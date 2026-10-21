/**
 * Deal notifications for sellers: email, Telegram and HMAC-signed webhooks. Events go into an outbox once (unique
 * dedupe key, so a re-scanned block never notifies twice) and the reconciler tick delivers them with retries.
 *
 * Messages are informational; the chain is the record. They never carry service API keys or buyer contact details,
 * and amounts link to the explorer. Webhooks are SSRF-guarded: https only, DNS resolved and private, loopback,
 * link-local and metadata addresses refused, no redirects, 5 s timeout, response body ignored.
 */
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, asc, eq, lt } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";

export type NotifyEvent = "deal_funded" | "usage_settled" | "refund_issued" | "dispute_opened" | "dispute_resolved" | "approval_required" | "test";

const TITLES: Record<NotifyEvent, string> = {
  deal_funded: "A buyer funded a deal",
  usage_settled: "Delivered usage was settled to you",
  refund_issued: "Unused balance was refunded to a buyer",
  dispute_opened: "A buyer opened a dispute",
  dispute_resolved: "A dispute was resolved",
  approval_required: "An offer needs your approval",
  test: "Test notification",
};

export async function enqueue(orgId: string, event: NotifyEvent, dedupeKey: string, payload: Record<string, unknown>, dealId?: string) {
  const [s] = await db.select().from(schema.notificationSettings).where(eq(schema.notificationSettings.orgId, orgId));
  if (!s || (!s.email && !s.telegramChatId && !s.webhookUrl)) return;
  await db.insert(schema.notifications).values({ id: id("ntf"), orgId, dealId, event, dedupeKey, payload }).onConflictDoNothing();
}

/* ---------------------------------------------------------------- settings */

export async function settingsView(orgId: string) {
  const [s] = await db.select().from(schema.notificationSettings).where(eq(schema.notificationSettings.orgId, orgId));
  return {
    email: s?.email ?? null,
    telegramChatId: s?.telegramChatId ?? null,
    webhookUrl: s?.webhookUrl ?? null,
    channels: { email: Boolean(env.SMTP_URL), telegram: Boolean(env.TELEGRAM_BOT_TOKEN), webhook: true },
  };
}

