import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:5195/app/market", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
const rows = await p.evaluate(() => Array.from(document.querySelectorAll("dl")).map((d) => d.innerText.replace(/\s+/g, " ")).filter((x) => x.includes("Prepaid from")));
console.log(rows.join("\n")); await b.close();
