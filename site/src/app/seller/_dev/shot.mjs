// usage: node shot.mjs <query> <out> <width> [actions-json]
import { chromium } from "playwright";
const [q, out, w, actions] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${process.env.PORT || 5193}/src/app/seller/_dev/index.html?${q}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(1500);
for (const a of JSON.parse(actions || "[]")) {
  if (a.click) await page.getByRole(a.role || "button", { name: a.click, exact: !!a.exact }).first().click();
  if (a.fill) await page.getByLabel(a.fill, { exact: false }).first().fill(a.value);
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.scroll) await page.evaluate((y) => window.scrollTo(0, y), a.scroll);
}
await page.waitForTimeout(800);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ out, scrollWidth: sw, errors }));
await browser.close();
