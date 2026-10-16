import { chromium } from "playwright";
const out = process.argv[2]; const base = "http://localhost:5195";
const b = await chromium.launch(); const errs = [];
for (const [name, vp, url] of [["d-market", { width: 1440, height: 900 }, "/app/market"], ["d-product", { width: 1440, height: 900 }, "/app/market/lumen-voice/callback-booking"], ["m-product", { width: 390, height: 844 }, "/app/market/lumen-voice/callback-booking"]]) {
  const p = await b.newPage({ viewport: vp }); p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(base + url, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: true });
  console.log(name, await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) ? "H-OVERFLOW" : "ok"); await p.close();
}
console.log("errors", JSON.stringify(errs)); await b.close();
