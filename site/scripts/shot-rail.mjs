import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:5195/app/market/lumen-voice/callback-booking", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
await p.getByRole("complementary", { name: "Buy" }).screenshot({ path: `${out}/rail.jpg`, type: "jpeg", quality: 80 });
await b.close();