export async function saveSettings(orgId: string, body: { email?: string | null; telegramChatId?: string | null; webhookUrl?: string | null }) {
  const email = body.email?.trim() || null;
  if (email && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const chat = body.telegramChatId?.trim() || null;
  if (chat && !/^-?\d{4,20}$/.test(chat)) throw new HttpError(400, "A Telegram chat id is a number (message the bot, then use the id it shows).");
  const url = body.webhookUrl?.trim() || null;
  if (url) await assertPublicHttps(url);
  const [cur] = await db.select().from(schema.notificationSettings).where(eq(schema.notificationSettings.orgId, orgId));
  let secret: string | null = null;
  let webhookSecretEnc = cur?.webhookSecretEnc ?? null;
  if (url && (!cur?.webhookUrl || cur.webhookUrl !== url || !webhookSecretEnc)) {
    secret = `whsec_${randomBytes(24).toString("hex")}`;
    webhookSecretEnc = encryptSecret(secret);
  }
  if (!url) webhookSecretEnc = null;
  await db
    .insert(schema.notificationSettings)
    .values({ orgId, email, telegramChatId: chat, webhookUrl: url, webhookSecretEnc, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.notificationSettings.orgId, set: { email, telegramChatId: chat, webhookUrl: url, webhookSecretEnc, updatedAt: new Date() } });
  // The signing secret is returned once, when created; it is stored encrypted and never shown again.
  return { ...(await settingsView(orgId)), webhookSecret: secret };
}

/* ---------------------------------------------------------------- SSRF guard */

function privateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

const allowPrivate = () => env.NOTIFY_ALLOW_PRIVATE === "1" && env.NODE_ENV !== "production";

async function assertPublicHttps(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "Webhook URL is not a valid URL.");
  }
  if (allowPrivate() && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u;
  if (u.protocol !== "https:") throw new HttpError(400, "Webhook URL must use https.");
  if (u.username || u.password) throw new HttpError(400, "Webhook URL must not contain credentials.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  // Checked at save and again at send. fetch resolves the name itself, so a rebinding DNS answer between the two is
  // not fully excluded; the response body is ignored, which keeps the impact to a blind POST.
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new HttpError(400, "Webhook host does not resolve.");
  if (addrs.some((a) => privateAddress(a.address))) throw new HttpError(400, "Webhook host resolves to a private or internal address.");
  return u;
}

/* ---------------------------------------------------------------- delivery */

async function sendWebhook(url: string, secretEnc: string, body: string) {
  const u = await assertPublicHttps(url); // re-checked at send time (DNS can change after saving)
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", decryptSecret(secretEnc)).update(`${t}.${body}`).digest("hex");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(u, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "content-type": "application/json", "user-agent": "ProteusAI-Webhooks/1", "x-proteus-signature": `t=${t},v1=${sig}` }, body });
    if (r.status < 200 || r.status >= 300) throw new Error(`webhook answered HTTP ${r.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  if (!r.ok) throw new Error(`telegram HTTP ${r.status}`);
}

let mailer: { sendMail: (o: Record<string, unknown>) => Promise<unknown> } | null = null;
async function sendEmail(to: string, subject: string, text: string) {
  if (!mailer) {
    const nm = await import("nodemailer");
    mailer = nm.createTransport(env.SMTP_URL!) as unknown as typeof mailer;
  }
  await mailer!.sendMail({ from: env.NOTIFY_FROM, to, subject, text });
}

function render(event: NotifyEvent, p: Record<string, unknown>) {
  const lines = [TITLES[event]];
  if (p.amountUsdc) lines.push(`Amount: ${p.amountUsdc} USDC`);
  if (p.deal) lines.push(`Deal: ${p.deal}`);
  if (p.product) lines.push(`Product: ${p.product}`);
  if (p.explorer) lines.push(`On chain: ${p.explorer}`);
  if (p.link) lines.push(`Open: ${p.link}`);
  lines.push("", "Informational only; the Arc chain is the record.");
  return lines.join("\n");
}

type Row = typeof schema.notifications.$inferSelect;

/** Sends one outbox row on every configured channel; records the outcome. Returns the channel errors (empty = sent). */
async function deliver(n: Row): Promise<string[]> {
  const [s] = await db.select().from(schema.notificationSettings).where(eq(schema.notificationSettings.orgId, n.orgId));
  const payload = n.payload as Record<string, unknown>;
  const text = render(n.event as NotifyEvent, payload);
  const errors: string[] = [];
  if (s?.webhookUrl && s.webhookSecretEnc) await sendWebhook(s.webhookUrl, s.webhookSecretEnc, JSON.stringify({ id: n.id, event: n.event, createdAt: n.createdAt, data: payload })).catch((e) => errors.push(`webhook: ${(e as Error).message}`));
  if (s?.telegramChatId && env.TELEGRAM_BOT_TOKEN) await sendTelegram(s.telegramChatId, text).catch((e) => errors.push(`telegram: ${(e as Error).message}`));
  if (s?.email && env.SMTP_URL) await sendEmail(s.email, `Proteus AI: ${TITLES[n.event as NotifyEvent]}`, text).catch((e) => errors.push(`email: ${(e as Error).message}`));
  const failed = errors.length > 0;
  await db
    .update(schema.notifications)
    .set({ status: failed && n.attempts + 1 < 5 ? "pending" : failed ? "failed" : "sent", attempts: n.attempts + 1, error: failed ? errors.join("; ").slice(0, 500) : null, sentAt: failed ? null : new Date() })
    .where(eq(schema.notifications.id, n.id));
  return errors;
}

/** Delivers pending notifications; called after each reconciler tick. Up to 5 attempts each. */
export async function drainOutbox(limit = 20): Promise<number> {
  const rows = await db.select().from(schema.notifications).where(and(eq(schema.notifications.status, "pending"), lt(schema.notifications.attempts, 5))).orderBy(asc(schema.notifications.createdAt)).limit(limit);
  let sent = 0;
  for (const n of rows) if (!(await deliver(n)).length) sent++;
  return sent;
}

/** Sends a sample notification to this seller's channels right away and reports each channel's result. */
export async function sendTest(orgId: string) {
  const [s] = await db.select().from(schema.notificationSettings).where(eq(schema.notificationSettings.orgId, orgId));
  if (!s || (!s.email && !s.telegramChatId && !s.webhookUrl)) throw new HttpError(400, "Add an email, Telegram chat or webhook first.");
  const [row] = await db.insert(schema.notifications).values({ id: id("ntf"), orgId, event: "test", dedupeKey: `test:${orgId}:${Date.now()}`, payload: { deal: "example", amountUsdc: "1.000000", link: `${env.WEB_ORIGIN}/app/sell` } }).returning();
  const errors = await deliver(row!);
  if (errors.length) await db.update(schema.notifications).set({ status: "failed" }).where(eq(schema.notifications.id, row!.id)); // no background retries for a test
  return { ok: errors.length === 0, errors };
}
