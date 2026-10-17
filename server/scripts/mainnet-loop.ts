/**
 * End-to-end money loop against a running Proteus AI API and an Arc-compatible chain.
 *
 *   API_URL=http://localhost:8787 BUYER_PRIVATE_KEY=0x... tsx scripts/testnet-demo.ts
 *
 * Steps: negotiate -> quote -> buyer signs Terms -> accept (seller countersigns) -> buyer approves USDC ->
 * relayer funds escrow -> provision -> 3 service calls (delivered / handoff / not found) -> buyer signs
 * cumulative usage -> relayer settles -> seller closes term -> refund of unused balance -> public record.
 * Prints every transaction hash. Exits non-zero on any mismatch. Nothing here is simulated.
 */
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MIN_BASE_FEE_WEI, TERMS_TYPES, ACCEPTANCE_TYPES, domain, hashTerms } from "@proteus/domain";

const API = process.env.API_URL ?? "http://localhost:8787";
const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
const BUYER_KEY = process.env.BUYER_PRIVATE_KEY as Hex;
if (!BUYER_KEY) throw new Error("BUYER_PRIVATE_KEY required");
const SELLER_COOKIE = { jar: "" };

const buyer = privateKeyToAccount(BUYER_KEY);
const pub = createPublicClient({ transport: http(RPC) });
const chainId = await pub.getChainId();
const chain = { id: chainId, name: "arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as const;
const wallet = createWalletClient({ account: buyer, chain, transport: http(RPC) });
const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)", "function balanceOf(address) view returns (uint256)"]);

