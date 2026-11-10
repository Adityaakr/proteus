import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { formatUsd } from "@proteus/domain";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { limit } from "../lib/ratelimit";
import { openText, sealText } from "../lib/vault";
import { addBuyerMessage, startNegotiation } from "./negotiation";
import { createQuote } from "./quotes";
import { routeToProduct } from "./storefront";
import { enqueue } from "./notify";

/*
 * WhatsApp channel (Meta Cloud API). Privacy rules this file keeps:
 * - A buyer is known by an HMAC of Meta's business-scoped user id. Ids needed to reply are sealed with the seller's key.
 * - Chat text carries only what the buyer may see anyway: the agent's reply and public offers. Never wallet addresses,
 *   deal, quote or negotiation ids; money and identity steps happen on the web through an opaque short-lived link.
 * - Message bodies, phone numbers and names are never logged.
 */

const LINK_TTL_MS = 30 * 60 * 1000;
const HUMAN_MS = 24 * 3600 * 1000;

/* ---------------------------------------------------------------- webhook security */

/** X-Hub-Signature-256: "sha256=" + HMAC-SHA256 of the raw body with the Meta app secret. Constant-time compare. */
export function verifySignature(rawBody: string, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
  const got = Buffer.from(header.slice("sha256=".length));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function senderKey(): Buffer {
  return createHash("sha256").update("proteus-whatsapp-sender|" + (env.KEY_ENCRYPTION_SECRET ?? env.SESSION_SECRET)).digest();
}

/** Stable pseudonym for a WhatsApp user within Proteus. Not reversible without the server secret. */
export function senderHash(userId: string): string {
  return createHmac("sha256", senderKey()).update(userId).digest("hex");
}

/* ---------------------------------------------------------------- webhook payload */

interface InboundMessage {
  phoneNumberId: string;
  wamid: string;
  /** Business-scoped user id when Meta sends one, else the wa_id. Used only for the pseudonym. */
  userKey: string;
  /** What we reply to: wa_id (phone) when present, else the business-scoped user id. */
  contact: { waId?: string; userId?: string };
  kind: "text" | "button" | "other";
  text?: string;
  buttonId?: string;
  group: boolean;
}

/** Pulls buyer messages out of a Cloud API webhook body. Status callbacks and unknown shapes are skipped. */
export function parseWebhook(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const e of entries) {
    for (const ch of ((e as { changes?: unknown[] }).changes ?? []) as { field?: string; value?: Record<string, unknown> }[]) {
      const v = ch.value;
      if (ch.field !== "messages" || !v) continue;
      const phoneNumberId = (v.metadata as { phone_number_id?: string } | undefined)?.phone_number_id;
      const contacts = (v.contacts as { wa_id?: string; user_id?: string }[] | undefined) ?? [];
      for (const m of (v.messages as Record<string, unknown>[] | undefined) ?? []) {
        const from = m.from as string | undefined;
        const fromUserId = m.from_user_id as string | undefined;
        const c = contacts.find((x) => (from && x.wa_id === from) || (fromUserId && x.user_id === fromUserId)) ?? contacts[0];
        const userId = fromUserId ?? c?.user_id;
        const waId = from ?? c?.wa_id;
        const userKey = userId ?? waId;
        if (!phoneNumberId || !userKey || typeof m.id !== "string") continue;
        const type = m.type as string;
        const interactive = m.interactive as { type?: string; button_reply?: { id?: string } } | undefined;
        out.push({
          phoneNumberId,
          wamid: m.id,
          userKey,
          contact: { waId, userId },
          kind: type === "text" ? "text" : type === "interactive" && interactive?.type === "button_reply" ? "button" : "other",
          text: type === "text" ? String((m.text as { body?: string } | undefined)?.body ?? "").slice(0, 4000) : undefined,
          buttonId: interactive?.button_reply?.id,
          group: Boolean(m.group_id ?? (m.context as { group_id?: string } | undefined)?.group_id),
        });
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- outbound */

type Outbound =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: { id: string; title: string }[] }
  | { kind: "link"; body: string; label: string; url: string };

/** Cloud API message body. Limits from Meta: text 4096, interactive body 1024, 3 buttons, titles and link label 20. */
export function messagePayload(to: { waId?: string; userId?: string }, m: Outbound): Record<string, unknown> {
  const addr = to.waId ? { to: to.waId } : { recipient: to.userId };
  const base = { messaging_product: "whatsapp", recipient_type: "individual", ...addr };
  if (m.kind === "text") return { ...base, type: "text", text: { preview_url: false, body: m.body.slice(0, 4096) } };
  if (m.kind === "buttons")
    return { ...base, type: "interactive", interactive: { type: "button", body: { text: m.body.slice(0, 1024) }, action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) } } };
  return { ...base, type: "interactive", interactive: { type: "cta_url", body: { text: m.body.slice(0, 1024) }, action: { name: "cta_url", parameters: { display_text: m.label.slice(0, 20), url: m.url } } } };
}

async function send(account: typeof schema.whatsappAccounts.$inferSelect, to: { waId?: string; userId?: string }, m: Outbound) {
  const token = await openText(account.orgId, account.tokenEnc);
  const res = await fetch(`${env.WHATSAPP_GRAPH_URL}/${encodeURIComponent(account.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(messagePayload(to, m)),
    signal: AbortSignal.timeout(10_000),
  });
  // Only the status goes to the log: Graph error bodies can echo the recipient.
  if (!res.ok) {
    console.error(`[whatsapp] send failed for org ${account.orgId}: HTTP ${res.status}`);
    throw new HttpError(502, res.status === 401 || res.status === 403 ? "WhatsApp refused the access token. Reconnect your number in Settings with a valid token." : `WhatsApp did not accept the message (HTTP ${res.status}).`);
  }
}

/* ---------------------------------------------------------------- conversation */

const STOP = /^(stop|unsubscribe|opt out|optout)$/i;
const START = /^(start|unstop|resume chat)$/i;
const HUMAN = /^(human|person|agent please|talk to (a )?(human|person)|team)$/i;
const AGENT = /^(agent|bot|back to agent)$/i;

async function logEvent(orgId: string, sender: string, event: "opt_in" | "opt_out" | "human" | "resume") {
  await db.insert(schema.whatsappEvents).values({ id: id("wae"), orgId, senderHash: sender, event });
}

/** Handles one verified webhook body. Each message is processed once (wamid), in order. Errors are contained per message. */
export async function handleWebhook(body: unknown): Promise<void> {
  for (const m of parseWebhook(body)) {
    try {
      const [fresh] = await db.insert(schema.whatsappInbound).values({ wamid: m.wamid }).onConflictDoNothing().returning();
      if (!fresh) continue;
      await handleMessage(m);
    } catch (e) {
      // Name and status only: messages from routing or the model can echo buyer text.
      console.error(`[whatsapp] message failed: ${(e as Error).name}${e instanceof HttpError ? ` ${e.status}` : ""}`);
    }
  }
}

async function handleMessage(m: InboundMessage) {
  const [account] = await db.select().from(schema.whatsappAccounts).where(and(eq(schema.whatsappAccounts.phoneNumberId, m.phoneNumberId), eq(schema.whatsappAccounts.active, true)));
  if (!account || m.group) return; // unknown number, or a group chat: never answer into a group
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, account.orgId));
  if (!org) return;
  const sender = senderHash(m.userKey);
  const text = (m.text ?? "").trim();
  // STOP and START always go through, even for a buyer over the limit: an opt-out must never be lost.
  if (!STOP.test(text) && !START.test(text)) {
    try {
      limit(`wa:${account.orgId}:${sender}`, 30);
    } catch {
      return; // over the per-buyer limit: stay silent rather than spend the seller's messages
    }
  }
  const contactEnc = await sealText(org.id, JSON.stringify(m.contact));
  let [s] = await db.select().from(schema.whatsappSessions).where(and(eq(schema.whatsappSessions.orgId, org.id), eq(schema.whatsappSessions.senderHash, sender)));
  if (!s) {
    [s] = await db.insert(schema.whatsappSessions).values({ id: id("was"), orgId: org.id, senderHash: sender, contactEnc }).onConflictDoNothing().returning();
    if (!s) [s] = await db.select().from(schema.whatsappSessions).where(and(eq(schema.whatsappSessions.orgId, org.id), eq(schema.whatsappSessions.senderHash, sender)));
  } else {
    await db.update(schema.whatsappSessions).set({ contactEnc, lastInboundAt: new Date() }).where(eq(schema.whatsappSessions.id, s.id));
  }
  if (!s) return;
  const reply = (o: Outbound) => send(account, m.contact, o);

  if (STOP.test(text)) {
    await db.update(schema.whatsappSessions).set({ optedOutAt: new Date() }).where(eq(schema.whatsappSessions.id, s.id));
    await logEvent(org.id, sender, "opt_out");
    return reply({ kind: "text", body: `You will not get more messages from ${org.name}'s sales agent. Send START to chat again.` });
  }
  if (s.optedOutAt) {
    if (!START.test(text)) return;
    await db.update(schema.whatsappSessions).set({ optedOutAt: null }).where(eq(schema.whatsappSessions.id, s.id));
    s = { ...s, optedOutAt: null, optedInAt: null };
  }
  if (!s.optedInAt) {
    // The buyer wrote first; record it and say plainly who they are talking to before anything else.
    await db.update(schema.whatsappSessions).set({ optedInAt: new Date() }).where(eq(schema.whatsappSessions.id, s.id));
    await logEvent(org.id, sender, "opt_in");
    await reply({ kind: "text", body: disclosure(org.name) });
    if (START.test(text) || !text) return;
  }

  if (HUMAN.test(text)) {
    await db.update(schema.whatsappSessions).set({ humanUntil: new Date(Date.now() + HUMAN_MS) }).where(eq(schema.whatsappSessions.id, s.id));
    await logEvent(org.id, sender, "human");
    await enqueue(org.id, "whatsapp_human", `wa-human:${s.id}:${new Date().toISOString().slice(0, 13)}`, { channel: "WhatsApp", link: s.negotiationId ? `${env.WEB_ORIGIN}/app/sell/negotiations/${s.negotiationId}` : `${env.WEB_ORIGIN}/app/sell/negotiations` }).catch(() => {});
    return reply({ kind: "text", body: `I have asked the ${org.name} team to reply here. Send AGENT any time to come back to me.` });
  }
  if (AGENT.test(text) && s.humanUntil) {
    await db.update(schema.whatsappSessions).set({ humanUntil: null }).where(eq(schema.whatsappSessions.id, s.id));
    await logEvent(org.id, sender, "resume");
    return reply({ kind: "text", body: "I am back. Tell me what you need, how many and by when." });
  }
  if (s.humanUntil && s.humanUntil.getTime() > Date.now()) {
    // The seller's team has this conversation: keep the buyer's message on the negotiation so the team sees it.
    if (s.negotiationId && text) {
      const [last] = await db.select({ seq: schema.turns.seq }).from(schema.turns).where(eq(schema.turns.negotiationId, s.negotiationId)).orderBy(desc(schema.turns.seq)).limit(1);
      await db.insert(schema.turns).values({ id: id("turn"), negotiationId: s.negotiationId, seq: (last?.seq ?? 0) + 1, role: "buyer", kind: "message", content: await sealText(org.id, text) });
      await db.update(schema.negotiations).set({ updatedAt: new Date() }).where(eq(schema.negotiations.id, s.negotiationId));
    }
    return;
  }

  if (m.kind === "button" && m.buttonId?.startsWith("q:") && s.negotiationId) return acceptOffer(org, s, sender, m.buttonId.slice(2), reply);
  if (m.kind !== "text" || !text) return reply({ kind: "text", body: "I can read text messages here. Tell me what you need, how many and by when, and your budget." });

  // Every agent turn is a model call: cap them per seller as well as per buyer, so many numbers cannot run up the bill.
  try {
    limit(`wa-org:${org.id}`, 600, 60 * 60 * 1000);
  } catch {
    return reply({ kind: "text", body: `${org.name}'s agent is very busy right now. Please try again in a little while, or reply HUMAN to reach the team.` });
  }

  // Pick the product from what the buyer says; continue the current negotiation unless they clearly switch,
  // or it has already ended (accepted or closed), in which case a new one starts.
  const route = await routeToProduct(org.slug, text, s.productSlug ?? undefined);
  let negId = s.negotiationId;
  const [current] = negId ? await db.select({ status: schema.negotiations.status }).from(schema.negotiations).where(eq(schema.negotiations.id, negId)) : [];
  const ended = !current || current.status === "accepted" || current.status === "closed";
  if (!negId || route.switched || ended) {
    const started = await startNegotiation(org.slug, route.productSlug, undefined, negId && !ended ? "continue" : "open");
    negId = started.id;
    await db.update(schema.whatsappSessions).set({ negotiationId: negId, productSlug: route.productSlug }).where(eq(schema.whatsappSessions.id, s.id));
  }
  const view = await addBuyerMessage(negId, text);
  const agentText = [...view.turns].reverse().find((t) => t.role === "agent")?.content ?? "";
  const offers = view.offers.filter((o) => o.status === "eligible").slice(0, 3);
  if (!offers.length) return reply({ kind: "text", body: agentText });
  return reply({ kind: "buttons", body: `${agentText}\n\nTap an option to review and pay.`, buttons: offers.map((o) => ({ id: `q:${o.candidateId}`, title: offerTitle(o.units, o.prepaidTotal) })) });
}

export function disclosure(seller: string): string {
  return `Hi, I am ${seller}'s AI sales agent. My prices come from ${seller}'s own rules. Reply HUMAN to reach the team, or STOP to stop messages. Privacy: ${env.WEB_ORIGIN}/docs/privacy`;
}

/** "3,000 · $1,500" — fits the 20-character button title. */
export function offerTitle(units: unknown, prepaidTotal: unknown): string {
  const u = BigInt(String(units)).toLocaleString("en-US");
  const total = formatUsd(BigInt(String(prepaidTotal))).replace(/\.00$/, "");
  const t = `${u} · ${total}`;
  return t.length <= 20 ? t : total.slice(0, 20);
}

async function acceptOffer(org: typeof schema.orgs.$inferSelect, s: typeof schema.whatsappSessions.$inferSelect, sender: string, candidateId: string, reply: (o: Outbound) => Promise<void>) {
  let quote: { id: string; status: string };
  try {
    quote = (await createQuote(s.negotiationId!, candidateId)) as { id: string; status: string };
  } catch (e) {
    if (e instanceof HttpError) return reply({ kind: "text", body: "That option is no longer available. Tell me what you need and I will put together fresh options." });
    throw e;
  }
  if (quote.status === "approval_required") return reply({ kind: "text", body: `This one needs ${org.name}'s approval first. I will send you the link here as soon as they approve.` });
  return sendOfferLink(org, s.contactEnc, sender, quote.id);
}

/** Issues an opaque 30-minute link to the offer page and sends it. The chat never sees the quote id. */
export async function sendOfferLink(org: typeof schema.orgs.$inferSelect, contactEnc: string, sender: string, quoteId: string) {
  const [account] = await db.select().from(schema.whatsappAccounts).where(and(eq(schema.whatsappAccounts.orgId, org.id), eq(schema.whatsappAccounts.active, true)));
  if (!account) return;
  const token = randomBytes(18).toString("base64url");
  await db.insert(schema.whatsappLinks).values({ token, orgId: org.id, quoteId, senderHash: sender, expiresAt: new Date(Date.now() + LINK_TTL_MS) });
  const contact = JSON.parse(await openText(org.id, contactEnc)) as { waId?: string; userId?: string };
  await send(account, contact, { kind: "link", body: `Your offer from ${org.name} is ready. Review the exact terms and pay securely on the next page. The link works for 30 minutes.`, label: "Review and pay", url: `${env.WEB_ORIGIN}/api/w/${token}` });
}

/** Resolves a chat link to the offer page path, or null when unknown or expired. */
export async function resolveLink(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [l] = await db.select().from(schema.whatsappLinks).where(and(eq(schema.whatsappLinks.token, token), gt(schema.whatsappLinks.expiresAt, new Date())));
  return l ? `/app/offers/${encodeURIComponent(l.quoteId)}` : null;
}

/** After the seller approves a quote that started in WhatsApp, send that buyer the link. Best effort. */
export async function notifyApproved(negotiationId: string, quoteId: string) {
  const [s] = await db.select().from(schema.whatsappSessions).where(eq(schema.whatsappSessions.negotiationId, negotiationId));
  if (!s || s.optedOutAt || Date.now() - s.lastInboundAt.getTime() >= 24 * 3600 * 1000) return; // outside WhatsApp's reply window
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, s.orgId));
  if (org) await sendOfferLink(org, s.contactEnc, s.senderHash, quoteId);
}

