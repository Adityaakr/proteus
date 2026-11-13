/**
 * A scheduling service's public face: the buyer (a business) shares a link, or embeds it on its website, and its
 * own customers talk to the AI receptionist there. Each customer request runs through the normal metered path on the
 * business's deal (billed only when delivered, capped by the deal's units), the customer sees only the reply meant
 * for them, and the full call note lands in the business's inbox.
 *
 * The link token is random; only its hash is used for lookup (`label`), the token itself is sealed so the business
 * can copy its link again. Revoking deletes it. Abuse limits: per IP and per link per day.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id, sha256 } from "../lib/ids";
import { limit } from "../lib/ratelimit";
import { openJsonOr, sealJson } from "../lib/vault";
import { getProfile } from "./calendar";
import { loadDeal } from "./deals";
import { loadProductById } from "./catalog";
import { execute } from "./gateway";
import { requestMarks } from "./orders";
import { notifyBuyer } from "./buyer-notify";

const linkUrl = (token: string) => `${env.WEB_ORIGIN.replace(/\/$/, "")}/embed/talk/${token}`;

/** What a customer fills in, per product; the agent receives the same field names as the deal page form. */
const CUSTOMER_FIELDS: Record<string, { key: string; label: string; required: boolean; placeholder: string }[]> = {
  "ai-receptionist": [
    { key: "name", label: "Your name", required: true, placeholder: "Sam" },
    { key: "phone", label: "Phone number", required: true, placeholder: "+1 415 555 0100" },
    { key: "question", label: "How can we help?", required: true, placeholder: "Can I book a boiler service next Tuesday afternoon?" },
  ],
  "after-hours-answering": [
    { key: "name", label: "Your name", required: true, placeholder: "Priya" },
    { key: "phone", label: "Phone number", required: true, placeholder: "+1 415 555 0123" },
    { key: "question", label: "Your message", required: true, placeholder: "I need to move my Thursday appointment." },
  ],
  "callback-booking": [
    { key: "customer", label: "Your name", required: true, placeholder: "Jane Doe" },
    { key: "phone", label: "Phone number", required: true, placeholder: "+1 415 555 0100" },
    { key: "time", label: "When should we call?", required: true, placeholder: "Tomorrow 10:00" },
    { key: "question", label: "What is it about?", required: false, placeholder: "Annual plan" },
  ],
};

async function linkRow(dealId: string) {
  const [row] = await db.select().from(schema.serviceConnections).where(and(eq(schema.serviceConnections.dealId, dealId), eq(schema.serviceConnections.kind, "customer_link")));
  return row ?? null;
}

/** The business's link (and embed code), or null if it has none. */
export async function customerLinkView(dealId: string, orgId: string) {
  const row = await linkRow(dealId);
  if (!row) return null;
  const { token } = await openJsonOr<{ token?: string }>(orgId, row.data, {});
  if (!token) return null;
  const url = linkUrl(token);
  return { url, embed: `<iframe src="${url}" title="Talk to us" style="width:100%;max-width:440px;height:620px;border:0;border-radius:16px" allow="microphone"></iframe>`, createdAt: row.updatedAt };
}

/** Creates or replaces the link; the old link stops working at once. */
export async function rotateCustomerLink(dealId: string, orgId: string, productSlug: string) {
  if (!CUSTOMER_FIELDS[productSlug]) throw new HttpError(404, "This service has no customer link.");
  const token = randomBytes(18).toString("base64url");
  const sealed = await sealJson(orgId, { token });
  await db
    .insert(schema.serviceConnections)
    .values({ id: id("sc"), dealId, orgId, kind: "customer_link", data: sealed, label: sha256(token) })
    .onConflictDoUpdate({ target: [schema.serviceConnections.dealId, schema.serviceConnections.kind], set: { data: sealed, label: sha256(token), updatedAt: new Date() } });
  return customerLinkView(dealId, orgId);
}

export async function revokeCustomerLink(dealId: string) {
  await db.delete(schema.serviceConnections).where(and(eq(schema.serviceConnections.dealId, dealId), eq(schema.serviceConnections.kind, "customer_link")));
}

