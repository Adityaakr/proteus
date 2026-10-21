#!/usr/bin/env tsx
/**
 * Proteus AI MCP server (stdio). Gives an AI agent (Claude, Cursor, any MCP client) tools to buy services from
 * businesses on Proteus AI: discover, negotiate within the seller's rules, verify the seller on Arc, sign and fund a
 * USDC escrow deal, call the service, and settle only for delivered units.
 *
 * Spending is bounded by a mandate the human sets: the agent cannot sign or fund a deal whose prepaid amount exceeds
 * PROTEUS_MAX_PREPAID_USDC, and it refuses to sign when the on-chain seller checks fail.
 *
 * Env:
 *   PROTEUS_API_URL            default https://ai.proteus.co.in (testnet); https://app.proteus.co.in for Arc mainnet
 *   PROTEUS_MAX_PREPAID_USDC   the mandate: largest prepaid per deal, in USDC (default 5)
 *   PROTEUS_BUYER_PRIVATE_KEY  optional. When set, the agent signs and funds itself (EOA). When absent, signing tools
 *                              return the EIP-712 typed data and the Circle CLI command for a Circle Agent Wallet.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { createPublicClient, createWalletClient, erc20Abi, getAddress, http, isAddressEqual, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACCEPTANCE_TYPES, AGENT_METADATA_KEYS, IDENTITY_REGISTRY_ABI, POLICY_REGISTRY_ABI, TERMS_TYPES, chainFor, domain, publicTermsHash } from "@proteus/domain";

const API = (process.env.PROTEUS_API_URL ?? "https://ai.proteus.co.in").replace(/\/+$/, "");
const MAX_PREPAID = BigInt(Math.round(Number(process.env.PROTEUS_MAX_PREPAID_USDC ?? "5") * 1_000_000));
const buyer = process.env.PROTEUS_BUYER_PRIVATE_KEY ? privateKeyToAccount(process.env.PROTEUS_BUYER_PRIVATE_KEY as Hex) : null;
const usd = (micro: bigint | string) => `$${(Number(micro) / 1e6).toFixed(2)}`;

type Health = { chainId: number; escrowAddress: Address | null; usdcAddress: Address; network: string };
let health: Health | null = null;
async function net() {
  health ??= (await get<Health>("/api/health")) as Health;
  const chain = chainFor(health.chainId);
  return { ...health, chain, pub: createPublicClient({ chain, transport: http() }) };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error ?? `${r.status} ${path}`);
  return body as T;
}
async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...headers }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((out as { error?: string }).error ?? `${r.status} ${path}`);
  return out as T;
}
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const big = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) && !["usdc", "buyer", "seller", "payee"].includes(k) ? BigInt(v) : v]));

/** Service API keys returned at provisioning, kept in this process only (never written to disk or logs). */
const keys = new Map<string, { key: string; product: string }>();

const server = new McpServer({ name: "proteus-ai", version: "0.1.0" });

server.registerTool(
  "proteus_list_services",
  { description: "List every service on the Proteus AI market: seller, unit, starting prepaid price, per-call price. Start here.", inputSchema: z.object({}) },
  async () => text(await get("/api/market")),
);

server.registerTool(
  "proteus_get_service",
  {
    description: "Full details for one service: tiers with unit prices, term, refund policy, request fields, and whether the seller is registered on Arc (ERC-8004).",
    inputSchema: z.object({ seller: z.string().describe("seller slug"), product: z.string().describe("product slug") }),
  },
  async ({ seller, product }) => {
    const [p, s] = await Promise.all([get(`/api/public/sellers/${seller}/products/${product}`), get<{ agent?: unknown; stats?: unknown }>(`/api/public/sellers/${seller}`)]);
    return text({ product: p, sellerAgentOnArc: s.agent ?? null, trackRecord: s.stats ?? null });
  },
);

