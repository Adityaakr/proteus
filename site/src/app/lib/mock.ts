/**
 * In-browser mock of docs/api.md for VITE_MOCK=1. Uses the real deterministic pricing engine from
 * @proteus/domain so offers, counters and approvals behave like the server. It never invents
 * transaction hashes: anything that would need a chain transaction is either skipped or labeled.
 */
import {
  ACCEPTANCE_TYPES,
  TERMS_TYPES,
  cumulativeCharge,
  domain,
  evaluateCounteroffer,
  formatUsd,
  fromMicro,
  getQuoteCandidates,
  hashTerms,
  mulDivFloor,
  productIdHash,
  publicTermsHash,
  receiptsRoot,
  toMicro,
  toPublicCandidate,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC,
  type Candidate,
  type CostModel,
  type Policy,
  type Product,
  type Requirements,
} from "@proteus/domain";
import { keccak256, toHex, type Address, type Hex } from "viem";
import { ApiError } from "./api";
import type * as T from "./types";

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

const SELLER_SLUG = "northwind";
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const ESCROW = ((import.meta.env.VITE_ESCROW_ADDRESS as string | undefined) ?? "0x000000000000000000000000000000000000e5c0") as Address;
const SELLER_ADDR = "0x00000000000000000000000000000000005e11e7" as Address;
const PLACEHOLDER_SIG = ("0x" + "00".repeat(65)) as Hex;

const product: Product = {
  id: "p_support",
  slug: "order-support",
  name: "AI order support",
  billableUnit: "a supported order-status answer acknowledged by the buyer",
  unitLabel: "resolution",
  supportedIntegrations: ["rest-api", "webhook"],
  capabilities: ["Order status lookup", "Delivery questions", "Human handoff"],
  tiers: [
    { id: "starter", name: "Starter", includedUnits: 1500n, unitPrice: { num: 960_000n, den: 1n }, includes: ["Order status", "Delivery questions", "Human handoff"] },
    { id: "growth", name: "Growth", includedUnits: 2000n, unitPrice: { num: 850_000n, den: 1n }, includes: ["Order status", "Delivery questions", "Human handoff", "Priority support"] },
  ],
  maxUnitsPerDeal: 10_000n,
  termDays: 30,
  refundPolicy: "Unused prepaid balance is refundable after the term ends plus a 3-day grace window.",
};
const starters = [
  "We handle about 2,000 order questions a month and use Zendesk. Budget is around $1,500.",
  "What does one billable resolution include?",
  "Can you do 1,500 resolutions for 30 days through your REST API?",
];

let cost: CostModel = { version: 1, variableCostPerUnit: 520_000n, directCostPerDeal: 20_000_000n, txCostBps: 50n, freshUntil: Date.now() + 30 * 86_400_000 };
let policy: Policy = { version: 1, minMarginBps: 3500n, maxDiscountBps: 1500n, approvalThreshold: toMicro("2500"), prepaidMinimum: toMicro("200"), availableCapacityUnits: 6000n, quoteTtlSeconds: 3600, allowNonPositiveContribution: false };
const ctx = () => ({ product, cost, policy, now: Date.now() });

/* ------------------------------------------------------------------ */
/* Store (sessionStorage so reloads keep the flow)                     */
/* ------------------------------------------------------------------ */

interface NegRec {
  neg: T.Negotiation;
  req: Requirements;
  candidates: Record<string, Candidate>;
  decisions: T.DecisionLog[];
  runs: T.AgentRun[];
  createdAt: string;
}
interface QuoteRec {
  quote: T.Quote;
  candidate: Candidate;
  approveAt?: number;
}
interface DealRec {
  deal: T.Deal;
  quoteId: string;
  negotiationId: string;
  unitPrice: { num: bigint; den: bigint };
  fundingReadyAt?: number;
  apiKey?: string;
  apiKeyShown?: boolean;
  receipts: T.Receipt[];
  executions: Record<string, T.ExecuteResponse>;
  ackedUnits: string;
  ackNonce: number;
  timeline: T.ReviewRecord["timeline"];
  createdAt: string;
}
interface Store {
  negs: Record<string, NegRec>;
  quotes: Record<string, QuoteRec>;
  deals: Record<string, DealRec>;
  approvals: Record<string, T.Approval>;
  session: boolean;
  /** v1 account mock: undefined = not initialised yet, null = no seller org. */
  org?: T.MeOrg | null;
  /** Mock wallet balance in micro-USDC. */
  walletUsdc?: string;
  ppcCalls?: number;
  signerCreatedAt?: string;
  signerRevokedAt?: string;
}

const KEY = "proteus:mock:v1";
const reviver = (_k: string, v: unknown) => (typeof v === "string" && v.startsWith("$big:") ? BigInt(v.slice(5)) : v);
const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? `$big:${v.toString()}` : v);

function load(): Store {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw, reviver) as Store;
  } catch {
    /* ignore */
  }
  return { negs: {}, quotes: {}, deals: {}, approvals: {}, session: false };
}
let store: Store = load();
function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store, replacer));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v)) as V;

function usdFromUnitPrice(p: { num: bigint; den: bigint }): string {
  // micro per unit with 4 decimal places of a cent precision: show up to 4 decimals of USD
  const microTimes100 = mulDivFloor(100n, p.num, p.den); // micro * 100
  const s = fromMicro(microTimes100 / 100n);
  const [w, f = ""] = s.split(".");
  const trimmed = f.replace(/0+$/, "");
  return `${w}.${(trimmed + "00").slice(0, Math.max(2, Math.min(4, trimmed.length)))}`;
}

function wireOffer(c: Candidate): T.Offer {
  const pc = toPublicCandidate(c);
  return {
    candidateId: pc.candidateId,
    tierId: pc.tierId,
    tierName: pc.tierName,
    units: pc.units.toString(),
    unitPrice: { num: pc.unitPrice.num.toString(), den: pc.unitPrice.den.toString() },
    prepaidTotal: pc.prepaidTotal.toString(),
    overagePrice: pc.overagePrice ? { num: pc.overagePrice.num.toString(), den: pc.overagePrice.den.toString() } : undefined,
    includes: pc.includes,
    supportedIntegrations: pc.supportedIntegrations,
    unsupportedIntegrations: pc.unsupportedIntegrations,
    status: pc.status,
    origin: pc.origin,
    origins: pc.origins,
    publicReasons: pc.publicReasons,
    unitPriceUsd: usdFromUnitPrice(pc.unitPrice),
    prepaidTotalUsd: fromMicro(pc.prepaidTotal).slice(0, -4),
    overagePriceUsd: pc.overagePrice ? usdFromUnitPrice(pc.overagePrice) : undefined,
  };
}

function econWire(c: Candidate): T.EconomicsWire {
  const e = c.economics;
  return {
    expectedRevenue: e.expectedRevenue.toString(),
    expectedVariableCost: e.expectedVariableCost.toString(),
    expectedTxCost: e.expectedTxCost.toString(),
    allocatedDirectCost: e.allocatedDirectCost.toString(),
    expectedContribution: e.expectedContribution.toString(),
    expectedContributionMarginBps: e.expectedContributionMarginBps.toString(),
    discountBps: e.discountBps.toString(),
  };
}

function withEconomics(c: Candidate): T.CandidateWithEconomics {
  return { ...wireOffer(c), rules: [...c.rules], economics: econWire(c) };
}

