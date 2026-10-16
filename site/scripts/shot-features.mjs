// Screenshot #features at a given viewport width. Usage: node scripts/shot-features.mjs <width> <out> [cardCycleOut]
import { chromium } from "playwright";
const width = Number(process.argv[2] ?? 1200);
const out = process.argv[3] ?? "features.png";
const cycleOut = process.argv[4];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://localhost:5174/", { waitUntil: "networkidle" });
const docTop = async (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, sel);
const top = await docTop("#features");
const h = await p.evaluate(() => document.querySelector("#features").offsetHeight);
// scroll through the section so in-view effects fire, then park the section top at the viewport top
for (let y = top; y < top + h; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(150); }
await p.evaluate((yy) => window.scrollTo(0, yy), top);
await p.waitForTimeout(1500);
await p.locator("#features").screenshot({ path: out });
if (cycleOut) {
  const t4 = await docTop("#HKd1Ndk3M");
  await p.evaluate((yy) => window.scrollTo(0, yy - 150), t4);
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(i === 0 ? 1200 : 2500); await p.locator("#HKd1Ndk3M").screenshot({ path: cycleOut.replace(".png", `_${i}.png`) }); }
}
console.log(JSON.stringify({ out, top, h, errors }));
await b.close();
