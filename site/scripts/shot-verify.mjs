// Section screenshots for the verify owner: node scripts/shot-verify.mjs <width> <outdir> [ids...]
// Scrolls with the mouse wheel (Lenis smooth scroll) like a user, parks on the section long enough
// for in-view effects (Tag, GrowthGraph fade, Capability card cycle) to settle, then captures it.
import { chromium } from "playwright";
const width = Number(process.argv[2] ?? 1200);
const out = process.argv[3] ?? ".";
const ids = process.argv.slice(4).length ? process.argv.slice(4) : ["capabilities", "partners", "comparison"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto("http://localhost:5174/", { waitUntil: "networkidle" });
await p.mouse.move(width / 2, 450);
const scrollY = () => p.evaluate(() => window.scrollY);
const wheelTo = async (target) => {
  for (let i = 0; i < 400; i++) {
    const y = await scrollY();
    const d = target - y;
    if (Math.abs(d) < 8) break;
    await p.mouse.wheel(0, Math.max(-500, Math.min(500, d)));
    await p.waitForTimeout(60);
  }
  await p.waitForTimeout(500);
};
for (const id of ids) {
  const top = await p.evaluate((i) => document.getElementById(i).getBoundingClientRect().top + window.scrollY, id);
  const h = await p.evaluate((i) => document.getElementById(i).getBoundingClientRect().height, id);
  // walk through the section so every in-view trigger fires, then park at the bottom so the
  // bottom-anchored content (graph) stays visible, then back to the top for the capture
  for (let y = top; y < top + h; y += 450) await wheelTo(y);
  await wheelTo(Math.max(0, top + h - 900));
  await p.waitForTimeout(4500);
  await wheelTo(top);
  await p.waitForTimeout(600);
  await p.locator("#" + id).screenshot({ path: `${out}/${id}-${width}.png` });
  console.log(id, width, "top", Math.round(top), "height", Math.round(h));
}
console.log(JSON.stringify({ errors }));
await b.close();
