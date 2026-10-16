import { chromium } from "playwright";
const [url, outDir] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
for (const w of [1200, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(6500);
  await p.locator("#hero").screenshot({ path: `${outDir}/hero_${w}.jpg`, type: "jpeg", quality: 70 });
  await p.close();
}
await b.close();
