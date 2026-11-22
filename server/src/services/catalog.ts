import { howItWorksToday, isScheduling } from "./calendar";
import { and, desc, eq } from "drizzle-orm";
import { applyFx, formatUnitPrice, formatUsd, fromPaise, isInrAmount, mulDivFloor, toPaise, unitPriceToInr, usdcToInr, type CostModel, type EvaluationContext, type FxRate, type Policy, type Product, type Tier } from "@proteus/domain";
import { displayOf, orgFx } from "./currency";
import { db, schema } from "../db";
import { nameColours } from "../lib/colours";
import { HttpError } from "../lib/http";

export interface LoadedProduct {
  org: typeof schema.orgs.$inferSelect;
  row: typeof schema.products.$inferSelect;
  product: Product;
  cost: CostModel;
  policy: Policy;
  costRow: typeof schema.costModels.$inferSelect;
  policyRow: typeof schema.policies.$inferSelect;
  /** The seller's current rate (fixed or reference), when it has one. Rupee list prices are already converted at it. */
  fx?: FxRate;
}

/** Revive a stored public product (bigints as strings) into the domain type. */
export function reviveProduct(p: Record<string, unknown>): Product {
  const tiers = (p.tiers as Array<Record<string, unknown>>).map<Tier>((t) => ({
    id: String(t.id),
    name: String(t.name),
    includedUnits: BigInt(String(t.includedUnits)),
    unitPrice: { num: BigInt(String((t.unitPrice as Record<string, unknown>).num)), den: BigInt(String((t.unitPrice as Record<string, unknown>).den)) },
    overagePrice: t.overagePrice ? { num: BigInt(String((t.overagePrice as Record<string, unknown>).num)), den: BigInt(String((t.overagePrice as Record<string, unknown>).den)) } : undefined,
    includes: (t.includes as string[]) ?? [],
    ...(isInrAmount(t.unitPriceInr) ? { unitPriceInr: toPaise(t.unitPriceInr) } : {}),
  }));
  return {
    id: String(p.id),
    slug: String(p.slug),
    name: String(p.name),
    billableUnit: String(p.billableUnit),
    unitLabel: String(p.unitLabel),
    supportedIntegrations: (p.supportedIntegrations as string[]) ?? [],
    capabilities: (p.capabilities as string[]) ?? [],
    tiers,
    maxUnitsPerDeal: BigInt(String(p.maxUnitsPerDeal)),
    termDays: Number(p.termDays),
    refundPolicy: String(p.refundPolicy),
    ...(typeof p.summary === "string" && p.summary ? { summary: p.summary } : {}),
    ...(typeof p.category === "string" && p.category ? { category: p.category } : {}),
    ...(p.request && typeof p.request === "object" && Array.isArray((p.request as { fields?: unknown }).fields) ? { request: p.request as Product["request"] } : {}),
    ...(p.knowledge && typeof p.knowledge === "object" ? { knowledge: p.knowledge as Product["knowledge"] } : {}),
  };
}

export function costFromRow(r: typeof schema.costModels.$inferSelect): CostModel {
  return { version: r.version, variableCostPerUnit: r.variableCostPerUnit, directCostPerDeal: r.directCostPerDeal, txCostBps: BigInt(r.txCostBps), freshUntil: r.freshUntil.getTime(), ...(r.floorUnitPrice !== null ? { floorUnitPrice: r.floorUnitPrice } : {}), ...(r.floorUnitPriceInr != null ? { floorUnitPriceInr: r.floorUnitPriceInr } : {}) };
}

export function policyFromRow(r: typeof schema.policies.$inferSelect): Policy {
  return {
    version: r.version,
    minMarginBps: BigInt(r.minMarginBps),
    maxDiscountBps: BigInt(r.maxDiscountBps),
    approvalThreshold: r.approvalThreshold,
    prepaidMinimum: r.prepaidMinimum,
    availableCapacityUnits: r.availableCapacityUnits,
    quoteTtlSeconds: r.quoteTtlSeconds,
    allowNonPositiveContribution: r.allowNonPositiveContribution,
  };
}

/**
 * Lumen Voice's original copy promised phone calls and calendar entries that the service does not do on these
 * deployments. Until the stored rows are edited, the old wording is replaced when read, and only while it is still the
 * exact old text, so any later edit by the seller wins. No stored data is changed.
 */
const LEGACY_COPY: Record<string, { old: string; fix: Partial<Product> }> = {
  "lumen-voice/ai-receptionist": {
    old: "Answers inbound calls for service businesses, books appointments and hands off anything it should not decide.",
    fix: { summary: "Front desk for service businesses: answers your customers by chat or voice on your link or website, takes bookings and hands off anything it should not decide.", billableUnit: "one customer request handled and a booking or message recorded for you", capabilities: ["Answer customer questions", "Take bookings"] },
  },
  "lumen-voice/after-hours-answering": {
    old: "Covers the phone when the office is closed: takes the message, books the slot, and escalates emergencies to the on-call line.",
    fix: { summary: "Covers your front desk when the office is closed: takes the message, records the booking request, and flags emergencies to you at once.", billableUnit: "One after-hours customer request handled and either recorded as a booking request, taken as a message, or flagged as an emergency, with a written summary for the business.", capabilities: ["Message taking", "Booking requests", "Emergency flags", "Written summaries"] },
  },
};

