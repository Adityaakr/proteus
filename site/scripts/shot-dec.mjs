import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, vp] of [["dec-m", { width: 390, height: 844 }], ["dec-t", { width: 810, height: 1000 }], ["dec-d", { width: 1440, height: 900 }]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto("http://localhost:5174/", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  const h = p.getByText("It knows the price", { exact: false }).first(); await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  const box = await h.boundingBox(); const lines = await h.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, clip: { x: 0, y: Math.max(0, box.y - 40), width: vp.width, height: box.height + 120 } });
  console.log(name, "lines", lines, "h", Math.round(box.height)); await p.close();
}
await b.close();
