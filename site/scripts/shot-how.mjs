// Screenshot one section at several widths. Usage: node scripts/shot-how.mjs <selector> <outDir> [widths...]
import { chromium } from "playwright";

const sel = process.argv[2] ?? "#how-it-works";
const outDir = process.argv[3] ?? ".";
const widths = process.argv.slice(4).map(Number);
const list = widths.length ? widths : [1200, 1000, 390];

const browser = await chromium.launch();
for (const width of list) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:5174/", { waitUntil: "networkidle" });
  const el = page.locator(sel);
  await el.scrollIntoViewIfNeeded();
  // Scroll through the section so every whileInView element has fired.
  const box = await el.boundingBox();
  for (let y = box.y; y < box.y + box.height; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y - 200);
    await page.waitForTimeout(150);
  }
  await page.evaluate((yy) => window.scrollTo(0, yy), box.y - 40);
  await page.waitForTimeout(2200);
  const out = `${outDir}/how-${width}.png`;
  await el.screenshot({ path: out });
  console.log(JSON.stringify({ out, box, errors }));
  await page.close();
}
await browser.close();