/* ---------------------------------------------------------------- seller connection */

export async function connectAccount(orgId: string, input: { phoneNumberId: string; accessToken: string; displayPhone?: string }) {
  const [org] = await db.select({ label: schema.orgs.label }).from(schema.orgs).where(eq(schema.orgs.id, orgId));
  // The example seller's console is open to every visitor, so no one may attach a real number to it.
  if (!org || org.label === "sandbox") throw new HttpError(403, "WhatsApp can be connected from your own seller account, not the example seller.");
  if (!/^\d{5,30}$/.test(input.phoneNumberId)) throw new HttpError(400, "phoneNumberId is the numeric Phone number ID from Meta's WhatsApp dashboard");
  if (input.accessToken.length < 20 || input.accessToken.length > 1000) throw new HttpError(400, "accessToken looks wrong");
  const [taken] = await db.select().from(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.phoneNumberId, input.phoneNumberId));
  if (taken && taken.orgId !== orgId) throw new HttpError(409, "this WhatsApp number is connected to another seller");
  // Prove the seller controls this number: Meta must accept the token for this phone number id.
  // Without this, anyone who knows a number's id (it is not secret) could route that seller's buyers to themselves.
  const owned = await graphPhone(input.phoneNumberId, input.accessToken);
  const tokenEnc = await sealText(orgId, input.accessToken);
  const displayPhone = owned.displayPhone ?? (input.displayPhone?.replace(/[^\d+ ]/g, "").slice(0, 24) || null);
  await db
    .insert(schema.whatsappAccounts)
    .values({ orgId, phoneNumberId: input.phoneNumberId, tokenEnc, displayPhone, active: true })
    .onConflictDoUpdate({ target: schema.whatsappAccounts.orgId, set: { phoneNumberId: input.phoneNumberId, tokenEnc, displayPhone, active: true, updatedAt: new Date() } });
  return accountView(orgId);
}

