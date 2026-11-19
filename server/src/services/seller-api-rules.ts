/**
 * The request checks behind the seller API's write endpoints, as pure functions with no database, chain or network
 * access. The real handlers (product-rules.ts, delivery.ts, orders.ts) run these before they write anything, and the
 * public sandbox (sandbox.ts) runs the same ones for its dry runs, so a dry run accepts and refuses exactly what the
 * real API does. Messages and the order of the checks are the API's own.
 */
import { cumulativeCharge, toMicro } from "@proteus/domain";
import { HttpError } from "../lib/http";

/* ---------------------------------------------------------------- products */

export const MAX_TIERS = 6;

export interface ParsedTier {
  id: string;
  name: string;
  includedUnits: string;
  unitPrice: { num: string; den: string };
  includes: string[];
}

/**
 * Validates PATCH /products/:id/tiers. `pub` is the product's public listing: its current tier ids and the largest
 * number of units one deal may cover. Returns the new tiers sorted by quantity, or throws the API's 400.
 */
export function parseTiers(pub: { tiers: { id: string }[]; maxUnitsPerDeal: string }, body: { tiers?: unknown }): ParsedTier[] {
  const input = (Array.isArray(body?.tiers) ? body.tiers : []) as { name?: unknown; includedUnits?: unknown; unitPriceUsd?: unknown; includes?: unknown }[];
  if (input.length < 1 || input.length > MAX_TIERS) throw new HttpError(400, `between 1 and ${MAX_TIERS} tiers`);
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
  return tiers;
}

/** Validates PATCH /products/:id/listing. */
export function parseListing(active: unknown): boolean {
  if (typeof active !== "boolean") throw new HttpError(400, "active must be true or false");
  return active;
}

/* ---------------------------------------------------------------- deliveries */

export interface DeliveryInput {
  /** Units delivered in this batch (whole units, at least 1). */
  units: number;
  /** What was delivered, in the seller's words: shown to the buyer as the receipt's answer. */
  note: string;
  /** Optional https link to proof (tracking page, signed delivery note, shared folder). */
  proofUrl?: string;
  /** Idempotency key: the same requestId on the same deal never records twice. */
  requestId: string;
}

/** The body of POST /deals/:id/deliveries as the route reads it. */
export function deliveryInputOf(b: { units?: unknown; note?: unknown; proofUrl?: unknown; requestId?: unknown }): DeliveryInput {
  return { units: Number(b.units), note: String(b.note ?? ""), proofUrl: typeof b.proofUrl === "string" && b.proofUrl ? b.proofUrl : undefined, requestId: String(b.requestId ?? "") };
}

/** Field checks for a delivery, before the deal is read. Returns the trimmed note. */
export function checkDeliveryInput(input: DeliveryInput): string {
  if (!Number.isInteger(input.units) || input.units < 1 || input.units > 1_000_000) throw new HttpError(400, "units must be a whole number from 1");
  const note = input.note.trim();
  if (note.length < 3 || note.length > 2000) throw new HttpError(400, "describe what was delivered (3 to 2000 characters)");
  if (input.proofUrl && !/^https:\/\/[^\s]{4,2000}$/.test(input.proofUrl)) throw new HttpError(400, "proof must be an https link");
  if (!/^[A-Za-z0-9._:-]{4,80}$/.test(input.requestId)) throw new HttpError(400, "requestId: 4 to 80 letters, digits, . _ : -");
  return note;
}

/** Deliveries and order updates are recorded only on a deal whose escrow is funded. */
export function checkDealOpen(status: string, what: "deliveries can be recorded" | "updates can be posted") {
  if (!["funded", "active"].includes(status)) throw new HttpError(409, `deal is ${status}; ${what} only on a funded deal`);
}

/**
 * The totals after delivering `units` more on top of `prevUnits`, or the API's 409 when the agreement or the prepaid
 * balance cannot cover them.
 */
export function planDelivery(prevUnits: bigint, units: bigint, terms: { maxUnits: bigint; unitNum: bigint; unitDen: bigint; prepaid: bigint }) {
  if (prevUnits + units > terms.maxUnits) throw new HttpError(409, `This would deliver ${prevUnits + units} units; the agreement covers ${terms.maxUnits}.`);
  const cumulativeUnits = prevUnits + units;
  const cumulativeCharged = cumulativeCharge(cumulativeUnits, { num: terms.unitNum, den: terms.unitDen });
  if (cumulativeCharged > terms.prepaid) throw new HttpError(409, "This delivery would exceed the prepaid balance.");
  return { cumulativeUnits, cumulativeCharged, remaining: terms.prepaid - cumulativeCharged };
}

/* ---------------------------------------------------------------- order updates */

export const ORDER_STATUSES = ["accepted", "in_production", "shipped", "out_for_delivery", "delayed", "note"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_LABEL: Record<OrderStatus, string> = {
  accepted: "Seller accepted your order",
  in_production: "In production",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delayed: "Delayed",
  note: "Message from the seller",
};

export const httpsUrl = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]{4,2000}$/.test(u.trim()) ? u.trim() : undefined);

/** The first check on POST /deals/:id/order-updates, before the deal is read. */
export function parseOrderStatus(body: { status?: unknown }): OrderStatus {
  const status = String(body.status ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${ORDER_STATUSES.join(", ")}`);
  return status;
}

/** The remaining checks on an order update, after the deal is known to be open. Returns what would be stored. */
export function parseOrderUpdateBody(status: OrderStatus, body: { note?: unknown; trackingUrl?: unknown }): { note?: string; url?: string } {
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (status === "note" && note.length < 2) throw new HttpError(400, "write the message for the buyer");
  if (status === "delayed" && note.length < 2) throw new HttpError(400, "tell the buyer why and the new expected date");
  if (body.trackingUrl && !httpsUrl(body.trackingUrl)) throw new HttpError(400, "tracking link must be an https URL");
  return { ...(note ? { note } : {}), ...(httpsUrl(body.trackingUrl) ? { url: httpsUrl(body.trackingUrl) } : {}) };
}
