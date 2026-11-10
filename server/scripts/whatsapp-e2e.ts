/**
 * WhatsApp channel end to end against a fake Graph API, on a LOCAL database only.
 *
 *   1. Start the API with the fake Graph URL and test secrets:
 *      WHATSAPP_APP_SECRET=e2e-app-secret-0123456789 WHATSAPP_VERIFY_TOKEN=e2e-verify-token-0123 \
 *      WHATSAPP_GRAPH_URL=http://127.0.0.1:8898/v27.0 INVITE_GATE=0 PORT=8799 npx tsx src/index.ts
 *   2. WHATSAPP_GRAPH_URL=http://127.0.0.1:8898/v27.0 npx tsx scripts/whatsapp-e2e.ts [sellerSlug]
 *
 * It connects the seller to the fake Graph server, plays a buyer, checks every reply and what is stored,
 * then removes everything it created.
 */
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { eq, inArray, like } from "drizzle-orm";
import { db, schema } from "../src/db";
import { connectAccount, sellerReply } from "../src/services/whatsapp";

const API = "http://127.0.0.1:8799/api";
const SECRET = "e2e-app-secret-0123456789";
const VERIFY = "e2e-verify-token-0123";
const PHONE_ID = "900000000000001";
const seller = process.argv[2] ?? "lumen-voice";

if (!/@?(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "postgres://localhost/")) throw new Error("refusing: this script writes test rows and must run against a local database");
// Some calls run in this process too (the team reply), so they must also go to the fake Graph server, never to Meta.
if (process.env.WHATSAPP_GRAPH_URL !== "http://127.0.0.1:8898/v27.0") throw new Error("refusing: run with WHATSAPP_GRAPH_URL=http://127.0.0.1:8898/v27.0 so no request can reach Meta");

/* fake Graph API: records every message the server sends */
const sent: Record<string, any>[] = [];
const graph = createServer((req, res) => {
  let b = "";
  req.on("data", (d) => (b += d));
  req.on("end", () => {
    if (req.method === "GET" && req.url?.startsWith(`/v27.0/${PHONE_ID}?`)) {
      // Meta's phone number lookup: only the real token is accepted.
      const okToken = req.headers.authorization === "Bearer EAAG-e2e-fake-token-not-real-000000";
      res.writeHead(okToken ? 200 : 401, { "content-type": "application/json" }).end(JSON.stringify(okToken ? { id: PHONE_ID, display_phone_number: "+91 90000 00001" } : { error: { code: 190 } }));
    } else if (req.method === "POST" && req.url === `/v27.0/${PHONE_ID}/messages`) {
      sent.push({ auth: req.headers.authorization, ...JSON.parse(b) });
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.out" }] }));
    } else res.writeHead(404).end();
  });
});
await new Promise<void>((r) => graph.listen(8898, "127.0.0.1", r));

let failures = 0;
const check = (ok: unknown, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(n: number, ms = 20_000) {
  const end = Date.now() + ms;
  while (sent.length < n && Date.now() < end) await sleep(150);
  return sent.length >= n;
}

let seq = 0;
const buyer = { wa: "919800000001", user: "IN.e2e" + Date.now() };
function payload(msg: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { object: "whatsapp_business_account", entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: PHONE_ID }, contacts: [{ wa_id: buyer.wa, user_id: buyer.user, profile: { name: "E2E Buyer" } }], messages: [{ id: `wamid.e2e.${Date.now()}.${++seq}`, from: buyer.wa, from_user_id: buyer.user, timestamp: String(Math.floor(Date.now() / 1000)), ...msg, ...extra }] } }] }] };
}
async function deliver(body: unknown, sign = true) {
  const raw = JSON.stringify(body);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(raw).digest("hex");
  return fetch(`${API}/channels/whatsapp/webhook`, { method: "POST", headers: { "content-type": "application/json", ...(sign ? { "x-hub-signature-256": sig } : {}) }, body: raw });
}
const say = (text: string) => deliver(payload({ type: "text", text: { body: text } }));

const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, seller));
if (!org) throw new Error(`no seller ${seller}`);
const created = { negs: [] as string[] };

