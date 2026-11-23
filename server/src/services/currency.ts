/**
 * A seller's display currency and exchange rate. Escrow, signed terms and settlement stay in USDC; the rate only states
 * prices in rupees. Two kinds of rate, both dated and shown with every offer:
 *  - fixed: the seller's own rate with its date (a pilot rate), used until the seller changes it;
 *  - reference: the European Central Bank's daily reference rate (the feed the importer already suggests rates from),
 *    refreshed by the server and kept in fx_rates, so a restart or an unreachable feed keeps the last published rate.
 * A seller with no setting shows USD first; its buyers can still switch to rupees at the reference rate. Rupee list
 * prices and floors need a rate the seller chose, never one picked for them.
 */
import { desc, eq } from "drizzle-orm";
import { isRate, type CurrencyCode, type FxRate } from "@proteus/domain";
import { db, schema } from "../db";
import type { OrgCurrency } from "../db/schema";
import { HttpError } from "../lib/http";
import { suggestUsdRate } from "./importer/providers";

export const REFERENCE_SOURCE = "European Central Bank reference rate";
export const FIXED_SOURCE = "Seller's fixed rate";

type Fetcher = (currency: string) => Promise<{ rate: string; asOf: string; source: string } | null>;

let cached: { at: number; rate: FxRate | undefined } | undefined;
const CACHE_MS = 60_000;

/** The stored reference rate for rupees, or undefined when none was ever fetched. Cached for a minute. */
export async function referenceRate(): Promise<FxRate | undefined> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rate;
  try {
    const [row] = await db.select().from(schema.fxRates).where(eq(schema.fxRates.currency, "INR")).orderBy(desc(schema.fxRates.fetchedAt)).limit(1);
    const rate: FxRate | undefined = row && isRate(row.perUsd) ? { currency: "INR", perUsd: row.perUsd, asOf: row.asOf, kind: "reference", source: REFERENCE_SOURCE } : undefined;
    cached = { at: Date.now(), rate };
    return rate;
  } catch {
    return cached?.rate;
  }
}

/** Fetch today's reference rate and keep it. A failed fetch keeps the last stored rate (its date says how old it is). */
export async function refreshReferenceRate(fetch: Fetcher = suggestUsdRate): Promise<FxRate | undefined> {
  const r = await fetch("INR").catch(() => null);
  if (r && isRate(r.rate) && /^\d{4}-\d{2}-\d{2}$/.test(r.asOf)) {
    await db
      .insert(schema.fxRates)
      .values({ currency: "INR", perUsd: r.rate, asOf: r.asOf, source: REFERENCE_SOURCE, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: schema.fxRates.currency, set: { perUsd: r.rate, asOf: r.asOf, source: REFERENCE_SOURCE, fetchedAt: new Date() } });
    cached = undefined;
  }
  return referenceRate();
}

/** The rate a seller's prices are stated at: its fixed rate, else the reference rate. */
export function rateFor(cur: OrgCurrency | null | undefined, reference: FxRate | undefined): FxRate | undefined {
  const r = cur?.rate;
  if (r?.mode === "fixed" && isRate(r.perUsd)) return { currency: "INR", perUsd: r.perUsd, asOf: r.asOf, kind: "fixed", source: FIXED_SOURCE };
  return reference;
}

export function displayOf(cur: OrgCurrency | null | undefined): CurrencyCode {
  return cur?.display === "INR" ? "INR" : "USD";
}

/** Whether the seller chose a rate itself (needed before prices or floors are set in rupees). */
export const hasOwnRate = (cur: OrgCurrency | null | undefined) => Boolean(cur?.rate);

export async function orgFx(org: { currency: OrgCurrency | null }): Promise<FxRate | undefined> {
  return rateFor(org.currency, org.currency?.rate?.mode === "fixed" ? undefined : await referenceRate());
}

/** What buyers and the dashboard read about a seller's currency. */
export async function currencyView(org: { currency: OrgCurrency | null }) {
  const reference = await referenceRate();
  return { display: displayOf(org.currency), mode: org.currency?.rate?.mode ?? null, rate: rateFor(org.currency, reference) ?? null, reference: reference ?? null };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Validates PUT /app/currency. Pure: `reference` is the stored reference rate, `rupeePrices` whether any product is
 * priced or floored in rupees (those need a rate the seller chose).
 */
export function parseCurrencyBody(body: unknown, reference: FxRate | undefined, rupeePrices: boolean): OrgCurrency {
  const b = (body ?? {}) as { display?: unknown; rate?: unknown };
  if (b.display !== "USD" && b.display !== "INR") throw new HttpError(400, "display must be USD or INR");
  const r = b.rate as { mode?: unknown; perUsd?: unknown; asOf?: unknown } | null | undefined;
  let rate: OrgCurrency["rate"];
  if (r === null || r === undefined) rate = undefined;
  else if (r.mode === "fixed") {
    const perUsd = typeof r.perUsd === "string" || typeof r.perUsd === "number" ? String(r.perUsd).trim() : "";
    if (!isRate(perUsd)) throw new HttpError(400, "enter the rate as rupees per 1 USD, for example 92.68 (up to 4 decimals)");
    const asOf = typeof r.asOf === "string" ? r.asOf.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) throw new HttpError(400, "give the date the rate is for, as YYYY-MM-DD");
    if (asOf > today()) throw new HttpError(400, "the rate's date cannot be in the future");
    rate = { mode: "fixed", perUsd, asOf };
  } else if (r.mode === "reference") {
    if (!reference) throw new HttpError(409, "The daily reference rate is not available right now. Set a fixed rate, or try again later.");
    rate = { mode: "reference" };
  } else throw new HttpError(400, "rate.mode must be fixed or reference");
  if (b.display === "INR" && !rate) throw new HttpError(400, "showing rupees first needs a rate: a fixed rate with its date, or the daily reference rate");
  if (!rate && rupeePrices) throw new HttpError(409, "Some of your prices or floors are set in rupees, so they need a rate. Keep a rate, or set those prices in USD first.");
  return { display: b.display, ...(rate ? { rate } : {}) };
}

/** Whether any of the seller's products has a rupee list price or a rupee floor. */
export async function hasRupeePrices(orgId: string): Promise<boolean> {
  const rows = await db.select({ id: schema.products.id, pub: schema.products.public }).from(schema.products).where(eq(schema.products.orgId, orgId));
  for (const r of rows) {
    if (((r.pub as { tiers?: { unitPriceInr?: unknown }[] }).tiers ?? []).some((t) => t.unitPriceInr != null)) return true;
    const [cost] = await db.select({ inr: schema.costModels.floorUnitPriceInr }).from(schema.costModels).where(eq(schema.costModels.productId, r.id)).orderBy(desc(schema.costModels.version)).limit(1);
    if (cost?.inr != null) return true;
  }
  return false;
}

export async function saveCurrency(orgId: string, body: unknown) {
  let reference = await referenceRate();
  if (!reference && (body as { rate?: { mode?: unknown } } | null)?.rate?.mode === "reference") reference = await refreshReferenceRate();
  const next = parseCurrencyBody(body, reference, await hasRupeePrices(orgId));
  await db.update(schema.orgs).set({ currency: next }).where(eq(schema.orgs.id, orgId));
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  return currencyView(org!);
}
