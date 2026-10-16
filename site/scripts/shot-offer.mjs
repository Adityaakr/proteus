import { chromium } from "playwright";
const [out, quoteId] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
for (const [name, vp] of [["d-offer", { width: 1440, height: 900 }], ["m-offer", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(`http://localhost:5195/app/offers/${quoteId}`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: true });
  console.log(name, "errors", JSON.stringify(errs), "overflow", await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await p.close();
}
await b.close();
