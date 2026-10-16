import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, vp] of [["compare-desktop", { width: 1440, height: 900 }], ["compare-phone", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto("http://localhost:5174/#compare", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  const el = p.locator("#compare"); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1800);
  await el.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70 });
  console.log(name, "errors", JSON.stringify(errs), "overflow", await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await p.close();
}
await b.close();
