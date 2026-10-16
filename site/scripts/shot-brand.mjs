import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
const shots = [
  ["brand-nav", "http://localhost:5174/", { x: 0, y: 0, width: 1440, height: 160 }],
  ["brand-compare", "http://localhost:5174/#compare", null],
  ["brand-app", "http://localhost:5195/app/market", { x: 0, y: 0, width: 1440, height: 300 }],
  ["brand-footer", "http://localhost:5174/#footer", null],
];
for (const [name, url, clip] of shots) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  if (name === "brand-compare") { const h = p.getByText("How Proteus AI compares", { exact: false }).first(); if (await h.count()) await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); }
  if (name === "brand-footer") { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(1200); }
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, ...(clip ? { clip } : {}) });
  console.log(name, "errors", JSON.stringify(errs)); await p.close();
}
await b.close();
