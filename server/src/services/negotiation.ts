import { and, asc, desc, eq, ne } from "drizzle-orm";
import { amountText, applyFx, evaluateCounteroffer, formatUsd, getQuoteCandidates, greetingText, inrBudgetToUsdc, inrToUsdc, localPriceJson, mulDivFloor, offerTotalText, reviveLocalPrice, sellerGreeting, toPaise, toPublicCandidate, type Candidate, type CounterDecision, type CurrencyCode, type GreetingProduct, type PriceView, type Product, type PublicCandidate, type Requirements, pluralUnit, unitFor } from "@proteus/domain";
import { displayOf } from "./currency";
import { detectInjection, getAgentAdapter, redactPersonalData, type AgentStep, type ConversationTurn, type UnlistedAsk } from "../agent";
import { answersCustomRequest, findUnlisted, itemsText, requestedItems, sameKindListed, type ListedProduct } from "../agent/unlisted";
import { db, schema } from "../db";
import { HttpError, bigintsToStrings } from "../lib/http";
import { id, negotiationKey, publicId, sha256 } from "../lib/ids";
import { openJsonOr, openTextOr, sealJson, sealText } from "../lib/vault";
import { timingSafeEqual } from "node:crypto";
import { evaluationContext, loadProductById, loadProductBySlugs, publicProduct, reviveProduct, unitPriceUsd, type LoadedProduct } from "./catalog";
import { env, features } from "../env";
import { enqueue } from "./notify";
import { nameColourCodesInProse, nameColours } from "../lib/colours";

/* ------------------------------------------------------------------ */
/* revive helpers                                                       */
/* ------------------------------------------------------------------ */

export function reviveRequirements(r: Record<string, unknown>): Requirements {
  return {
    desiredUnits: r.desiredUnits != null ? BigInt(String(r.desiredUnits)) : undefined,
    budget: r.budget != null ? BigInt(String(r.budget)) : undefined,
    ...(r.budgetInr != null ? { budgetInr: BigInt(String(r.budgetInr)) } : {}),
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
    ...(reviveLocalPrice(c.local) ? { local: reviveLocalPrice(c.local)! } : {}),
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

/**
 * Offer = public candidate + display strings. `local` is the offer in rupees ("1050.00" per unit, "42000.00" in all)
 * with the dated rate it is fixed at; null when the seller has no rate. Escrow takes prepaidTotal micro-USDC either way.
 */
export function toOffer(c: Candidate) {
  const { local, ...p } = toPublicCandidate(c);
  return {
    ...p,
    unitPriceUsd: unitPriceUsd(c.unitPrice.num, c.unitPrice.den),
    prepaidTotalUsd: formatUsd(c.prepaidTotal),
    overagePriceUsd: c.overagePrice ? unitPriceUsd(c.overagePrice.num, c.overagePrice.den) : undefined,
    local: local ? localPriceJson(local) : null,
  };
}

/** The currency this buyer reads prices in: their choice, else the seller's; rupees only when the seller has a rate. */
export function buyerCurrency(neg: { currency: string | null }, lp: Pick<LoadedProduct, "org" | "fx">): CurrencyCode {
  const c = neg.currency === "INR" || neg.currency === "USD" ? neg.currency : displayOf(lp.org.currency);
  return c === "INR" && lp.fx ? "INR" : "USD";
}

export function priceView(neg: { currency: string | null }, lp: Pick<LoadedProduct, "org" | "fx">): PriceView {
  return { currency: buyerCurrency(neg, lp), ...(lp.fx ? { fx: lp.fx } : {}) };
}

/** A rupee budget the buyer stated, converted at the seller's rate (rounded down); without a rate it is dropped. */
export function withRupeeBudget(r: Requirements, lp: Pick<LoadedProduct, "fx">): Requirements {
  if (r.budgetInr === undefined) return r;
  if (!lp.fx) {
    const { budgetInr: _drop, ...rest } = r;
    return rest;
  }
  return { ...r, budget: inrBudgetToUsdc(r.budgetInr, lp.fx) };
}

/* ------------------------------------------------------------------ */
/* loading                                                              */
/* ------------------------------------------------------------------ */

export async function loadNegotiation(negId: string) {
  const [neg] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, negId));
  if (!neg) throw new HttpError(404, "negotiation not found");
  const sealed = await db.select().from(schema.turns).where(eq(schema.turns.negotiationId, negId)).orderBy(asc(schema.turns.seq));
  const turnRows = await Promise.all(sealed.map(async (t) => ({ ...t, content: await openTextOr(neg.orgId, t.content) })));
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
    /** buyer: the currency the agent quotes in; display: the seller's; rate: what rupee amounts are stated at (null: none). */
    currency: { buyer: buyerCurrency(neg, lp), display: displayOf(lp.org.currency), rate: lp.fx ?? null },
    labels: { seller: lp.org.label, network: features.network, pricing: "illustrative" },
  };
}

