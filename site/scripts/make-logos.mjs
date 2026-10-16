import { chromium } from "playwright";
const C = "#2b2b2b";
const logos = [
  { file: "northwind", html: `
    <svg width="44" height="44" viewBox="0 0 44 44"><path d="M8 14h22a6 6 0 1 0-6-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M8 22h28a6 6 0 1 1-6 6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M8 30h14" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/></svg>
    <span style="font:800 40px/1 Satoshi; letter-spacing:-1.5px">northwind</span>` },
  { file: "lumen", html: `
    <svg width="46" height="44" viewBox="0 0 46 44"><g stroke="${C}" stroke-width="5" stroke-linecap="round"><line x1="6" y1="18" x2="6" y2="26"/><line x1="15" y1="10" x2="15" y2="34"/><line x1="24" y1="4" x2="24" y2="40"/><line x1="33" y1="12" x2="33" y2="32"/><line x1="42" y1="18" x2="42" y2="26"/></g></svg>
    <span style="font:700 40px/1 Satoshi; letter-spacing:-1px">Lumen<span style="font-weight:500; opacity:.75"> Voice</span></span>` },
  { file: "harbor", html: `
    <svg width="42" height="44" viewBox="0 0 42 44"><path d="M21 3 38 12.5v19L21 41 4 31.5v-19z" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/><path d="M4 12.5 21 22l17-9.5M21 22v19" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/></svg>
    <span style="font:700 36px/1 Satoshi; letter-spacing:4px">HARBOR</span>` },
  { file: "kaidata", html: `
    <svg width="46" height="44" viewBox="0 0 46 44"><g fill="${C}"><rect x="4" y="26" width="8" height="14" rx="2"/><rect x="16" y="16" width="8" height="24" rx="2"/><rect x="28" y="22" width="8" height="18" rx="2"/></g><path d="M6 18 20 8l10 6 12-10" fill="none" stroke="${C}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span style="font:800 40px/1 Satoshi; letter-spacing:-1.5px">kai<span style="font-weight:500">data</span></span>` },
  { file: "meridian", html: `
    <svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="${C}" stroke-width="4.5"/><ellipse cx="22" cy="22" rx="8" ry="18" fill="none" stroke="${C}" stroke-width="4.5"/><line x1="4" y1="22" x2="40" y2="22" stroke="${C}" stroke-width="4.5"/></svg>
    <span style="font:600 40px/1 Satoshi; letter-spacing:-0.5px">Meridian</span>` },
  { file: "vantage", html: `
    <svg width="44" height="44" viewBox="0 0 44 44"><path d="M4 34 16 10l8 16 6-9 10 17z" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/></svg>
    <span style="font:700 40px/1 Satoshi; letter-spacing:-1px">vantage<span style="font-weight:500; opacity:.7">api</span></span>` },
  { file: "orbit", html: `
    <svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="8" fill="${C}"/><ellipse cx="22" cy="22" rx="19" ry="8" fill="none" stroke="${C}" stroke-width="4" transform="rotate(-30 22 22)"/></svg>
    <span style="font:800 40px/1 Satoshi; letter-spacing:-1.5px">Orbit Labs</span>` },
  { file: "tidewater", html: `
    <svg width="46" height="44" viewBox="0 0 46 44"><path d="M4 16c6 0 6-6 12-6s6 6 12 6 6-6 12-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M4 28c6 0 6-6 12-6s6 6 12 6 6-6 12-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/></svg>
    <span style="font:600 38px/1 Satoshi; letter-spacing:1.5px">TIDEWATER</span>` },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 120 }, deviceScaleFactor: 1 });
for (const l of logos) {
  await p.goto("http://localhost:5174/", { waitUntil: "domcontentloaded" }); await p.evaluate((html) => { document.open(); document.write(html); document.close(); }, `<html><head><style>
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-700.woff2) format("woff2");font-weight:700}
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-500.woff2) format("woff2");font-weight:500}
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-700.woff2) format("woff2");font-weight:800}
    body{margin:0;background:transparent} #w{display:inline-flex;align-items:center;gap:14px;padding:8px 10px;color:${C};white-space:nowrap}
  </style></head><body><div id="w">${l.html}</div></body></html>`);
  await p.evaluate(async () => { await Promise.all([document.fonts.load("500 40px Satoshi"), document.fonts.load("700 40px Satoshi"), document.fonts.load("800 40px Satoshi")]); await document.fonts.ready; });
  await p.waitForTimeout(200);
  const el = p.locator("#w");
  await el.screenshot({ path: `public/assets/logos/${l.file}.png`, omitBackground: true });
  console.log(l.file, await el.boundingBox());
}
await b.close();
