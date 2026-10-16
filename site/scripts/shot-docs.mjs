import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
const shots = [
  ["svc-docs", "http://localhost:5195/docs/ledgerline/invoice-processing", null, true],
  ["docs-agents", "http://localhost:5195/docs", "agents", false],
  ["product-links", "http://localhost:5195/s/ledgerline/invoice-processing", null, false],
];
for (const [name, url, scrollTo, full] of shots) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
  if (scrollTo) { await p.evaluate((id) => { const el = document.getElementById(id); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90); }, scrollTo); await p.waitForTimeout(800); }
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 60, fullPage: full });
  console.log(name, "errors", JSON.stringify(errs)); await p.close();
}
await b.close();
