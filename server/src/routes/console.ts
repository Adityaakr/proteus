import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "../db";
import { json } from "../lib/http";
import { loadProductById } from "../services/catalog";
import { reviveCandidate } from "../services/negotiation";
import { session } from "./session";
import { features } from "../env";

/**
 * Seller console additions: a dashboard-grade overview, customers, usage and delivery, insights.
 * Every number is a sum over real rows; nothing here is estimated or sampled.
 */
export const consoleRoutes = new Hono();

async function productNames(ids: string[]) {
  const out = new Map<string, string>();
  for (const id of Array.from(new Set(ids))) {
    try {
      out.set(id, (await loadProductById(id)).product.name);
    } catch {
      out.set(id, "Product");
    }
  }
  return out;
}

consoleRoutes.get("/app/dashboard", async (c) => {
  const { orgId } = session(c);
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId)).orderBy(desc(schema.deals.createdAt));
  const negs = await db.select().from(schema.negotiations).where(eq(schema.negotiations.orgId, orgId));
  const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.orgId, orgId));
  const pending = await db.select().from(schema.approvals).where(and(eq(schema.approvals.orgId, orgId), eq(schema.approvals.status, "pending"))).orderBy(desc(schema.approvals.createdAt)).limit(5);
  const names = await productNames([...deals.map((d) => d.productId), ...quotes.map((q) => q.productId)]);

  const funded = deals.filter((d) => d.deposit > 0n);
  const earned = funded.reduce((s, d) => s + d.settled, 0n);
  const refunded = funded.reduce((s, d) => s + d.refunded, 0n);
  const held = funded.filter((d) => d.status === "funded" || d.status === "active").reduce((s, d) => s + d.deposit - d.settled - d.refunded, 0n);
  const fulfilled = funded.filter((d) => d.status === "closed").length;

  // Margin: revenue-weighted contribution margin across accepted quotes (falls back to every quote the agent issued).
  const accepted = quotes.filter((q) => q.status === "accepted");
  const pool = accepted.length ? accepted : quotes;
  let rev = 0n;
  let contrib = 0n;
  for (const q of pool) {
    const e = reviveCandidate(q.candidate as Record<string, unknown>).economics;
    rev += e.expectedRevenue;
    contrib += e.expectedContribution;
  }
  const marginBps = rev > 0n ? Number((contrib * 10_000n) / rev) : null;

  const attention = [];
  for (const a of pending) {
    const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, a.quoteId));
    if (!q) continue;
    const cand = reviveCandidate(q.candidate as Record<string, unknown>);
    const [neg] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, q.negotiationId));
    attention.push({ id: a.id, quoteId: q.id, negotiationId: q.negotiationId, buyerAddress: neg?.buyerAddress ?? null, productName: names.get(q.productId) ?? "Product", tierName: cand.tierName, units: cand.units, prepaidTotal: cand.prepaidTotal, marginBps: cand.economics.expectedContributionMarginBps, reason: a.reason, ruleIds: a.ruleIds, createdAt: a.createdAt });
  }

  return json(c, {
    revenueEarned: earned,
    fulfilledDeals: fulfilled,
    activeNegotiations: negs.filter((n) => n.status === "open" || n.status === "quoted").length,
    needsAttention: pending.length,
    marginBps,
    marginBasis: accepted.length ? "accepted" : quotes.length ? "quoted" : "none",
    fundsHeld: held,
    refunded,
    dealsFunded: funded.length,
    attention,
    recentDeals: deals.slice(0, 6).map((d) => ({ id: d.id, publicId: d.publicId, buyerAddress: d.buyerAddress, productName: names.get(d.productId) ?? "Product", deposit: d.deposit, settled: d.settled, status: d.status, createdAt: d.createdAt })),
    labels: { seller: org?.label ?? "live", network: features.network },
  });
});

consoleRoutes.get("/app/customers", async (c) => {
  const { orgId } = session(c);
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId));
  const negs = await db.select().from(schema.negotiations).where(eq(schema.negotiations.orgId, orgId));
  const names = await productNames(deals.map((d) => d.productId));
  const byBuyer = new Map<string, { address: string; negotiations: number; deals: number; funded: bigint; settled: bigint; inEscrow: bigint; products: Set<string>; lastActivity: Date; firstSeen: Date }>();
  const touch = (addr: string | null, at: Date) => {
    if (!addr) return;
    const key = addr.toLowerCase();
    const cur = byBuyer.get(key) ?? { address: addr, negotiations: 0, deals: 0, funded: 0n, settled: 0n, inEscrow: 0n, products: new Set<string>(), lastActivity: at, firstSeen: at };
    if (at > cur.lastActivity) cur.lastActivity = at;
    if (at < cur.firstSeen) cur.firstSeen = at;
    byBuyer.set(key, cur);
    return cur;
  };
  for (const n of negs) {
    const cur = touch(n.buyerAddress, n.updatedAt ?? n.createdAt);
    if (cur) cur.negotiations += 1;
  }
  for (const d of deals) {
    const cur = touch(d.buyerAddress, d.createdAt);
    if (!cur) continue;
    cur.deals += 1;
    cur.funded += d.deposit;
    cur.settled += d.settled;
    if (d.status === "funded" || d.status === "active") cur.inEscrow += d.deposit - d.settled - d.refunded;
    cur.products.add(names.get(d.productId) ?? "Product");
  }
  const out = Array.from(byBuyer.values())
    .map((b) => ({ ...b, products: Array.from(b.products) }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  return json(c, out);
});

