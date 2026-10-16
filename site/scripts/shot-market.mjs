import { chromium } from "playwright";
const out = process.argv[2]; const base = "http://localhost:5195";
const b = await chromium.launch();
const errs = [];
async function page(vp) { const p = await b.newPage({ viewport: vp }); p.on("pageerror", (e) => errs.push(e.message.slice(0, 200))); p.on("console", (m) => { if (m.type() === "error" && !/40[1-4]/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); }); return p; }
async function shot(p, name, full = true) { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: full }); const ov = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); console.log("shot", name, ov ? "H-OVERFLOW" : "ok"); }

const d = await page({ width: 1440, height: 900 });
await d.goto(`${base}/app/market`, { waitUntil: "networkidle" }); await shot(d, "d-market");
await d.goto(`${base}/app/market/meridian-legal/contract-review`, { waitUntil: "networkidle" }); await shot(d, "d-product-demo");
await d.goto(`${base}/app/market/lumen-voice/callback-booking`, { waitUntil: "networkidle" }); await shot(d, "d-product-live");
// start a negotiation on a demo product via a starter
await d.goto(`${base}/app/market/harbor-logistics/shipment-exceptions`, { waitUntil: "networkidle" });
await d.locator("button").filter({ hasText: /3,000 parcels/ }).first().click();
await d.waitForURL(/\/app\/negotiations\//, { timeout: 20000 }); await d.waitForTimeout(5000); await shot(d, "d-negotiation");
await d.goto(`${base}/app/negotiations`, { waitUntil: "networkidle" }); await shot(d, "d-negotiations");
await d.goto(`${base}/app/sell/settings`, { waitUntil: "networkidle" }); await shot(d, "d-sell-settings");
await d.close();

const m = await page({ width: 390, height: 844 });
await m.goto(`${base}/app/market`, { waitUntil: "networkidle" }); await shot(m, "m-market");
await m.goto(`${base}/app/market/meridian-legal/contract-review`, { waitUntil: "networkidle" }); await shot(m, "m-product");
await m.close();
console.log("errors", JSON.stringify(errs.slice(0, 10)));
await b.close();
