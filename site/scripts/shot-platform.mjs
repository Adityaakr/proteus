// Walks the platform against the REAL API (dev server :5174 proxying :8787) and screenshots each surface.
// usage: node scripts/shot-platform.mjs <outDir> [width]
import { chromium } from "playwright";
const [outDir, widthArg] = [process.argv[2], Number(process.argv[3] || 1200)];
const base = "http://localhost:5174";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: widthArg, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${outDir}/${name}_${widthArg}.jpg`, type: "jpeg", quality: 70, fullPage: true }); };

await p.goto(`${base}/s/northwind-support/order-support`, { waitUntil: "networkidle" });
await shot("01-storefront");
await p.getByRole("button", { name: /negotiate a deal/i }).first().click();
await p.waitForURL(/\/negotiate\//, { timeout: 20000 });
await p.waitForLoadState("networkidle");
await shot("02-negotiate-empty");
const composer = p.getByRole("textbox").first();
await composer.fill("We operate three online stores, handle roughly 8,000 support requests per month and use Zendesk. We want to automate order tracking and delivery questions, with a human handling refunds. Our budget is $1,500/month. What can you offer?");
await composer.press("Enter").catch(() => {});
const sendBtn = p.getByRole("button", { name: /send/i }).first();
if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click().catch(() => {});
await p.waitForTimeout(3500);
await shot("03-negotiate-offers");
const negUrl = p.url();
// Accept the 1,500 offer -> offer page
const acceptBtns = p.getByRole("button", { name: /accept this offer/i });
if (await acceptBtns.count()) { await acceptBtns.first().click(); await p.waitForURL(/\/offer\//, { timeout: 20000 }); await p.waitForLoadState("networkidle"); await shot("04-offer"); }
// Seller console
await p.goto(`${base}/app`, { waitUntil: "networkidle" });
const tryBtn = p.getByRole("button", { name: /try the sandbox seller/i });
if (await tryBtn.isVisible().catch(() => false)) { await tryBtn.click(); await p.waitForTimeout(1500); }
await shot("05-seller-overview");
await p.goto(`${base}/app/negotiations`, { waitUntil: "networkidle" }); await shot("06-seller-negotiations");
const negId = negUrl.split("/negotiate/")[1];
if (negId) { await p.goto(`${base}/app/negotiations/${negId}`, { waitUntil: "networkidle" }); await shot("07-seller-negotiation-detail"); }
await p.goto(`${base}/app/products`, { waitUntil: "networkidle" });
const firstProduct = p.locator("a[href^='/app/products/']").first();
if (await firstProduct.count()) { await firstProduct.click(); await p.waitForLoadState("networkidle"); }
await shot("08-seller-product");
await p.goto(`${base}/app/approvals`, { waitUntil: "networkidle" }); await shot("09-seller-approvals");
await p.goto(`${base}/app/deals`, { waitUntil: "networkidle" }); await shot("10-seller-deals");
await p.goto(`${base}/app/finance`, { waitUntil: "networkidle" }); await shot("11-seller-finance");
await p.goto(`${base}/review`, { waitUntil: "networkidle" }); await shot("12-review");
console.log(JSON.stringify({ negUrl, errors }, null, 1));
await b.close();
