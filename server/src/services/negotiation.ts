import { asc, desc, eq } from "drizzle-orm";
import { evaluateCounteroffer, formatUsd, getQuoteCandidates, toPublicCandidate, type Candidate, type PublicCandidate, type Requirements } from "@proteus/domain";
import { detectInjection, getAgentAdapter, type AgentStep, type ConversationTurn } from "../agent";
import { db, schema } from "../db";
import { HttpError, bigintsToStrings } from "../lib/http";
import { id, publicId } from "../lib/ids";
import { evaluationContext, loadProductById, loadProductBySlugs, unitPriceUsd, type LoadedProduct } from "./catalog";
import { features } from "../env";

/* ------------------------------------------------------------------ */
/* revive helpers                                                       */
/* ------------------------------------------------------------------ */

export function reviveRequirements(r: Record<string, unknown>): Requirements {
  return {
    desiredUnits: r.desiredUnits != null ? BigInt(String(r.desiredUnits)) : undefined,
    budget: r.budget != null ? BigInt(String(r.budget)) : undefined,
    integrations: (r.integrations as string[]) ?? [],
    notes: (r.notes as string[]) ?? [],
    openQuestions: (r.openQuestions as string[]) ?? [],
    industry: r.industry as string | undefined,
    useCase: r.useCase as string | undefined,
  };
}

export function reviveCandidate(c: Record<string, unknown>): Candidate {
  const e = c.economics as Record<string, unknown>;
  const up = c.unitPrice as Record<string, unknown>;
  const op = c.overagePrice as Record<string, unknown> | undefined;
  return {
    candidateId: String(c.candidateId),
    tierId: String(c.tierId),
    tierName: String(c.tierName),
    units: BigInt(String(c.units)),
    unitPrice: { num: BigInt(String(up.num)), den: BigInt(String(up.den)) },
    prepaidTotal: BigInt(String(c.prepaidTotal)),
    overagePrice: op ? { num: BigInt(String(op.num)), den: BigInt(String(op.den)) } : undefined,
    includes: (c.includes as string[]) ?? [],
    supportedIntegrations: (c.supportedIntegrations as string[]) ?? [],
    unsupportedIntegrations: (c.unsupportedIntegrations as string[]) ?? [],
    status: c.status as Candidate["status"],
    rules: (c.rules as Candidate["rules"]) ?? [],
    origin: c.origin as Candidate["origin"],
    origins: (c.origins as Candidate["origins"]) ?? [c.origin as Candidate["origin"]],
    economics: {
      expectedRevenue: BigInt(String(e.expectedRevenue)),
      expectedVariableCost: BigInt(String(e.expectedVariableCost)),
      expectedTxCost: BigInt(String(e.expectedTxCost)),
      allocatedDirectCost: BigInt(String(e.allocatedDirectCost)),
      expectedContribution: BigInt(String(e.expectedContribution)),
      expectedContributionMarginBps: BigInt(String(e.expectedContributionMarginBps)),
      discountBps: BigInt(String(e.discountBps)),
    },
  };
}

/** Offer = public candidate + display strings. */
export function toOffer(c: Candidate) {
  const p = toPublicCandidate(c);
  return {
    ...p,
    unitPriceUsd: unitPriceUsd(c.unitPrice.num, c.unitPrice.den),
    prepaidTotalUsd: formatUsd(c.prepaidTotal),
    overagePriceUsd: c.overagePrice ? unitPriceUsd(c.overagePrice.num, c.overagePrice.den) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* loading                                                              */
/* ------------------------------------------------------------------ */

export async function loadNegotiation(negId: string) {
  const [neg] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, negId));
  if (!neg) throw new HttpError(404, "negotiation not found");
  const turnRows = await db.select().from(schema.turns).where(eq(schema.turns.negotiationId, negId)).orderBy(asc(schema.turns.seq));
  const lp = await loadProductById(neg.productId);
  return { neg, turnRows, lp };
}

