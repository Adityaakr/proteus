import { chromium } from "playwright";
const out = process.argv[2]; const base = "http://localhost:5195";
const b = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${base}/app`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}-home.jpg`, type: "jpeg", quality: 70 });
  await p.getByRole("button", { name: /^deposit$/i }).first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${name}-deposit.jpg`, type: "jpeg", quality: 70 });
  const dlg = p.getByRole("dialog"); const ok = await dlg.isVisible();
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  const gone = !(await dlg.isVisible().catch(() => false));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(name, "dialog", ok, "esc closes", gone, "h-overflow", overflow, "errors", errs);
  await p.close();
}
await b.close();
