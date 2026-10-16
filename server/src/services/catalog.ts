import { and, desc, eq } from "drizzle-orm";
import { formatUsd, mulDivFloor, type CostModel, type EvaluationContext, type Policy, type Product, type Tier } from "@proteus/domain";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";

export interface LoadedProduct {
  org: typeof schema.orgs.$inferSelect;
  row: typeof schema.products.$inferSelect;
  product: Product;
  cost: CostModel;
  policy: Policy;
  costRow: typeof schema.costModels.$inferSelect;
  policyRow: typeof schema.policies.$inferSelect;
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
  };
}

export function costFromRow(r: typeof schema.costModels.$inferSelect): CostModel {
  return { version: r.version, variableCostPerUnit: r.variableCostPerUnit, directCostPerDeal: r.directCostPerDeal, txCostBps: BigInt(r.txCostBps), freshUntil: r.freshUntil.getTime() };
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

export async function loadProductById(productId: string): Promise<LoadedProduct> {
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!row) throw new HttpError(404, "product not found");
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, row.orgId));
  if (!org) throw new HttpError(404, "org not found");
  const [costRow] = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, row.id)).orderBy(desc(schema.costModels.version)).limit(1);
  const [policyRow] = await db.select().from(schema.policies).where(eq(schema.policies.productId, row.id)).orderBy(desc(schema.policies.version)).limit(1);
  if (!costRow || !policyRow) throw new HttpError(500, "product has no cost model or policy");
  return { org, row, product: reviveProduct(row.public as Record<string, unknown>), cost: costFromRow(costRow), policy: policyFromRow(policyRow), costRow, policyRow };
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
  return { product: lp.product, cost: lp.cost, policy: lp.policy, now };
}

/** Buyer-safe product projection. */
export function publicProduct(lp: LoadedProduct) {
  const p = lp.product;
  return {
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
      includes: t.includes,
    })),
    termDays: p.termDays,
    refundPolicy: p.refundPolicy,
    summary: p.summary ?? null,
    category: p.category ?? null,
    maxUnitsPerDeal: p.maxUnitsPerDeal.toString(),
    payPerCallUsd: lp.row.payPerCallPrice ? formatUsd(lp.row.payPerCallPrice, 4) : null,
    service: lp.row.adapter === "http" ? "seller-endpoint" : lp.row.adapter === "demo" ? "example" : "sample-store",
    starters: (lp.row.starters as string[]) ?? [],
    labels: { seller: lp.org.label, network: "testnet", pricing: "illustrative" },
  };
}

export function unitPriceUsd(num: bigint, den: bigint): string {
  // Show up to 4 decimals for per-unit prices.
  const scaled = (num * 10_000n) / den; // micro * 1e4 / den
  const whole = scaled / 10_000_000_000n;
  const frac = (scaled % 10_000_000_000n).toString().padStart(10, "0").slice(0, 4).replace(/0+$/, "");
  return `$${whole}${frac ? "." + frac : ""}`;
}