async function graphPhone(phoneNumberId: string, token: string): Promise<{ displayPhone: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${env.WHATSAPP_GRAPH_URL}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError(502, "Could not reach WhatsApp to check this number. Try again in a moment.");
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string; display_phone_number?: string };
  if (!res.ok || body.id !== phoneNumberId) throw new HttpError(400, "WhatsApp did not accept this access token for this phone number ID. Check both in Meta's WhatsApp Manager.");
  return { displayPhone: body.display_phone_number?.replace(/[^\d+ ]/g, "").slice(0, 24) || null };
}

export async function disconnectAccount(orgId: string) {
  await db.delete(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.orgId, orgId));
  return accountView(orgId);
}

/** What the seller console shows. Never the token. */
export async function accountView(orgId: string) {
  const [a] = await db.select().from(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.orgId, orgId));
  return {
    platformReady: Boolean(env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN),
    webhookUrl: `${env.WEB_ORIGIN}/api/channels/whatsapp/webhook`,
    connected: Boolean(a?.active),
    phoneNumberId: a?.phoneNumberId ?? null,
    displayPhone: a?.displayPhone ?? null,
    connectedAt: a?.updatedAt ?? null,
  };
}

/* ---------------------------------------------------------------- seller replies (after HUMAN) */

const WINDOW_MS = 24 * 3600 * 1000;

