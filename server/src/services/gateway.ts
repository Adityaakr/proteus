import { and, desc, eq } from "drizzle-orm";
import { keccak256, toHex, type Hex } from "viem";
import { cumulativeCharge } from "@proteus/domain";
import { orgSignerAccount } from "../chain/signer";
import { db, schema } from "../db";
import { decryptSecret } from "../lib/crypto";
import { HttpError } from "../lib/http";
import { id, sha256 } from "../lib/ids";
import { loadProductById } from "./catalog";
import { loadDeal, reviveTerms } from "./deals";
import { runServiceAgent } from "./workers";

/**
 * Service gateway: authenticates a deal's bearer key, executes the product's adapter, meters billable
 * units with cumulative-charge arithmetic, writes an evidence digest and a seller-signed receipt.
 * The billable unit is objective: a "delivered" order-status answer sourced from the sample store.
 * Failed lookups and human handoffs are never billable. Retries with the same requestId return the
 * original receipt and never charge twice (unique (deal, requestId)).
 */

export interface ServiceInput {
  orderId?: string;
  email?: string;
  question?: string;
  /** Seller-defined request fields (see the product's request spec). Files arrive as { name, type, size, dataBase64 }. */
  [key: string]: unknown;
}

/** A plain-text view of a request for the first-party adapters: the question if present, else the string fields joined. */
export function textOf(input: ServiceInput): string {
  if (typeof input.question === "string" && input.question.trim()) return input.question.trim();
  const parts: string[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (k === "question") continue;
    if (typeof v === "string" && v.trim()) parts.push(`${k}: ${v.trim()}`);
    else if (typeof v === "number") parts.push(`${k}: ${v}`);
    else if (v && typeof v === "object" && "name" in (v as object)) parts.push(`${k}: file ${(v as { name?: string }).name ?? ""}`);
  }
  return parts.join("; ");
}

/** Human summary of a request's fields, for example answers: files by name and size, text trimmed. */
export function describeInput(input: ServiceInput): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && v.trim()) parts.push(`${k} "${v.trim().slice(0, 60)}${v.trim().length > 60 ? "…" : ""}"`);
    else if (typeof v === "number") parts.push(`${k} ${v}`);
    else if (v && typeof v === "object" && "name" in (v as object)) {
      const f = v as { name?: string; size?: number };
      parts.push(`${k} ${f.name ?? "file"}${typeof f.size === "number" ? ` (${Math.max(1, Math.round(f.size / 1024))} KB)` : ""}`);
    }
  }
  return parts.join(", ") || "an empty request";
}

const MAX_INPUT_BYTES = 700_000;
export function assertInputSize(input: unknown) {
  if (JSON.stringify(input).length > MAX_INPUT_BYTES) throw new HttpError(413, "request input is too large; files must be under 512 KB");
}

export interface ServiceOutput {
  status: "delivered" | "failed" | "handoff";
  billable: boolean;
  answer: string;
  source: { store: string; orderId?: string; fields: string[] };
}

/** First-party adapter: AI-assisted e-commerce order support over a labeled sample store. */
export async function orderSupport(orgId: string, input: ServiceInput): Promise<ServiceOutput> {
  const q = textOf(input).toLowerCase();
  const wantsRefund = /refund|return|chargeback|cancel/.test(q);
  if (wantsRefund) {
    return { status: "handoff", billable: false, answer: "Refunds and returns are handled by a human on the support team. I have flagged this conversation for them; no automated answer was given.", source: { store: "sample-store", orderId: input.orderId, fields: [] } };
  }
  const orderId = input.orderId ?? q.match(/\b([a-z]\d{4})\b/i)?.[1]?.toUpperCase();
  if (!orderId && !input.email) {
    return { status: "failed", billable: false, answer: "I need an order number (for example A1001) or the email on the order to look up its status.", source: { store: "sample-store", fields: [] } };
  }
  const rows = orderId
    ? await db.select().from(schema.sampleOrders).where(and(eq(schema.sampleOrders.orgId, orgId), eq(schema.sampleOrders.orderId, orderId)))
    : await db.select().from(schema.sampleOrders).where(and(eq(schema.sampleOrders.orgId, orgId), eq(schema.sampleOrders.email, input.email!.toLowerCase())));
  const order = rows[0];
  if (!order) {
    return { status: "failed", billable: false, answer: `I could not find an order ${orderId ?? "for that email"} in the store. Please check the order number; this request was not charged.`, source: { store: "sample-store", orderId, fields: [] } };
  }
  const items = (order.items as { name: string; qty: number }[]).map((i) => `${i.qty} x ${i.name}`).join(", ");
  const parts = [`Order ${order.orderId} (${items}) is ${order.status.replace(/_/g, " ")}.`];
  const fields = ["status", "items"];
  if (order.carrier && order.tracking) {
    parts.push(`It shipped with ${order.carrier}, tracking ${order.tracking}.`);
    fields.push("carrier", "tracking");
  }
  if (order.eta) {
    parts.push(`Estimated delivery: ${order.eta}.`);
    fields.push("eta");
  }
  return { status: "delivered", billable: true, answer: parts.join(" "), source: { store: "sample-store", orderId: order.orderId, fields } };
}

