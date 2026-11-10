import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { handleWebhook, resolveLink, verifySignature } from "../services/whatsapp";

export const channelRoutes = new Hono();

/** Meta's subscription check: echo hub.challenge when the verify token matches. */
channelRoutes.get("/channels/whatsapp/webhook", (c) => {
  const expected = env.WHATSAPP_VERIFY_TOKEN;
  const got = c.req.query("hub.verify_token") ?? "";
  const ok = Boolean(expected) && c.req.query("hub.mode") === "subscribe" && got.length === expected!.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected!));
  if (!ok) return c.text("forbidden", 403);
  return c.text(c.req.query("hub.challenge") ?? "", 200);
});

/**
 * Message webhook. The signature is checked over the raw body before anything is parsed. Meta expects a fast 200 and
 * retries otherwise, so verified bodies are acknowledged at once and handled after the response.
 */
channelRoutes.post("/channels/whatsapp/webhook", async (c) => {
  if (!env.WHATSAPP_APP_SECRET) return c.text("not configured", 404);
  const raw = await c.req.text();
  if (raw.length > 3_000_000 || !verifySignature(raw, c.req.header("x-hub-signature-256"), env.WHATSAPP_APP_SECRET)) return c.text("bad signature", 401);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.text("ok", 200);
  }
  void handleWebhook(body).catch((e) => console.error("[whatsapp] webhook:", (e as Error).message.slice(0, 200)));
  return c.text("ok", 200);
});

/** Opaque link from a chat message to the offer page. Expired or unknown links land on a plain explanation. */
channelRoutes.get("/w/:token", async (c) => {
  const path = await resolveLink(c.req.param("token"));
  c.header("cache-control", "no-store");
  c.header("referrer-policy", "no-referrer");
  if (!path) return c.html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link expired</title><body style="font-family:system-ui;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.5"><h1 style="font-size:1.25rem">This link has expired</h1><p>Offer links from WhatsApp work for 30 minutes. Go back to the chat and tap the option again for a fresh link.</p></body>`, 410);
  return c.redirect(path, 302);
});
