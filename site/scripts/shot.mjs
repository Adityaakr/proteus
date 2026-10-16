// Full-page screenshot of the dev server for visual checks.
// Usage: node scripts/shot.mjs [url] [out] [width]
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";
const out = process.argv[3] ?? "shot.png";
const width = Number(process.argv[4] ?? 1200);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
// Scroll through so whileInView animations and lazy content settle.
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 600) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(120);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ out, height: h, errors }));
await browser.close();
