import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:5174/#compare", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
const thead = p.locator("table thead").first(); await thead.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160)); await p.waitForTimeout(1500);
await thead.screenshot({ path: `${out}/cmp-head.jpg`, type: "jpeg", quality: 80 });
const box = await thead.boundingBox();
console.log("ok", Math.round(box.width), Math.round(box.height)); await b.close();