export async function negotiationView(negId: string) {
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  const candidates = (neg.candidates as Record<string, unknown>[]).map(reviveCandidate);
  const offers = candidates.filter((c) => c.status !== "rejected").map(toOffer);
  const req = reviveRequirements(neg.requirements as Record<string, unknown>);
  return {
    id: neg.id,
    publicId: neg.publicId,
    sellerSlug: lp.org.slug,
    sellerName: lp.org.name,
    sellerBrand: (lp.org.brand as Record<string, unknown> | null) ?? {},
    productSlug: lp.product.slug,
    productName: lp.product.name,
    productSummary: lp.product.summary ?? null,
    termDays: lp.product.termDays,
    unitLabel: lp.product.unitLabel,
    status: neg.status,
    requirements: { ...req, assumptions: req.notes },
    turns: turnRows.map((t) => ({ id: t.id, role: t.role, kind: t.kind, content: t.content, createdAt: t.createdAt, ...(t.payload as Record<string, unknown> | null) })),
    offers,
    activity: neg.activity,
    labels: { seller: lp.org.label, network: features.network, pricing: "illustrative" },
  };
}

/* ------------------------------------------------------------------ */
/* start                                                                */
/* ------------------------------------------------------------------ */

export async function startNegotiation(sellerSlug: string, productSlug: string, buyerAddress?: string) {
  const lp = await loadProductBySlugs(sellerSlug, productSlug);
  const negId = id("neg");
  const requirements: Requirements = { integrations: [], notes: [], openQuestions: [] };
  await db.insert(schema.negotiations).values({ id: negId, publicId: publicId("n"), orgId: lp.org.id, productId: lp.row.id, buyerAddress, requirements: bigintsToStrings(requirements), candidates: [], activity: [] });
  await db.insert(schema.turns).values({
    id: id("turn"),
    negotiationId: negId,
    seq: 1,
    role: "agent",
    kind: "message",
    content: `Hi, I am the deal desk for ${lp.org.name}. Tell me what you are trying to automate, roughly how much volume you expect, and the budget you are working with. I will put together options that the seller can actually deliver.`,
  });
  return negotiationView(negId);
}

/* ------------------------------------------------------------------ */
/* message                                                              */
/* ------------------------------------------------------------------ */