/* ------------------------------------------------------------------ */
/* start                                                                */
/* ------------------------------------------------------------------ */

/**
 * How a negotiation opens. "open": a buyer started from the store page, so the agent greets for the whole store.
 * "continue": the store conversation moved here from another product, so it only says where it is now.
 */
export type StoreOpening = "open" | "continue";

/** Every listed product of the seller, with the public lines its website gave (for the store greeting's facts). */
async function storeProducts(lp: LoadedProduct): Promise<GreetingProduct[]> {
  const rows = await db.select({ p: schema.products.public }).from(schema.products).where(and(eq(schema.products.orgId, lp.org.id), eq(schema.products.active, true)));
  return rows.map(({ p }) => {
    const v = p as { name?: unknown; knowledge?: { notes?: unknown } };
    const notes = Array.isArray(v.knowledge?.notes) ? v.knowledge.notes.filter((n): n is string => typeof n === "string") : [];
    return { name: String(v.name ?? ""), notes };
  });
}

/**
 * The agent's first message: a short welcome, the key facts from the seller's own site (minimum order, production
 * time, samples) and an invitation to say what is needed. Prices are not listed here; the agent quotes them when asked.
 */
function greeting(lp: LoadedProduct, store: StoreOpening | undefined, products: GreetingProduct[]): string {
  if (store === "continue") return `Now on ${lp.product.name.toLowerCase()}.`;
  if (store === "open" && products.length > 1) return greetingText(sellerGreeting(lp.org.name, products));
  const self: GreetingProduct = { name: lp.product.name, notes: lp.product.knowledge?.notes ?? [] };
  return greetingText(sellerGreeting(lp.org.name, [self], self));
}

export async function startNegotiation(sellerSlug: string, productSlug: string, buyerAddress?: string, store?: StoreOpening, currency?: CurrencyCode) {
  const lp = await loadProductBySlugs(sellerSlug, productSlug);
  const storeItems = store === "open" ? await storeProducts(lp) : [];
  const negId = id("neg");
  const access = negotiationKey();
  const requirements: Requirements = { integrations: [], notes: [], openQuestions: [] };
  await db.insert(schema.negotiations).values({ id: negId, publicId: publicId("n"), orgId: lp.org.id, productId: lp.row.id, buyerAddress, buyerKeyHash: access.hash, ...(currency ? { currency } : {}), requirements: bigintsToStrings(requirements), candidates: [], activity: [] });
  await db.insert(schema.turns).values({
    id: id("turn"),
    negotiationId: negId,
    seq: 1,
    role: "agent",
    kind: "message",
    content: await sealText(lp.org.id, greeting(lp, store, storeItems)),
  });
  // The key is returned only here. Every later read or write of this negotiation presents it (X-Negotiation-Key),
  // so a forwarded or leaked negotiation id alone does not expose the buyer's conversation.
  return { ...(await negotiationView(negId)), buyerKey: access.key };
}

/**
 * A negotiation is readable and writable by whoever holds its key, or by a signed-in user who owns the buyer wallet.
 * Negotiations started before keys existed (null hash) stay open by id, as they were.
 */
