import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:5195/app/market/lumen-voice/callback-booking", { waitUntil: "networkidle" }); await p.waitForTimeout(1000);
const rail = p.getByRole("complementary", { name: "Buy" });
await rail.screenshot({ path: `${out}/rail-closed.jpg`, type: "jpeg", quality: 80 });
await p.getByRole("button", { name: /pay per call/i }).click(); await p.waitForTimeout(1200);
await rail.screenshot({ path: `${out}/rail-open.jpg`, type: "jpeg", quality: 80 });
await b.close();
