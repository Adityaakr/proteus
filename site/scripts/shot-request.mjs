import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
const shots = [
  ["ledgerline", "http://localhost:5195/s/ledgerline/invoice-processing", async (p) => {
    // attach a small file to the pay-per-call form
    const input = p.locator('input[type="file"]').first();
    if (await input.count()) await input.setInputFiles({ name: "acme-0412.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 test invoice") });
    await p.waitForTimeout(400);
  }],
  ["orbit-gpu", "http://localhost:5195/s/orbit-labs/gpu-hours", async () => {}],
  ["sell-request", "http://localhost:5195/app/sell/start", async (p) => {
    const fill = p.getByRole("button", { name: /Fill with the order support example/ });
    if (await fill.count()) await fill.click();
    await p.waitForTimeout(400);
    const h = p.getByText("What buyers send", { exact: true }).first();
    if (await h.count()) await h.scrollIntoViewIfNeeded();
  }],
];
for (const [name, url, prep] of shots) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
  await prep(p); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 65, fullPage: true });
  console.log(name, "errors", JSON.stringify(errs), "overflow", await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await p.close();
}
await b.close();
