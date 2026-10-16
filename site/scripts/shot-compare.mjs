import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, vp] of [["compare-desktop", { width: 1440, height: 900 }], ["compare-tablet", { width: 1000, height: 900 }]]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto("http://localhost:5174/", { waitUntil: "networkidle" });
  const head = p.locator("#compare thead"); await head.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  await head.screenshot({ path: `${out}/${name}-head.jpg`, type: "jpeg", quality: 80 });
  const order = await p.evaluate(() => Array.from(document.querySelectorAll("main > section")).map((s) => s.id || s.className.split(" ")[0]).slice(0, 8));
  console.log(name, "errors", JSON.stringify(errs), "order", JSON.stringify(order));
  await p.close();
}
await b.close();
