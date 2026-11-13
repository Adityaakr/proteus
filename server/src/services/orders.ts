/**
 * The order view a buyer sees, like a normal shop's "track your order": every step from payment to payout, built
 * from what the chain records (funding, settlement, refund), what the service records (order details sent,
 * deliveries) and what the seller posts (accepted, in production, shipped with tracking). Sellers post updates from
 * their console; buyers mark their own service requests (a booking confirmed or done) from the deal page.
 *
 * Notes and tracking links are sealed with the seller's vault key and shown only to the deal's buyer and seller.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { openJsonOr, sealJson } from "../lib/vault";
import { loadDeal } from "./deals";
import { loadProductById } from "./catalog";
import { sellerDelivered } from "./gateway";

export const ORDER_STATUSES = ["accepted", "in_production", "shipped", "out_for_delivery", "delayed", "note"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const REQUEST_STATUSES = ["new", "confirmed", "done", "cancelled"] as const;

const ORDER_LABEL: Record<OrderStatus, string> = {
  accepted: "Seller accepted your order",
  in_production: "In production",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delayed: "Delayed",
  note: "Message from the seller",
};

interface UpdateData { note?: string; url?: string }

const httpsUrl = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]{4,2000}$/.test(u.trim()) ? u.trim() : undefined);

/** Seller posts an order status (physical goods and other seller-delivered work). */
export async function postOrderUpdate(orgId: string, dealId: string, body: { status?: unknown; note?: unknown; trackingUrl?: unknown }) {
  const status = String(body.status ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${ORDER_STATUSES.join(", ")}`);
  const deal = await loadDeal(dealId);
  if (deal.orgId !== orgId) throw new HttpError(404, "deal not found");
  if (!["funded", "active"].includes(deal.status)) throw new HttpError(409, `deal is ${deal.status}; updates can be posted only on a funded deal`);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (status === "note" && note.length < 2) throw new HttpError(400, "write the message for the buyer");
  if (status === "delayed" && note.length < 2) throw new HttpError(400, "tell the buyer why and the new expected date");
  if (body.trackingUrl && !httpsUrl(body.trackingUrl)) throw new HttpError(400, "tracking link must be an https URL");
  const data: UpdateData = { ...(note ? { note } : {}), ...(httpsUrl(body.trackingUrl) ? { url: httpsUrl(body.trackingUrl) } : {}) };
  const row = { id: id("du"), dealId, orgId, actor: "seller", kind: "order_status", status, data: Object.keys(data).length ? await sealJson(orgId, data) : null };
  await db.insert(schema.dealUpdates).values(row);
  return { id: row.id, status, label: ORDER_LABEL[status] };
}

/** Buyer marks one of its service requests (for example a booking: confirmed, done, cancelled). */
export async function markRequest(dealId: string, requestId: string, status: string, note?: string) {
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, `status must be one of ${REQUEST_STATUSES.join(", ")}`);
  const deal = await loadDeal(dealId);
  const [req] = await db.select({ id: schema.serviceRequests.id }).from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.requestId, requestId)));
  if (!req) throw new HttpError(404, "request not found on this deal");
  const clean = note?.trim().slice(0, 500);
  await db.insert(schema.dealUpdates).values({ id: id("du"), dealId, orgId: deal.orgId, actor: "buyer", kind: "request_status", status, requestId, data: clean ? await sealJson(deal.orgId, { note: clean }) : null });
  return { requestId, status };
}

/** Latest buyer mark per request. */
export async function requestMarks(dealId: string): Promise<Map<string, { status: string; at: Date }>> {
  const rows = await db.select().from(schema.dealUpdates).where(and(eq(schema.dealUpdates.dealId, dealId), eq(schema.dealUpdates.kind, "request_status"))).orderBy(asc(schema.dealUpdates.createdAt));
  const out = new Map<string, { status: string; at: Date }>();
  for (const r of rows) if (r.requestId) out.set(r.requestId, { status: r.status, at: r.createdAt });
  return out;
}

export interface TimelineEvent {
  at: string;
  kind: "placed" | "paid" | "details" | "order_status" | "delivered" | "settled" | "refunded" | "disputed";
  label: string;
  status?: string;
  note?: string;
  url?: string;
  txHash?: string;
  units?: number;
}

/** Progress steps a buyer sees for a seller-delivered order, and which one it has reached. */
const STEPS = ["paid", "accepted", "in_production", "shipped", "delivered", "settled"] as const;

/** The full order history for the deal's buyer or seller. */
export async function orderTimeline(dealId: string) {
  const deal = await loadDeal(dealId);
  const lp = await loadProductById(deal.productId);
  const [txs, reqs, updates] = await Promise.all([
    db.select().from(schema.chainTxs).where(eq(schema.chainTxs.dealId, dealId)).orderBy(asc(schema.chainTxs.createdAt)),
    db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.dealId, dealId)).orderBy(asc(schema.serviceRequests.createdAt)),
    db.select().from(schema.dealUpdates).where(and(eq(schema.dealUpdates.dealId, dealId), eq(schema.dealUpdates.kind, "order_status"))).orderBy(desc(schema.dealUpdates.createdAt)),
  ]);
  const events: TimelineEvent[] = [{ at: deal.createdAt.toISOString(), kind: "placed", label: "Order placed: terms signed by you and the seller" }];
  const fund = txs.find((t) => t.kind === "fund" && t.status === "confirmed") ?? txs.find((t) => t.kind === "fund");
  if (deal.fundedAt || fund) events.push({ at: (deal.fundedAt ?? fund!.createdAt).toISOString(), kind: "paid", label: "Paid into escrow on Arc: the seller is paid only after you confirm delivery", txHash: fund?.txHash });
  for (const r of reqs) {
    const store = (r.output as { source?: { store?: string } } | null)?.source?.store;
    if (store === "order-details") events.push({ at: r.createdAt.toISOString(), kind: "details", label: "You sent order details to the seller" });
    if (store === "seller-confirmed") {
      const o = r.output as { answer?: string; source?: { proofUrl?: string | null } };
      events.push({ at: r.createdAt.toISOString(), kind: "delivered", label: `Seller recorded delivery of ${r.units} ${r.units === 1 ? "unit" : "units"}`, note: o.answer, url: o.source?.proofUrl ?? undefined, units: r.units });
    }
  }
  for (const u of updates) {
    const data = u.data ? await openJsonOr<UpdateData>(u.orgId, u.data, {}) : {};
    events.push({ at: u.createdAt.toISOString(), kind: "order_status", status: u.status, label: ORDER_LABEL[u.status as OrderStatus] ?? u.status, note: data.note, url: data.url });
  }
  for (const t of txs) {
    if (t.kind === "settle") events.push({ at: t.createdAt.toISOString(), kind: "settled", label: "You confirmed delivery and the seller was paid from escrow", txHash: t.txHash });
    if (t.kind === "refund") events.push({ at: t.createdAt.toISOString(), kind: "refunded", label: "Unused balance refunded to your wallet", txHash: t.txHash });
  }
  if (deal.status === "disputed") events.push({ at: deal.updatedAt.toISOString(), kind: "disputed", label: "Dispute open: the escrow is frozen until the arbiter decides" });
  events.sort((a, b) => a.at.localeCompare(b.at));

  // How far the order got, for the progress bar.
  const reached = new Set<string>();
  if (events.some((e) => e.kind === "paid")) reached.add("paid");
  for (const e of events) if (e.kind === "order_status" && e.status) reached.add(e.status === "out_for_delivery" ? "shipped" : e.status);
  if (events.some((e) => e.kind === "delivered")) reached.add("delivered");
  if (events.some((e) => e.kind === "settled")) reached.add("settled");
  let current = -1;
  STEPS.forEach((s, i) => { if (reached.has(s)) current = i; });
  const latestTracking = [...events].reverse().find((e) => e.url && (e.status === "shipped" || e.status === "out_for_delivery"))?.url ?? null;

  return {
    dealId,
    product: lp.product.name,
    seller: lp.org.name,
    sellerDelivered: sellerDelivered(lp.row as never),
    steps: STEPS.map((s, i) => ({ id: s, done: i <= current })),
    current: current >= 0 ? STEPS[current] : null,
    tracking: latestTracking,
    events: events.reverse(),
  };
}