export async function addBuyerMessage(negId: string, content: string) {
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  if (neg.status === "accepted" || neg.status === "closed") throw new HttpError(409, "negotiation is closed");
  const started = Date.now();
  const seq = (turnRows.at(-1)?.seq ?? 0) + 1;
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq, role: "buyer", content });

  const adapter = getAgentAdapter();
  const convo: ConversationTurn[] = [...turnRows.map((t) => ({ role: t.role as ConversationTurn["role"], content: t.content })), { role: "buyer", content }];
  const injection = detectInjection(content);
  const steps: AgentStep[] = [];
  const activity: { at: string; label: string; state: "done" | "working" }[] = [];

  const prior = reviveRequirements(neg.requirements as Record<string, unknown>);
  const ext = await adapter.extractRequirements({ productName: lp.product.name, unitLabel: lp.product.unitLabel, capabilities: lp.product.capabilities, supportedIntegrations: lp.product.supportedIntegrations, starters: (lp.row.starters as string[]) ?? [], prior, turns: convo });
  steps.push(...ext.steps);
  activity.push({ at: iso(), label: "Understood the request", state: "done" });

  // Deterministic candidates. The model never touches this.
  const ctx = evaluationContext(lp);
  const candidates = getQuoteCandidates(ctx, ext.requirements);
  activity.push({ at: iso(), label: "Checked the seller's policy and capacity", state: "done" });
  steps.push({ at: iso(), label: `Evaluated ${candidates.length} candidates against policy v${lp.policy.version} and cost v${lp.cost.version}`, state: "done", detail: candidates.map((c) => `${c.tierName} ${c.units}u ${formatUsd(c.prepaidTotal)} margin ${c.economics.expectedContributionMarginBps}bps -> ${c.status}${c.rules.length ? " [" + c.rules.join(",") + "]" : ""}`).join(" | ") });

  const offers = candidates.filter((c) => c.status !== "rejected");
  const rejected = candidates.filter((c) => c.status === "rejected");

  await db.insert(schema.decisions).values({
    id: id("dec"),
    orgId: lp.org.id,
    negotiationId: negId,
    kind: injection ? "injection_blocked" : "candidates",
    ruleIds: Array.from(new Set(candidates.flatMap((c) => c.rules))),
    summary: injection ? "Buyer text attempted to override policy; evaluated normally against server-side policy." : `Generated ${offers.length} offer(s), rejected ${rejected.length}.`,
    privateBasis: bigintsToStrings({ requirements: ext.requirements, candidates, policyVersion: lp.policy.version, costVersion: lp.cost.version }),
    publicExplanation: offers.length ? "Options priced within the seller's policy." : rejected[0]?.rules.length ? (toPublicCandidate(rejected[0]).publicReasons[0] ?? "No option cleared policy.") : "Waiting for more detail.",
  });

  const composed = await adapter.composeReply({ productName: lp.product.name, unitLabel: lp.product.unitLabel, requirements: ext.requirements, offers: offers.map(toPublicCandidate), rejected: rejected.map(toPublicCandidate), injectionDetected: injection, turns: convo, facts: { termDays: lp.product.termDays, refundPolicy: lp.product.refundPolicy, billableUnit: lp.product.billableUnit, supportedIntegrations: lp.product.supportedIntegrations, capabilities: lp.product.capabilities } });
  steps.push(...composed.steps);
  activity.push({ at: iso(), label: offers.length ? "Prepared offers" : "Prepared a reply", state: "done" });

  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq: seq + 1, role: "agent", kind: offers.length ? "offers" : "message", content: composed.reply, payload: offers.length ? bigintsToStrings({ offers: offers.map(toOffer) }) : null });
  await db.insert(schema.agentRuns).values({ id: id("run"), orgId: lp.org.id, negotiationId: negId, adapter: adapter.name, steps, durationMs: Date.now() - started });
  await db
    .update(schema.negotiations)
    .set({ requirements: bigintsToStrings(ext.requirements), candidates: bigintsToStrings(candidates), activity, status: offers.length ? "quoted" : "open", updatedAt: new Date() })
    .where(eq(schema.negotiations.id, negId));

  // Approval-required candidates open an approval request when the buyer asks for a quote; nothing to do here.
  return negotiationView(negId);
}

/* ------------------------------------------------------------------ */
/* counter                                                              */
/* ------------------------------------------------------------------ */

