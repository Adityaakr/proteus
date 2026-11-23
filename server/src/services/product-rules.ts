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
import { parseFloor, parseListing, parseTiers } from "./seller-api-rules";
import { hasOwnRate } from "./currency";

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
    floorUnitPrice: body.floorUnitPrice === undefined ? prev.floorUnitPrice : body.floorUnitPrice === null ? null : toBig(body.floorUnitPrice),
    floorUnitPriceInr: body.floorUnitPriceInr === undefined ? prev.floorUnitPriceInr : body.floorUnitPriceInr === null ? null : rupeeFloor(lp, body.floorUnitPriceInr),
    freshUntil: new Date(Date.now() + 30 * 86400 * 1000),
  });
}

/** A rupee floor, only once the seller chose a rate (it is checked at that rate on every offer). */
function rupeeFloor(lp: LoadedProduct, v: string): bigint {
  return parseFloor({ floorUnitPriceInr: v }, ownRate(lp)).inr!;
}

/** The rate the seller chose itself (fixed or reference), or undefined: rupee prices are not converted at a default. */
export const ownRate = (lp: LoadedProduct) => (hasOwnRate(lp.org.currency) ? lp.fx : undefined);

/**
 * Set or remove a product's floors (PATCH /v1/seller/products/:id/floor): a new cost-model version with the other
 * cost fields unchanged, so offers made under the old floor cannot be quoted.
 */
export async function setFloor(lp: LoadedProduct, body: { floorUnitPriceUsd?: unknown; floorUnitPriceInr?: unknown }) {
  const f = parseFloor(body, ownRate(lp));
  const prev = lp.costRow;
  await db.insert(schema.costModels).values({
    id: id("cost"),
    orgId: lp.org.id,
    productId: lp.row.id,
    version: prev.version + 1,
    variableCostPerUnit: prev.variableCostPerUnit,
    directCostPerDeal: prev.directCostPerDeal,
    txCostBps: prev.txCostBps,
    floorUnitPrice: f.usd === undefined ? prev.floorUnitPrice : f.usd,
    floorUnitPriceInr: f.inr === undefined ? prev.floorUnitPriceInr : f.inr,
    freshUntil: new Date(Date.now() + 30 * 86400 * 1000),
  });
}

/**
 * Replace a product's public price tiers. Tiers are list prices buyers see (and every quote's signed public terms
 * carry), not the private policy, so nothing is re-committed on Arc. A 1-unit tier is how a seller sells single items.
 * A tier priced in rupees keeps its rupee price and is converted at the seller's current rate whenever it is read.
 * Existing deals keep the prices they were signed at.
 */
export async function replaceTiers(lp: LoadedProduct, body: { tiers?: unknown }) {
  const tiers = parseTiers(lp.row.public as { tiers: { id: string }[]; maxUnitsPerDeal: string }, body, ownRate(lp));
  await db.update(schema.products).set({ public: { ...(lp.row.public as object), tiers } }).where(eq(schema.products.id, lp.row.id));
}

/** List or unlist a product. Hidden products leave the market; existing deals and keys keep working. */
export async function setListing(lp: LoadedProduct, active: unknown) {
  await db.update(schema.products).set({ active: parseListing(active) }).where(eq(schema.products.id, lp.row.id));
}