export async function assertNegotiationAccess(negId: string, key: string | undefined, ownsBuyer: (address: string) => Promise<boolean>) {
  const [n] = await db.select({ hash: schema.negotiations.buyerKeyHash, buyer: schema.negotiations.buyerAddress }).from(schema.negotiations).where(eq(schema.negotiations.id, negId));
  if (!n) throw new HttpError(404, "negotiation not found");
  if (!n.hash) return;
  if (key) {
    const a = Buffer.from(sha256(key)), b = Buffer.from(n.hash);
    if (a.length === b.length && timingSafeEqual(a, b)) return;
  }
  if (n.buyer && (await ownsBuyer(n.buyer))) return;
  throw new HttpError(403, "This negotiation needs its key: send the buyerKey returned when it started in the X-Negotiation-Key header.", { code: "negotiation_key_required" });
}

/* ------------------------------------------------------------------ */
/* message                                                              */
/* ------------------------------------------------------------------ */

/** The buyer switched currency: later replies quote in it. */
export async function setNegotiationCurrency(negId: string, currency: CurrencyCode | undefined) {
  if (currency) await db.update(schema.negotiations).set({ currency }).where(eq(schema.negotiations.id, negId));
}

export async function addBuyerMessage(negId: string, content: string, currency?: CurrencyCode) {
  await setNegotiationCurrency(negId, currency);
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  if (neg.status === "accepted" || neg.status === "closed") throw new HttpError(409, "negotiation is closed");
  const started = Date.now();
  const seq = (turnRows.at(-1)?.seq ?? 0) + 1;
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq, role: "buyer", content: await sealText(lp.org.id, content) });
  const view = priceView(neg, lp);

  const listed = await listedProducts(lp, view);
  const current = { ...listedOf(lp.product, view), id: lp.row.id, slug: lp.row.slug };
  const others = listed.filter((p) => p.id !== lp.row.id);

  // The agent offered to send the seller a custom request for an unlisted item, and this message is that request.
  const pending = pendingCustomRequest(turnRows);
  if (pending && answersCustomRequest(content, pending, [current, ...others])) return sendCustomRequest(negId, lp, seq, pending, content, started);

  const adapter = getAgentAdapter();
  // The model provider gets the conversation without contact details (emails, phone and card numbers).
  const convo: ConversationTurn[] = [...turnRows.map((t) => ({ role: t.role as ConversationTurn["role"], content: redactPersonalData(t.content) })), { role: "buyer", content: redactPersonalData(content) }];
  const injection = detectInjection(content);
  const steps: AgentStep[] = [];
  const activity: { at: string; label: string; state: "done" | "working" }[] = [];

  const prior = reviveRequirements(neg.requirements as Record<string, unknown>);
  const ext = await adapter.extractRequirements({ productName: lp.product.name, unitLabel: lp.product.unitLabel, capabilities: lp.product.capabilities, supportedIntegrations: lp.product.supportedIntegrations, starters: (lp.row.starters as string[]) ?? [], prior, turns: convo });
  steps.push(...ext.steps);
  // "₹40,000": the engine works in USDC, so a rupee budget is converted at the seller's rate (rounded down).
  ext.requirements = withRupeeBudget(ext.requirements, lp);
  activity.push({ at: iso(), label: "Understood the request", state: "done" });
  // Shown to the buyer: an earlier turn may still hold a colour code, and the model may repeat it.
  ext.requirements.notes = ext.requirements.notes.map(nameColourCodesInProse);
  ext.requirements.openQuestions = ext.requirements.openQuestions.map(nameColourCodesInProse);

  // A kind of product no listed product is ("i want caps" at a store with no caps): checked here, on every listed product.
  const missing = findUnlisted(content, current, others, ext.askedFor ?? []);
  const unlisted: UnlistedAsk | undefined = missing
    ? { items: itemsText(missing.items), alsoListed: missing.alsoListed, closest: missing.closest.map((p) => ({ name: p.name, smallestPack: p.smallestPack ?? "", current: p === current })), listed: [current, ...others].slice(0, 4).map((p) => p.name), sellerName: lp.org.name }
    : undefined;
  if (unlisted) steps.push({ at: iso(), label: `Not listed: ${unlisted.items}`, state: "done", detail: unlisted.closest.length ? `closest listed: ${unlisted.closest.map((c) => c.name).join(", ")}` : "nothing listed is close" });
  // "i want caps" on a cap, where the seller lists several caps: the buyer gets the choice, not just this one.
  // Only what this message itself asks for: a model reading "caps" back out of the conversation would repeat the list.
  const kin = sameKindListed(content, [current]).length ? sameKindListed(content, others) : [];
  const choices = kin.length ? { kind: requestedItems(content)[0]?.phrase ?? pluralUnit(lp.product.unitLabel), products: kin.slice(0, 6).map((p) => ({ name: p.name, smallestPack: p.smallestPack ?? "" })), total: kin.length, sellerName: lp.org.name } : undefined;
  if (unlisted && !unlisted.alsoListed) return replyUnlisted(negId, lp, seq, unlisted, { convo, injection, steps, activity, started, requirements: ext.requirements, view });

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
    privateBasis: await sealJson(lp.org.id, bigintsToStrings({ requirements: ext.requirements, candidates, policyVersion: lp.policy.version, costVersion: lp.cost.version })),
    publicExplanation: offers.length ? "Options priced within the seller's policy." : rejected[0]?.rules.length ? (toPublicCandidate(rejected[0]).publicReasons[0] ?? "No option cleared policy.") : "Waiting for more detail.",
  });

  const catalog = await sellerCatalog(lp, view);
  const composed = await adapter.composeReply({ productName: lp.product.name, unitLabel: lp.product.unitLabel, requirements: ext.requirements, offers: offers.map(toPublicCandidate), rejected: rejected.map(toPublicCandidate), injectionDetected: injection, turns: convo, facts: productFacts(lp), catalog, unlisted, choices, view });
  steps.push(...composed.steps);
  composed.reply = nameColourCodesInProse(composed.reply);
  activity.push({ at: iso(), label: offers.length ? "Prepared offers" : "Prepared a reply", state: "done" });

  const payload = offers.length ? { offers: offers.map(toOffer) } : {};
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq: seq + 1, role: "agent", kind: offers.length ? "offers" : "message", content: await sealText(lp.org.id, composed.reply), payload: Object.keys(payload).length ? bigintsToStrings(payload) : null });
  await db.insert(schema.agentRuns).values({ id: id("run"), orgId: lp.org.id, negotiationId: negId, adapter: adapter.name, steps: await sealJson(lp.org.id, steps), durationMs: Date.now() - started });
  await db
    .update(schema.negotiations)
    .set({ requirements: bigintsToStrings(ext.requirements), candidates: bigintsToStrings(candidates), activity, status: offers.length ? "quoted" : "open", updatedAt: new Date() })
    .where(eq(schema.negotiations.id, negId));

  // Approval-required candidates open an approval request when the buyer asks for a quote; nothing to do here.
  return negotiationView(negId);
}

