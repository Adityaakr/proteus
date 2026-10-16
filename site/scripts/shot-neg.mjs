import { chromium } from "playwright";
const out = process.argv[2]; const base = "http://localhost:5195";
const b = await chromium.launch();
for (const [name, vp] of [["d-neg", { width: 1440, height: 900 }], ["m-neg", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`${base}/app/negotiations`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  await p.locator("table tbody tr").first().click(); await p.waitForURL(/\/app\/negotiations\//); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: true });
  console.log(name, "errors", JSON.stringify(errs), "overflow", await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await p.close();
}
await b.close();
