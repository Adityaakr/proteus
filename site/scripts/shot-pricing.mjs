// Screenshot #pricing and #security at several widths. Usage: node scripts/shot-pricing.mjs <outdir> [toggle]
import { chromium } from "playwright";
const out = process.argv[2];
const toggle = process.argv[3] === "toggle";
const browser = await chromium.launch();
for (const width of [1200, 1000, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:5174/", { waitUntil: "networkidle" });
  for (const id of ["pricing", "security"]) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    // scroll through the section so in-view effects fire
    const box = await el.boundingBox();
    const top = await page.evaluate(() => window.scrollY) + (box?.y ?? 0);
    for (let y = top - 400; y < top + (box?.height ?? 0); y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(150);
    }
    if (toggle && id === "pricing") {
      await page.getByRole("radio", { name: "Testnet" }).click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(2000);
    await el.screenshot({ path: `${out}/${id}-${width}${toggle ? "-testnet" : ""}.png` });
  }
  console.log(width, JSON.stringify(errors));
  await page.close();
}
await browser.close();
