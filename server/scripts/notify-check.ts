/**
 * Notifications check (local only): a webhook receiver verifies the HMAC signature of a real test send, the SSRF guard
 * refuses internal targets, and an on-chain-style event is queued once and delivered once.
 *
 *   NOTIFY_ALLOW_PRIVATE=1 tsx scripts/notify-check.ts
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { drainOutbox, enqueue, saveSettings, sendTest } from "../src/services/notify";

const got: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
const srv = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => (got.push({ headers: req.headers, body }), res.writeHead(204).end()));
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const port = (srv.address() as { port: number }).port;

const [org] = await db.select().from(schema.orgs).limit(1);
if (!org) throw new Error("no org in the local DB");
const fail = (m: string) => { console.error("FAIL", m); process.exit(1); };

for (const bad of ["http://example.com/x", "https://169.254.169.254/latest", "https://10.0.0.5/h", "https://user:pw@example.com/h", "https://[::1]/h"]) {
  const r = await saveSettings(org.id, { webhookUrl: bad }).then(() => "accepted", (e) => (e as Error).message);
  if (r === "accepted") fail(`SSRF guard accepted ${bad}`);
  console.log("refused", bad, "-", r);
}

const saved = await saveSettings(org.id, { webhookUrl: `http://127.0.0.1:${port}/hook` });
if (!saved.webhookSecret?.startsWith("whsec_")) fail("no signing secret returned on create");
const again = await saveSettings(org.id, { webhookUrl: `http://127.0.0.1:${port}/hook` });
if (again.webhookSecret !== null) fail("secret was shown a second time");

const t = await sendTest(org.id);
if (!t.ok) fail(`test send: ${t.errors.join("; ")}`);
const verify = (h: { headers: Record<string, unknown>; body: string }) => {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(String(h.headers["x-proteus-signature"]));
  if (!m) return false;
  const want = createHmac("sha256", saved.webhookSecret!).update(`${m[1]}.${h.body}`).digest();
  return timingSafeEqual(want, Buffer.from(m[2]!, "hex"));
};
if (!got[0] || !verify(got[0])) fail("signature did not verify");
console.log("test webhook signed and verified:", JSON.parse(got[0]!.body).event);

const key = `0xcheck${Date.now()}:0`;
await enqueue(org.id, "deal_funded", key, { deal: "D-CHECK", amountUsdc: "0.200000" });
await enqueue(org.id, "deal_funded", key, { deal: "D-CHECK", amountUsdc: "0.200000" }); // same log seen again
await drainOutbox();
await drainOutbox();
const funded = got.filter((g) => JSON.parse(g.body).event === "deal_funded");
if (funded.length !== 1 || !verify(funded[0]!)) fail(`expected exactly 1 signed deal_funded, got ${funded.length}`);
console.log("deal_funded delivered once:", JSON.parse(funded[0]!.body).data);

await saveSettings(org.id, { webhookUrl: null });
await db.delete(schema.notifications).where(eq(schema.notifications.orgId, org.id));
srv.close();
console.log("NOTIFY CHECK PASSED");
process.exit(0);