export interface UpstreamConfig {
  url: string;
  authHeader?: string;
  secretEnc?: string;
}

/**
 * Seller-owned adapter: Proteus AI forwards each metered request to the seller's own HTTPS endpoint and
 * bills exactly what the endpoint reports. Contract (documented in docs/api.md, "Bring your own endpoint"):
 *   POST <url>  JSON { requestId, dealId?, orgId, productSlug, input }
 *   2xx JSON { answer: string, billable?: boolean, status?: "delivered"|"failed"|"handoff" }
 * A 2xx with billable !== false is one delivered unit. Non-2xx, timeouts and bad JSON are "failed" and never billed.
 */
export async function httpUpstream(cfg: UpstreamConfig, ctx: { requestId: string; dealId?: string; orgId: string; productSlug: string }, input: ServiceInput): Promise<ServiceOutput> {
  const host = (() => {
    try {
      return new URL(cfg.url).host;
    } catch {
      return "invalid-url";
    }
  })();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "x-proteus-request-id": ctx.requestId };
    if (cfg.secretEnc) headers[cfg.authHeader?.trim() || "authorization"] = (cfg.authHeader?.trim() ? "" : "Bearer ") + decryptSecret(cfg.secretEnc);
    const res = await fetch(cfg.url, { method: "POST", headers, body: JSON.stringify({ requestId: ctx.requestId, dealId: ctx.dealId, orgId: ctx.orgId, productSlug: ctx.productSlug, input }), signal: ac.signal });
    const text = await res.text();
    if (!res.ok) return { status: "failed", billable: false, answer: `The seller's endpoint answered HTTP ${res.status}. This request was not charged.`, source: { store: host, fields: [] } };
    let body: { answer?: unknown; billable?: unknown; status?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return { status: "failed", billable: false, answer: "The seller's endpoint did not return JSON. This request was not charged.", source: { store: host, fields: [] } };
    }
    const answer = typeof body.answer === "string" ? body.answer : text.slice(0, 2000);
    const status = body.status === "handoff" ? "handoff" : body.status === "failed" ? "failed" : "delivered";
    const billable = status === "delivered" && body.billable !== false;
    return { status, billable, answer, source: { store: host, orderId: input.orderId, fields: Object.keys(body).filter((k) => k !== "answer") } };
  } catch (e) {
    const timeout = (e as Error).name === "AbortError";
    return { status: "failed", billable: false, answer: timeout ? "The seller's endpoint did not answer within 20 seconds. This request was not charged." : "The seller's endpoint could not be reached. This request was not charged.", source: { store: host, fields: [] } };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs the product's adapter. `dealId` is absent for pay-per-call. */
export async function runAdapter(lp: Awaited<ReturnType<typeof loadProductById>>, ctx: { requestId: string; dealId?: string }, input: ServiceInput): Promise<ServiceOutput> {
  if (lp.row.adapter === "http" && lp.row.upstream) return httpUpstream(lp.row.upstream as UpstreamConfig, { ...ctx, orgId: lp.org.id, productSlug: lp.product.slug }, input);
  if (lp.row.adapter === "order-support") return orderSupport(lp.org.id, input);
  // Products Proteus AI runs itself: a service agent does the work from what the buyer sent (see workers.ts).
  if (lp.row.adapter === "demo") return runServiceAgent(lp, ctx, input);
  return { status: "failed", billable: false, answer: "No service endpoint is configured for this product. This request was not charged.", source: { store: "none", fields: [] } };
}

export async function authenticateDeal(bearer: string | undefined, productSlug: string) {
  if (!bearer) throw new HttpError(401, "missing bearer token");
  const hash = sha256(bearer);
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.apiKeyHash, hash));
  if (!deal) throw new HttpError(401, "invalid api key");
  const lp = await loadProductById(deal.productId);
  if (lp.product.slug !== productSlug) throw new HttpError(403, "key is not valid for this product");
  if (!["funded", "active"].includes(deal.status)) throw new HttpError(403, `deal is ${deal.status}; no active funded allowance`);
  if (deal.serviceStatus !== "provisioned") throw new HttpError(403, "service not provisioned");
  return { deal, lp };
}

