import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
await p.goto("http://localhost:5174/app/login", { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/login.jpg`, type: "jpeg", quality: 65, clip: { x: 420, y: 150, width: 600, height: 420 } });
const btn = p.getByRole("button", { name: /^Sign in$/ });
if (await btn.count()) { await btn.first().click({ force: true, timeout: 5000 }).catch(() => {}); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/login-modal.jpg`, type: "jpeg", quality: 65 }); }
console.log("errors", JSON.stringify(errs)); await b.close();
