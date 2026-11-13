/**
 * Where a deal's buyer wants to hear about it: email, Telegram or a signed webhook (for Zapier, Make, a CRM or a
 * calendar). Stored per deal, sealed with the seller's vault key; the webhook secret is shown once. Used for order
 * updates (a shopper) and for new customer requests on a scheduling service (a business).
 */
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { encryptSecret } from "../lib/crypto";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { openJsonOr, sealJson } from "../lib/vault";
import { assertPublicHttps, channelsAvailable, sendToChannels } from "./notify";

interface Settings { email?: string | null; telegramChatId?: string | null; webhookUrl?: string | null; webhookSecretEnc?: string | null }

async function row(dealId: string) {
  const [r] = await db.select().from(schema.serviceConnections).where(and(eq(schema.serviceConnections.dealId, dealId), eq(schema.serviceConnections.kind, "buyer_notify")));
  return r ?? null;
}

async function read(dealId: string, orgId: string): Promise<Settings> {
  const r = await row(dealId);
  return r ? openJsonOr<Settings>(orgId, r.data, {}) : {};
}

export async function buyerNotifyView(dealId: string, orgId: string) {
  const s = await read(dealId, orgId);
  return { email: s.email ?? null, telegramChatId: s.telegramChatId ?? null, webhookUrl: s.webhookUrl ?? null, channels: channelsAvailable(), telegramBot: env.TELEGRAM_BOT_TOKEN ? "Message the Proteus bot /start to get your chat id" : null };
}

export async function saveBuyerNotify(dealId: string, orgId: string, body: { email?: string | null; telegramChatId?: string | null; webhookUrl?: string | null }) {
  const cur = await read(dealId, orgId);
  const email = body.email?.trim() || null;
  if (email && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const chat = body.telegramChatId?.trim() || null;
  if (chat && !/^-?\d{3,20}$/.test(chat)) throw new HttpError(400, "A Telegram chat id is a number.");
  const url = body.webhookUrl?.trim() || null;
  if (url) await assertPublicHttps(url);
  let secret: string | undefined;
  let webhookSecretEnc = cur.webhookSecretEnc ?? null;
  if (url && (url !== cur.webhookUrl || !webhookSecretEnc)) {
    secret = `whsec_${randomBytes(24).toString("base64url")}`;
    webhookSecretEnc = encryptSecret(secret);
  }
  if (!url) webhookSecretEnc = null;
  const data = await sealJson(orgId, { email, telegramChatId: chat, webhookUrl: url, webhookSecretEnc } satisfies Settings);
  await db
    .insert(schema.serviceConnections)
    .values({ id: id("sc"), dealId, orgId, kind: "buyer_notify", data, label: null })
    .onConflictDoUpdate({ target: [schema.serviceConnections.dealId, schema.serviceConnections.kind], set: { data, updatedAt: new Date() } });
  return { ...(await buyerNotifyView(dealId, orgId)), webhookSecret: secret };
}

/** Fire and forget: never blocks or fails the action that triggered it. */
export function notifyBuyer(dealId: string, orgId: string, subject: string, text: string, payload: Record<string, unknown>) {
  void read(dealId, orgId)
    .then((s) => (s.email || s.telegramChatId || s.webhookUrl ? sendToChannels(s, subject, text, payload) : undefined))
    .catch((e) => console.error(`[notify] buyer settings unreadable for ${dealId}: ${String((e as Error).message).slice(0, 80)}`));
}