try {
  let refused = false;
  try {
    await connectAccount(org.id, { phoneNumberId: PHONE_ID, accessToken: "EAAG-someone-elses-guess-0000000000" });
  } catch {
    refused = true;
  }
  check(refused, "connecting with a token Meta rejects is refused");
  await connectAccount(org.id, { phoneNumberId: PHONE_ID, accessToken: "EAAG-e2e-fake-token-not-real-000000" });
  check((await fetch(`${API}/channels/whatsapp/webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(2 * 1024 * 1024) })).status === 413, "an oversized webhook body is refused before reading");

  // Meta subscription handshake
  const ok = await fetch(`${API}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=4242`);
  check(ok.status === 200 && (await ok.text()) === "4242", "verify handshake echoes the challenge");
  check((await fetch(`${API}/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong-token-000000000&hub.challenge=1`)).status === 403, "wrong verify token is refused");

  // Signature
  check((await deliver(payload({ type: "text", text: { body: "hi" } }), false)).status === 401, "unsigned webhook is refused");
  check(sent.length === 0, "nothing sent for an unsigned webhook");

  // First message: disclosure, then the agent's options as buttons
  const first = payload({ type: "text", text: { body: "Hi, we need an AI receptionist for about 2000 calls a month, budget $1500. Email me at riya@example.com" } });
  check((await deliver(first)).status === 200, "signed webhook acknowledged");
  await waitFor(2);
  check(sent[0]?.type === "text" && /AI sales agent/.test(sent[0].text.body) && /HUMAN/.test(sent[0].text.body) && /STOP/.test(sent[0].text.body), "first reply discloses the AI agent, HUMAN and STOP");
  check(sent[0]?.auth === "Bearer EAAG-e2e-fake-token-not-real-000000", "sends with the seller's own token");
  check(sent[0]?.to === buyer.wa, "replies to the buyer");
  const offers = sent[1];
  check(offers?.type === "interactive" && offers.interactive.type === "button" && offers.interactive.action.buttons.length >= 1 && offers.interactive.action.buttons.length <= 3, "offers arrive as 1 to 3 reply buttons");
  check(offers?.interactive.action.buttons.every((b: any) => b.reply.title.length <= 20 && b.reply.id.startsWith("q:")), "button titles fit 20 characters");

  // Meta retry of the same message is ignored
  const before = sent.length;
  await deliver(first);
  await sleep(1500);
  check(sent.length === before, "a redelivered message is processed once");

  // Tap an offer: an opaque link, never a quote id in the chat
  const cid = offers!.interactive.action.buttons[0].reply.id as string;
  await deliver(payload({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: cid, title: "x" } } }));
  await waitFor(before + 1);
  const link = sent.at(-1)!;
  if (link.interactive?.type !== "cta_url") console.log("  (last message)", JSON.stringify(link).slice(0, 300));
  check(link.interactive?.type === "cta_url" && /\/api\/w\/[A-Za-z0-9_-]{16,}$/.test(link.interactive.action.parameters.url), "tapping an offer sends a Review and pay link");
  const r = await fetch(link.interactive.action.parameters.url.replace(/^https?:\/\/[^/]+/, "http://127.0.0.1:8799"), { redirect: "manual" });
  check(r.status === 302 && /^\/app\/offers\/q/.test(r.headers.get("location") ?? ""), "the link opens the offer page");
  check((await fetch(`${API}/w/not-a-real-token-123456`, { redirect: "manual" })).status === 410, "an unknown link shows the expired page");

  // What reached the chat and what is stored
  const chat = JSON.stringify(sent);
  check(!/0x[0-9a-fA-F]{40}/.test(chat) && !/neg_[a-z0-9]{6}/.test(chat) && !/"q_[a-z0-9]/.test(chat), "no wallet, negotiation or quote id in any chat message");
  const [sess] = await db.select().from(schema.whatsappSessions).where(eq(schema.whatsappSessions.orgId, org.id));
  created.negs.push(sess!.negotiationId!);
  check(sess && !JSON.stringify(sess).includes(buyer.wa) && !JSON.stringify(sess).includes(buyer.user) && sess.contactEnc.startsWith("pv2:"), "session stores no phone number or user id in clear");
  const [acc] = await db.select().from(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.orgId, org.id));
  check(acc!.tokenEnc.startsWith("pv2:") && !acc!.tokenEnc.includes("EAAG"), "access token stored sealed");
  const turns = await db.select().from(schema.turns).where(eq(schema.turns.negotiationId, sess!.negotiationId!));
  check(turns.length >= 2 && turns.every((t) => t.content.startsWith("pv2:")), "chat turns stored sealed");
  const events = await db.select().from(schema.whatsappEvents).where(eq(schema.whatsappEvents.orgId, org.id));
  check(events.some((e) => e.event === "opt_in"), "opt-in logged");

  // HUMAN: agent pauses, team replies from the console, AGENT hands back
  let n = sent.length;
  await say("HUMAN");
  await waitFor(n + 1);
  check(/team/.test(sent.at(-1)?.text?.body ?? ""), "HUMAN hands the chat to the seller's team");
  n = sent.length;
  await say("hello, anyone there?");
  await sleep(2000);
  check(sent.length === n, "the agent stays quiet while the team has the chat");
  const kept = await db.select().from(schema.turns).where(eq(schema.turns.negotiationId, sess!.negotiationId!));
  check(kept.length > turns.length, "the buyer's message is kept for the team while the agent is paused");
  await sellerReply(org.id, sess!.negotiationId!, "Hi, this is the team. We can do this.");
  check(sent.at(-1)?.text?.body === "Hi, this is the team. We can do this.", "the team's reply is delivered");
  n = sent.length;
  await say("AGENT");
  await waitFor(n + 1);
  check(/back/.test(sent.at(-1)?.text?.body ?? ""), "AGENT hands back to the agent");

  // STOP, silence, START
  n = sent.length;
  await say("STOP");
  await waitFor(n + 1);
  check(/not get more messages/.test(sent.at(-1)?.text?.body ?? ""), "STOP is confirmed");
  n = sent.length;
  await say("are you there?");
  await sleep(2000);
  check(sent.length === n, "no messages after STOP");
  await say("START");
  await waitFor(n + 1);
  check(/AI sales agent/.test(sent.at(-1)?.text?.body ?? ""), "START opts back in with the disclosure");

  // Groups are never answered
  n = sent.length;
  await deliver(payload({ type: "text", text: { body: "group hello" } }, { group_id: "g1" }));
  await sleep(1500);
  check(sent.length === n, "group messages are ignored");
} finally {
  const sessions = await db.select().from(schema.whatsappSessions).where(eq(schema.whatsappSessions.orgId, org.id));
  const negs = [...new Set([...created.negs, ...sessions.map((s) => s.negotiationId).filter((x): x is string => Boolean(x))])];
  if (negs.length) {
    const quotes = await db.select({ id: schema.quotes.id }).from(schema.quotes).where(inArray(schema.quotes.negotiationId, negs));
    if (quotes.length) await db.delete(schema.approvals).where(inArray(schema.approvals.quoteId, quotes.map((q) => q.id)));
    await db.delete(schema.quotes).where(inArray(schema.quotes.negotiationId, negs));
    await db.delete(schema.turns).where(inArray(schema.turns.negotiationId, negs));
    await db.delete(schema.decisions).where(inArray(schema.decisions.negotiationId, negs));
    await db.delete(schema.agentRuns).where(inArray(schema.agentRuns.negotiationId, negs));
    await db.delete(schema.negotiations).where(inArray(schema.negotiations.id, negs));
  }
  await db.delete(schema.whatsappInbound).where(like(schema.whatsappInbound.wamid, "wamid.e2e.%"));
  await db.delete(schema.whatsappLinks).where(eq(schema.whatsappLinks.orgId, org.id));
  await db.delete(schema.whatsappEvents).where(eq(schema.whatsappEvents.orgId, org.id));
  await db.delete(schema.whatsappSessions).where(eq(schema.whatsappSessions.orgId, org.id));
  await db.delete(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.orgId, org.id));
  graph.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}