/* ------------------------------------------------------------------ */
/* unlisted items and custom requests                                   */
/* ------------------------------------------------------------------ */

export type Listed = ListedProduct & { id: string; slug: string };

/** "10 sweatshirts for $86.30": the smallest list pack, as the buyer would see it. */
function listedOf(p: Product, view?: PriceView): ListedProduct {
  const small = [...p.tiers].sort((a, b) => (a.includedUnits < b.includedUnits ? -1 : a.includedUnits > b.includedUnits ? 1 : 0))[0];
  return { name: p.name, unitLabel: p.unitLabel, category: p.category, summary: p.summary, capabilities: p.capabilities, smallestPack: small ? `${small.includedUnits.toLocaleString()} ${unitFor(small.includedUnits, p.unitLabel)} for ${tierTotalText(small, view)}` : "" };
}

/** A list tier's total in the buyer's currency: the seller's rupee price when it set one. */
function tierTotalText(t: Product["tiers"][number], view?: PriceView): string {
  const usdc = mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den);
  return amountText(usdc, view, t.unitPriceInr !== undefined ? t.unitPriceInr * t.includedUnits : undefined);
}

/** Every product the seller lists, in one read: what "is this listed?" is checked against. */
export async function listedProducts(lp: LoadedProduct, view?: PriceView): Promise<Listed[]> {
  const rows = await db.select({ id: schema.products.id, slug: schema.products.slug, pub: schema.products.public }).from(schema.products).where(and(eq(schema.products.orgId, lp.org.id), eq(schema.products.active, true)));
  return rows.map((r) => ({ ...listedOf(applyFx(reviveProduct(r.pub as Record<string, unknown>), lp.fx), view), id: r.id, slug: r.slug }));
}