server.registerTool(
  "proteus_negotiate",
  {
    description:
      "Talk to the seller's deal agent. State volume and budget plainly. Returns the agent's reply and the current offers (each with candidateId, units, prepaidTotal, status). Offers come from the seller's rules in code; the agent cannot quote below the seller's floor. Omit negotiationId to start a new negotiation.",
    inputSchema: z.object({ seller: z.string(), product: z.string(), message: z.string().min(1).max(4000), negotiationId: z.string().optional() }),
  },
  async ({ seller, product, message, negotiationId }) => {
    const id = negotiationId ?? (await post<{ id: string }>("/api/negotiations", { sellerSlug: seller, productSlug: product, buyerAddress: buyer?.address })).id;
    const n = await post<{ turns: { role: string; content: string }[]; offers: { candidateId: string; tierName: string; units: string; prepaidTotal: string; prepaidTotalUsd: string; status: string }[] }>(`/api/negotiations/${id}/messages`, { content: message });
    const reply = [...n.turns].reverse().find((t) => t.role === "agent")?.content ?? "";
    return text({
      negotiationId: id,
      reply,
      offers: n.offers.map((o) => ({ candidateId: o.candidateId, tier: o.tierName, units: o.units, prepaid: o.prepaidTotalUsd, status: o.status, withinMandate: BigInt(o.prepaidTotal) <= MAX_PREPAID })),
      mandate: usd(MAX_PREPAID),
    });
  },
);

type QuoteView = { id: string; status: string; terms: Record<string, string> | null; publicTerms: Record<string, unknown>; typedData: { message: Record<string, string> } | null };

/** The on-chain checks a buyer agent runs before signing (also in the platform SKILL.md). */
async function verifySeller(q: QuoteView) {
  const { pub, chainId } = await net();
  const pt = q.publicTerms as { sellerAgent?: { agentRegistry: string; agentId: string } | null; policy?: { version: number; commitment: Hex; registry: string } };
  const checks: { check: string; ok: boolean; detail: string }[] = [];
  const hashOk = q.terms ? publicTermsHash(q.publicTerms) === (q.terms.publicTermsHash as Hex) : false;
  checks.push({ check: "publicTermsHash matches the public terms", ok: hashOk, detail: q.terms?.publicTermsHash ?? "no terms" });
  if (!pt.sellerAgent) {
    checks.push({ check: "seller registered on Arc (ERC-8004)", ok: false, detail: "not registered: identity and policy cannot be checked on chain (not fatal)" });
    return { ok: hashOk, onChain: false, checks };
  }
  const [, cid, identity] = pt.sellerAgent.agentRegistry.split(":");
  if (Number(cid) !== chainId) checks.push({ check: "agent registry is on this chain", ok: false, detail: pt.sellerAgent.agentRegistry });
  const agentId = BigInt(pt.sellerAgent.agentId);
  const meta = async (key: string) => {
    const v = (await pub.readContract({ address: identity as Address, abi: IDENTITY_REGISTRY_ABI, functionName: "getMetadata", args: [agentId, key] })) as Hex;
    return v.length === 42 ? getAddress(v) : null;
  };
  const [signer, payee] = await Promise.all([meta(AGENT_METADATA_KEYS.signer), meta(AGENT_METADATA_KEYS.payee)]);
  checks.push({ check: "on-chain proteus.signer == Terms.seller", ok: Boolean(signer && q.terms && isAddressEqual(signer, q.terms.seller as Address)), detail: `${signer} vs ${q.terms?.seller}` });
  checks.push({ check: "on-chain proteus.payee == Terms.payee", ok: Boolean(payee && q.terms && isAddressEqual(payee, q.terms.payee as Address)), detail: `${payee} vs ${q.terms?.payee}` });
  if (pt.policy) {
    const [, , registry] = pt.policy.registry.split(":");
    const productId = q.terms?.productId as Hex;
    const c = (await pub.readContract({ address: registry as Address, abi: POLICY_REGISTRY_ABI, functionName: "policyOf", args: [agentId, productId, BigInt(pt.policy.version)] })) as { commitment: Hex };
    checks.push({ check: `policy v${pt.policy.version} commitment is on ProteusPolicyRegistry`, ok: c.commitment === pt.policy.commitment, detail: c.commitment });
  }
  return { ok: checks.every((c) => c.ok), onChain: true, checks };
}

