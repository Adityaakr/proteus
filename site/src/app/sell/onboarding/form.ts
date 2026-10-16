/**
 * Start selling form: state, validation, the POST body and the engine inputs for the live preview.
 * Money is parsed to integer micro-USDC with toMicro from @proteus/domain; nothing uses JS floats for money.
 */
import { toMicro, type CostModel, type Policy, type Product, type Requirements } from "@proteus/domain";
import type { ProductCreateBody } from "../types";

export interface TierRow {
  key: string;
  name: string;
  includedUnits: string;
  unitPriceUsd: string;
  includes: string;
}

export interface FormState {
  businessName: string;
  productName: string;
  unitLabel: string;
  billableUnit: string;
  capabilities: string[];
  integrations: string[];
  tiers: TierRow[];
  maxUnitsPerDeal: string;
  termDays: string;
  refundPolicy: string;
  variableCostUsd: string;
  directCostUsd: string;
  txCostBps: string;
  minMarginPct: string;
  maxDiscountPct: string;
  approvalThresholdUsd: string;
  prepaidMinimumUsd: string;
  capacityUnits: string;
  quoteValidityHours: string;
  perCallUsd: string;
  /** "http": your own endpoint answers every metered request. "sample": the first-party sample order store (demo). */
  serviceKind: "http" | "sample";
  upstreamUrl: string;
  upstreamAuthHeader: string;
  upstreamSecret: string;
}

let k = 0;
export const newTier = (t: Partial<TierRow> = {}): TierRow => ({ key: `t${++k}`, name: "", includedUnits: "", unitPriceUsd: "", includes: "", ...t });

export const EMPTY: FormState = {
  businessName: "",
  productName: "",
  unitLabel: "",
  billableUnit: "",
  capabilities: [],
  integrations: [],
  tiers: [newTier()],
  maxUnitsPerDeal: "",
  termDays: "30",
  refundPolicy: "",
  variableCostUsd: "",
  directCostUsd: "",
  txCostBps: "",
  minMarginPct: "",
  maxDiscountPct: "",
  approvalThresholdUsd: "",
  prepaidMinimumUsd: "",
  capacityUnits: "",
  quoteValidityHours: "48",
  perCallUsd: "",
  serviceKind: "http",
  upstreamUrl: "",
  upstreamAuthHeader: "",
  upstreamSecret: "",
};

export const EXAMPLE: FormState = {
  businessName: "Northwind Commerce",
  productName: "AI order support",
  unitLabel: "resolution",
  billableUnit: "One delivered order-status answer sourced from the store's order record",
  capabilities: ["Order status", "Delivery questions", "Human handoff"],
  integrations: ["rest-api", "shopify", "zendesk"],
  tiers: [
    newTier({ name: "Starter", includedUnits: "1500", unitPriceUsd: "0.96", includes: "Order status, Delivery questions, Human handoff" }),
    newTier({ name: "Growth", includedUnits: "2000", unitPriceUsd: "0.85", includes: "Everything in Starter, Priority support" }),
    newTier({ name: "Scale", includedUnits: "5000", unitPriceUsd: "0.72", includes: "Everything in Growth, Dedicated channel" }),
  ],
  maxUnitsPerDeal: "10000",
  termDays: "30",
  refundPolicy: "Unused prepaid units are refunded to the buyer's wallet when the term ends.",
  variableCostUsd: "0.48",
  directCostUsd: "150",
  txCostBps: "50",
  minMarginPct: "35",
  maxDiscountPct: "15",
  approvalThresholdUsd: "3000",
  prepaidMinimumUsd: "500",
  capacityUnits: "20000",
  quoteValidityHours: "48",
  perCallUsd: "1.20",
  serviceKind: "sample",
  upstreamUrl: "",
  upstreamAuthHeader: "",
  upstreamSecret: "",
};

export const SAMPLE_ASK = { label: "2,000 units with a $1,500 budget", desiredUnits: 2000n, budgetUsd: "1500" };

const USD = /^\d+(\.\d{1,6})?$/;
const INT = /^\d+$/;
const clean = (v: string) => v.replace(/[$,\s]/g, "");
const isUsd = (v: string) => USD.test(clean(v));
const isInt = (v: string) => INT.test(clean(v));
const int = (v: string) => BigInt(clean(v));
const usd = (v: string) => toMicro(clean(v));

