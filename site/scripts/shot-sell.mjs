import { chromium } from "playwright";
const out = process.argv[2]; const base = "http://localhost:5195";
const b = await chromium.launch(); const errs = [];
const pages = [["sell-overview", "/app/sell"], ["sell-customers", "/app/sell/customers"], ["sell-usage", "/app/sell/usage"], ["sell-insights", "/app/sell/insights"], ["sell-policies", "/app/sell/policies"]];
for (const [name, url] of pages) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on("pageerror", (e) => errs.push(name + ": " + e.message.slice(0, 160)));
  await p.goto(base + url, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: true });
  console.log(name, await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) ? "H-OVERFLOW" : "ok"); await p.close();
}
const m = await b.newPage({ viewport: { width: 390, height: 844 } }); m.on("pageerror", (e) => errs.push("m: " + e.message.slice(0, 160)));
await m.goto(base + "/app/sell", { waitUntil: "networkidle" }); await m.waitForTimeout(1200);
await m.screenshot({ path: `${out}/m-sell-overview.jpg`, type: "jpeg", quality: 65, fullPage: true });
console.log("m-sell-overview", await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) ? "H-OVERFLOW" : "ok");
console.log("errors", JSON.stringify(errs)); await b.close();
