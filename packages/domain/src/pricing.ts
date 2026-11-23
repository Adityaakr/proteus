import { BPS, bpsOf, mulDivFloor, type Micro, type UnitPrice } from "./money";
import { inrFloorHolds, inrToUsdc, unitPriceToInr, usdcToInr, type FxRate, type LocalPrice, type Paise } from "./fx";

/* ------------------------------------------------------------------ */
/* Seller-side configuration                                           */
/* ------------------------------------------------------------------ */

/** Public product definition. Safe to show buyers. */
export type RequestFieldType = "text" | "textarea" | "number" | "file";
export interface RequestField {
  /** Key in the request `input` object, e.g. "invoice". */
  key: string;
  label: string;
  type: RequestFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}
export interface RequestSpec {
  /** One sentence shown above the form, e.g. "Send the invoice as PDF or JSON." */
  intro?: string;
  fields: RequestField[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** What one billable unit is, e.g. "a supported order-status answer acknowledged by the buyer". */
  billableUnit: string;
  unitLabel: string; // "resolution"
  /** Integrations the seller actually supports, lower-case ids e.g. "rest-api", "zendesk". */
  supportedIntegrations: string[];
  /** Public capabilities list. */
  capabilities: string[];
  /** One-line public summary (optional, shown in the market). */
  summary?: string;
  /** Market category id, e.g. "support", "voice", "data" (optional). */
  category?: string;
  /** What a buyer sends per request. Drives the request form and documents the contract. */
  request?: RequestSpec;
  tiers: Tier[];
  /** Hard ceiling for a single deal, in units per term. */
  maxUnitsPerDeal: bigint;
  termDays: number;
  /** Refund policy text shown to buyers; enforced by the contract's end+grace rule. */
  refundPolicy: string;
  /** Public facts imported from the seller's own website. Context for the agent's answers; never a source of prices. */
  knowledge?: ProductKnowledge;
}

/**
 * What the website importer learned about one product. All of it comes from the seller's own public site and was shown
 * to the seller before publishing. Offers never take a number from here: prices come only from tiers and the engine.
 */
export interface ProductKnowledge {
  sourceUrl?: string;
  /** The list price as the website shows it, before conversion to USDC (rate = website currency per 1 USD). */
  listPrice?: { amount: string; currency: string; usdRate?: string };
  /** Variant names, e.g. colours and sizes (at most 30). */
  variants?: string[];
  options?: { name: string; values: string[] }[];
  imageUrl?: string;
  category?: string;
  /** Short lines the agent may answer from: minimum order, lead time, customisation. */
  notes?: string[];
  /** The seller's store-wide policies as short summaries, each with the page it came from. */
  policies?: { kind: string; summary: string; url?: string }[];
  importedAt?: string;
}

export interface Tier {
  id: string;
  name: string;
  includedUnits: bigint;
  /** List unit price (micro-USDC per unit). Prepaid total = includedUnits * price. */
  unitPrice: UnitPrice;
  /**
   * The list price as the seller set it in rupees (paise per unit). When present it is the source of truth: unitPrice
   * is the rupee total for includedUnits converted once at the seller's current rate (applyFx), so the rupee price holds
   * when the rate moves.
   */
  unitPriceInr?: Paise;
  /** Overage price per unit beyond includedUnits, if allowed. */
  overagePrice?: UnitPrice;
  /** Features included. */
  includes: string[];
}

/** Seller-private cost model. NEVER serialized to buyer-facing responses. */
export interface CostModel {
  version: number;
  /** Variable fulfillment cost per unit (micro-USDC). */
  variableCostPerUnit: Micro;
  /** Direct per-deal costs allocated (micro-USDC), e.g. provisioning. */
  directCostPerDeal: Micro;
  /** Transaction/settlement costs in bps of revenue. */
  txCostBps: bigint;
  /** Fresh until this unix ms; stale cost models force conservative handling. */
  freshUntil: number;
  /**
   * Lowest price per unit the seller accepts (micro-USDC), whatever the tier, discount or counter. Enforced exactly:
   * an offer is rejected when its prepaid total is below units x floor. Optional; without it only margin and discount apply.
   */
  floorUnitPrice?: Micro;
  /**
   * The same kind of floor stated in rupees (paise per unit). Checked exactly against each offer's USDC total at the
   * current rate, so the agent never goes below it when the rate moves. Without a rate it refuses every offer.
   */
  floorUnitPriceInr?: Paise;
}

/** Seller-private commercial policy. NEVER serialized to buyer-facing responses. */
export interface Policy {
  version: number;
  /** Minimum expected contribution margin in bps (e.g. 3500 = 35%). */
  minMarginBps: bigint;
  /** Maximum discount from list unit price in bps. */
  maxDiscountBps: bigint;
  /** Deals with prepaid total above this need owner approval. */
  approvalThreshold: Micro;
  /** Minimum prepaid total accepted. */
  prepaidMinimum: Micro;
  /** Units the seller can still commit this period. */
  availableCapacityUnits: bigint;
  /** Quote validity in seconds. */
  quoteTtlSeconds: number;
  /** Allow zero/negative contribution for a labeled test product. */
  allowNonPositiveContribution: boolean;
}

/* ------------------------------------------------------------------ */
/* Buyer requirements                                                  */
/* ------------------------------------------------------------------ */

export interface Requirements {
  /** Units per term the buyer wants, if stated. */
  desiredUnits?: bigint;
  /** Budget per term in micro-USDC, if stated. */
  budget?: Micro;
  /** The same budget as the buyer said it in rupees (paise), when they did; budget is it converted (rounded down). */
  budgetInr?: Paise;
  /** Integrations the buyer needs. */
  integrations: string[];
  /** Free-text constraints the model extracted (never trusted for money). */
  notes: string[];
  /** Things the agent should ask about. */
  openQuestions: string[];
  industry?: string;
  useCase?: string;
}

/* ------------------------------------------------------------------ */
/* Deterministic evaluation                                            */
/* ------------------------------------------------------------------ */

export type RuleId =
  | "MARGIN_FLOOR_BPS"
  | "NON_POSITIVE_CONTRIBUTION"
  | "MAX_DISCOUNT_BPS"
  | "CAPACITY"
  | "APPROVAL_THRESHOLD"
  | "PREPAID_MINIMUM"
  | "MAX_UNITS_PER_DEAL"
  | "UNSUPPORTED_INTEGRATION"
  | "COST_MODEL_STALE"
  | "FLOOR_PRICE";

export type CandidateStatus = "eligible" | "approval_required" | "rejected";

/** Private economics, seller-only. */
export interface Economics {
  expectedRevenue: Micro;
  expectedVariableCost: Micro;
  expectedTxCost: Micro;
  allocatedDirectCost: Micro;
  expectedContribution: Micro;
  expectedContributionMarginBps: bigint;
  discountBps: bigint;
}

export interface Candidate {
  /** Opaque, deterministic id derived from inputs; the model only ever passes this around. */
  candidateId: string;
  tierId: string;
  tierName: string;
  units: bigint;
  unitPrice: UnitPrice;
  prepaidTotal: Micro;
  overagePrice?: UnitPrice;
  includes: string[];
  /** Integrations from the buyer's request that this seller supports. */
  supportedIntegrations: string[];
  /** Integrations the buyer asked for that the seller does not support. */
  unsupportedIntegrations: string[];
  status: CandidateStatus;
  /** Rule ids that fired. Empty for eligible. */
  rules: RuleId[];
  /** Why this candidate exists, buyer-safe. */
  origin: "tier" | "budget_fit" | "requested_units" | "counter";
  /** All reasons this candidate was generated (a budget fit can coincide with a tier). */
  origins: Candidate["origin"][];
  /** The offer in rupees, with the rate it is fixed at. Present when the seller has a rate. Buyer-safe. */
  local?: LocalPrice;
  /** SELLER ONLY. Stripped before any buyer-facing response. */
  economics: Economics;
}

export interface EvaluationContext {
  product: Product;
  cost: CostModel;
  policy: Policy;
  now: number;
  /** The seller's current rate. Rupee list prices and floors are converted and checked at it; offers carry it. */
  fx?: FxRate;
}

/** Whether a candidate's price depends on the rate (a rupee list price or floor), so the rate is part of its id. */
function priceUsesRate(ctx: EvaluationContext, tier: Tier): boolean {
  return Boolean(ctx.fx) && (tier.unitPriceInr !== undefined || ctx.cost.floorUnitPriceInr !== undefined);
}

/**
 * The deterministic id of a (tier, units, price) proposal under the context's cost and policy versions, and the rate
 * when the price depends on it. A quote recomputes it: an offer made before the seller changed its rules or before the
 * rate moved cannot be signed.
 */
export function candidateIdFor(ctx: EvaluationContext, tier: Tier, units: bigint, unitPrice: UnitPrice): string {
  const parts: (string | number | bigint)[] = [ctx.product.id, tier.id, units.toString(), unitPrice.num.toString(), unitPrice.den.toString(), ctx.cost.version, ctx.policy.version];
  if (priceUsesRate(ctx, tier)) parts.push(`fx:${ctx.fx!.perUsd}@${ctx.fx!.asOf}`);
  return stableId(parts);
}

/** A rupee list price for `units`: the rupee total converted once (rounded up to the cent), spread over the units. */
export function inrListPrice(unitPriceInr: Paise, units: bigint, fx: FxRate): UnitPrice {
  return units > 0n ? { num: inrToUsdc(units * unitPriceInr, fx), den: units } : { num: inrToUsdc(unitPriceInr, fx), den: 1n };
}

/** Rupee list prices converted at the rate, for the tier's own units. Without a rate, the stored USDC prices stand. */
export function applyFx(product: Product, fx: FxRate | undefined): Product {
  if (!fx || !product.tiers.some((t) => t.unitPriceInr !== undefined)) return product;
  return { ...product, tiers: product.tiers.map((t) => (t.unitPriceInr === undefined ? t : { ...t, unitPrice: inrListPrice(t.unitPriceInr, t.includedUnits, fx) })) };
}

/** The offer in rupees: the seller's rupee list price, the buyer's rupee counter, or (else) its USDC converted. */
function localFor(ctx: EvaluationContext, tier: Tier, units: bigint, unitPrice: UnitPrice, prepaidTotal: Micro, localTotal?: Paise): LocalPrice | undefined {
  const fx = ctx.fx;
  if (!fx) return undefined;
  const list = listPriceForUnits(ctx, tier, units);
  const atList = tier.unitPriceInr !== undefined && unitPrice.num * list.den === list.num * unitPrice.den;
  if (atList) return { currency: "INR", unitPrice: tier.unitPriceInr!, total: units * tier.unitPriceInr!, stated: true, rate: fx };
  if (localTotal !== undefined && units > 0n) return { currency: "INR", unitPrice: (localTotal * 2n + units) / (2n * units), total: localTotal, stated: true, rate: fx };
  return { currency: "INR", unitPrice: unitPriceToInr(unitPrice, fx), total: usdcToInr(prepaidTotal, fx), stated: false, rate: fx };
}

/** The tier's list price for `units`: a rupee list price converts the rupee total for those units once. */
export function listPriceForUnits(ctx: Pick<EvaluationContext, "fx">, tier: Tier, units: bigint): UnitPrice {
  return tier.unitPriceInr !== undefined && ctx.fx ? inrListPrice(tier.unitPriceInr, units, ctx.fx) : tier.unitPrice;
}

/** Evaluate one concrete (tier, units, unitPrice) proposal against seller economics and policy. */
export function evaluate(
  ctx: EvaluationContext,
  input: { tier: Tier; units: bigint; unitPrice: UnitPrice; origin: Candidate["origin"]; requested: Requirements; localTotal?: Paise },
): Candidate {
  const { product, cost, policy, now } = ctx;
  const { tier, units, unitPrice, origin, requested } = input;
  const rules: RuleId[] = [];

  const prepaidTotal = mulDivFloor(units, unitPrice.num, unitPrice.den);
  const list = listPriceForUnits(ctx, tier, units);
  const listTotal = mulDivFloor(units, list.num, list.den);
  const discountBps = listTotal > 0n && listTotal > prepaidTotal ? bpsOf(listTotal - prepaidTotal, listTotal) : 0n;

  const expectedRevenue = prepaidTotal;
  const expectedVariableCost = units * cost.variableCostPerUnit;
  const expectedTxCost = (expectedRevenue * cost.txCostBps) / BPS;
  const allocatedDirectCost = cost.directCostPerDeal;
  const expectedContribution = expectedRevenue - expectedVariableCost - expectedTxCost - allocatedDirectCost;
  const expectedContributionMarginBps = expectedRevenue > 0n ? bpsOf(expectedContribution, expectedRevenue) : 0n;

  if (now > cost.freshUntil) rules.push("COST_MODEL_STALE");
  if (cost.floorUnitPrice !== undefined && prepaidTotal < units * cost.floorUnitPrice) rules.push("FLOOR_PRICE");
  // A rupee floor needs a rate to be checked against; without one nothing is offered rather than guessing.
  else if (cost.floorUnitPriceInr !== undefined && (!ctx.fx || !inrFloorHolds(prepaidTotal, units, cost.floorUnitPriceInr, ctx.fx))) rules.push("FLOOR_PRICE");
  if (expectedContribution <= 0n && !policy.allowNonPositiveContribution) rules.push("NON_POSITIVE_CONTRIBUTION");
  if (expectedContributionMarginBps < policy.minMarginBps) rules.push("MARGIN_FLOOR_BPS");
  if (discountBps > policy.maxDiscountBps) rules.push("MAX_DISCOUNT_BPS");
  if (units > policy.availableCapacityUnits) rules.push("CAPACITY");
  if (units > product.maxUnitsPerDeal) rules.push("MAX_UNITS_PER_DEAL");
  if (prepaidTotal < policy.prepaidMinimum) rules.push("PREPAID_MINIMUM");

  const unsupportedIntegrations = requested.integrations.filter((i) => !product.supportedIntegrations.includes(i));
  const supportedIntegrations = requested.integrations.filter((i) => product.supportedIntegrations.includes(i));
  // Unsupported integrations do not reject the candidate; they are disclosed and excluded from terms.
  if (unsupportedIntegrations.length) rules.push("UNSUPPORTED_INTEGRATION");

  const hardRejects: RuleId[] = ["MARGIN_FLOOR_BPS", "NON_POSITIVE_CONTRIBUTION", "MAX_DISCOUNT_BPS", "CAPACITY", "MAX_UNITS_PER_DEAL", "PREPAID_MINIMUM", "COST_MODEL_STALE", "FLOOR_PRICE"];
  let status: CandidateStatus = "eligible";
  if (rules.some((r) => hardRejects.includes(r))) status = "rejected";
  else if (prepaidTotal > policy.approvalThreshold) {
    rules.push("APPROVAL_THRESHOLD");
    status = "approval_required";
  }

  const candidateId = candidateIdFor(ctx, tier, units, unitPrice);
  const local = localFor(ctx, tier, units, unitPrice, prepaidTotal, input.localTotal);

  return {
    candidateId,
    tierId: tier.id,
    tierName: tier.name,
    units,
    unitPrice,
    prepaidTotal,
    overagePrice: tier.overagePrice,
    includes: tier.includes,
    supportedIntegrations,
    unsupportedIntegrations,
    status,
    rules,
    origin,
    origins: [origin],
    ...(local ? { local } : {}),
    economics: { expectedRevenue, expectedVariableCost, expectedTxCost, allocatedDirectCost, expectedContribution, expectedContributionMarginBps, discountBps },
  };
}

/** Round units down to a sensible step so budget-fit offers read cleanly (e.g. 1,537 -> 1,500). */
export function roundUnitsDown(units: bigint, step = 100n): bigint {
  if (units < step) return units;
  return (units / step) * step;
}

/**
 * Deterministic candidate generation:
 *  - every tier at list price,
 *  - the buyer's requested units at the nearest tier's list price,
 *  - a budget-fit candidate: the most units the budget buys at the cheapest eligible tier's list price.
 * The model never changes a number here; it only chooses among returned candidateIds.
 */
export function getQuoteCandidates(ctx: EvaluationContext, req: Requirements): Candidate[] {
  const { product } = ctx;
  const out: Candidate[] = [];
  const push = (c: Candidate) => {
    const existing = out.find((x) => x.candidateId === c.candidateId);
    if (existing) {
      if (!existing.origins.includes(c.origin)) existing.origins.push(c.origin);
      return;
    }
    out.push(c);
  };

  for (const tier of product.tiers) {
    push(evaluate(ctx, { tier, units: tier.includedUnits, unitPrice: listPriceForUnits(ctx, tier, tier.includedUnits), origin: "tier", requested: req }));
  }

  if (req.desiredUnits && req.desiredUnits > 0n) {
    const tier = qualifyingTier(product, req.desiredUnits);
    push(evaluate(ctx, { tier, units: req.desiredUnits, unitPrice: listPriceForUnits(ctx, tier, req.desiredUnits), origin: "requested_units", requested: req }));
  }

  if (req.budget && req.budget > 0n) {
    // Tiers are volume thresholds: a tier's unit price applies only at or above its included units.
    // Walk from the largest tier down and take the first one the budget qualifies for.
    const byVolumeDesc = [...product.tiers].sort((a, b) => (a.includedUnits < b.includedUnits ? 1 : -1));
    for (const tier of byVolumeDesc) {
      // A rupee budget against a rupee list price is compared in rupees; otherwise in USDC.
      const inRupees = req.budgetInr !== undefined && tier.unitPriceInr !== undefined && Boolean(ctx.fx);
      const within = (u: bigint) => {
        if (inRupees) return u * tier.unitPriceInr! <= req.budgetInr!;
        const p = listPriceForUnits(ctx, tier, u);
        return mulDivFloor(u, p.num, p.den) <= req.budget!;
      };
      let most = inRupees ? req.budgetInr! / tier.unitPriceInr! : (req.budget * tier.unitPrice.den) / tier.unitPrice.num;
      if (most > 0n && !within(most)) most -= 1n;
      const unitsAffordable = roundUnitsDown(most);
      if (unitsAffordable < tier.includedUnits && tier !== byVolumeDesc[byVolumeDesc.length - 1]) continue;
      if (unitsAffordable <= 0n) continue;
      const c = evaluate(ctx, { tier, units: unitsAffordable, unitPrice: listPriceForUnits(ctx, tier, unitsAffordable), origin: "budget_fit", requested: req });
      push(c);
      if (c.status !== "rejected") break;
    }
  }

  // Sort: eligible first, then approval_required, then rejected. Within a status the candidate that matches
  // what the buyer asked for comes first (their units, then their budget), then by contribution desc, so the
  // recommended offer is the one sized to the request rather than the largest tier.
  const rank = (s: CandidateStatus) => (s === "eligible" ? 0 : s === "approval_required" ? 1 : 2);
  const fit = (c: Candidate) => (c.origins.includes("requested_units") ? 0 : c.origins.includes("budget_fit") ? 1 : 2);
  return out.sort((a, b) => rank(a.status) - rank(b.status) || fit(a) - fit(b) || (b.economics.expectedContribution > a.economics.expectedContribution ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Counteroffers                                                       */
/* ------------------------------------------------------------------ */

export interface CounterRequest {
  /** Buyer wants this total for the same units (micro-USDC). */
  targetTotal?: Micro;
  /** Or this total in rupees (paise), converted at the context's rate (rounded up to the cent). Needs ctx.fx. */
  targetTotalInr?: Paise;
  /** Or this many units for the same total. */
  targetUnits?: bigint;
}

export type CounterDecision =
  | { decision: "approved"; candidate: Candidate }
  | { decision: "approval_required"; candidate: Candidate }
  | { decision: "rejected"; candidate: Candidate; alternative?: Candidate };

/**
 * Evaluate a buyer counter against a base candidate. Deterministic; the model only relays the ask.
 * If the ask is rejected, returns the best eligible alternative that respects the buyer's budget.
 */
export function evaluateCounteroffer(ctx: EvaluationContext, base: Candidate, ask: CounterRequest, req: Requirements): CounterDecision {
  const tier = ctx.product.tiers.find((t) => t.id === base.tierId);
  if (!tier) throw new Error("unknown tier");

  let units = base.units;
  let unitPrice: UnitPrice = base.unitPrice;
  let localTotal: Paise | undefined;
  if (ask.targetTotalInr !== undefined && ask.targetTotalInr > 0n) {
    if (!ctx.fx) throw new Error("a rupee counter needs the seller's rate");
    ask = { ...ask, targetTotal: inrToUsdc(ask.targetTotalInr, ctx.fx) };
    localTotal = ask.targetTotalInr;
  }
  if (ask.targetTotal !== undefined && ask.targetTotal > 0n) {
    unitPrice = { num: ask.targetTotal, den: units };
  } else if (ask.targetUnits !== undefined && ask.targetUnits > 0n) {
    units = ask.targetUnits;
    unitPrice = { num: base.prepaidTotal, den: units };
    // Same total for more units: a rupee total the offer stated stays the total.
    if (base.local?.stated) localTotal = base.local.total;
  }
  const proposed = evaluate(ctx, { tier, units, unitPrice, origin: "counter", requested: req, localTotal });
  if (proposed.status === "eligible") return { decision: "approved", candidate: proposed };
  if (proposed.status === "approval_required") return { decision: "approval_required", candidate: proposed };

  // Alternative: fit the buyer's implied budget with fewer units at list price.
  const impliedBudget = ask.targetTotal ?? base.prepaidTotal;
  const { budgetInr: _stated, ...rest } = req;
  const alt = getQuoteCandidates(ctx, { ...rest, budget: impliedBudget, ...(localTotal !== undefined ? { budgetInr: localTotal } : {}), desiredUnits: undefined }).find((c) => c.status === "eligible" && c.origins.includes("budget_fit"));
  return { decision: "rejected", candidate: proposed, alternative: alt };
}

/* ------------------------------------------------------------------ */
/* Buyer-safe projection                                               */
/* ------------------------------------------------------------------ */

export type PublicCandidate = Omit<Candidate, "economics" | "rules"> & {
  /** Buyer-visible reason codes only. */
  publicReasons: string[];
};

const PRICE_REASON = "That price is outside what the seller can offer for this package.";

const PUBLIC_REASON: Partial<Record<RuleId, string>> = {
  // Price rules share one reason on purpose: distinct texts would tell a buyer which private limit it hit
  // (margin floor vs discount cap vs prepaid minimum), which helps search for the seller's floor.
  MARGIN_FLOOR_BPS: PRICE_REASON,
  NON_POSITIVE_CONTRIBUTION: PRICE_REASON,
  MAX_DISCOUNT_BPS: PRICE_REASON,
  CAPACITY: "The seller cannot commit that much volume this period.",
  MAX_UNITS_PER_DEAL: "That volume is above the maximum for a single agreement.",
  PREPAID_MINIMUM: PRICE_REASON,
  UNSUPPORTED_INTEGRATION: "One or more requested integrations are not available and are excluded from the terms.",
  APPROVAL_THRESHOLD: "An agreement of this size needs the seller's approval before it can be offered.",
  COST_MODEL_STALE: "The seller's pricing inputs need a refresh before this can be offered.",
  FLOOR_PRICE: PRICE_REASON,
};

/** Strip seller-private economics and rule ids. This is the ONLY projection buyers may see. */
export function toPublicCandidate(c: Candidate): PublicCandidate {
  const { economics: _e, rules, ...rest } = c;
  const publicReasons = Array.from(new Set(rules.map((r) => PUBLIC_REASON[r]).filter((s): s is string => Boolean(s))));
  return { ...rest, publicReasons };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Largest tier whose included units are <= the requested units, else the smallest tier. */
export function qualifyingTier(product: Product, units: bigint): Tier {
  const asc = [...product.tiers].sort((a, b) => (a.includedUnits < b.includedUnits ? -1 : 1));
  let best = asc[0]!;
  for (const t of asc) if (t.includedUnits <= units) best = t;
  return best;
}


/** Deterministic short id from inputs (FNV-1a 64-bit over the joined string, base36). */
export function stableId(parts: (string | number | bigint)[]): string {
  const s = parts.map(String).join("|");
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return "c_" + h.toString(36);
}
