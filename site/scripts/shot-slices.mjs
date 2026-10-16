import { chromium } from "playwright";
const [url, outDir, width, slice] = [process.argv[2], process.argv[3], Number(process.argv[4] || 1200), Number(process.argv[5] || 1900)];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
const h = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, i = 0; y < h; y += 300, i++) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(60); }
await p.waitForTimeout(1500);
for (let y = 0, i = 0; y < h; y += slice, i++) {
  await p.screenshot({ path: `${outDir}/s${width}_${i}.jpg`, type: "jpeg", quality: 70, fullPage: true, clip: { x: 0, y, width, height: Math.min(slice, h - y) } });
}
console.log(JSON.stringify({ h, slices: Math.ceil(h / slice) }));
await b.close();
