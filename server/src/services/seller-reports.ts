/**
 * Seller money figures shared by the dashboard, the Payments page and the seller API. Every figure is a sum over the
 * deals table, whose balances the reconciler copies from the escrow contract.
 *
 * Revenue is only what the contract has paid out (`settled`). Money still in escrow is the buyer's until usage is
 * accepted, so it is reported as funds held, never as revenue.
 *
 * A deal whose whole deposit was settled stays `Funded` on chain (the contract only closes a deal through a refund or
 * a dispute ruling, and a refund of nothing reverts), so the reconciler keeps it `active`. Such a deal is fulfilled:
 * `effectiveDealStatus` reports it as "settled" and `dealTotals` counts it, instead of waiting for a close that never
 * comes.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { features } from "../env";

type DealMoney = { status: string; deposit: bigint; settled: bigint; refunded: bigint };

const HOLDING = new Set(["funded", "active", "disputed"]);
const remaining = (d: DealMoney) => {
  const r = d.deposit - d.settled - d.refunded;
  return r > 0n ? r : 0n;
};

/** A funded deal whose deposit is fully paid out to the seller, whether or not the chain ever marks it closed. */
export function isFulfilled(d: DealMoney): boolean {
  if (d.settled <= 0n) return false;
  return d.status === "closed" || (d.deposit > 0n && remaining(d) === 0n);
}

/** The status to show: "settled" for a deal the contract keeps open although nothing is left in escrow. */
export function effectiveDealStatus(d: DealMoney): string {
  return (d.status === "funded" || d.status === "active") && d.deposit > 0n && d.settled > 0n && remaining(d) === 0n ? "settled" : d.status;
}

/** A deal view for the seller: `status` is what to show, `chainStatus` is the contract's and gates seller actions. */
export function withEffectiveStatus<V extends { status: string; balances: { deposit: bigint; settled: bigint; refunded: bigint } }>(view: V) {
  return { ...view, status: effectiveDealStatus({ status: view.status, ...view.balances }), chainStatus: view.status };
}

export function dealTotals(deals: DealMoney[]) {
  const funded = deals.filter((d) => d.deposit > 0n);
  return {
    /** USDC the escrow contract paid out to the seller. */
    revenueEarned: funded.reduce((s, d) => s + d.settled, 0n),
    /** Deals that paid out anything. */
    settledDeals: funded.filter((d) => d.settled > 0n).length,
    /** Deals fully delivered and paid. */
    fulfilledDeals: funded.filter(isFulfilled).length,
    /** Buyer money still in escrow (including deals frozen by a dispute). */
    fundsHeld: funded.filter((d) => HOLDING.has(d.status)).reduce((s, d) => s + remaining(d), 0n),
    refunded: funded.reduce((s, d) => s + d.refunded, 0n),
    fundedValue: funded.reduce((s, d) => s + d.deposit, 0n),
    dealsFunded: funded.length,
  };
}

/** Payments summary (Payments page and GET /api/v1/seller/payments). */
export async function financeView(orgId: string, opts: { journal?: boolean } = {}) {
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId));
  const funded = deals.reduce((s, d) => s + d.deposit, 0n);
  const settled = deals.reduce((s, d) => s + d.settled, 0n);
  const refunded = deals.reduce((s, d) => s + d.refunded, 0n);
  const reqs = await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.orgId, orgId), eq(schema.serviceRequests.billable, true)));
  // Earned-but-unsettled: max cumulative charged per deal minus settled.
  const chargedByDeal = new Map<string, bigint>();
  for (const r of reqs) chargedByDeal.set(r.dealId, r.cumulativeCharged > (chargedByDeal.get(r.dealId) ?? 0n) ? r.cumulativeCharged : (chargedByDeal.get(r.dealId) ?? 0n));
  const earnedUnsettled = deals.reduce((s, d) => s + ((chargedByDeal.get(d.id) ?? 0n) - d.settled > 0n ? (chargedByDeal.get(d.id) ?? 0n) - d.settled : 0n), 0n);
  const journal = opts.journal === false ? undefined : await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.orgId, orgId)).orderBy(desc(schema.journalEntries.createdAt)).limit(200);
  const discrepancies = deals.filter((d) => d.balancesSource === "chain" && d.deposit - d.settled - d.refunded < 0n).map((d) => ({ dealId: d.id, issue: "negative remaining" }));
  return {
    funded,
    settled,
    earnedUnsettled,
    liability: funded - settled - refunded,
    refunded,
    ...(journal ? { journal } : {}),
    reconciliation: { lastRunAt: deals.reduce<Date | null>((m, d) => (!m || d.updatedAt > m ? d.updatedAt : m), null), discrepancies },
    labels: { network: features.network, note: "Deposits are customer liabilities until usage is accepted and settled. Unused balances are never seller revenue." },
  };
}

/** Metered requests and delivery totals (Usage page and GET /api/v1/seller/usage). */
export async function usageView(orgId: string, productName: (productId: string) => Promise<string>) {
  const rows = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.orgId, orgId)).orderBy(desc(schema.serviceRequests.createdAt)).limit(300);
  const dealIds = Array.from(new Set(rows.map((r) => r.dealId)));
  const deals = dealIds.length ? await db.select().from(schema.deals).where(inArray(schema.deals.id, dealIds)) : [];
  const names = new Map<string, string>();
  for (const d of deals) if (!names.has(d.productId)) names.set(d.productId, await productName(d.productId));
  const dealMap = new Map(deals.map((d) => [d.id, d]));
  const totals = { requests: rows.length, delivered: rows.filter((r) => r.status === "delivered").length, handoff: rows.filter((r) => r.status === "handoff").length, failed: rows.filter((r) => r.status === "failed").length, billableUnits: rows.reduce((s, r) => s + r.units, 0), avgLatencyMs: rows.length ? Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length) : 0 };
  return {
    totals,
    requests: rows.map((r) => {
      const d = dealMap.get(r.dealId);
      return { id: r.id, requestId: r.requestId, dealId: r.dealId, dealPublicId: d?.publicId ?? null, buyerAddress: d?.buyerAddress ?? null, productName: d ? names.get(d.productId) ?? "Product" : "Product", status: r.status, billable: r.billable, units: r.units, cumulativeUnits: r.cumulativeUnits, cumulativeCharged: r.cumulativeCharged, latencyMs: r.latencyMs, signed: Boolean(r.sellerSignature), at: r.createdAt };
    }),
  };
}
