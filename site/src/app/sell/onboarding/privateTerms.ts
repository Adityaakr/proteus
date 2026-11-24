/**
 * The seller's private terms (cost model and pricing policy) as form fields, shared by "New product" and prepared
 * listings. Sellers type these in while signed in; they are sent only to the authenticated product API and never belong
 * in a file the site serves.
 */
import type { ProductCreateBody } from "../types";

export interface PrivateTerms {
  variableCostUsd: string;
  directCostUsd: string;
  txCostBps: string;
  minMarginPct: string;
  maxDiscountPct: string;
  approvalThresholdUsd: string;
  prepaidMinimumUsd: string;
  capacityUnits: string;
  quoteValidityHours: string;
}

export const EMPTY_PRIVATE_TERMS: PrivateTerms = {
  variableCostUsd: "",
  directCostUsd: "",
  txCostBps: "",
  minMarginPct: "",
  maxDiscountPct: "",
  approvalThresholdUsd: "",
  prepaidMinimumUsd: "",
  capacityUnits: "",
  quoteValidityHours: "48",
};

export const PRIVATE_TERM_FIELDS: { key: keyof PrivateTerms; label: string; placeholder: string; hint: string; inputMode: "decimal" | "numeric" }[] = [
  { key: "variableCostUsd", label: "Variable cost per unit USD", placeholder: "0.48", hint: "What one unit costs you to deliver.", inputMode: "decimal" },
  { key: "directCostUsd", label: "Direct cost per deal USD", placeholder: "150", hint: "Setup or onboarding per deal.", inputMode: "decimal" },
  { key: "txCostBps", label: "Transaction cost bps", placeholder: "50", hint: "100 bps is 1% of revenue.", inputMode: "numeric" },
  { key: "minMarginPct", label: "Minimum margin %", placeholder: "35", hint: "The floor. Offers below it are refused.", inputMode: "decimal" },
  { key: "maxDiscountPct", label: "Max discount %", placeholder: "15", hint: "From list unit price.", inputMode: "decimal" },
  { key: "approvalThresholdUsd", label: "Approval threshold USD", placeholder: "3000", hint: "Larger deals wait for you.", inputMode: "decimal" },
  { key: "prepaidMinimumUsd", label: "Prepaid minimum USD", placeholder: "500", hint: "Smallest deal you accept.", inputMode: "decimal" },
  { key: "capacityUnits", label: "Available capacity units", placeholder: "20000", hint: "Units you can still commit.", inputMode: "numeric" },
  { key: "quoteValidityHours", label: "Quote validity hours", placeholder: "48", hint: "How long an offer can be signed.", inputMode: "numeric" },
];

const USD = /^\d+(\.\d{1,6})?$/;
const INT = /^\d+$/;
export const clean = (v: string) => v.replace(/[$,\s]/g, "");
export const isUsd = (v: string) => USD.test(clean(v));
export const isInt = (v: string) => INT.test(clean(v));
export const int = (v: string) => BigInt(clean(v));

/** "35" or "35.5" percent to integer bps; undefined when invalid. */
export function pctBps(v: string): number | undefined {
  const s = v.trim().replace("%", "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [w, f = ""] = s.split(".");
  const b = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return b <= 10000 ? b : undefined;
}

export function validatePrivateTerms(t: PrivateTerms): Partial<Record<keyof PrivateTerms, string>> {
  const e: Partial<Record<keyof PrivateTerms, string>> = {};
  if (!isUsd(t.variableCostUsd)) e.variableCostUsd = "Cost in USD, zero or more.";
  if (!isUsd(t.directCostUsd)) e.directCostUsd = "Cost in USD, zero or more.";
  if (!isInt(t.txCostBps) || Number(clean(t.txCostBps)) > 10000) e.txCostBps = "Whole basis points from 0 to 10000.";
  if (pctBps(t.minMarginPct) === undefined) e.minMarginPct = "Percent from 0 to 100.";
  if (pctBps(t.maxDiscountPct) === undefined) e.maxDiscountPct = "Percent from 0 to 100.";
  if (!isUsd(t.approvalThresholdUsd)) e.approvalThresholdUsd = "Amount in USD, zero or more.";
  if (!isUsd(t.prepaidMinimumUsd)) e.prepaidMinimumUsd = "Amount in USD, zero or more.";
  if (!isInt(t.capacityUnits) || int(t.capacityUnits) <= 0n) e.capacityUnits = "Whole number of units above zero.";
  if (!isInt(t.quoteValidityHours) || Number(clean(t.quoteValidityHours)) < 1 || Number(clean(t.quoteValidityHours)) > 168) e.quoteValidityHours = "Between 1 and 168 hours.";
  return e;
}

/** The cost model and policy for POST /app/products. Call only when validatePrivateTerms found nothing. */
export function privateTermsBody(t: PrivateTerms): Pick<ProductCreateBody, "cost" | "policy"> {
  return {
    cost: { variableCostPerUnitUsd: clean(t.variableCostUsd), directCostPerDealUsd: clean(t.directCostUsd), txCostBps: Number(clean(t.txCostBps)) },
    policy: {
      minMarginBps: pctBps(t.minMarginPct)!,
      maxDiscountBps: pctBps(t.maxDiscountPct)!,
      approvalThresholdUsd: clean(t.approvalThresholdUsd),
      prepaidMinimumUsd: clean(t.prepaidMinimumUsd),
      availableCapacityUnits: Number(clean(t.capacityUnits)),
      quoteTtlSeconds: Number(clean(t.quoteValidityHours)) * 3600,
    },
  };
}
