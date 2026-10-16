// Screenshots of the nav-hero owner's sections at the three breakpoints.
// Usage: node scripts/shot-navhero.mjs <outDir> [url]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/navhero";
const url = process.argv[3] ?? "http://localhost:5174/";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const width of [1200, 1000, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`${width}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${width}: ${m.text()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  // Nav + hero (top of page, full hero height)
  const hero = page.locator("#hero");
  const hb = await hero.boundingBox();
  await page.screenshot({ path: `${out}/hero_${width}.png`, clip: { x: 0, y: 0, width, height: Math.ceil(hb.y + hb.height) }, fullPage: true });
  // Prompt card later in its cycle (step 4 at ~4s, step 5 at ~5s+)
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${out}/card5_${width}.png`, clip: { x: 0, y: 0, width, height: Math.ceil(hb.y + hb.height) }, fullPage: true });
  // Logos strip: second section in <main>
  const logos = page.locator("main > section").nth(1);
  await logos.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await logos.screenshot({ path: `${out}/logos_${width}.png` });
  // Footer
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await footer.screenshot({ path: `${out}/footer_${width}.png` });
  // Phone / tablet: open the menu
  if (width < 1200) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.locator("nav button").click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/menu_${width}.png` });
  }
  await page.close();
}
console.log(JSON.stringify({ out, errors }));
await browser.close();