function publicProduct(): T.PublicProduct {
  return {
    slug: product.slug,
    name: product.name,
    billableUnit: product.billableUnit,
    unitLabel: product.unitLabel,
    capabilities: product.capabilities,
    supportedIntegrations: product.supportedIntegrations,
    tiers: product.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      includedUnits: t.includedUnits.toString(),
      unitPriceUsd: usdFromUnitPrice(t.unitPrice),
      prepaidTotalUsd: fromMicro(mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den)).slice(0, -4),
      includes: t.includes,
    })),
    termDays: product.termDays,
    refundPolicy: product.refundPolicy,
    starters,
    network: "illustrative",
  };
}

const INTEGRATION_WORDS: [RegExp, string][] = [
  [/zendesk/i, "zendesk"],
  [/shopify/i, "shopify"],
  [/gorgias/i, "gorgias"],
  [/intercom/i, "intercom"],
  [/salesforce/i, "salesforce"],
  [/\brest\b|\bapi\b/i, "rest-api"],
  [/webhook/i, "webhook"],
];

function parseRequirements(text: string, prev: Requirements): Requirements {
  const next: Requirements = { ...prev, integrations: [...prev.integrations], notes: [...prev.notes], openQuestions: [] };
  const money = text.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?/i);
  if (money) {
    const base = money[1]!.replace(/,/g, "");
    next.budget = money[2] ? toMicro(base) * 1000n : toMicro(base);
  }
  const stripped = money ? text.replace(money[0], " ") : text;
  const units = stripped.match(/(\d[\d,]*)\s*(k)?\s*(resolutions?|units?|tickets?|answers?|questions?|requests?|conversations?|orders?|order questions)/i);
  if (units) {
    const n = BigInt(units[1]!.replace(/,/g, ""));
    next.desiredUnits = units[2] ? n * 1000n : n;
  }
  for (const [re, id] of INTEGRATION_WORDS) if (re.test(text) && !next.integrations.includes(id)) next.integrations.push(id);
  if (!next.desiredUnits) next.openQuestions.push("How many order questions do you expect per month?");
  if (!next.budget) next.openQuestions.push("Do you have a budget for the 30-day term?");
  return next;
}

function wireReq(r: Requirements): T.WireRequirements {
  const assumptions = ["Term is 30 days, prepaid in testnet USDC", "Only acknowledged answers are billable"];
  if (r.integrations.some((i) => !product.supportedIntegrations.includes(i))) assumptions.push("Unsupported integrations are excluded from the terms");
  return {
    desiredUnits: r.desiredUnits?.toString(),
    budget: r.budget?.toString(),
    integrations: r.integrations,
    openQuestions: r.openQuestions,
    assumptions,
  };
}

function activity(labels: string[]): T.ActivityItem[] {
  const t = Date.now();
  return labels.map((label, i) => ({ at: new Date(t - (labels.length - i) * 400).toISOString(), label, state: "done" as const }));
}

function notFound(what: string): never {
  throw new ApiError(404, `${what} not found`, { error: `${what} not found` }, "not_found");
}

function getNeg(id: string): NegRec {
  return store.negs[id] ?? notFound("Negotiation");
}

function refreshQuote(q: QuoteRec) {
  if (q.quote.status === "approval_required" && q.approveAt && Date.now() >= q.approveAt) {
    q.quote.status = "approved";
    if (q.quote.approval) {
      q.quote.approval.status = "approved";
      q.quote.approval.decidedAt = now();
    }
    const ap = q.quote.approval && store.approvals[q.quote.approval.id];
    if (ap && ap.status === "pending") {
      ap.status = "approved";
      ap.decidedAt = now();
    }
    save();
  }
  if (["draft", "approved", "approval_required"].includes(q.quote.status) && Date.parse(q.quote.expiresAt) < Date.now()) {
    q.quote.status = "expired";
    save();
  }
}

