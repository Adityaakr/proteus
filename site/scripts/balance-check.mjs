import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
async function run(name, block) {
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  if (block) await p.route("https://rpc.testnet.arc.io/**", (r) => r.abort("failed"));
  await p.goto("http://localhost:5195/app/wallet", { waitUntil: "networkidle" });
  await p.waitForTimeout(6000);
  const text = await p.textContent("body");
  const m = text.match(/Could not read your balance[^.]*\.[^.]*\./) || text.match(/(\d[\d,]*\.\d+)\s*USDC/);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 60 });
  console.log(name, "=>", m ? m[0] : "no balance text", "| errors:", errs.length);
  await p.close();
}
await run("direct", false);
await run("blocked", true);
await b.close();