/** No offers for an item the seller does not list: the reply says so plainly, names the closest listed products and offers a custom request. */
async function replyUnlisted(negId: string, lp: LoadedProduct, seq: number, unlisted: UnlistedAsk, run: { convo: ConversationTurn[]; injection: boolean; steps: AgentStep[]; activity: { at: string; label: string; state: "done" | "working" }[]; started: number; requirements: Requirements; view?: PriceView }) {
  const adapter = getAgentAdapter();
  const composed = await adapter.composeReply({ productName: lp.product.name, unitLabel: lp.product.unitLabel, requirements: run.requirements, offers: [], rejected: [], injectionDetected: run.injection, turns: run.convo, facts: productFacts(lp), catalog: await sellerCatalog(lp, run.view), unlisted, view: run.view });
  run.steps.push(...composed.steps);
  composed.reply = nameColourCodesInProse(composed.reply);
  run.activity.push({ at: iso(), label: "Checked what the seller lists", state: "done" }, { at: iso(), label: "Prepared a reply", state: "done" });
  await db.insert(schema.decisions).values({
    id: id("dec"),
    orgId: lp.org.id,
    negotiationId: negId,
    kind: "unlisted_request",
    ruleIds: [],
    summary: `Buyer asked for ${unlisted.items.toLowerCase()}, which is not listed; no offers shown.`,
    privateBasis: await sealJson(lp.org.id, { items: unlisted.items, closest: unlisted.closest.map((c) => c.name) }),
    publicExplanation: `${unlisted.items} not listed; offered to send the seller a custom request.`,
  });
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq: seq + 1, role: "agent", kind: "message", content: await sealText(lp.org.id, composed.reply), payload: { customRequest: { items: unlisted.items } } });
  await db.insert(schema.agentRuns).values({ id: id("run"), orgId: lp.org.id, negotiationId: negId, adapter: adapter.name, steps: await sealJson(lp.org.id, run.steps), durationMs: Date.now() - run.started });
  // The numbers in this message were about the unlisted item: this product's requirements and offers stay as they were.
  await db.update(schema.negotiations).set({ activity: run.activity, updatedAt: new Date() }).where(eq(schema.negotiations.id, negId));
  return negotiationView(negId);
}

/** Sends the seller the buyer's custom request (kept with this conversation, notified on the seller's channels without the buyer's text). */
/** The items of a custom request the agent's last turn offered to send, if it did. */
export function pendingCustomRequest(turnRows: { role: string; payload: unknown }[]): string | undefined {
  const last = turnRows.at(-1);
  const items = last?.role === "agent" ? (last.payload as { customRequest?: { items?: unknown } } | null)?.customRequest?.items : undefined;
  return typeof items === "string" ? items : undefined;
}

export async function sendCustomRequest(negId: string, lp: LoadedProduct, seq: number, items: string, content: string, started: number) {
  const contact = /@|\+?\d[\d\s().-]{8,}\d/.test(content);
  const reply = `I have sent ${lp.org.name} your custom request for ${items.toLowerCase()}, with your message. They decide whether they can make it and get back to you${contact ? "" : "; if you have not left an email or phone number, add one here so they can reach you"}. Anything ${lp.org.name} lists, I can quote right here.`;
  await db.insert(schema.decisions).values({
    id: id("dec"),
    orgId: lp.org.id,
    negotiationId: negId,
    kind: "custom_request",
    ruleIds: [],
    summary: `Custom request for ${items.toLowerCase()}: the buyer's message is in the conversation.`,
    privateBasis: await sealJson(lp.org.id, { items, message: content.slice(0, 2000) }),
    publicExplanation: "Sent to the seller as a custom request.",
  });
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq: seq + 1, role: "agent", kind: "message", content: await sealText(lp.org.id, reply) });
  await db.insert(schema.agentRuns).values({ id: id("run"), orgId: lp.org.id, negotiationId: negId, adapter: "rule-based", steps: await sealJson(lp.org.id, [{ at: iso(), label: `Custom request for ${items} sent to the seller`, state: "done" }]), durationMs: Date.now() - started });
  await db.update(schema.negotiations).set({ activity: [{ at: iso(), label: "Sent your custom request to the seller", state: "done" }], updatedAt: new Date() }).where(eq(schema.negotiations.id, negId));
  await enqueue(lp.org.id, "custom_request", `custom-request:${negId}:${seq}`, { product: items, link: `${env.WEB_ORIGIN}/app/sell/negotiations/${negId}` }).catch(() => {});
  return negotiationView(negId);
}