server.registerTool(
  "proteus_verify_seller",
  { description: "Run the on-chain checks for a quote before signing: publicTermsHash, the seller's ERC-8004 signer and payee on Arc, and the policy commitment on ProteusPolicyRegistry.", inputSchema: z.object({ quoteId: z.string() }) },
  async ({ quoteId }) => text(await verifySeller(await get<QuoteView>(`/api/quotes/${quoteId}${buyer ? `?buyer=${buyer.address}` : ""}`))),
);

server.registerTool(
  "proteus_accept_offer",
  {
    description:
      "Turn an offer into signed terms. Creates the quote, enforces the mandate, verifies the seller on Arc, then signs the EIP-712 Terms with the buyer key and returns the deal. Without a buyer key it returns the typed data and the Circle CLI command to sign it with a Circle Agent Wallet.",
    inputSchema: z.object({ negotiationId: z.string(), candidateId: z.string(), buyerAddress: z.string().optional().describe("required when no buyer key is configured (e.g. a Circle Agent Wallet address)") }),
  },
  async ({ negotiationId, candidateId, buyerAddress }) => {
    const { chainId, escrowAddress } = await net();
    const who = (buyer?.address ?? buyerAddress) as Address | undefined;
    if (!who) throw new Error("Set PROTEUS_BUYER_PRIVATE_KEY or pass buyerAddress.");
    const created = await post<{ id: string; status: string }>(`/api/negotiations/${negotiationId}/quotes`, { candidateId });
    if (created.status === "approval_required") return text({ quoteId: created.id, status: "approval_required", next: "The seller must approve this offer; call proteus_verify_seller later or pick a smaller offer." });
    const q = await get<QuoteView>(`/api/quotes/${created.id}?buyer=${who}`);
    if (!q.terms || !q.typedData || !escrowAddress) throw new Error("quote has no signable terms yet");
    const prepaid = BigInt(q.terms.prepaid ?? "0");
    if (prepaid > MAX_PREPAID) throw new Error(`Refused: prepaid ${usd(prepaid)} exceeds the mandate ${usd(MAX_PREPAID)}.`);
    const v = await verifySeller(q);
    if (!v.ok && v.onChain) throw new Error(`Refused: on-chain seller checks failed: ${JSON.stringify(v.checks.filter((c) => !c.ok))}`);
    const message = big(q.typedData.message);
    if (!buyer) {
      const typed = { domain: domain(chainId, escrowAddress), types: TERMS_TYPES, primaryType: "Terms", message: q.typedData.message };
      return text({
        quoteId: q.id,
        prepaid: usd(prepaid),
        verification: v,
        sign: `circle wallet sign typed-data '${JSON.stringify(typed)}' --address ${who} --chain ${chainId === 5042 ? "ARC" : "ARC-TESTNET"}`,
        then: `POST ${API}/api/quotes/${q.id}/accept {"buyerAddress":"${who}","buyerSignature":"<signature>"}`,
      });
    }
    const signature = await buyer.signTypedData({ domain: domain(chainId, escrowAddress), types: TERMS_TYPES, primaryType: "Terms", message: message as never });
    const deal = await post<{ id: string; status: string; termsHash: string }>(`/api/quotes/${q.id}/accept`, { buyerAddress: buyer.address, buyerSignature: signature });
    return text({ dealId: deal.id, status: deal.status, prepaid: usd(prepaid), termsHash: deal.termsHash, verification: v, next: "proteus_fund_deal" });
  },
);

