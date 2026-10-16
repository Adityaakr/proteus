/**
 * End-to-end money loop against a running PROTEUS API and an Arc-compatible chain.
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

// 1. Negotiate
const neg = await api<{ id: string }>("/api/negotiations", { method: "POST", body: JSON.stringify({ sellerSlug: "northwind-support", productSlug: "order-support", buyerAddress: buyer.address }) });
const n1 = await api<{ offers: { candidateId: string; units: string; prepaidTotal: string; status: string; tierName: string }[]; turns: { content: string }[] }>(`/api/negotiations/${neg.id}/messages`, {
  method: "POST",
  body: JSON.stringify({ content: "We operate three online stores, handle roughly 8,000 support requests per month and use Zendesk. We want to automate order tracking and delivery questions, with a human handling refunds. Our budget is $1,500/month. What can you offer?" }),
});
log("agent:", n1.turns.at(-1)!.content.split("\n")[0]);
const starter = n1.offers.find((o) => o.units === "1500");
assert(starter && starter.status === "eligible", "expected an eligible 1,500-unit offer");
// Counter below the floor: must be rejected with an alternative
const growth = n1.offers.find((o) => o.units === "2000")!;
const c1 = await api<{ turns: { decision?: { decision: string } }[] }>(`/api/negotiations/${neg.id}/counter`, { method: "POST", body: JSON.stringify({ candidateId: growth.candidateId, targetTotal: "1500000000" }) });
assert(c1.turns.at(-1)!.decision?.decision === "rejected", "below-floor counter should be rejected");
log("counter $1,500 for 2,000 units: rejected by policy (expected)");

// 2. Quote + buyer signs Terms
const quote = await api<{ id: string; status: string }>(`/api/negotiations/${neg.id}/quotes`, { method: "POST", body: JSON.stringify({ candidateId: starter!.candidateId }) });
const q = await api<{ typedData: { message: Record<string, string> }; terms: Record<string, string> }>(`/api/quotes/${quote.id}?buyer=${buyer.address}`);
const terms = Object.fromEntries(Object.entries(q.terms).map(([k, v]) => [k, /^\d+$/.test(v) ? BigInt(v) : v])) as never;
const buyerSig = await buyer.signTypedData({ domain: domain(chainId, escrow), types: TERMS_TYPES, primaryType: "Terms", message: terms });
const localHash = hashTerms(chainId, escrow, terms);
const deal = await api<{ id: string; publicId: string; termsHash: string; dealIdOnchain: string; status: string }>(`/api/quotes/${quote.id}/accept`, { method: "POST", body: JSON.stringify({ buyerAddress: buyer.address, buyerSignature: buyerSig }) });
assert(deal.termsHash.toLowerCase() === localHash.toLowerCase(), "server terms hash must equal the hash the buyer signed");
log("deal", deal.id, "termsHash", deal.termsHash, "status", deal.status);

// 3. Approve USDC and fund via relayer
const prepaid = BigInt(q.terms.prepaid!);
const usdc = "0x3600000000000000000000000000000000000000" as Address;
const bal = (await pub.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [buyer.address] })) as bigint;
assert(bal >= prepaid, `buyer USDC balance ${bal} < prepaid ${prepaid}; fund ${buyer.address} at https://faucet.circle.com`);
const block = await pub.getBlock();
const base = block.baseFeePerGas ?? ARC_MIN_BASE_FEE_WEI;
const fees = { maxFeePerGas: (base < ARC_MIN_BASE_FEE_WEI ? ARC_MIN_BASE_FEE_WEI : base) * 2n, maxPriorityFeePerGas: 1_000_000_000n };
const approveTx = await wallet.writeContract({ address: usdc, abi: erc20, functionName: "approve", args: [escrow, prepaid], ...fees });
await pub.waitForTransactionReceipt({ hash: approveTx });
log("approve tx", approveTx);
const funded = await api<{ funding: { txHash: string } }>(`/api/deals/${deal.id}/funding-intent`, { method: "POST", body: JSON.stringify({}) });
log("fund tx (relayer)", funded.funding.txHash);
const active = await waitFor("deal active", async () => {
  const d = await api<{ status: string; service: { apiKey?: string; status: string }; balances: { deposit: string; source: string } }>(`/api/deals/${deal.id}`);
  return d.status === "active" && d.service.apiKey ? d : undefined;
});
assert(active.balances.source === "chain" && BigInt(active.balances.deposit) === prepaid, "deposit must be reconciled from chain");
const apiKey = active.service.apiKey!;
log("provisioned; deposit on chain", active.balances.deposit);

// 4. Use the service: delivered, handoff, not found, and a retry that must not double charge
const call = (requestId: string, input: Record<string, string>) => api<{ status: string; billable: boolean; deal: { cumulativeUnits: string; cumulativeCharged: string }; answer: string }>(`/api/services/order-support/execute`, { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ requestId, input }) });
const r1 = await call("req-" + Date.now() + "-1", { orderId: "A1001", question: "Where is my order?" });
assert(r1.status === "delivered" && r1.billable, "A1001 lookup should be delivered and billable");
const r2 = await call("req-" + Date.now() + "-2", { orderId: "A1002", question: "I want a refund for this order" });
assert(r2.status === "handoff" && !r2.billable, "refund question must hand off and not bill");
const r3 = await call("req-" + Date.now() + "-3", { orderId: "A9999", question: "status?" });
assert(r3.status === "failed" && !r3.billable, "unknown order must fail and not bill");
const r4id = "req-" + Date.now() + "-4";
const r4 = await call(r4id, { orderId: "A1004", question: "When does it arrive?" });
const r4b = await call(r4id, { orderId: "A1004", question: "When does it arrive?" });
assert(r4.deal.cumulativeUnits === "2" && r4b.deal.cumulativeUnits === "2", "retry with same requestId must not add units");
log("service: delivered 2, handoff 1, failed 1, retry deduped; charged", r4.deal.cumulativeCharged);

// 5. Buyer signs cumulative usage, relayer settles
const usage = await api<{ pendingAcceptance: { acceptance: Record<string, string>; typedData: { message: Record<string, string> } } }>(`/api/deals/${deal.id}/usage`);
const a = usage.pendingAcceptance.acceptance;
const acceptance = { dealId: BigInt(a.dealId!), termsHash: a.termsHash as Hex, cumulativeAmount: BigInt(a.cumulativeAmount!), cumulativeUnits: BigInt(a.cumulativeUnits!), receiptsRoot: a.receiptsRoot as Hex, nonce: BigInt(a.nonce!), expiry: BigInt(a.expiry!) };
const ackSig = await buyer.signTypedData({ domain: domain(chainId, escrow), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: acceptance });
const settled = await api<{ settlement: { txHash: string } }>(`/api/deals/${deal.id}/usage-acknowledgments`, { method: "POST", body: JSON.stringify({ buyerSignature: ackSig, cumulativeUnits: a.cumulativeUnits, cumulativeAmount: a.cumulativeAmount, receiptsRoot: a.receiptsRoot, nonce: a.nonce, expiry: a.expiry }) });
log("settle tx (relayer)", settled.settlement.txHash);
const afterSettle = await waitFor("settlement reconciled", async () => {
  const d = await api<{ balances: { settled: string } }>(`/api/deals/${deal.id}`);
  return BigInt(d.balances.settled) === acceptance.cumulativeAmount ? d : undefined;
});
log("settled on chain", afterSettle.balances.settled);

// 6. Seller closes the term early, buyer gets the unused balance back
await api("/api/app/session/sandbox", { method: "POST", seller: true });
const closed = await api<{ txHash: string }>(`/api/app/deals/${deal.id}/close-term`, { method: "POST", seller: true });
await pub.waitForTransactionReceipt({ hash: closed.txHash as Hex });
log("close-term tx (seller signer)", closed.txHash);
const refund = await api<{ status: string; txHash?: string }>(`/api/deals/${deal.id}/refund-request`, { method: "POST" });
assert(refund.status === "submitted", "refund should be submitted after seller closed the term");
log("refund tx (relayer)", refund.txHash);
const final = await waitFor("refund reconciled", async () => {
  const d = await api<{ status: string; balances: { deposit: string; settled: string; refunded: string; remaining: string } }>(`/api/deals/${deal.id}`);
  return d.status === "closed" ? d : undefined;
});
const b = final.balances;
assert(BigInt(b.deposit) === BigInt(b.settled) + BigInt(b.refunded) && BigInt(b.remaining) === 0n, "conservation: deposit = settled + refunded");
log("final balances", b);

const record = await api<{ timeline: { kind: string; txHash?: string }[] }>(`/api/review/${deal.publicId}`);
log("public record", `/records/${deal.publicId}`, record.timeline.map((t) => t.kind + (t.txHash ? ":" + t.txHash.slice(0, 10) : "")).join(" > "));
console.log("\nE2E OK");