consoleRoutes.get("/app/usage", async (c) => {
  const { orgId } = session(c);
  const rows = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.orgId, orgId)).orderBy(desc(schema.serviceRequests.createdAt)).limit(300);
  const dealIds = Array.from(new Set(rows.map((r) => r.dealId)));
  const deals = dealIds.length ? await db.select().from(schema.deals).where(inArray(schema.deals.id, dealIds)) : [];
  const names = await productNames(deals.map((d) => d.productId));
  const dealMap = new Map(deals.map((d) => [d.id, d]));
  const totals = { requests: rows.length, delivered: rows.filter((r) => r.status === "delivered").length, handoff: rows.filter((r) => r.status === "handoff").length, failed: rows.filter((r) => r.status === "failed").length, billableUnits: rows.reduce((s, r) => s + r.units, 0), avgLatencyMs: rows.length ? Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length) : 0 };
  return json(c, {
    totals,
    requests: rows.map((r) => {
      const d = dealMap.get(r.dealId);
      return { id: r.id, requestId: r.requestId, dealId: r.dealId, dealPublicId: d?.publicId ?? null, buyerAddress: d?.buyerAddress ?? null, productName: d ? names.get(d.productId) ?? "Product" : "Product", status: r.status, billable: r.billable, units: r.units, cumulativeUnits: r.cumulativeUnits, cumulativeCharged: r.cumulativeCharged, latencyMs: r.latencyMs, signed: Boolean(r.sellerSignature), at: r.createdAt };
    }),
  });
});

consoleRoutes.get("/app/insights", async (c) => {
  const { orgId } = session(c);
  const days = 30;
  const since = new Date(Date.now() - days * 86400 * 1000);
  since.setUTCHours(0, 0, 0, 0);
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId));
  const reqs = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.orgId, orgId));
  const negs = await db.select().from(schema.negotiations).where(eq(schema.negotiations.orgId, orgId));
  const acceptances = await db.select().from(schema.usageAcceptances).where(and(eq(schema.usageAcceptances.orgId, orgId), eq(schema.usageAcceptances.status, "confirmed"))).orderBy(schema.usageAcceptances.dealId, schema.usageAcceptances.nonce);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const series = new Map<string, { day: string; negotiations: number; dealsFunded: number; funded: bigint; settled: bigint; requests: number; billableUnits: number }>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(since.getTime() + i * 86400 * 1000);
    series.set(key(d), { day: key(d), negotiations: 0, dealsFunded: 0, funded: 0n, settled: 0n, requests: 0, billableUnits: 0 });
  }
  const bump = (at: Date | null, f: (p: NonNullable<ReturnType<typeof series.get>>) => void) => {
    if (!at) return;
    const p = series.get(key(at));
    if (p) f(p);
  };
  for (const n of negs) bump(n.createdAt, (p) => void (p.negotiations += 1));
  for (const d of deals) bump(d.fundedAt ?? (d.deposit > 0n ? d.createdAt : null), (p) => { p.dealsFunded += 1; p.funded += d.deposit; });
  // Settlements are cumulative per deal; the delta between consecutive confirmed acceptances is what moved that day.
  const lastByDeal = new Map<string, bigint>();
  for (const a of acceptances) {
    const prev = lastByDeal.get(a.dealId) ?? 0n;
    const delta = a.cumulativeAmount > prev ? a.cumulativeAmount - prev : 0n;
    lastByDeal.set(a.dealId, a.cumulativeAmount > prev ? a.cumulativeAmount : prev);
    bump(a.createdAt, (p) => void (p.settled += delta));
  }
  for (const r of reqs) bump(r.createdAt, (p) => { p.requests += 1; p.billableUnits += r.units; });
  const quoted = negs.filter((n) => n.status === "quoted" || n.status === "accepted" || n.status === "closed").length;
  const fundedCount = deals.filter((d) => d.deposit > 0n).length;
  return json(c, {
    days,
    series: Array.from(series.values()),
    conversion: { negotiations: negs.length, quoted, funded: fundedCount, closed: deals.filter((d) => d.status === "closed").length },
    delivery: { requests: reqs.length, delivered: reqs.filter((r) => r.status === "delivered").length, handoff: reqs.filter((r) => r.status === "handoff").length, failed: reqs.filter((r) => r.status === "failed").length },
  });
});
