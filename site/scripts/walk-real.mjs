// Drives the real app (dev key mode on :5195, live API on :8787, Arc testnet) through the buyer flow and
// screenshots every step. Real transactions are sent from VITE_DEV_BUYER_KEY. usage: node scripts/walk-real.mjs <outDir>
import { chromium } from "playwright";
const outDir = process.argv[2];
const base = "http://localhost:5195";
const product = process.env.PRODUCT ?? "northwind-support/order-support";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !/401|403|402/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
let n = 0;
const shot = async (name) => { await p.waitForTimeout(800); await p.screenshot({ path: `${outDir}/${String(++n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 70, fullPage: true }); console.log("shot", name, p.url()); };
const click = async (re, timeout = 15000) => { const el = p.getByRole("button", { name: re }).first(); await el.waitFor({ timeout }); await el.click(); };

await p.goto(`${base}/app`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await shot("home");
await p.goto(`${base}/app/wallet`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await shot("wallet");
await p.goto(`${base}/app/market`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500); await shot("market");
await p.goto(`${base}/app/market/${product}`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await shot("product");
await click(/negotiate a (prepaid )?deal/i);
await p.waitForURL(/\/app\/negotiations\//, { timeout: 20000 }); await p.waitForLoadState("networkidle"); await shot("negotiate-empty");
const box = p.getByRole("textbox").first();
await box.fill(process.env.ASK ?? "We run three online stores and use Zendesk. Let us start with a trial of about 12 resolutions for $15 before we commit.");
const send = p.getByRole("button", { name: /send/i }).first();
if (await send.isVisible().catch(() => false)) await send.click(); else await box.press("Enter");
await p.waitForTimeout(4000); await shot("negotiate-offers");
// Accept the Trial offer specifically (small enough for the testnet buyer balance).
const trialCard = p.locator("article, section, div").filter({ hasText: /^Trial/ }).filter({ has: p.getByRole("button", { name: /accept this offer/i }) }).last();
const accept = (await trialCard.count()) ? trialCard.getByRole("button", { name: /accept this offer/i }).first() : p.getByRole("button", { name: /accept this offer/i }).first();
await accept.waitFor({ timeout: 15000 }); await accept.click();
await p.waitForURL(/\/app\/offers\//, { timeout: 20000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(2000); await shot("offer");
// Fund from balance: real sign + approve + createAndFundDeal
const fund = p.getByRole("button", { name: /fund deal from balance|fund deal|approve/i }).first();
await fund.waitFor({ timeout: 15000 }); await fund.click();
await shot("funding-started");
const dealPage = await p.waitForURL(/\/app\/deals\//, { timeout: 240000 }).then(() => "nav").catch(() => "timeout");
await p.waitForTimeout(3000); await shot("after-fund");
if (dealPage === "timeout" && !/\/app\/deals\//.test(p.url())) {
  const open = p.getByRole("link", { name: /open deal|view deal|go to deal/i }).first();
  if (await open.isVisible().catch(() => false)) { await open.click(); await p.waitForLoadState("networkidle"); }
}
await p.waitForTimeout(12000); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(3000); await shot("deal");
console.log(JSON.stringify({ url: p.url(), errors }, null, 1));
await b.close();