async function sessionForNegotiation(orgId: string, negotiationId: string) {
  const [s] = await db.select().from(schema.whatsappSessions).where(and(eq(schema.whatsappSessions.orgId, orgId), eq(schema.whatsappSessions.negotiationId, negotiationId)));
  return s ?? null;
}

/** Whether a negotiation came from WhatsApp, whether the team has it, and whether WhatsApp still allows a free-form reply. */
export async function negotiationChannel(orgId: string, negotiationId: string) {
  const s = await sessionForNegotiation(orgId, negotiationId);
  if (!s) return { channel: null };
  return {
    channel: "whatsapp" as const,
    humanActive: Boolean(s.humanUntil && s.humanUntil.getTime() > Date.now()),
    optedOut: Boolean(s.optedOutAt),
    replyWindowOpen: Date.now() - s.lastInboundAt.getTime() < WINDOW_MS,
    lastInboundAt: s.lastInboundAt,
  };
}

/** The seller's team writes to the buyer from the console. The agent stays paused while the team has the chat. */
export async function sellerReply(orgId: string, negotiationId: string, text: string) {
  const body = text.trim();
  if (!body || body.length > 4000) throw new HttpError(400, "Write a message of up to 4,000 characters.");
  const s = await sessionForNegotiation(orgId, negotiationId);
  if (!s) throw new HttpError(404, "This negotiation did not come from WhatsApp.");
  if (s.optedOutAt) throw new HttpError(409, "The buyer sent STOP. You cannot message them until they write again.");
  if (Date.now() - s.lastInboundAt.getTime() >= WINDOW_MS) throw new HttpError(409, "WhatsApp only allows free-form replies within 24 hours of the buyer's last message.");
  const [account] = await db.select().from(schema.whatsappAccounts).where(and(eq(schema.whatsappAccounts.orgId, orgId), eq(schema.whatsappAccounts.active, true)));
  if (!account) throw new HttpError(409, "Connect your WhatsApp number in Settings first.");
  const contact = JSON.parse(await openText(orgId, s.contactEnc)) as { waId?: string; userId?: string };
  await send(account, contact, { kind: "text", body });
  await db.update(schema.whatsappSessions).set({ humanUntil: new Date(Date.now() + HUMAN_MS) }).where(eq(schema.whatsappSessions.id, s.id));
  const [last] = await db.select({ seq: schema.turns.seq }).from(schema.turns).where(eq(schema.turns.negotiationId, negotiationId)).orderBy(desc(schema.turns.seq)).limit(1);
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId, seq: (last?.seq ?? 0) + 1, role: "agent", kind: "seller_reply", content: await sealText(orgId, body) });
  return negotiationChannel(orgId, negotiationId);
}

/** Hands the chat back to the agent. */
export async function resumeAgent(orgId: string, negotiationId: string) {
  const s = await sessionForNegotiation(orgId, negotiationId);
  if (!s) throw new HttpError(404, "This negotiation did not come from WhatsApp.");
  await db.update(schema.whatsappSessions).set({ humanUntil: null }).where(eq(schema.whatsappSessions.id, s.id));
  await logEvent(orgId, s.senderHash, "resume");
  return negotiationChannel(orgId, negotiationId);
}