server.registerTool(
  "proteus_fund_deal",
  { description: "Fund a signed deal: approve USDC for the escrow (the only transaction the buyer sends) and let the relayer submit createAndFundDeal. Waits until funded and keeps the service API key in memory.", inputSchema: z.object({ dealId: z.string() }) },
  async ({ dealId }) => {
    if (!buyer) throw new Error("Funding needs PROTEUS_BUYER_PRIVATE_KEY, or approve with: circle wallet execute \"approve(address,uint256)\" <escrow> <prepaid> --contract <usdc> --address <wallet> --chain ARC-TESTNET, then POST /api/deals/{id}/funding-intent {}.");
    const { chain, pub, escrowAddress, usdcAddress } = await net();
    const d = await get<{ terms: { prepaid: string; buyer: string }; status: string }>(`/api/deals/${dealId}`);
    const prepaid = BigInt(d.terms.prepaid);
    if (prepaid > MAX_PREPAID) throw new Error(`Refused: prepaid ${usd(prepaid)} exceeds the mandate ${usd(MAX_PREPAID)}.`);
    const wallet = createWalletClient({ account: buyer, chain, transport: http() });
    const approve = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [escrowAddress!, prepaid] });
    await pub.waitForTransactionReceipt({ hash: approve });
    const f = await post<{ funding?: { txHash?: string } }>(`/api/deals/${dealId}/funding-intent`, {});
    for (let i = 0; i < 40; i++) {
      const s = await get<{ status: string; service: { status: string; apiKey?: string }; product?: { slug: string }; productSlug?: string }>(`/api/deals/${dealId}`);
      if (s.service.apiKey) keys.set(dealId, { key: s.service.apiKey, product: s.productSlug ?? s.product?.slug ?? "" });
      if (["funded", "active"].includes(s.status) && s.service.status === "provisioned") return text({ dealId, status: s.status, approveTx: approve, fundTx: f.funding?.txHash, serviceKey: keys.has(dealId) ? "held in memory" : "missed; rotate with a wallet signature" });
      await new Promise((r) => setTimeout(r, 3000));
    }
    return text({ dealId, approveTx: approve, fundTx: f.funding?.txHash, status: "funding submitted; check proteus_deal_status" });
  },
);

server.registerTool(
  "proteus_call_service",
  { description: "Call the funded service. Only status 'delivered' is billed; requestId is idempotent (reuse it to retry safely).", inputSchema: z.object({ dealId: z.string(), product: z.string(), requestId: z.string().min(4).max(80), input: z.record(z.string(), z.unknown()) }) },
  async ({ dealId, product, requestId, input }) => {
    const k = keys.get(dealId);
    if (!k) throw new Error("No service key for this deal in this session (keys are shown once at provisioning).");
    const r = await fetch(`${API}/api/services/${product}/execute`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${k.key}` }, body: JSON.stringify({ requestId, input }) });
    return text(await r.json());
  },
);

server.registerTool(
  "proteus_settle_usage",
  { description: "Pay the seller for delivered units: checks the pending cumulative usage against the receipts and the unit price, signs the EIP-712 Acceptance, and the relayer settles from escrow. No gas for the buyer.", inputSchema: z.object({ dealId: z.string() }) },
  async ({ dealId }) => {
    const { chainId, escrowAddress } = await net();
    const u = await get<{ pendingAcceptance: { acceptance: Record<string, string> } | null; receipts: { billable: boolean }[] }>(`/api/deals/${dealId}/usage`);
    if (!u.pendingAcceptance) return text({ dealId, status: "nothing to settle" });
    const d = await get<{ terms: { unitNum: string; unitDen: string } }>(`/api/deals/${dealId}`);
    const a = big(u.pendingAcceptance.acceptance) as Record<string, bigint | Hex>;
    const expected = ((a.cumulativeUnits as bigint) * BigInt(d.terms.unitNum) + BigInt(d.terms.unitDen) - 1n) / BigInt(d.terms.unitDen);
    if ((a.cumulativeAmount as bigint) > expected) throw new Error(`Refused: cumulative amount ${a.cumulativeAmount} exceeds units x price (${expected}).`);
    if (!buyer) return text({ sign: { domain: domain(chainId, escrowAddress!), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: u.pendingAcceptance.acceptance } });
    const signature = await buyer.signTypedData({ domain: domain(chainId, escrowAddress!), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: a as never });
    const r = await post(`/api/deals/${dealId}/usage-acknowledgments`, { buyerSignature: signature, cumulativeUnits: String(a.cumulativeUnits), cumulativeAmount: String(a.cumulativeAmount), receiptsRoot: a.receiptsRoot, nonce: String(a.nonce), expiry: String(a.expiry) });
    return text(r);
  },
);

server.registerTool(
  "proteus_deal_status",
  { description: "A deal's status and balances read from the escrow on Arc (deposit, used, settled, remaining) with explorer links.", inputSchema: z.object({ dealId: z.string() }) },
  async ({ dealId }) => text(await get(`/api/deals/${dealId}`)),
);

await server.connect(new StdioServerTransport());