function refreshDeal(d: DealRec) {
  if (d.deal.status === "funding_pending" && d.fundingReadyAt && Date.now() >= d.fundingReadyAt) {
    d.deal.status = "active";
    d.deal.funding.confirmedAt = now();
    d.deal.balances = { ...d.deal.balances, deposit: d.deal.terms.prepaid, remaining: d.deal.terms.prepaid, source: "pending" };
    d.deal.service.status = "provisioned";
    d.apiKey = d.apiKey ?? `pk_test_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    d.timeline.push({ at: now(), kind: "fund", summary: `Escrow funded with ${formatUsd(BigInt(d.deal.terms.prepaid))} (mock, no onchain transaction)` });
    d.timeline.push({ at: now(), kind: "service", summary: "Service provisioned and API key issued" });
    save();
  }
}

function dealView(d: DealRec): T.Deal {
  refreshDeal(d);
  const out = clone(d.deal);
  if (d.deal.service.status === "provisioned" && d.apiKey && !d.apiKeyShown) {
    out.service.apiKey = d.apiKey;
    d.apiKeyShown = true;
    save();
  }
  return out;
}

function agentRun(labels: string[], ms: number): T.AgentRun {
  const t = Date.now();
  return { id: rid("run"), at: now(), adapter: "rule-based", durationMs: ms, steps: labels.map((label, i) => ({ at: new Date(t - (labels.length - i) * 300).toISOString(), label, state: "done" as const })) };
}

function dealIdUint(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return BigInt(toHex(b)).toString();
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

type Body = Record<string, unknown> | undefined;

async function startNegotiation(body: Body): Promise<T.Negotiation> {
  if (body?.sellerSlug !== SELLER_SLUG || body?.productSlug !== product.slug) notFound("Product");
  await sleep(350);
  const req: Requirements = { integrations: [], notes: [], openQuestions: ["How many order questions do you expect per month?", "Do you have a budget for the 30-day term?"] };
  const cands = getQuoteCandidates(ctx(), req);
  const id = rid("neg");
  const rec: NegRec = {
    req,
    candidates: Object.fromEntries(cands.map((c) => [c.candidateId, c])),
    decisions: [{ id: rid("dec"), at: now(), kind: "candidates", ruleIds: [], summary: "Listed tier candidates at list price", privateBasis: {}, publicExplanation: "Published tiers at list price." }],
    runs: [agentRun(["Loaded product and tiers", "Generated list price candidates"], 420)],
    createdAt: now(),
    neg: {
      id,
      publicId: `pub_${id.slice(4)}`,
      sellerSlug: SELLER_SLUG,
      productSlug: product.slug,
      status: "open",
      requirements: wireReq(req),
      turns: [
        {
          id: rid("t"),
          role: "agent",
          kind: "message",
          createdAt: now(),
          content:
            "Hi, I negotiate on behalf of Northwind's order support service. Tell me roughly how many order questions you get each month, the tools you use, and your budget, and I will put together offers you can accept.",
        },
      ],
      offers: cands.filter((c) => c.status !== "rejected").map(wireOffer),
      activity: activity(["Loaded seller catalog", "Listed published tiers"]),
      network: "illustrative",
    },
  };
  store.negs[id] = rec;
  save();
  return clone(rec.neg);
}

async function sendMessage(id: string, body: Body): Promise<T.Negotiation> {
  const rec = getNeg(id);
  const content = String(body?.content ?? "").slice(0, 4000);
  if (!content.trim()) throw new ApiError(400, "Message is empty", { error: "Message is empty" });
  rec.neg.turns.push({ id: rid("t"), role: "buyer", kind: "message", content, createdAt: now() });
  await sleep(1400);

  if (/ignore (all |the )?(previous|prior)|system prompt|you are now|set the price/i.test(content)) {
    rec.decisions.push({ id: rid("dec"), at: now(), kind: "injection_blocked", ruleIds: [], summary: "Instruction-like text ignored", privateBasis: {}, publicExplanation: "Instructions inside messages cannot change pricing." });
    rec.neg.turns.push({
      id: rid("t"),
      role: "agent",
      kind: "message",
      createdAt: now(),
      content: "I can only offer prices that come from the seller's published pricing and policy. Messages cannot change those rules, but I am happy to find the best fit for your volume and budget.",
    });
    rec.neg.activity = activity(["Read your message", "Ignored instruction-like text", "Kept seller pricing rules"]);
    save();
    return clone(rec.neg);
  }

  const isQuestion = /what|how|does|include|\?/i.test(content) && !/\d/.test(content);
  rec.req = parseRequirements(content, rec.req);
  const cands = getQuoteCandidates(ctx(), rec.req);
  for (const c of cands) rec.candidates[c.candidateId] = c;
  const visible = cands.filter((c) => c.status !== "rejected");
  rec.neg.requirements = wireReq(rec.req);
  rec.neg.offers = visible.map(wireOffer);
  rec.decisions.push({ id: rid("dec"), at: now(), kind: "candidates", ruleIds: [...new Set(cands.flatMap((c) => c.rules))], summary: `Evaluated ${cands.length} candidates`, privateBasis: {}, publicExplanation: "Generated candidates from tiers, requested units and budget." });
  rec.runs.push(agentRun(["Extracted requirements", "Called get_quote_candidates", "Filtered to eligible offers", "Wrote reply"], 1380));

  if (isQuestion) {
    rec.neg.turns.push({
      id: rid("t"),
      role: "agent",
      kind: "clarify",
      createdAt: now(),
      content: `One billable resolution is ${product.billableUnit}. Failed lookups and handoffs to your team are never billed. How many order questions do you expect in a month?`,
    });
  } else {
    const unsupported = rec.req.integrations.filter((i) => !product.supportedIntegrations.includes(i));
    const parts: string[] = [];
    if (rec.req.desiredUnits) parts.push(`${rec.req.desiredUnits.toLocaleString("en-US")} resolutions`);
    if (rec.req.budget) parts.push(`a budget of ${formatUsd(rec.req.budget, 0)}`);
    let text = parts.length ? `Thanks. Based on ${parts.join(" and ")}, here are the offers I can make.` : "Here are the offers I can make right now.";
    if (unsupported.length) text += ` ${unsupported.map((u) => u[0]!.toUpperCase() + u.slice(1)).join(", ")} is not supported yet, so it is excluded from the terms; the REST API and webhooks are available.`;
    if (visible.some((c) => c.status === "approval_required")) text += " The larger option needs the seller's approval before you can accept it.";
    rec.neg.turns.push({ id: rid("t"), role: "agent", kind: "offers", createdAt: now(), content: text, offers: visible.map(wireOffer) });
  }
  rec.neg.activity = activity(["Read your message", "Extracted requirements", "Checked seller pricing rules", "Prepared offers"]);
  save();
  return clone(rec.neg);
}

async function counter(id: string, body: Body): Promise<T.Negotiation> {
  const rec = getNeg(id);
  const base = rec.candidates[String(body?.candidateId)];
  if (!base) notFound("Offer");
  const targetTotal = body?.targetTotal ? BigInt(String(body.targetTotal)) : undefined;
  const targetUnits = body?.targetUnits ? BigInt(String(body.targetUnits)) : undefined;
  const ask = targetTotal ? `${formatUsd(targetTotal)} for ${base.units.toLocaleString("en-US")} resolutions` : `${targetUnits?.toLocaleString("en-US")} resolutions for ${formatUsd(base.prepaidTotal)}`;
  rec.neg.turns.push({ id: rid("t"), role: "buyer", kind: "message", content: `Counteroffer: ${ask}.`, createdAt: now() });
  await sleep(1200);
  const d = evaluateCounteroffer(ctx(), base, { targetTotal, targetUnits }, rec.req);
  rec.candidates[d.candidate.candidateId] = d.candidate;
  if (d.decision === "rejected" && d.alternative) rec.candidates[d.alternative.candidateId] = d.alternative;
  const pub = toPublicCandidate(d.candidate);
  rec.decisions.push({ id: rid("dec"), at: now(), kind: "counter", ruleIds: [...d.candidate.rules], candidateId: d.candidate.candidateId, summary: `Counter ${d.decision}`, privateBasis: { ...econWire(d.candidate) }, publicExplanation: pub.publicReasons.join(" ") });
  rec.runs.push(agentRun(["Read counteroffer", "Called evaluate_counteroffer", "Wrote decision"], 1150));
  let content: string;
  if (d.decision === "approved") content = `Good news, that works. ${ask} is within the seller's rules and you can accept it now.`;
  else if (d.decision === "approval_required") content = `That can work, but an agreement of this size needs the seller's approval first. You can request it and I will let you know.`;
  else content = `I cannot do ${ask}. ${pub.publicReasons[0] ?? ""}${d.alternative ? ` What I can do is ${Number(d.alternative.units).toLocaleString("en-US")} resolutions for ${formatUsd(d.alternative.prepaidTotal)}.` : ""}`.trim();
  const decisionOffer = d.decision === "rejected" ? undefined : wireOffer(d.candidate);
  rec.neg.turns.push({
    id: rid("t"),
    role: "agent",
    kind: "decision",
    createdAt: now(),
    content,
    offers: decisionOffer ? [decisionOffer] : undefined,
    decision: { decision: d.decision, reasons: pub.publicReasons, alternative: d.decision === "rejected" && d.alternative ? wireOffer(d.alternative) : undefined },
  });
  const newOffer = d.decision === "rejected" ? (d.alternative ? wireOffer(d.alternative) : undefined) : decisionOffer;
  if (newOffer && !rec.neg.offers.some((o) => o.candidateId === newOffer.candidateId)) rec.neg.offers = [newOffer, ...rec.neg.offers];
  rec.neg.activity = activity(["Read counteroffer", "Checked margin and discount rules", d.decision === "rejected" ? "Found an alternative within budget" : "Prepared revised offer"]);
  save();
  return clone(rec.neg);
}

async function createQuote(id: string, body: Body): Promise<T.Quote> {
  const rec = getNeg(id);
  const c = rec.candidates[String(body?.candidateId)];
  if (!c) notFound("Offer");
  if (c.status === "rejected") throw new ApiError(409, "That offer is not available", { error: "That offer is not available" });
  await sleep(500);
  const qid = rid("q");
  const start = BigInt(Math.floor(Date.now() / 1000));
  const end = start + BigInt(product.termDays * 86400);
  const offer = wireOffer(c);
  const publicTerms: T.PublicTerms = {
    includes: c.includes,
    billableUnit: product.billableUnit,
    integrations: c.supportedIntegrations.length ? c.supportedIntegrations : product.supportedIntegrations,
    refundPolicy: product.refundPolicy,
    termDays: product.termDays,
    overage: c.overagePrice ? `${usdFromUnitPrice(c.overagePrice)} per resolution beyond the included units` : undefined,
  };
  const terms: T.TermsWire = {
    dealId: dealIdUint(),
    buyer: ZERO,
    seller: SELLER_ADDR,
    payee: SELLER_ADDR,
    usdc: ARC_TESTNET_USDC,
    productId: productIdHash(product.slug),
    unitNum: c.unitPrice.num.toString(),
    unitDen: c.unitPrice.den.toString(),
    maxUnits: c.units.toString(),
    prepaid: c.prepaidTotal.toString(),
    start: start.toString(),
    end: end.toString(),
    grace: String(3 * 86400),
    publicTermsHash: publicTermsHash(publicTerms as unknown as Record<string, unknown>),
    nonce: String(Date.now()),
    expiry: (start + BigInt(policy.quoteTtlSeconds)).toString(),
  };
  const needsApproval = c.status === "approval_required";
  const quote: T.Quote = {
    id: qid,
    negotiationId: id,
    status: needsApproval ? "approval_required" : "draft",
    offer,
    expiresAt: new Date(Date.now() + policy.quoteTtlSeconds * 1000).toISOString(),
    chainId: ARC_TESTNET_CHAIN_ID,
    escrowAddress: ESCROW,
    usdcAddress: ARC_TESTNET_USDC,
    terms,
    typedData: { domain: { ...domain(ARC_TESTNET_CHAIN_ID, ESCROW) }, types: clone(TERMS_TYPES) as unknown as T.TypedDataWire["types"], primaryType: "Terms", message: terms },
    publicTerms,
    network: "illustrative",
  };
  if (needsApproval) {
    const apId = rid("ap");
    quote.approval = { id: apId, status: "pending", reason: "An agreement of this size needs the seller's approval before it can be offered." };
    store.approvals[apId] = { id: apId, quoteId: qid, status: "pending", reason: quote.approval.reason, createdAt: now(), offer, economics: econWire(c) };
  }
  store.quotes[qid] = { quote, candidate: c, approveAt: needsApproval ? Date.now() + 9000 : undefined };
  rec.neg.status = "quoted";
  rec.decisions.push({ id: rid("dec"), at: now(), kind: "quote", ruleIds: [...c.rules], candidateId: c.candidateId, summary: `Quote ${qid} created`, privateBasis: { ...econWire(c) }, publicExplanation: "Quote issued at the offered terms." });
  save();
  return clone(quote);
}

async function acceptQuote(id: string, body: Body): Promise<T.Deal> {
  const q = store.quotes[id] ?? notFound("Quote");
  refreshQuote(q);
  if (!["draft", "approved"].includes(q.quote.status)) throw new ApiError(409, `Quote is ${q.quote.status.replace("_", " ")}`, { error: "quote not acceptable" });
  const buyer = String(body?.buyerAddress ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(buyer)) throw new ApiError(400, "A buyer wallet address is required", { error: "buyerAddress" });
  await sleep(600);
  q.quote.status = "accepted";
  const neg = store.negs[q.quote.negotiationId];
  if (neg) neg.neg.status = "accepted";
  const dealId = rid("deal");
  const terms = { ...q.quote.terms, buyer: buyer as Address };
  const end = Number(terms.end) * 1000;
  const rec: DealRec = {
    quoteId: id,
    negotiationId: q.quote.negotiationId,
    unitPrice: q.candidate.unitPrice,
    receipts: [],
    executions: {},
    ackedUnits: "0",
    ackNonce: 1,
    createdAt: now(),
    timeline: [
      { at: now(), kind: "quote", summary: `Quote for ${Number(q.quote.offer.units).toLocaleString("en-US")} resolutions at ${formatUsd(BigInt(q.quote.offer.prepaidTotal))}` },
      { at: now(), kind: "accept", summary: "Buyer signed the EIP-712 terms" },
    ],
    deal: {
      id: dealId,
      publicId: `rec_${dealId.slice(5)}`,
      status: "awaiting_funding",
      chainId: ARC_TESTNET_CHAIN_ID,
      escrowAddress: ESCROW,
      usdcAddress: ARC_TESTNET_USDC,
      dealIdOnchain: terms.dealId,
      terms,
      publicTerms: q.quote.publicTerms,
      signatures: { buyer: String(body?.buyerSignature ?? PLACEHOLDER_SIG) as Hex, seller: PLACEHOLDER_SIG },
      buyerAddress: buyer as Address,
      sellerPayee: SELLER_ADDR,
      funding: {},
      balances: { deposit: "0", settled: "0", refunded: "0", remaining: "0", source: "pending" },
      service: { status: "pending", endpoint: `/api/services/${product.slug}/execute`, docsUrl: "/docs/api.md#service-metered-endpoint" },
      usage: { units: "0", charged: "0", settled: "0" },
      refundableAt: new Date(end + 3 * 86400_000).toISOString(),
      explorer: { escrow: "", settlements: [] },
      labels: { network: "testnet", seller: "sandbox" },
      network: "illustrative",
    },
  };
  store.deals[dealId] = rec;
  save();
  return clone(rec.deal);
}

async function fundingIntent(id: string, body: Body): Promise<T.Deal> {
  const d = store.deals[id] ?? notFound("Deal");
  if (d.deal.status !== "awaiting_funding") return dealView(d);
  await sleep(500);
  const bal = BigInt(store.walletUsdc ?? MOCK_START_USDC) - BigInt(d.deal.terms.prepaid);
  store.walletUsdc = (bal < 0n ? 0n : bal).toString();
  const tx = body?.txHash ? (String(body.txHash) as Hex) : undefined;
  d.deal.status = "funding_pending";
  if (tx) d.deal.funding = { txHash: tx };
  d.fundingReadyAt = Date.now() + 3500;
  save();
  return dealView(d);
}

const ORDERS: Record<string, { status: string; carrier: string; eta: string; fields: string[] }> = {
  "1042": { status: "shipped", carrier: "UPS", eta: "Saturday, October 18", fields: ["status", "carrier", "eta"] },
  "1043": { status: "out for delivery", carrier: "USPS", eta: "today by 8 pm", fields: ["status", "carrier", "eta"] },
  "1044": { status: "processing", carrier: "not assigned yet", eta: "Tuesday, October 21", fields: ["status", "eta"] },
};

async function execute(slug: string, body: Body, headers: Record<string, string>): Promise<T.ExecuteResponse> {
  const key = (headers.Authorization ?? "").replace(/^Bearer\s+/i, "");
  const d = Object.values(store.deals).find((x) => x.apiKey && x.apiKey === key);
  if (!d || slug !== product.slug) throw new ApiError(401, "Invalid or missing API key", { error: "unauthorized" });
  refreshDeal(d);
  const requestId = String(body?.requestId ?? "");
  if (requestId.length < 8) throw new ApiError(400, "requestId must be at least 8 characters", { error: "requestId" });
  if (d.executions[requestId]) return clone(d.executions[requestId]!);
  await sleep(900);
  const input = (body?.input ?? {}) as T.ExecuteInput;
  const orderId = String(input.orderId ?? "").replace(/[^0-9a-z]/gi, "");
  const order = orderId ? ORDERS[orderId] : undefined;
  let status: T.ReceiptStatus;
  let answer: string;
  let fields: string[] = [];
  if (!orderId) {
    status = "handoff";
    answer = "I need an order number to look this up, so I have handed this conversation to your team. This request is not billed.";
  } else if (!order) {
    status = "failed";
    answer = `I could not find order #${orderId} in the store. This request is not billed.`;
  } else {
    status = "delivered";
    answer = `Order #${orderId} is ${order.status}${order.carrier.startsWith("not") ? "" : ` with ${order.carrier}`} and is expected ${order.eta}.`;
    fields = order.fields;
  }
  const billable = status === "delivered";
  const prevUnits = BigInt(d.deal.usage.units);
  const maxUnits = BigInt(d.deal.terms.maxUnits);
  const units = billable && prevUnits < maxUnits ? 1n : 0n;
  const cumUnits = prevUnits + units;
  const cumCharged = cumulativeCharge(cumUnits, d.unitPrice);
  d.deal.usage.units = cumUnits.toString();
  d.deal.usage.charged = cumCharged.toString();
  const digest = keccak256(toHex(JSON.stringify({ deal: d.deal.dealIdOnchain, requestId, status, cumUnits: cumUnits.toString() })));
  const receipt: T.Receipt = { requestId, status, units: units.toString(), chargedCumulative: cumCharged.toString(), digest, createdAt: now(), answerPreview: answer.slice(0, 120) };
  d.receipts.unshift(receipt);
  const remaining = BigInt(d.deal.balances.deposit) - BigInt(d.deal.balances.settled) - BigInt(d.deal.balances.refunded);
  const res: T.ExecuteResponse = {
    requestId,
    status,
    billable,
    units: units.toString(),
    answer,
    source: { store: "Northwind demo store", orderId: orderId || undefined, fields },
    receipt: { digest, sellerSignature: PLACEHOLDER_SIG },
    deal: { cumulativeUnits: cumUnits.toString(), cumulativeCharged: cumCharged.toString(), remaining: remaining.toString() },
  };
  d.executions[requestId] = res;
  save();
  return clone(res);
}

function termsHashOf(d: DealRec): Hex {
  const t = d.deal.terms;
  return hashTerms(d.deal.chainId, d.deal.escrowAddress, {
    dealId: BigInt(t.dealId),
    buyer: t.buyer,
    seller: t.seller,
    payee: t.payee,
    usdc: t.usdc,
    productId: t.productId,
    unitNum: BigInt(t.unitNum),
    unitDen: BigInt(t.unitDen),
    maxUnits: BigInt(t.maxUnits),
    prepaid: BigInt(t.prepaid),
    start: BigInt(t.start),
    end: BigInt(t.end),
    grace: BigInt(t.grace),
    publicTermsHash: t.publicTermsHash,
    nonce: BigInt(t.nonce),
    expiry: BigInt(t.expiry),
  });
}

async function usage(id: string): Promise<T.UsageResponse> {
  const d = store.deals[id] ?? notFound("Deal");
  refreshDeal(d);
  await sleep(200);
  const out: T.UsageResponse = {
    receipts: clone(d.receipts),
    cumulativeUnits: d.deal.usage.units,
    cumulativeCharged: d.deal.usage.charged,
    settledOnchain: d.deal.usage.settled,
  };
  if (BigInt(d.deal.usage.units) > BigInt(d.ackedUnits)) {
    const acceptance: T.AcceptanceWire = {
      dealId: d.deal.dealIdOnchain,
      termsHash: termsHashOf(d),
      cumulativeAmount: d.deal.usage.charged,
      cumulativeUnits: d.deal.usage.units,
      receiptsRoot: receiptsRoot(d.receipts.filter((r) => r.status === "delivered").map((r) => r.digest)),
      nonce: String(d.ackNonce),
      expiry: String(Math.floor(Date.now() / 1000) + 3600),
    };
    out.pendingAcceptance = {
      acceptance,
      typedData: { domain: { ...domain(d.deal.chainId, d.deal.escrowAddress) }, types: clone(ACCEPTANCE_TYPES) as unknown as T.TypedDataWire["types"], primaryType: "Acceptance", message: acceptance },
    };
  }
  return out;
}

async function acknowledge(id: string, body: Body): Promise<T.UsageAckResponse> {
  const d = store.deals[id] ?? notFound("Deal");
  await sleep(900);
  const units = String(body?.cumulativeUnits ?? "0");
  const amount = String(body?.cumulativeAmount ?? "0");
  if (BigInt(units) !== BigInt(d.deal.usage.units) || BigInt(amount) !== BigInt(d.deal.usage.charged)) throw new ApiError(409, "Usage changed, refresh and sign again", { error: "stale acceptance" });
  const delta = BigInt(amount) - BigInt(d.deal.usage.settled);
  d.ackedUnits = units;
  d.ackNonce += 1;
  d.deal.usage.settled = amount;
  d.deal.balances.settled = amount;
  d.deal.balances.remaining = (BigInt(d.deal.balances.deposit) - BigInt(amount) - BigInt(d.deal.balances.refunded)).toString();
  d.timeline.push({ at: now(), kind: "usage_accept", summary: `Buyer acknowledged ${Number(units).toLocaleString("en-US")} ${units === "1" ? "resolution" : "resolutions"}` });
  d.timeline.push({ at: now(), kind: "settle", summary: `Settled ${formatUsd(delta)} to the seller (mock, no onchain transaction)` });
  save();
  // Mock mode never fabricates a transaction hash.
  return { settlement: { status: "mock_no_transaction" }, deal: dealView(d) };
}

async function refund(id: string): Promise<T.RefundResponse> {
  const d = store.deals[id] ?? notFound("Deal");
  await sleep(400);
  if (Date.now() < Date.parse(d.deal.refundableAt)) return { status: "too_early", refundableAt: d.deal.refundableAt };
  return { status: "submitted", refundableAt: d.deal.refundableAt };
}

const SEEDED_REVIEW: T.ReviewListItem[] = [
  { publicId: "rec_sample01", sellerLabel: "sandbox", productName: "AI order support", status: "active", fundedUsd: "1440.00", settledUsd: "212.16", refundedUsd: "0.00", network: "illustrative", createdAt: "2026-10-12T15:04:00.000Z" },
  { publicId: "rec_sample02", sellerLabel: "sandbox", productName: "AI order support", status: "closed", fundedUsd: "1700.00", settledUsd: "1530.00", refundedUsd: "170.00", network: "illustrative", createdAt: "2026-09-08T10:22:00.000Z" },
];

function seededRecord(publicId: string): T.ReviewRecord | undefined {
  const item = SEEDED_REVIEW.find((r) => r.publicId === publicId);
  if (!item) return undefined;
  const closed = item.status === "closed";
  const base = Date.parse(item.createdAt);
  const at = (h: number) => new Date(base + h * 3600_000).toISOString();
  const timeline: T.ReviewRecord["timeline"] = [
    { at: at(0), kind: "quote", summary: `Quote for ${closed ? "2,000" : "1,500"} resolutions at $${item.fundedUsd}` },
    { at: at(0.2), kind: "accept", summary: "Buyer and seller signed the EIP-712 terms" },
    { at: at(0.4), kind: "fund", summary: `Escrow funded with $${item.fundedUsd} (illustrative)` },
    { at: at(0.5), kind: "service", summary: "Service provisioned" },
    { at: at(48), kind: "usage_accept", summary: "Buyer acknowledged usage" },
    { at: at(48.2), kind: "settle", summary: `Settled $${item.settledUsd} to the seller (illustrative)` },
  ];
  if (closed) timeline.push({ at: at(800), kind: "refund", summary: `Refunded $${item.refundedUsd} unused balance to the buyer (illustrative)` });
  const m = (usd: string) => toMicro(usd).toString();
  return {
    timeline,
    termsHash: keccak256(toHex(publicId)),
    publicTerms: { includes: product.tiers[closed ? 1 : 0]!.includes, billableUnit: product.billableUnit, integrations: product.supportedIntegrations, refundPolicy: product.refundPolicy, termDays: 30 },
    balances: { deposit: m(item.fundedUsd), settled: m(item.settledUsd), refunded: m(item.refundedUsd), remaining: (toMicro(item.fundedUsd) - toMicro(item.settledUsd) - toMicro(item.refundedUsd)).toString(), source: "pending" },
    labels: { network: "illustrative", seller: "sandbox" },
  };
}

function reviewList(): T.ReviewListItem[] {
  const live = Object.values(store.deals).map((d) => {
    refreshDeal(d);
    return {
      publicId: d.deal.publicId,
      sellerLabel: d.deal.labels.seller,
      productName: product.name,
      status: d.deal.status,
      fundedUsd: fromMicro(BigInt(d.deal.balances.deposit)).slice(0, -4),
      settledUsd: fromMicro(BigInt(d.deal.balances.settled)).slice(0, -4),
      refundedUsd: fromMicro(BigInt(d.deal.balances.refunded)).slice(0, -4),
      network: "illustrative" as const,
      createdAt: d.createdAt,
    };
  });
  return [...live.reverse(), ...SEEDED_REVIEW];
}

function reviewRecord(publicId: string): T.ReviewRecord {
  const d = Object.values(store.deals).find((x) => x.deal.publicId === publicId);
  if (!d) return seededRecord(publicId) ?? notFound("Record");
  refreshDeal(d);
  return { timeline: clone(d.timeline), termsHash: termsHashOf(d), publicTerms: d.deal.publicTerms, balances: d.deal.balances, labels: { network: "illustrative", seller: d.deal.labels.seller } };
}

/* Seller console mocks */
function requireSession() {
  if (!store.session && !accountOrg()) throw new ApiError(401, "Sign in to the seller console", { error: "unauthorized" });
}

function productWithPrivate(): T.ProductWithPrivate {
  return {
    ...publicProduct(),
    id: product.id,
    maxUnitsPerDeal: product.maxUnitsPerDeal.toString(),
    cost: { version: cost.version, variableCostPerUnit: cost.variableCostPerUnit.toString(), directCostPerDeal: cost.directCostPerDeal.toString(), txCostBps: Number(cost.txCostBps), freshUntil: cost.freshUntil },
    policy: {
      version: policy.version,
      minMarginBps: Number(policy.minMarginBps),
      maxDiscountBps: Number(policy.maxDiscountBps),
      approvalThreshold: policy.approvalThreshold.toString(),
      prepaidMinimum: policy.prepaidMinimum.toString(),
      availableCapacityUnits: policy.availableCapacityUnits.toString(),
      quoteTtlSeconds: policy.quoteTtlSeconds,
      allowNonPositiveContribution: policy.allowNonPositiveContribution,
    },
    previewCases: [
      { label: "2,000 resolutions at $1,500", desiredUnits: "2000", budget: toMicro("1500").toString() },
      { label: "4,000 resolutions", desiredUnits: "4000" },
      { label: "$300 budget", budget: toMicro("300").toString() },
    ],
  };
}

function overview(): T.SellerOverview {
  const deals = Object.values(store.deals).map((d) => (refreshDeal(d), d.deal));
  const funded = deals.filter((d) => ["active", "funded", "closed"].includes(d.status));
  const sum = (f: (d: T.Deal) => string) => funded.reduce((a, d) => a + BigInt(f(d)), 0n);
  const fundedValue = sum((d) => d.balances.deposit);
  const settled = sum((d) => d.balances.settled);
  const refunded = sum((d) => d.balances.refunded);
  return {
    quotes: Object.keys(store.quotes).length,
    approvalsPending: Object.values(store.approvals).filter((a) => (refreshQuote(store.quotes[a.quoteId]!), a.status === "pending")).length,
    dealsFunded: funded.length,
    fundedValue: fundedValue.toString(),
    earnedSettled: settled.toString(),
    pendingLiability: (fundedValue - settled - refunded).toString(),
    refunded: refunded.toString(),
    usageUnits: funded.reduce((a, d) => a + BigInt(d.usage.units), 0n).toString(),
    labels: { network: "testnet", seller: "sandbox" },
  };
}

function journalFor(d: DealRec): T.JournalEntry[] {
  const out: T.JournalEntry[] = [];
  if (BigInt(d.deal.balances.deposit) > 0n) out.push({ id: `${d.deal.id}_fund`, at: d.deal.funding.confirmedAt ?? d.createdAt, kind: "fund", debit: "escrow_usdc", credit: "deferred_revenue", amount: d.deal.balances.deposit, memo: "Escrow funded (mock)" });
  if (BigInt(d.deal.balances.settled) > 0n) out.push({ id: `${d.deal.id}_settle`, at: now(), kind: "settle", debit: "deferred_revenue", credit: "revenue", amount: d.deal.balances.settled, memo: "Usage settled (mock)" });
  return out;
}


/* ------------------------------------------------------------------ */
/* v1 account mocks: /me, /me/*, /orgs, /market, /pay, signer          */
/* ------------------------------------------------------------------ */

export const MOCK_BUYER_ADDRESS = "0x5af3107a4000ec2b6c3c3d6c1ae0cb2f7ae91b42" as Address;
const MOCK_START_USDC = "2500000000";
const NO_ORG_KEY = "proteus:mock:no-org";

/** Default: the mock user owns the Northwind sandbox org. `?mockOrg=none` starts without one. */
function accountOrg(): T.MeOrg | null {
  if (store.org === undefined) {
    let none = false;
    try {
      const q = new URLSearchParams(window.location.search).get("mockOrg");
      if (q === "none") sessionStorage.setItem(NO_ORG_KEY, "1");
      if (q === "default") sessionStorage.removeItem(NO_ORG_KEY);
      none = sessionStorage.getItem(NO_ORG_KEY) === "1";
    } catch {
      /* ignore */
    }
    store.org = none ? null : { id: "org_northwind", slug: SELLER_SLUG, name: "Northwind Commerce", label: "sandbox", role: "owner" };
    save();
  }
  return store.org ?? null;
}

function meView(): T.MeResponse {
  const org = accountOrg();
  return { userId: "did:privy:mock-buyer", email: "demo@proteus.dev", wallets: [{ address: MOCK_BUYER_ADDRESS, kind: "embedded", primary: true }], ...(org ? { org } : {}), access: true, labels: { network: "testnet" } };
}

function negSummaries(): T.NegotiationSummary[] {
  return Object.values(store.negs)
    .reverse()
    .map((n) => ({ id: n.neg.id, publicId: n.neg.publicId, productSlug: n.neg.productSlug, sellerSlug: n.neg.sellerSlug, status: n.neg.status, createdAt: n.createdAt, updatedAt: n.neg.turns.at(-1)?.createdAt, turns: n.neg.turns.length, bestOfferUsd: n.neg.offers[0]?.prepaidTotalUsd }));
}

function dealSummaries(): T.DealSummary[] {
  return Object.values(store.deals)
    .reverse()
    .map((d) => (refreshDeal(d), { id: d.deal.id, publicId: d.deal.publicId, status: d.deal.status, productSlug: product.slug, sellerSlug: SELLER_SLUG, deposit: d.deal.balances.deposit, settled: d.deal.balances.settled, remaining: d.deal.balances.remaining, createdAt: d.createdAt }));
}

function marketItems(): T.MarketItem[] {
  const pp = publicProduct();
  return [{ sellerSlug: SELLER_SLUG, sellerName: "Northwind Commerce", sellerLabel: "sandbox", productSlug: pp.slug, name: pp.name, unitLabel: pp.unitLabel, startingTierUsd: pp.tiers[0]?.prepaidTotalUsd ?? "0" }];
}

async function mockV1(method: string, p: string[], body: Body): Promise<unknown | typeof NO_MATCH> {
  const is = (m: string, ...parts: (string | null)[]) => method === m && p.length === parts.length && parts.every((x, i) => x === null || x === p[i]);
  if (is("GET", "invites", "status")) return { gate: false, pending: false, access: true };
  if (is("POST", "invites", "redeem")) return { ok: true, bound: true };
  if (is("GET", "me")) {
    await sleep(120);
    return meView();
  }
  if (is("GET", "me", "wallet")) {
    await sleep(150);
    const usdc = store.walletUsdc ?? MOCK_START_USDC;
    return { address: MOCK_BUYER_ADDRESS, usdc, native: (BigInt(usdc) * 1_000_000_000_000n).toString(), faucetUrl: "https://faucet.circle.com", chainId: ARC_TESTNET_CHAIN_ID, explorerUrl: `https://explorer.testnet.arc.io/address/${MOCK_BUYER_ADDRESS}` } satisfies T.MeWalletBalance;
  }
  if (is("GET", "me", "wallets", "nonce")) return { nonce: rid("nonce") };
  if (is("POST", "me", "wallets", "link")) return meView();
  if (is("GET", "me", "negotiations")) {
    await sleep(150);
    return negSummaries();
  }
  if (is("GET", "me", "deals")) {
    await sleep(150);
    return dealSummaries();
  }
  if (is("GET", "me", "activity")) {
    await sleep(150);
    return { negotiations: negSummaries(), deals: dealSummaries(), payPerCall: { calls: store.ppcCalls ?? 0, spent: "0" } } satisfies T.MeActivity;
  }
  if (is("POST", "orgs")) {
    const name = String(body?.name ?? "").trim() || "My business";
    const slug = String(body?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    store.org = { id: rid("org"), slug, name, label: "sandbox", role: "owner" };
    store.session = true;
    try {
      sessionStorage.removeItem(NO_ORG_KEY);
    } catch {
      /* ignore */
    }
    save();
    return clone(store.org);
  }
  if (is("GET", "app", "signer")) {
    if (!accountOrg()) throw new ApiError(404, "No seller org yet", { error: "no_org" }, "not_found");
    return { address: "0x00000000000000000000000000000000005e11e7", scope: "terms+delivery", createdAt: store.signerCreatedAt ?? (store.signerCreatedAt = now()), ...(store.signerRevokedAt ? { revokedAt: store.signerRevokedAt } : {}) } satisfies T.SignerInfo;
  }
  if (is("POST", "app", "signer", "revoke")) {
    store.signerRevokedAt = now();
    save();
    return { revokedAt: store.signerRevokedAt, note: "Revocation stops future signing only. Funded deals keep accepting this signer." };
  }
  if (is("POST", "app", "products")) {
    if (!accountOrg()) throw new ApiError(409, "Create a seller org first", { error: "no_org" });
    await sleep(400);
    return { ...productWithPrivate(), name: String(body?.name ?? product.name) };
  }
  if (is("GET", "market", "sellers")) {
    await sleep(200);
    const items = marketItems();
    return [{ slug: SELLER_SLUG, name: "Northwind Commerce", label: "sandbox" as const, brand: { logoUrl: "/assets/logos/northwind.png", tagline: "Order support for online stores, answered from the order record.", category: "support", accent: "#1b4dff" }, stats: { dealsFunded: 2, settled: "3750000", inEscrow: "0", since: new Date().toISOString() }, products: items.map((i) => ({ slug: i.productSlug, name: i.name, summary: "Order status and delivery answers from the order record (mock).", category: "support", unitLabel: i.unitLabel, capabilities: [], termDays: 30, tiers: 3, startingTierUsd: i.startingTierUsd, bestUnitPriceUsd: null, perCallUsd: i.perCallUsd ?? null, service: "sample-store" as const })) }] satisfies T.MarketSeller[];
  }
  if (is("GET", "market")) {
    await sleep(200);
    return marketItems();
  }
  if (method === "POST" && p[0] === "pay" && p.length === 4 && p[3] === "execute") {
    await sleep(200);
    throw new ApiError(501, "Pay per call is not available in mock mode", { error: "not_implemented" }, "not_implemented");
  }
  return NO_MATCH;
}
const NO_MATCH = Symbol("no-match");

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export async function mockRequest<R>(method: string, path: string, body: Body, headers: Record<string, string>): Promise<R> {
  store = load();
  const p = path.split("?")[0]!.split("/").filter(Boolean).map(decodeURIComponent);
  const r = (v: unknown) => v as R;
  const is = (m: string, ...parts: (string | null)[]) => method === m && p.length === parts.length && parts.every((x, i) => x === null || x === p[i]);

  const v1 = await mockV1(method, p, body);
  if (v1 !== NO_MATCH) return r(v1);

  if (is("GET", "health")) return r({ ok: true, network: "illustrative", chainId: ARC_TESTNET_CHAIN_ID, escrowAddress: ESCROW, usdcAddress: ARC_TESTNET_USDC, agentAdapter: "rule-based", relayer: "none" } satisfies T.Health as T.Health);
  if (is("GET", "public", "sellers", null)) {
    if (p[2] !== SELLER_SLUG) notFound("Seller");
    await sleep(250);
    return r({ slug: SELLER_SLUG, name: "Northwind Commerce", label: "sandbox", brand: { logoUrl: "/assets/logos/northwind.png", tagline: "Order support for online stores, answered from the order record.", category: "support" }, products: [publicProduct()], network: "illustrative" } satisfies T.PublicSeller);
  }
  if (is("GET", "public", "sellers", null, "products", null)) {
    if (p[2] !== SELLER_SLUG || p[4] !== product.slug) notFound("Product");
    await sleep(250);
    return r(publicProduct());
  }
  if (is("POST", "negotiations")) return r(await startNegotiation(body));
  if (is("GET", "negotiations", null)) {
    await sleep(150);
    return r(clone(getNeg(p[1]!).neg));
  }
  if (is("POST", "negotiations", null, "messages")) return r(await sendMessage(p[1]!, body));
  if (is("POST", "negotiations", null, "counter")) return r(await counter(p[1]!, body));
  if (is("POST", "negotiations", null, "quotes")) return r(await createQuote(p[1]!, body));
  if (is("GET", "quotes", null)) {
    const q = store.quotes[p[1]!] ?? notFound("Quote");
    refreshQuote(q);
    await sleep(150);
    return r(clone(q.quote));
  }
  if (is("POST", "quotes", null, "accept")) return r(await acceptQuote(p[1]!, body));
  if (is("GET", "deals", null)) {
    const d = store.deals[p[1]!] ?? notFound("Deal");
    await sleep(150);
    return r(dealView(d));
  }
  if (is("POST", "deals", null, "funding-intent")) return r(await fundingIntent(p[1]!, body));
  if (is("GET", "deals", null, "usage")) return r(await usage(p[1]!));
  if (is("POST", "deals", null, "usage-acknowledgments")) return r(await acknowledge(p[1]!, body));
  if (is("POST", "deals", null, "refund-request")) return r(await refund(p[1]!));
  if (is("POST", "services", null, "execute")) return r(await execute(p[1]!, body, headers));
  if (is("GET", "review")) {
    await sleep(200);
    return r(reviewList());
  }
  if (is("GET", "review", null)) {
    await sleep(200);
    return r(reviewRecord(p[1]!));
  }

  // Seller console
  if (is("POST", "app", "session", "sandbox")) {
    store.session = true;
    save();
    return r({ org: { slug: SELLER_SLUG, name: "Northwind Commerce", label: "sandbox" } });
  }
  if (is("POST", "app", "session", "siwe")) throw new ApiError(400, "Wallet sign-in is not available in mock mode", { error: "mock" });
  if (p[0] === "app") {
    requireSession();
    await sleep(200);
    if (is("GET", "app", "overview")) return r(overview());
    if (is("GET", "app", "products")) return r([productWithPrivate()]);
    if (is("GET", "app", "products", null)) return r(p[2] === product.id || p[2] === product.slug ? productWithPrivate() : notFound("Product"));
    if (is("PATCH", "app", "products", null, "policy")) {
      const b = body ?? {};
      policy = {
        ...policy,
        version: policy.version + 1,
        minMarginBps: b.minMarginBps !== undefined ? BigInt(Number(b.minMarginBps)) : policy.minMarginBps,
        maxDiscountBps: b.maxDiscountBps !== undefined ? BigInt(Number(b.maxDiscountBps)) : policy.maxDiscountBps,
        approvalThreshold: b.approvalThreshold !== undefined ? BigInt(String(b.approvalThreshold)) : policy.approvalThreshold,
        prepaidMinimum: b.prepaidMinimum !== undefined ? BigInt(String(b.prepaidMinimum)) : policy.prepaidMinimum,
        availableCapacityUnits: b.availableCapacityUnits !== undefined ? BigInt(String(b.availableCapacityUnits)) : policy.availableCapacityUnits,
        quoteTtlSeconds: b.quoteTtlSeconds !== undefined ? Number(b.quoteTtlSeconds) : policy.quoteTtlSeconds,
      };
      return r(productWithPrivate());
    }
    if (is("PATCH", "app", "products", null, "cost")) {
      const b = body ?? {};
      cost = {
        ...cost,
        version: cost.version + 1,
        variableCostPerUnit: BigInt(String(b.variableCostPerUnit ?? cost.variableCostPerUnit)),
        directCostPerDeal: b.directCostPerDeal !== undefined ? BigInt(String(b.directCostPerDeal)) : cost.directCostPerDeal,
        txCostBps: b.txCostBps !== undefined ? BigInt(Number(b.txCostBps)) : cost.txCostBps,
        freshUntil: Date.now() + 30 * 86_400_000,
      };
      return r(productWithPrivate());
    }
    if (is("POST", "app", "products", null, "preview")) {
      const req: Requirements = { integrations: [], notes: [], openQuestions: [], desiredUnits: body?.desiredUnits ? BigInt(String(body.desiredUnits)) : undefined, budget: body?.budget ? BigInt(String(body.budget)) : undefined };
      return r({ candidates: getQuoteCandidates(ctx(), req).map(withEconomics) });
    }
    if (is("GET", "app", "negotiations")) {
      return r(
        Object.values(store.negs)
          .reverse()
          .map((n): T.NegotiationSummary => ({ id: n.neg.id, publicId: n.neg.publicId, productSlug: n.neg.productSlug, status: n.neg.status, createdAt: n.createdAt, updatedAt: n.neg.turns.at(-1)?.createdAt, turns: n.neg.turns.length, bestOfferUsd: n.neg.offers[0]?.prepaidTotalUsd })),
      );
    }
    if (is("GET", "app", "negotiations", null)) {
      const n = getNeg(p[2]!);
      return r({ ...clone(n.neg), candidates: Object.values(n.candidates).map(withEconomics), decisions: clone(n.decisions), agentRuns: clone(n.runs) } satisfies T.SellerNegotiation);
    }
    if (is("GET", "app", "approvals")) {
      Object.values(store.quotes).forEach(refreshQuote);
      return r(Object.values(store.approvals).reverse());
    }
    if (is("POST", "app", "approvals", null, "decision")) {
      const ap = store.approvals[p[2]!] ?? notFound("Approval");
      const q = store.quotes[ap.quoteId];
      const approve = body?.decision === "approve";
      ap.status = approve ? "approved" : "declined";
      ap.decidedAt = now();
      if (q) {
        q.quote.status = approve ? "approved" : "declined";
        q.approveAt = undefined;
        if (q.quote.approval) q.quote.approval = { ...q.quote.approval, status: ap.status, decidedAt: ap.decidedAt, reason: String(body?.reason ?? q.quote.approval.reason) };
      }
      save();
      return r(clone(ap));
    }
    if (is("GET", "app", "deals")) {
      return r(
        Object.values(store.deals)
          .reverse()
          .map((d): T.DealSummary => (refreshDeal(d), { id: d.deal.id, publicId: d.deal.publicId, status: d.deal.status, productSlug: product.slug, deposit: d.deal.balances.deposit, settled: d.deal.balances.settled, remaining: d.deal.balances.remaining, createdAt: d.createdAt })),
      );
    }
    if (is("GET", "app", "deals", null)) {
      const d = store.deals[p[2]!] ?? notFound("Deal");
      refreshDeal(d);
      const q = store.quotes[d.quoteId];
      return r({ ...clone(d.deal), economics: q ? econWire(q.candidate) : {}, journal: journalFor(d), chainTxs: [] } satisfies T.SellerDeal);
    }
    if (is("POST", "app", "deals", null, "close-term")) throw new ApiError(409, "Closing a term needs a chain transaction, which mock mode does not send", { error: "mock" });
    if (is("GET", "app", "finance")) {
      const o = overview();
      return r({ funded: o.fundedValue, earned: o.earnedSettled, settled: o.earnedSettled, liability: o.pendingLiability, refunded: o.refunded, journal: Object.values(store.deals).flatMap(journalFor), reconciliation: { lastRunAt: null, discrepancies: [] } } satisfies T.SellerFinance);
    }
  }
  throw new ApiError(404, `Mock has no route for ${method} /api/${p.join("/")}`, { error: "not_found" });
}

/** Clears the mock store (handy in the console: window.__proteusMockReset()). */
export function resetMock() {
  store = { negs: {}, quotes: {}, deals: {}, approvals: {}, session: false };
  try {
    sessionStorage.removeItem(NO_ORG_KEY);
  } catch {
    /* ignore */
  }
  save();
}
if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__proteusMockReset = resetMock;