/** "35" or "35.5" percent to integer bps; undefined when invalid. */
export function pctBps(v: string): number | undefined {
  const s = v.trim().replace("%", "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [w, f = ""] = s.split(".");
  const b = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return b <= 10000 ? b : undefined;
}

export type Errors = Partial<Record<string, string>>;

export function validate(f: FormState, hasOrg: boolean): Errors {
  const e: Errors = {};
  if (!hasOrg && !f.businessName.trim()) e.businessName = "Enter your business name. Buyers see it on your market page.";
  if (!f.productName.trim()) e.productName = "Enter a product name.";
  if (!f.unitLabel.trim()) e.unitLabel = "Enter the unit you bill for, such as resolution.";
  else if (f.unitLabel.trim().length > 32) e.unitLabel = "Keep the unit label short, one or two words.";
  if (f.billableUnit.trim().length < 20) e.billableUnit = "Describe one billable unit in a full sentence so buyers know exactly what they pay for.";
  if (f.capabilities.length === 0) e.capabilities = "Add at least one capability.";
  if (f.tiers.length === 0) e.tiers = "Add at least one tier.";
  const names = new Set<string>();
  f.tiers.forEach((t) => {
    const n = t.name.trim().toLowerCase();
    if (!n) e[`tier.${t.key}.name`] = "Name this tier.";
    else if (names.has(n)) e[`tier.${t.key}.name`] = "Tier names must be different.";
    names.add(n);
    if (!isInt(t.includedUnits) || int(t.includedUnits) <= 0n) e[`tier.${t.key}.includedUnits`] = "Whole number above zero.";
    if (!isUsd(t.unitPriceUsd) || usd(t.unitPriceUsd) <= 0n) e[`tier.${t.key}.unitPriceUsd`] = "Price in USD above zero, up to 6 decimals.";
  });
  const largest = f.tiers.reduce((m, t) => (isInt(t.includedUnits) && int(t.includedUnits) > m ? int(t.includedUnits) : m), 0n);
  if (!isInt(f.maxUnitsPerDeal) || int(f.maxUnitsPerDeal) <= 0n) e.maxUnitsPerDeal = "Whole number of units above zero.";
  else if (int(f.maxUnitsPerDeal) < largest) e.maxUnitsPerDeal = `Must be at least your largest tier (${largest.toLocaleString()} units).`;
  if (!isInt(f.termDays) || Number(clean(f.termDays)) < 1 || Number(clean(f.termDays)) > 365) e.termDays = "Between 1 and 365 days.";
  if (!f.refundPolicy.trim()) e.refundPolicy = "Tell buyers what happens to unused prepaid units.";

  if (!isUsd(f.variableCostUsd)) e.variableCostUsd = "Cost in USD, zero or more.";
  if (!isUsd(f.directCostUsd)) e.directCostUsd = "Cost in USD, zero or more.";
  if (!isInt(f.txCostBps) || Number(clean(f.txCostBps)) > 10000) e.txCostBps = "Whole basis points from 0 to 10000.";
  if (pctBps(f.minMarginPct) === undefined) e.minMarginPct = "Percent from 0 to 100.";
  if (pctBps(f.maxDiscountPct) === undefined) e.maxDiscountPct = "Percent from 0 to 100.";
  if (!isUsd(f.approvalThresholdUsd)) e.approvalThresholdUsd = "Amount in USD, zero or more.";
  if (!isUsd(f.prepaidMinimumUsd)) e.prepaidMinimumUsd = "Amount in USD, zero or more.";
  if (!isInt(f.capacityUnits) || int(f.capacityUnits) <= 0n) e.capacityUnits = "Whole number of units above zero.";
  if (!isInt(f.quoteValidityHours) || Number(clean(f.quoteValidityHours)) < 1 || Number(clean(f.quoteValidityHours)) > 168) e.quoteValidityHours = "Between 1 and 168 hours.";
  if (f.perCallUsd.trim() && (!isUsd(f.perCallUsd) || usd(f.perCallUsd) <= 0n)) e.perCallUsd = "Price in USD above zero, or leave it empty.";
  if (f.serviceKind === "http") {
    const u = f.upstreamUrl.trim();
    let ok = false;
    try {
      const parsed = new URL(u);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      ok = parsed.protocol === "https:" || (parsed.protocol === "http:" && loopback);
    } catch {
      ok = false;
    }
    if (!ok) e.upstreamUrl = "Full https URL of the endpoint PROTEUS should call for every metered request.";
    if (f.upstreamAuthHeader.trim() && !/^[A-Za-z0-9-]{1,64}$/.test(f.upstreamAuthHeader.trim())) e.upstreamAuthHeader = "Header name only, letters, digits and dashes.";
  }
  return e;
}

/** Keys the live preview needs; the preview runs once these are all valid. */
export const ENGINE_KEYS = ["maxUnitsPerDeal", "variableCostUsd", "directCostUsd", "txCostBps", "minMarginPct", "maxDiscountPct", "approvalThresholdUsd", "prepaidMinimumUsd", "capacityUnits", "quoteValidityHours"];

const splitList = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
const decimal = (v: string) => clean(v);

export function toBody(f: FormState): ProductCreateBody {
  return {
    name: f.productName.trim(),
    unitLabel: f.unitLabel.trim(),
    billableUnit: f.billableUnit.trim(),
    capabilities: f.capabilities,
    supportedIntegrations: f.integrations,
    tiers: f.tiers.map((t) => ({ name: t.name.trim(), includedUnits: Number(clean(t.includedUnits)), unitPriceUsd: decimal(t.unitPriceUsd), includes: splitList(t.includes) })),
    maxUnitsPerDeal: Number(clean(f.maxUnitsPerDeal)),
    termDays: Number(clean(f.termDays)),
    refundPolicy: f.refundPolicy.trim(),
    cost: { variableCostPerUnitUsd: decimal(f.variableCostUsd), directCostPerDealUsd: decimal(f.directCostUsd), txCostBps: Number(clean(f.txCostBps)) },
    policy: {
      minMarginBps: pctBps(f.minMarginPct)!,
      maxDiscountBps: pctBps(f.maxDiscountPct)!,
      approvalThresholdUsd: decimal(f.approvalThresholdUsd),
      prepaidMinimumUsd: decimal(f.prepaidMinimumUsd),
      availableCapacityUnits: Number(clean(f.capacityUnits)),
      quoteTtlSeconds: Number(clean(f.quoteValidityHours)) * 3600,
    },
    ...(f.perCallUsd.trim() ? { payPerCall: { priceUsd: decimal(f.perCallUsd) } } : {}),
    ...(f.serviceKind === "http"
      ? { adapter: "http" as const, upstream: { url: f.upstreamUrl.trim(), ...(f.upstreamAuthHeader.trim() ? { authHeader: f.upstreamAuthHeader.trim() } : {}), ...(f.upstreamSecret.trim() ? { secret: f.upstreamSecret.trim() } : {}) } }
      : { adapter: "order-support" as const }),
  };
}

/** Engine inputs for getQuoteCandidates, or null when the pricing fields are not valid yet. */
export function toEngine(f: FormState, errors: Errors, now: number): { product: Product; cost: CostModel; policy: Policy; now: number } | null {
  const tierErr = Object.keys(errors).some((key) => key.startsWith("tier."));
  if (tierErr || f.tiers.length === 0 || ENGINE_KEYS.some((key) => errors[key])) return null;
  const product: Product = {
    id: "preview",
    slug: "preview",
    name: f.productName || "Preview",
    billableUnit: f.billableUnit,
    unitLabel: f.unitLabel || "unit",
    supportedIntegrations: f.integrations,
    capabilities: f.capabilities,
    tiers: f.tiers.map((t) => ({ id: t.key, name: t.name.trim(), includedUnits: int(t.includedUnits), unitPrice: { num: usd(t.unitPriceUsd), den: 1n }, includes: splitList(t.includes) })),
    maxUnitsPerDeal: int(f.maxUnitsPerDeal),
    termDays: Number(clean(f.termDays)) || 30,
    refundPolicy: f.refundPolicy,
  };
  const cost: CostModel = { version: 1, variableCostPerUnit: usd(f.variableCostUsd), directCostPerDeal: usd(f.directCostUsd), txCostBps: int(f.txCostBps), freshUntil: now + 30 * 86_400_000 };
  const policy: Policy = {
    version: 1,
    minMarginBps: BigInt(pctBps(f.minMarginPct)!),
    maxDiscountBps: BigInt(pctBps(f.maxDiscountPct)!),
    approvalThreshold: usd(f.approvalThresholdUsd),
    prepaidMinimum: usd(f.prepaidMinimumUsd),
    availableCapacityUnits: int(f.capacityUnits),
    quoteTtlSeconds: Number(clean(f.quoteValidityHours)) * 3600,
    allowNonPositiveContribution: false,
  };
  return { product, cost, policy, now };
}

export function sampleRequirements(): Requirements {
  return { desiredUnits: SAMPLE_ASK.desiredUnits, budget: toMicro(SAMPLE_ASK.budgetUsd), integrations: [], notes: [], openQuestions: [] };
}