export async function execute(dealId: string, requestId: string, input: ServiceInput) {
  assertInputSize(input);
  const started = Date.now();
  const deal = await loadDeal(dealId);
  const lp = await loadProductById(deal.productId);
  const terms = reviveTerms(deal.terms as Record<string, unknown>);

  // Idempotency: same (deal, requestId) returns the stored receipt.
  const [existing] = await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.requestId, requestId)));
  if (existing) return receiptView(existing, terms.prepaid);

  const output: ServiceOutput = await runAdapter(lp, { requestId, dealId }, input);

  // Serialize metering per deal with a row lock on the deal.
  const row = await db.transaction(async (tx) => {
    await tx.execute(`SELECT id FROM deals WHERE id = '${dealId.replace(/'/g, "")}' FOR UPDATE`);
    const [last] = await tx.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.billable, true))).orderBy(desc(schema.serviceRequests.cumulativeUnits)).limit(1);
    const prevUnits = last?.cumulativeUnits ?? 0n;
    let billable = output.billable;
    let units = billable ? 1 : 0;
    // Deny billable usage beyond the agreement's max units or prepaid balance.
    if (billable && prevUnits + 1n > terms.maxUnits) {
      billable = false;
      units = 0;
      output.status = "failed";
      output.billable = false;
      output.answer = "This agreement's included volume is used up. Ask the seller for a larger package; this request was not charged.";
    }
    const cumulativeUnits = billable ? prevUnits + 1n : prevUnits;
    const cumulativeCharged = cumulativeCharge(cumulativeUnits, { num: terms.unitNum, den: terms.unitDen });
    const evidence = { dealId: deal.dealIdOnchain.toString(), requestId, status: output.status, units, cumulativeUnits: cumulativeUnits.toString(), outputHash: sha256(JSON.stringify(output)), at: new Date().toISOString() };
    const evidenceDigest = keccak256(toHex(JSON.stringify(evidence)));
    let sellerSignature: string | undefined;
    try {
      sellerSignature = await (await orgSignerAccount(deal.orgId)).signMessage({ message: { raw: evidenceDigest as Hex } });
    } catch {
      sellerSignature = undefined;
    }
    const [inserted] = await tx
      .insert(schema.serviceRequests)
      .values({ id: id("sr"), orgId: deal.orgId, dealId, requestId, status: output.status, billable, units, cumulativeUnits, cumulativeCharged, input: input as unknown as Record<string, unknown>, output: output as unknown as Record<string, unknown>, evidenceDigest, sellerSignature, latencyMs: Date.now() - started })
      .returning();
    return inserted!;
  });
  return receiptView(row, terms.prepaid);
}

export function receiptView(r: typeof schema.serviceRequests.$inferSelect, prepaid: bigint) {
  const out = r.output as unknown as ServiceOutput;
  return {
    requestId: r.requestId,
    status: r.status,
    billable: r.billable,
    units: r.units,
    answer: out.answer,
    source: out.source,
    receipt: { digest: r.evidenceDigest, sellerSignature: r.sellerSignature, at: r.createdAt },
    chargedCumulative: r.cumulativeCharged,
    createdAt: r.createdAt,
    answerPreview: out.answer.slice(0, 120),
    deal: { cumulativeUnits: r.cumulativeUnits, cumulativeCharged: r.cumulativeCharged, remaining: prepaid - r.cumulativeCharged },
    latencyMs: r.latencyMs,
    labels: { data: "sample store (demo data)", network: "testnet" },
  };
}