/* ------------------------------------------------------------------ */
/* counter                                                              */
/* ------------------------------------------------------------------ */

/** The agent's answer to a counter: deterministic, from the engine's decision only. */
export function counterReply(d: CounterDecision, askText: string, unitLabel: string, view?: PriceView): string {
  if (d.decision === "approved") return `Yes, I can do ${d.candidate.units.toLocaleString()} ${unitFor(d.candidate.units, unitLabel)} for ${offerTotalText(d.candidate, view)}. That is within what the seller allows, so you can accept it now.`;
  if (d.decision === "approval_required") return `${askText} is above what I can agree on my own. I have sent it to the seller for approval. You can still accept one of the standing options meanwhile.`;
  const reason = toPublicCandidate(d.candidate).publicReasons[0] ?? "it falls outside the seller's policy.";
  return `I cannot do ${askText}: ${reason.toLowerCase()}${d.alternative ? ` What I can offer at that budget is ${d.alternative.units.toLocaleString()} ${pluralUnit(unitLabel)} for ${offerTotalText(d.alternative, view)}.` : ""}`;
}

/** "50 tees for $400.00", "60 tees for $480.00" or "50 tees for ₹40,000 (≈ 431.59 USDC)": the buyer's counter in the transcript. */
export function counterAskText(base: Candidate, ask: { targetTotal?: bigint; targetTotalInr?: bigint; targetUnits?: bigint }, unitLabel: string, view?: PriceView): string {
  const units = `${base.units.toLocaleString()} ${unitFor(base.units, unitLabel)}`;
  if (ask.targetTotalInr !== undefined && view?.fx) return `${units} for ${amountText(inrToUsdc(ask.targetTotalInr, view.fx), { ...view, currency: "INR" }, ask.targetTotalInr)}`;
  return ask.targetTotal !== undefined ? `${units} for ${amountText(ask.targetTotal, view)}` : `${ask.targetUnits?.toLocaleString()} ${pluralUnit(unitLabel)} for ${offerTotalText(base, view)}`;
}

/** Public facts the agent may answer from: the product's terms and what was imported from the seller's website. */
export function productFacts(lp: { product: LoadedProduct["product"] }) {
  const p = lp.product;
  const k = p.knowledge;
  return {
    termDays: p.termDays,
    refundPolicy: p.refundPolicy,
    billableUnit: p.billableUnit,
    supportedIntegrations: p.supportedIntegrations,
    capabilities: p.capabilities,
    // Products imported before colour codes were named still carry them ("#273a6b"); the agent reads names.
    ...(k ? { knowledge: { ...nameColours({ options: k.options ?? [], variants: k.variants ?? [] }), notes: k.notes ?? [], policies: (k.policies ?? []).map((x) => ({ kind: x.kind, summary: x.summary })), sourceUrl: k.sourceUrl } } : {}),
  };
}