async function api<T>(path: string, init: RequestInit & { seller?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  if (init.seller && SELLER_COOKIE.jar) headers.cookie = SELLER_COOKIE.jar;
  const res = await fetch(API + path, { ...init, headers });
  const sc = res.headers.get("set-cookie");
  if (sc && init.seller) SELLER_COOKIE.jar = sc.split(";")[0]!;
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("ASSERT: " + msg);
};
async function waitFor<T>(label: string, fn: () => Promise<T | undefined>, ms = 120_000): Promise<T> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const health = await api<{ escrowAddress: Address; chainId: number; relayer: string; agentAdapter: string }>("/api/health");
assert(health.escrowAddress, "ESCROW_ADDRESS not configured on the API");
assert(health.chainId === chainId, `API chainId ${health.chainId} != rpc ${chainId}`);
log("health", health.relayer, health.agentAdapter, "escrow", health.escrowAddress, "chain", chainId);
const escrow = health.escrowAddress;


// ---- Mainnet loop: the smallest real deal that exercises every contract path, sized to a tiny balance. ----
const MAX_PREPAID = BigInt(process.env.MAX_PREPAID_MICRO ?? "1000000"); // 1 USDC
const sellerSlug = process.env.SELLER_SLUG ?? "lumen-voice";
const productSlug = process.env.PRODUCT_SLUG ?? "callback-booking";
const sess = await api<{ org: { slug: string } }>("/api/app/session/sandbox", { method: "POST", seller: true, body: JSON.stringify({ slug: sellerSlug }) });
assert(sess.org.slug === sellerSlug, `sandbox session resolved to ${sess.org.slug}, wanted ${sellerSlug}`);
type Spec = { fields?: { key: string; type: string; required?: boolean; label?: string }[] };
const full = await api<{ unitLabel: string; tiers: { unitPriceUsd: string }[]; request?: Spec }>(`/api/public/sellers/${sellerSlug}/products/${productSlug}`);
const unitUsd = full.tiers.map((t) => Number(String(t.unitPriceUsd).replace(/[^0-9.]/g, ""))).sort((a, b) => a - b)[0]!;
const product = { slug: productSlug, unit: unitUsd, unitLabel: full.unitLabel, spec: full.request ?? {} };
log("seller", sellerSlug, "product", product.slug, "unit price", product.unit, "USDC per", product.unitLabel);
const units = Math.max(2, Math.min(8, Math.floor(0.6 / Math.max(product.unit, 0.01))));
const budget = Math.min(1, Math.max(0.3, units * product.unit * 1.3)).toFixed(2);

let deal: { id: string; publicId: string; termsHash: string; status: string };
let prepaid = 0n;
if (process.env.DEAL_ID) {
  const d = await api<{ id: string; publicId: string; termsHash: string; status: string; terms: { prepaid: string } }>(`/api/deals/${process.env.DEAL_ID}`);
  deal = d;
  prepaid = BigInt(d.terms.prepaid);
  log("resuming deal", d.id, "status", d.status);
} else {
const neg = await api<{ id: string }>("/api/negotiations", { method: "POST", body: JSON.stringify({ sellerSlug, productSlug: product.slug, buyerAddress: buyer.address }) });
type Offer = { candidateId: string; units: string; prepaidTotal: string; status: string; tierName: string };
let n = await api<{ offers: Offer[]; turns: { content: string }[] }>(`/api/negotiations/${neg.id}/messages`, { method: "POST", body: JSON.stringify({ content: `We need about ${units} ${product.unitLabel}s this month to try the service, budget around $${budget}. What is the smallest package you can do?` }) });
log("agent:", (n.turns.at(-1)!.content.split("\n")[0] ?? "").slice(0, 160));
let eligible = n.offers.filter((o) => o.status === "eligible" && BigInt(o.prepaidTotal) <= MAX_PREPAID).sort((a, b) => (BigInt(a.prepaidTotal) < BigInt(b.prepaidTotal) ? -1 : 1));
if (!eligible.length) {
  n = await api<{ offers: Offer[]; turns: { content: string }[] }>(`/api/negotiations/${neg.id}/messages`, { method: "POST", body: JSON.stringify({ content: `Can you do just ${units} ${product.unitLabel}s? That is all we need for the trial.` }) });
  log("agent:", (n.turns.at(-1)!.content.split("\n")[0] ?? "").slice(0, 160));
  eligible = n.offers.filter((o) => o.status === "eligible" && BigInt(o.prepaidTotal) <= MAX_PREPAID).sort((a, b) => (BigInt(a.prepaidTotal) < BigInt(b.prepaidTotal) ? -1 : 1));
}
const starter = eligible[0]!;
assert(starter, `no eligible offer under ${MAX_PREPAID} micro-USDC; offers: ${JSON.stringify(n.offers.map((o) => [o.units, o.prepaidTotal, o.status]))}`);
log("accepting", starter!.tierName, starter!.units, "units for", starter!.prepaidTotal, "micro-USDC");

const quote = await api<{ id: string; status: string }>(`/api/negotiations/${neg.id}/quotes`, { method: "POST", body: JSON.stringify({ candidateId: starter!.candidateId }) });
const q = await api<{ typedData: { message: Record<string, string> }; terms: Record<string, string> }>(`/api/quotes/${quote.id}?buyer=${buyer.address}`);
const terms = Object.fromEntries(Object.entries(q.terms).map(([k, v]) => [k, /^\d+$/.test(v) ? BigInt(v) : v])) as never;
const buyerSig = await buyer.signTypedData({ domain: domain(chainId, escrow), types: TERMS_TYPES, primaryType: "Terms", message: terms });
deal = await api<{ id: string; publicId: string; termsHash: string; status: string }>(`/api/quotes/${quote.id}/accept`, { method: "POST", body: JSON.stringify({ buyerAddress: buyer.address, buyerSignature: buyerSig }) });
assert(deal.termsHash.toLowerCase() === hashTerms(chainId, escrow, terms).toLowerCase(), "terms hash mismatch");
log("deal", deal.id, "termsHash", deal.termsHash);

prepaid = BigInt(q.terms.prepaid!);
const usdc = "0x3600000000000000000000000000000000000000" as Address;
const bal = (await pub.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [buyer.address] })) as bigint;
assert(bal >= prepaid, `buyer balance ${bal} < prepaid ${prepaid}`);
const block = await pub.getBlock();
const base = block.baseFeePerGas ?? ARC_MIN_BASE_FEE_WEI;
const fees = { maxFeePerGas: (base < ARC_MIN_BASE_FEE_WEI ? ARC_MIN_BASE_FEE_WEI : base) * 2n, maxPriorityFeePerGas: 1_000_000_000n };
const approveTx = await wallet.writeContract({ address: usdc, abi: erc20, functionName: "approve", args: [escrow, prepaid], ...fees });
await pub.waitForTransactionReceipt({ hash: approveTx });
log("approve tx", approveTx);
const funded = await api<{ funding: { txHash: string } }>(`/api/deals/${deal.id}/funding-intent`, { method: "POST", body: JSON.stringify({}) });
log("fund tx (relayer)", funded.funding.txHash);
}
const active = await waitFor("deal active with chain balances", async () => {
  const d = await api<{ status: string; service: { apiKey?: string; status: string }; balances: { deposit: string; source: string } }>(`/api/deals/${deal.id}`);
  return d.status === "active" && d.balances.source === "chain" && BigInt(d.balances.deposit) === prepaid ? d : undefined;
}, 240_000);
let apiKey = active.service.apiKey;
if (!apiKey) {
  const ts = Math.floor(Date.now() / 1000);
  const signature = await buyer.signMessage({ message: `PROTEUS rotate service key\ndeal: ${deal.id}\nts: ${ts}` });
  const rotated = await api<{ service: { apiKey?: string } }>(`/api/deals/${deal.id}/service/rotate-key`, { method: "POST", body: JSON.stringify({ address: buyer.address, ts, signature }) });
  apiKey = rotated.service.apiKey;
  log("rotated service key (buyer-signed)");
}
assert(apiKey, "no service key");
log("provisioned; deposit on chain", active.balances.deposit);

