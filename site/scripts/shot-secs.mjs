import { chromium } from "playwright";
const [url, outDir] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
const h = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < h; y += 300) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(40); }
for (const sel of ["#security", "footer"]) {
  await p.locator(sel).scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
  await p.locator(sel).screenshot({ path: `${outDir}/sec_${sel.replace('#','')}.jpg`, type: "jpeg", quality: 70 });
}
await p.evaluate(() => document.querySelector('#features').scrollIntoView()); await p.evaluate(() => window.scrollBy(0, 1400)); await p.waitForTimeout(1200);
await p.screenshot({ path: `${outDir}/sec_features.jpg`, type: "jpeg", quality: 70 });
await b.close();
