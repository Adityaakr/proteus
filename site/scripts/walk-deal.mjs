// Continues the real flow on an already funded deal: test request, sign usage (settles on chain), pay per call
// from the product page (x402 via Circle facilitator), seller closes the term (sandbox cookie), refund.
// usage: node scripts/walk-deal.mjs <outDir> <dealId>
import { chromium } from "playwright";
const [outDir, dealId] = [process.argv[2], process.argv[3]];
const base = "http://localhost:5195";
const api = "http://localhost:8787";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !/40[1-4]|402/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
let n = 0;
const shot = async (name) => { await p.waitForTimeout(800); await p.screenshot({ path: `${outDir}/${String(++n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 70, fullPage: true }); console.log("shot", name); };

await p.goto(`${base}/app/deals/${dealId}`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await shot("deal");
const issue = p.getByRole("button", { name: /issue a new key/i }).first();
if (await issue.isVisible().catch(() => false)) { await issue.click(); await p.waitForTimeout(3000); await shot("key-issued"); }
// Test request: fill question + order id, submit
const q = p.getByLabel(/question/i).first();
if (await q.isVisible().catch(() => false)) { await q.fill("Where is my order?"); }
const oid = p.getByLabel(/order id/i).first();
if (await oid.isVisible().catch(() => false)) { await oid.fill("A1001"); }
const sendBtn = p.getByRole("button", { name: /send test request|send request|send/i }).first();
await sendBtn.click();
await p.waitForTimeout(3000); await shot("after-request");
// Second request: handoff (not billable)
if (await q.isVisible().catch(() => false)) { await q.fill("I want a refund for this order"); await oid.fill("A1002"); await sendBtn.click(); await p.waitForTimeout(3000); await shot("after-handoff"); }
// Sign usage
const sign = p.getByRole("button", { name: /sign usage/i }).first();
await sign.waitFor({ timeout: 15000 }); await sign.click();
await p.waitForTimeout(6000); await shot("usage-signed");
// Wait for settlement reconciliation
for (let i = 0; i < 12; i++) { await p.waitForTimeout(5000); const t = await p.textContent("body"); if (/settled/i.test(t) && /0x[0-9a-f]{6}/i.test(t)) break; }
await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(3000); await shot("deal-settled");

// Pay per call from the product page (x402)
await p.goto(`${base}/app/market/northwind-support/order-support`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
const payBtn = p.getByRole("button", { name: /pay and run/i }).first();
if (await payBtn.isVisible().catch(() => false)) {
  const qq = p.getByLabel(/question/i).last(); if (await qq.isVisible().catch(() => false)) await qq.fill("Where is my order?");
  const oo = p.getByLabel(/order id/i).last(); if (await oo.isVisible().catch(() => false)) await oo.fill("A1003");
  await payBtn.click();
  await p.waitForTimeout(15000); await shot("pay-per-call");
}

// Seller closes the term (sandbox cookie session), then refund from the deal page
const jar = await fetch(`${api}/api/app/session/sandbox`, { method: "POST" });
const cookie = (jar.headers.get("set-cookie") ?? "").split(";")[0];
const close = await fetch(`${api}/api/app/deals/${dealId}/close-term`, { method: "POST", headers: { cookie } });
console.log("close-term", close.status, (await close.text()).slice(0, 160));
await p.waitForTimeout(8000);
await p.goto(`${base}/app/deals/${dealId}`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
const refund = p.getByRole("button", { name: /request a refund|refund/i }).first();
if (await refund.isVisible().catch(() => false)) { await refund.click(); await p.waitForTimeout(12000); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(3000); await shot("refunded"); }
console.log(JSON.stringify({ url: p.url(), errors }, null, 1));
await b.close();