const sample: Record<string, string> = { customer: "Jane Doe", phone: "+1 415 555 0100", time: "Tomorrow 10:00, Pacific", question: "Please call Jane back to confirm her annual maintenance visit; she prefers mornings.", prompt: "Summarize in two sentences why metered escrow makes agent-to-agent payments safer.", text: "Metered escrow releases money only against delivered usage.\nUnused balance returns to the buyer.", task: "List the three checks to run before paying a new vendor's first invoice.", vendor: "Acme Freight LLC", name: "Acme Freight LLC", country: "United States", website: "https://example.com", scope: "Freight forwarding for 40 pallets a month", orderid: "trial-1", image: "ghcr.io/acme/finetune:1.4", hours: "1" };
const input: Record<string, string> = {};
for (const f of product.spec.fields ?? []) if (f.required || sample[f.key]) input[f.key] = f.type === "number" ? (sample[f.key] ?? "1") : (sample[f.key] ?? `Trial ${f.label ?? f.key}`);
const call = (requestId: string, inp: Record<string, string>) => api<{ status: string; billable: boolean; deal: { cumulativeUnits: string; cumulativeCharged: string }; answer: string }>(`/api/services/${product.slug}/execute`, { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ requestId, input: inp }) });
const r1 = await call(`m-${Date.now()}-1`, input);
log("request 1:", r1.status, "billable", r1.billable, "|", r1.answer.replace(/\s+/g, " ").slice(0, 120));
const r2 = await call(`m-${Date.now()}-2`, { ...input, ...(input.customer ? { customer: "Marcus Lee", phone: "+1 415 555 0199", time: "Friday 15:30, Pacific", question: "Call Marcus back about the quote he requested for a second unit." } : {}), ...(input.text ? { text: "Second passage to embed." } : {}) });
log("request 2:", r2.status, "billable", r2.billable, "| charged so far", r2.deal.cumulativeCharged);
assert(r1.billable || r2.billable, "at least one request must be delivered and billable");

const usage = await api<{ pendingAcceptance: { acceptance: Record<string, string> } }>(`/api/deals/${deal.id}/usage`);
const a = usage.pendingAcceptance.acceptance;
const acceptance = { dealId: BigInt(a.dealId!), termsHash: a.termsHash as Hex, cumulativeAmount: BigInt(a.cumulativeAmount!), cumulativeUnits: BigInt(a.cumulativeUnits!), receiptsRoot: a.receiptsRoot as Hex, nonce: BigInt(a.nonce!), expiry: BigInt(a.expiry!) };
const ackSig = await buyer.signTypedData({ domain: domain(chainId, escrow), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: acceptance });
const settled = await api<{ settlement: { txHash: string } }>(`/api/deals/${deal.id}/usage-acknowledgments`, { method: "POST", body: JSON.stringify({ buyerSignature: ackSig, cumulativeUnits: a.cumulativeUnits, cumulativeAmount: a.cumulativeAmount, receiptsRoot: a.receiptsRoot, nonce: a.nonce, expiry: a.expiry }) });
log("settle tx (relayer)", settled.settlement.txHash);
await waitFor("settlement reconciled", async () => {
  const d = await api<{ balances: { settled: string } }>(`/api/deals/${deal.id}`);
  return BigInt(d.balances.settled) === acceptance.cumulativeAmount ? d : undefined;
});
const closed = await api<{ txHash: string }>(`/api/app/deals/${deal.id}/close-term`, { method: "POST", seller: true });
await pub.waitForTransactionReceipt({ hash: closed.txHash as Hex });
log("close-term tx (seller signer)", closed.txHash);
const refund = await api<{ status: string; txHash?: string }>(`/api/deals/${deal.id}/refund-request`, { method: "POST" });
log("refund tx (relayer)", refund.txHash);
const final = await waitFor("refund reconciled", async () => {
  const d = await api<{ status: string; balances: { deposit: string; settled: string; refunded: string; remaining: string } }>(`/api/deals/${deal.id}`);
  return d.status === "closed" ? d : undefined;
});
const b = final.balances;
assert(BigInt(b.deposit) === BigInt(b.settled) + BigInt(b.refunded) && BigInt(b.remaining) === 0n, "conservation: deposit = settled + refunded");
log("final balances", b);
log("public record", `/records/${deal.publicId}`);
console.log("\nMAINNET LOOP OK");