function withCurrentCopy(orgSlug: string, product: Product): Product {
  const legacy = LEGACY_COPY[`${orgSlug}/${product.slug}`];
  return legacy && product.summary === legacy.old ? { ...product, ...legacy.fix } : product;
}

export async function loadProductById(productId: string): Promise<LoadedProduct> {
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!row) throw new HttpError(404, "product not found");
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, row.orgId));
  if (!org) throw new HttpError(404, "org not found");
  const [costRow] = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, row.id)).orderBy(desc(schema.costModels.version)).limit(1);
  const [policyRow] = await db.select().from(schema.policies).where(eq(schema.policies.productId, row.id)).orderBy(desc(schema.policies.version)).limit(1);
  if (!costRow || !policyRow) throw new HttpError(500, "product has no cost model or policy");
  const fx = await orgFx(org);
  const product = applyFx(withCurrentCopy(org.slug, reviveProduct(row.public as Record<string, unknown>)), fx);
  return { org, row, product, cost: costFromRow(costRow), policy: policyFromRow(policyRow), costRow, policyRow, ...(fx ? { fx } : {}) };
}

export async function loadProductBySlugs(sellerSlug: string, productSlug: string): Promise<LoadedProduct> {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, sellerSlug));
  if (!org) throw new HttpError(404, "seller not found");
  const [row] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.slug, productSlug)));
  if (!row) throw new HttpError(404, "product not found");
  return loadProductById(row.id);
}

export function evaluationContext(lp: LoadedProduct, now = Date.now()): EvaluationContext {
  return { product: lp.product, cost: lp.cost, policy: lp.policy, now, ...(lp.fx ? { fx: lp.fx } : {}) };
}

/** Buyer-safe product projection. */
export function publicProduct(lp: LoadedProduct) {
  const p = lp.product;
  return {
    /** Scheduling services: what they do on this deployment, in plain words. */
    ...(isScheduling(lp) ? { today: howItWorksToday() } : {}),
    slug: p.slug,
    name: p.name,
    billableUnit: p.billableUnit,
    unitLabel: p.unitLabel,
    capabilities: p.capabilities,
    supportedIntegrations: p.supportedIntegrations,
    tiers: p.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      includedUnits: t.includedUnits.toString(),
      unitPriceUsd: unitPriceUsd(t.unitPrice.num, t.unitPrice.den),
      prepaidTotalUsd: formatUsd(mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den)),
      /** The prepaid total in micro-USDC (what escrow takes). */
      prepaidTotal: mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den).toString(),
      includes: t.includes,
      inr: tierInr(t, lp.fx),
    })),
    /** How the seller shows prices, and the rate rupee amounts are stated at (null: no rate, USD only). */
    currency: { display: displayOf(lp.org.currency), rate: lp.fx ?? null },
    termDays: p.termDays,
    refundPolicy: p.refundPolicy,
    summary: p.summary ?? null,
    category: p.category ?? null,
    request: p.request ?? null,
    knowledge: p.knowledge ? { ...p.knowledge, ...nameColours({ options: p.knowledge.options ?? [], variants: p.knowledge.variants ?? [] }) } : null,
    maxUnitsPerDeal: p.maxUnitsPerDeal.toString(),
    payPerCallUsd: lp.row.payPerCallPrice ? formatUsd(lp.row.payPerCallPrice, 4) : null,
    service: lp.row.adapter === "http" ? "seller-endpoint" : lp.row.adapter === "demo" ? "example" : "sample-store",
    starters: (lp.row.starters as string[]) ?? [],
    labels: { seller: lp.org.label, network: "testnet", pricing: "illustrative" },
  };
}

/**
 * A tier in rupees: the seller's own rupee price ("stated"), or its USDC converted at the rate for display. Null without
 * a rate. Decimal strings ("1050.00").
 */
export function tierInr(t: Tier, fx: FxRate | undefined): { unitPrice: string; prepaidTotal: string; stated: boolean } | null {
  if (t.unitPriceInr !== undefined) return { unitPrice: fromPaise(t.unitPriceInr), prepaidTotal: fromPaise(t.unitPriceInr * t.includedUnits), stated: true };
  if (!fx) return null;
  return { unitPrice: fromPaise(unitPriceToInr(t.unitPrice, fx)), prepaidTotal: fromPaise(usdcToInr(mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den), fx)), stated: false };
}

/** Per-unit price for buyers and docs: two decimals ("$6.50"), up to four for sub-cent prices ("$0.035"). */
export function unitPriceUsd(num: bigint, den: bigint): string {
  return formatUnitPrice(num, den);
}
