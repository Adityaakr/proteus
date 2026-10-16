import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, vp] of [["uc-d", { width: 1440, height: 900 }], ["uc-m", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  await p.goto("http://localhost:5174/", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  const h = p.getByText("Every business sells differently", { exact: false }).first();
  await h.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120)); await p.waitForTimeout(1800);
  const sec = h.locator("xpath=ancestor::section[1]");
  await sec.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65 });
  console.log(name, "errors", JSON.stringify(errs)); await p.close();
}
await b.close();
