import { chromium } from "playwright";
const [negId] = [process.argv[2]];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`http://localhost:5195/app/negotiations/${negId}`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
const box = p.locator("textarea").first(); await box.fill("1.5 usd"); await box.press("Enter"); await p.waitForTimeout(400);
console.log("composer during send:", JSON.stringify(await box.inputValue()), "| working:", await p.getByText("Working", { exact: true }).count() > 0);
await p.waitForTimeout(12000);
console.log("composer after reply:", JSON.stringify(await box.inputValue()), "| last bubble has 1.5:", (await p.getByText("1.5 usd").count()) > 0);
await b.close();
