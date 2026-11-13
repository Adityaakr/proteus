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
import { runServiceAgent } from "./workers";
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

const GREETING: Record<string, string> = {
  "ai-receptionist": "Hi! I'm the front desk assistant. Ask me anything or tell me what you'd like to book.",
  "after-hours-answering": "Hi! We're closed right now, but I can take your message or move your appointment. What can I do for you?",
  "callback-booking": "Hi! Want us to call you back? Tell me when suits you and what it's about.",
};
const STARTERS: Record<string, string[]> = {
  "ai-receptionist": ["Book an appointment", "What are your opening hours?", "How much does it cost?"],
  "after-hours-answering": ["Leave a message", "Move my appointment", "It's urgent"],
  "callback-booking": ["Call me back tomorrow morning", "Call me back this afternoon"],
};

/** What the public page shows: the business's name, a greeting and starters. No prices, no private notes. */
export async function customerPage(token: string) {
  const { deal, lp } = await dealForToken(token);
  const profile = await getProfile(deal.id, deal.orgId).catch(() => null);
  return {
    business: profile?.businessName || null,
    service: lp.product.name,
    greeting: GREETING[lp.product.slug] ?? "Hi! How can I help?",
    starters: STARTERS[lp.product.slug] ?? [],
    hours: profile?.hours ?? null,
    voice: true,
  };
}

export function customerReply(answer: string): string {
  const m = answer.match(/(?:What the caller hears|Reply to (?:the )?caller|Reply given)\s*:\s*([\s\S]*?)(?=\n\s*(?:Call note|Customer\s*:|Caller\s*:|Phone\s*:|Summary for the business|Note for the business)|$)/i);
  const reply = (m?.[1] ?? "").trim();
  return reply ? reply.slice(0, 1500) : "Thanks, we have your request. The team will be in touch to confirm.";
}

const MAX_TURNS = 14;

/**
 * One turn of a customer's chat. The agent sees the whole conversation; while it still needs something it asks one
 * question (never billed, never recorded). When it finishes, the request is metered once for this conversation
 * (request id = the session), lands in the business's inbox and notifies the business.
 */
export async function customerChat(token: string, ip: string, body: { sessionId?: unknown; messages?: unknown }) {
  limit(`talk-ip:${ip}`, 40);
  limit(`talk-link:${sha256(token)}`, 400, 24 * 3600_000);
  const sessionId = typeof body.sessionId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId) throw new HttpError(400, "missing session");
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const msgs = raw
    .filter((m): m is { role: string; text: string } => Boolean(m) && typeof (m as { text?: unknown }).text === "string")
    .map((m) => ({ role: m.role === "assistant" ? "Assistant" : "Customer", text: m.text.trim().slice(0, 1500) }))
    .filter((m) => m.text)
    .slice(-MAX_TURNS * 2);
  if (!msgs.length || msgs.at(-1)!.role !== "Customer") throw new HttpError(400, "send a message");
  if (msgs.filter((m) => m.role === "Customer").length > MAX_TURNS) throw new HttpError(429, "This conversation is long; please start a new one.");
  const { deal, lp } = await dealForToken(token);
  const input = { mode: "live chat", channel: "Customer chat on the business's website", conversation: msgs.map((m) => `${m.role}: ${m.text}`).join("\n") };
  const out = await runServiceAgent(lp, { requestId: `talk-${sessionId}`, dealId: deal.id }, input as never);
  if (out.followUp) return { done: false, reply: out.answer };
  if (out.status === "failed") return { done: false, reply: "Sorry, something went wrong on our side. Could you send that again?" };
  const receipt = (await execute(deal.id, `talk-${sessionId}`, input as never, out)) as { status: string; answer?: string };
  const answer = String(receipt.answer ?? out.answer);
  const urgent = /\bemergenc/i.test(answer) || out.status === "handoff";
  const link = `${env.WEB_ORIGIN.replace(/\/$/, "")}/app/deals/${deal.id}`;
  notifyBuyer(deal.id, deal.orgId, urgent ? "Urgent: a customer needs you now" : "New request from a customer", `${answer.slice(0, 1500)}\n\nInbox: ${link}`, { event: urgent ? "customer_urgent" : "customer_request", product: lp.product.slug, note: answer.slice(0, 4000), url: link });
  return { done: true, reply: customerReply(answer), urgent };
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