export async function counter(negId: string, candidateId: string, ask: { targetTotal?: bigint; targetTotalInr?: bigint; targetUnits?: bigint }, currency?: CurrencyCode) {
  await setNegotiationCurrency(negId, currency);
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  const candidates = (neg.candidates as Record<string, unknown>[]).map(reviveCandidate);
  const base = candidates.find((c) => c.candidateId === candidateId);
  if (!base) throw new HttpError(404, "candidate not found");
  if (ask.targetTotalInr !== undefined && !lp.fx) throw new HttpError(409, "This seller has no rupee rate; counter with a USDC total instead.");
  const req = reviveRequirements(neg.requirements as Record<string, unknown>);
  const ctx = evaluationContext(lp);
  const d = evaluateCounteroffer(ctx, base, ask, req);
  const seq = (turnRows.at(-1)?.seq ?? 0) + 1;
  const view = priceView(neg, lp);

  const askText = counterAskText(base, ask, lp.product.unitLabel, view);
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq, role: "buyer", kind: "message", content: await sealText(lp.org.id, `Counteroffer: ${askText}.`) });

  let reply: string;
  const next = [...candidates];
  const upsert = (c: Candidate) => {
    const i = next.findIndex((x) => x.candidateId === c.candidateId);
    if (i >= 0) next[i] = c;
    else next.push(c);
  };
  const pub = toPublicCandidate(d.candidate);
  if (d.decision === "rejected") {
    if (d.alternative) upsert(d.alternative);
  } else upsert(d.candidate);
  reply = counterReply(d, askText, lp.product.unitLabel, view);

  await db.insert(schema.decisions).values({
    id: id("dec"),
    orgId: lp.org.id,
    negotiationId: negId,
    kind: "counter",
    ruleIds: d.candidate.rules,
    candidateId: d.candidate.candidateId,
    summary: `Counter ${askText}: ${d.decision}`,
    privateBasis: await sealJson(lp.org.id, bigintsToStrings({ ask, evaluated: d.candidate, alternative: d.decision === "rejected" ? d.alternative : undefined, policyVersion: lp.policy.version, costVersion: lp.cost.version })),
    publicExplanation: pub.publicReasons[0] ?? "Within policy.",
  });
  await db.insert(schema.turns).values({
    id: id("turn"),
    negotiationId: negId,
    seq: seq + 1,
    role: "agent",
    kind: "decision",
    content: await sealText(lp.org.id, reply),
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
  const decisionRows = await db.select().from(schema.decisions).where(eq(schema.decisions.negotiationId, negId)).orderBy(asc(schema.decisions.createdAt));
  const runRows = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.negotiationId, negId)).orderBy(asc(schema.agentRuns.createdAt));
  const decisions = await Promise.all(decisionRows.map(async (d) => ({ ...d, privateBasis: await openJsonOr(orgId, d.privateBasis, {}) })));
  const agentRuns = await Promise.all(runRows.map(async (r) => ({ ...r, steps: await openJsonOr(orgId, r.steps, []) })));
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

/** The seller's other listed products as public lines, so the agent can point a buyer to the right one. */
async function sellerCatalog(lp: LoadedProduct, view?: PriceView): Promise<{ sellerName: string; products: { name: string; unitLabel: string; detail: string; smallestPack: string }[] } | undefined> {
  const rows = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.orgId, lp.org.id), eq(schema.products.active, true), ne(schema.products.id, lp.row.id)));
  if (!rows.length) return undefined;
  const products: { name: string; unitLabel: string; detail: string; smallestPack: string }[] = [];
  // In rupees a tier reads "₹1,050 (≈ 11.33 USDC) each, ₹1,050 (≈ 11.33 USDC)"; in USD exactly as before.
  const rupees = view?.currency === "INR" && view.fx ? view : undefined;
  const each = (t: ReturnType<typeof publicProduct>["tiers"][number]) => (rupees && t.inr ? amountText(BigInt(t.prepaidTotal) / BigInt(t.includedUnits), rupees, t.inr.stated ? toPaise(t.inr.unitPrice) : undefined) : t.unitPriceUsd);
  const total = (t: ReturnType<typeof publicProduct>["tiers"][number]) => (rupees && t.inr ? amountText(BigInt(t.prepaidTotal), rupees, t.inr.stated ? toPaise(t.inr.prepaidTotal) : undefined) : t.prepaidTotalUsd);
  for (const r of rows.slice(0, 8)) {
    const p = publicProduct(await loadProductById(r.id));
    const tiers = p.tiers.map((t) => `${t.name}: ${Number(t.includedUnits).toLocaleString()} ${unitFor(t.includedUnits, p.unitLabel)} at ${each(t)} each, ${total(t)}`).join("; ");
    const small = [...p.tiers].sort((a, b) => Number(a.includedUnits) - Number(b.includedUnits))[0];
    products.push({ name: p.name, unitLabel: p.unitLabel, detail: `${p.name} (${p.summary ?? p.unitLabel}). List tiers: ${tiers}.`, smallestPack: small ? `${Number(small.includedUnits).toLocaleString()} ${unitFor(small.includedUnits, p.unitLabel)} for ${total(small)}` : "" });
  }
  return { sellerName: lp.org.name, products };
}