async function dealForToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new HttpError(404, "This link is not valid.");
  const [row] = await db.select().from(schema.serviceConnections).where(and(eq(schema.serviceConnections.kind, "customer_link"), eq(schema.serviceConnections.label, sha256(token))));
  if (!row) throw new HttpError(404, "This link is no longer active. Ask the business for a new one.");
  const deal = await loadDeal(row.dealId);
  const lp = await loadProductById(deal.productId);
  if (!["funded", "active"].includes(deal.status) || deal.serviceStatus !== "provisioned") throw new HttpError(410, "This business is not taking requests here right now.");
  return { deal, lp };
}

/** What the public page shows: the business's name and what to fill in. No prices, no private notes. */
export async function customerPage(token: string) {
  const { deal, lp } = await dealForToken(token);
  const profile = await getProfile(deal.id, deal.orgId).catch(() => null);
  return {
    business: profile?.businessName || "This business",
    service: lp.product.name,
    intro: lp.product.slug === "callback-booking" ? "Leave your details and pick a time; we will call you back." : lp.product.slug === "after-hours-answering" ? "We are closed right now. Leave a message and we will get back to you." : "Ask a question or book an appointment. You are talking to our AI assistant.",
    fields: CUSTOMER_FIELDS[lp.product.slug] ?? [],
    voice: true,
  };
}

/** The part of the agent's answer meant for the customer; the call note stays with the business. */
export function customerReply(answer: string): string {
  const m = answer.match(/(?:What the caller hears|Reply to (?:the )?caller|Reply given)\s*:\s*([\s\S]*?)(?=\n\s*(?:Call note|Customer\s*:|Caller\s*:|Phone\s*:|Summary for the business|Note for the business)|$)/i);
  const reply = (m?.[1] ?? "").trim();
  return reply ? reply.slice(0, 1500) : "Thanks, we have your request. The team will be in touch to confirm.";
}

/** A customer's request: runs on the business's deal, billed only if delivered, and lands in the inbox. */
export async function customerRequest(token: string, ip: string, body: Record<string, unknown>) {
  limit(`talk-ip:${ip}`, 8);
  limit(`talk-link:${sha256(token)}`, 200, 24 * 3600_000);
  const { deal, lp } = await dealForToken(token);
  const fields = CUSTOMER_FIELDS[lp.product.slug] ?? [];
  const input: Record<string, string> = {};
  for (const f of fields) {
    const v = typeof body[f.key] === "string" ? (body[f.key] as string).trim().slice(0, 2000) : "";
    if (f.required && !v) throw new HttpError(400, `${f.label} is required.`);
    if (v) input[f.key] = v;
  }
  if (input.name && lp.product.slug !== "callback-booking") input.question = `Caller name: ${input.name}\n${input.question ?? ""}`;
  delete input.name;
  input.channel = "Customer link on the business's website";
  const receipt = (await execute(deal.id, `talk-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`, input)) as { status: string; answer?: string };
  const answer = String(receipt.answer ?? "");
  if (receipt.status === "failed") return { ok: false, reply: "Sorry, we could not take your request right now. Please try again in a moment." };
  const urgent = /\bemergenc/i.test(answer) || receipt.status === "handoff";
  const link = `${env.WEB_ORIGIN.replace(/\/$/, "")}/app/deals/${deal.id}`;
  notifyBuyer(deal.id, deal.orgId, urgent ? "Urgent: a customer needs you now" : "New request from a customer", `${answer.slice(0, 1500)}\n\nInbox: ${link}`, { event: urgent ? "customer_urgent" : "customer_request", product: lp.product.slug, note: answer.slice(0, 4000), url: link });
  return { ok: true, reply: customerReply(answer) };
}

/** The business's inbox: every request on the deal, newest first, with its full answer and the business's mark. */
export async function inbox(dealId: string) {
  const deal = await loadDeal(dealId);
  const [reqs, marks] = await Promise.all([
    db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.dealId, dealId)).orderBy(desc(schema.serviceRequests.createdAt)).limit(200),
    requestMarks(dealId),
  ]);
  const items = [];
  for (const r of reqs) {
    const out = r.output as { answer?: string; source?: { store?: string } } | null;
    if (out?.source?.store === "seller-confirmed") continue;
    const input = await openJsonOr<Record<string, unknown>>(deal.orgId, r.input, {});
    items.push({
      requestId: r.requestId,
      at: r.createdAt.toISOString(),
      via: typeof input.channel === "string" ? "customer" : "you",
      status: r.status,
      billable: r.billable,
      answer: out?.answer ?? "",
      mark: marks.get(r.requestId)?.status ?? "new",
    });
  }
  return { items };
}