export async function counter(negId: string, candidateId: string, ask: { targetTotal?: bigint; targetUnits?: bigint }) {
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  const candidates = (neg.candidates as Record<string, unknown>[]).map(reviveCandidate);
  const base = candidates.find((c) => c.candidateId === candidateId);
  if (!base) throw new HttpError(404, "candidate not found");
  const req = reviveRequirements(neg.requirements as Record<string, unknown>);
  const ctx = evaluationContext(lp);
  const d = evaluateCounteroffer(ctx, base, ask, req);
  const seq = (turnRows.at(-1)?.seq ?? 0) + 1;

  const askText = ask.targetTotal !== undefined ? `${base.units.toLocaleString()} ${lp.product.unitLabel}s for ${formatUsd(ask.targetTotal)}` : `${ask.targetUnits?.toLocaleString()} ${lp.product.unitLabel}s for ${formatUsd(base.prepaidTotal)}`;
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq, role: "buyer", kind: "message", content: `Counteroffer: ${askText}.` });

  let reply: string;
  const next = [...candidates];
  const upsert = (c: Candidate) => {
    const i = next.findIndex((x) => x.candidateId === c.candidateId);
    if (i >= 0) next[i] = c;
    else next.push(c);
  };
  const pub = toPublicCandidate(d.candidate);
  if (d.decision === "approved") {
    upsert(d.candidate);
    reply = `Yes, I can do ${d.candidate.units.toLocaleString()} ${lp.product.unitLabel}s for ${formatUsd(d.candidate.prepaidTotal)}. That is within what the seller allows, so you can accept it now.`;
  } else if (d.decision === "approval_required") {
    upsert(d.candidate);
    reply = `${askText} is above what I can agree on my own. I have sent it to the seller for approval. You can still accept one of the standing options meanwhile.`;
  } else {
    if (d.alternative) upsert(d.alternative);
    reply = `I cannot do ${askText}: ${(pub.publicReasons[0] ?? "it falls outside the seller's policy.").toLowerCase()}${d.alternative ? ` What I can offer at that budget is ${d.alternative.units.toLocaleString()} ${lp.product.unitLabel}s for ${formatUsd(d.alternative.prepaidTotal)}.` : ""}`;
  }

  await db.insert(schema.decisions).values({
    id: id("dec"),
    orgId: lp.org.id,
    negotiationId: negId,
    kind: "counter",
    ruleIds: d.candidate.rules,
    candidateId: d.candidate.candidateId,
    summary: `Counter ${askText}: ${d.decision}`,
    privateBasis: bigintsToStrings({ ask, evaluated: d.candidate, alternative: d.decision === "rejected" ? d.alternative : undefined, policyVersion: lp.policy.version, costVersion: lp.cost.version }),
    publicExplanation: pub.publicReasons[0] ?? "Within policy.",
  });
  await db.insert(schema.turns).values({
    id: id("turn"),
    negotiationId: negId,
    seq: seq + 1,
    role: "agent",
    kind: "decision",
    content: reply,
    payload: bigintsToStrings({ decision: { decision: d.decision, reasons: pub.publicReasons, candidate: toOffer(d.candidate), alternative: d.decision === "rejected" && d.alternative ? toOffer(d.alternative) : undefined } }),
  });
  await db.update(schema.negotiations).set({ candidates: bigintsToStrings(next), updatedAt: new Date() }).where(eq(schema.negotiations.id, negId));
  return negotiationView(negId);
}

/* ------------------------------------------------------------------ */
/* seller views                                                         */
/* ------------------------------------------------------------------ */

export async function sellerNegotiationView(orgId: string, negId: string) {
  const view = await negotiationView(negId);
  const [neg] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, negId));
  if (!neg || neg.orgId !== orgId) throw new HttpError(404, "negotiation not found");
  const candidates = (neg.candidates as Record<string, unknown>[]).map(reviveCandidate);
  const decisions = await db.select().from(schema.decisions).where(eq(schema.decisions.negotiationId, negId)).orderBy(asc(schema.decisions.createdAt));
  const agentRuns = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.negotiationId, negId)).orderBy(asc(schema.agentRuns.createdAt));
  const quoteRows = await db.select().from(schema.quotes).where(eq(schema.quotes.negotiationId, negId)).orderBy(desc(schema.quotes.createdAt));
  return { ...view, candidates, decisions, agentRuns, quotes: quoteRows.map((q) => ({ id: q.id, status: q.status, candidateId: q.candidateId, expiresAt: q.expiresAt, createdAt: q.createdAt })) };
}

export async function listNegotiations(orgId: string) {
  const rows = await db.select().from(schema.negotiations).where(eq(schema.negotiations.orgId, orgId)).orderBy(desc(schema.negotiations.updatedAt)).limit(100);
  return rows.map((n) => {
    const req = reviveRequirements(n.requirements as Record<string, unknown>);
    const cands = (n.candidates as Record<string, unknown>[]).map(reviveCandidate);
    return { id: n.id, publicId: n.publicId, status: n.status, buyerAddress: n.buyerAddress, desiredUnits: req.desiredUnits, budget: req.budget, offers: cands.filter((c) => c.status !== "rejected").length, rejected: cands.filter((c) => c.status === "rejected").length, updatedAt: n.updatedAt, createdAt: n.createdAt };
  });
}

export type { LoadedProduct, PublicCandidate };

function iso() {
  return new Date().toISOString();
}
