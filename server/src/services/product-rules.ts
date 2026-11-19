/**
 * The only way a product's rules change: a new policy version or a new cost-model version, never an edit in place.
 * Accepted deals keep the version they were signed under (their terms are frozen and hashed), and a new policy version
 * is committed to ProteusPolicyRegistry at its first quote. Used by the dashboard edits and by catalog sync.
 */
import { toMicro, type CostUpdateBody, type PolicyUpdateBody } from "@proteus/domain";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError, toBig } from "../lib/http";
import { id } from "../lib/ids";
import type { LoadedProduct } from "./catalog";

export async function updatePolicy(lp: LoadedProduct, body: PolicyUpdateBody) {
  const prev = lp.policyRow;
  await db.insert(schema.policies).values({
    id: id("pol"),
    orgId: lp.org.id,
    productId: lp.row.id,
    version: prev.version + 1,
    minMarginBps: body.minMarginBps ?? prev.minMarginBps,
    maxDiscountBps: body.maxDiscountBps ?? prev.maxDiscountBps,
    approvalThreshold: body.approvalThreshold ? toBig(body.approvalThreshold) : prev.approvalThreshold,
    prepaidMinimum: body.prepaidMinimum ? toBig(body.prepaidMinimum) : prev.prepaidMinimum,
    availableCapacityUnits: body.availableCapacityUnits ? toBig(body.availableCapacityUnits) : prev.availableCapacityUnits,
    quoteTtlSeconds: body.quoteTtlSeconds ?? prev.quoteTtlSeconds,
    allowNonPositiveContribution: prev.allowNonPositiveContribution,
  });
}

export async function updateCost(lp: LoadedProduct, body: CostUpdateBody) {
  const prev = lp.costRow;
  await db.insert(schema.costModels).values({
    id: id("cost"),
    orgId: lp.org.id,
    productId: lp.row.id,
    version: prev.version + 1,
    variableCostPerUnit: toBig(body.variableCostPerUnit),
    directCostPerDeal: body.directCostPerDeal ? toBig(body.directCostPerDeal) : prev.directCostPerDeal,
    txCostBps: body.txCostBps ?? prev.txCostBps,
    freshUntil: new Date(Date.now() + 30 * 86400 * 1000),
  });
}

const MAX_TIERS = 6;

/**
 * Replace a product's public price tiers. Tiers are list prices buyers see (and every quote's signed public terms
 * carry), not the private policy, so nothing is re-committed on Arc. A 1-unit tier is how a seller sells single items.
 * Existing deals keep the prices they were signed at.
 */
export async function replaceTiers(lp: LoadedProduct, body: { tiers?: unknown }) {
  const input = (Array.isArray(body?.tiers) ? body.tiers : []) as { name?: unknown; includedUnits?: unknown; unitPriceUsd?: unknown; includes?: unknown }[];
  if (input.length < 1 || input.length > MAX_TIERS) throw new HttpError(400, `between 1 and ${MAX_TIERS} tiers`);
  const pub = lp.row.public as { tiers: { id: string }[]; maxUnitsPerDeal: string };
  const seen = new Set<string>();
  const tiers = input.map((t, i) => {
    const name = typeof t.name === "string" ? t.name.trim().slice(0, 40) : "";
    const units = typeof t.includedUnits === "string" || typeof t.includedUnits === "number" ? String(t.includedUnits).trim() : "";
    const price = typeof t.unitPriceUsd === "string" || typeof t.unitPriceUsd === "number" ? String(t.unitPriceUsd).trim() : "";
    if (!name) throw new HttpError(400, `tier ${i + 1}: a name is required`);
    if (!/^[1-9]\d{0,9}$/.test(units)) throw new HttpError(400, `tier ${i + 1}: units must be a whole number of at least 1`);
    if (BigInt(units) > BigInt(pub.maxUnitsPerDeal)) throw new HttpError(400, `tier ${i + 1}: more units than this product allows in one deal (${pub.maxUnitsPerDeal})`);
    if (seen.has(units)) throw new HttpError(400, `two tiers start at ${units} units; each tier needs its own quantity`);
    seen.add(units);
    if (!/^\d{1,7}(\.\d{1,6})?$/.test(price) || toMicro(price) <= 0n) throw new HttpError(400, `tier ${i + 1}: enter a unit price in dollars, more than 0`);
    const includes = Array.isArray(t.includes) ? t.includes.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 60)).slice(0, 8) : [];
    const tierId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `tier-${i}`;
    return { id: pub.tiers.some((x, j) => x.id === tierId && j !== i) ? `${tierId}-${i}` : tierId, name, includedUnits: units, unitPrice: { num: toMicro(price).toString(), den: "1" }, includes };
  });
  tiers.sort((a, b) => (BigInt(a.includedUnits) < BigInt(b.includedUnits) ? -1 : 1));
  await db.update(schema.products).set({ public: { ...(lp.row.public as object), tiers } }).where(eq(schema.products.id, lp.row.id));
}

/** List or unlist a product. Hidden products leave the market; existing deals and keys keep working. */
export async function setListing(lp: LoadedProduct, active: unknown) {
  if (typeof active !== "boolean") throw new HttpError(400, "active must be true or false");
  await db.update(schema.products).set({ active }).where(eq(schema.products.id, lp.row.id));
}
