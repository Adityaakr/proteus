// Five more invented marks for the operations-agent example sellers. Same pipeline as make-logos.mjs / make-marks.mjs.
import { chromium } from "playwright";
const C = "#2b2b2b";
const icons = {
  cairn: `<svg width="44" height="44" viewBox="0 0 44 44"><g fill="${C}"><rect x="12" y="6" width="20" height="8" rx="4"/><rect x="8" y="18" width="28" height="8" rx="4"/><rect x="4" y="30" width="36" height="8" rx="4"/></g></svg>`,
  ledgerline: `<svg width="44" height="44" viewBox="0 0 44 44"><g stroke="${C}" stroke-width="4.5" stroke-linecap="round" fill="none"><line x1="6" y1="12" x2="30" y2="12"/><line x1="6" y1="22" x2="24" y2="22"/><line x1="6" y1="32" x2="18" y2="32"/><path d="M26 30l5 5 9-11"/></g></svg>`,
  tessera: `<svg width="44" height="44" viewBox="0 0 44 44"><g fill="${C}"><rect x="5" y="5" width="15" height="15" rx="3"/><rect x="24" y="5" width="15" height="15" rx="3" opacity=".55"/><rect x="5" y="24" width="15" height="15" rx="3" opacity=".55"/><rect x="24" y="24" width="15" height="15" rx="3"/></g></svg>`,
  pilotlight: `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M22 4c3 8 12 12 12 22a12 12 0 0 1-24 0c0-5 3-8 5-11 1 4 3 6 5 6 2-4 1-11 2-17z" fill="${C}"/></svg>`,
  lantern: `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M22 3 39 12.5v19L22 41 5 31.5v-19z" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="22" cy="22" r="5" fill="${C}"/></svg>`,
};
const words = {
  cairn: `<span style="font:700 40px/1 Satoshi; letter-spacing:-1px">Cairn<span style="font-weight:500; opacity:.7"> Treasury</span></span>`,
  ledgerline: `<span style="font:800 40px/1 Satoshi; letter-spacing:-1.5px">ledger<span style="font-weight:500">line</span></span>`,
  tessera: `<span style="font:600 38px/1 Satoshi; letter-spacing:2px">TESSERA</span>`,
  pilotlight: `<span style="font:700 40px/1 Satoshi; letter-spacing:-1px">Pilotlight</span>`,
  lantern: `<span style="font:600 40px/1 Satoshi; letter-spacing:-0.5px">Lantern</span>`,
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 120 }, deviceScaleFactor: 1 });
for (const name of Object.keys(icons)) {
  await p.goto("http://localhost:5174/", { waitUntil: "domcontentloaded" });
  await p.evaluate((html) => { document.open(); document.write(html); document.close(); }, `<html><head><style>
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-700.woff2) format("woff2");font-weight:700}
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-500.woff2) format("woff2");font-weight:500}
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-700.woff2) format("woff2");font-weight:800}
    @font-face{font-family:Satoshi;src:url(/fonts/Satoshi-500.woff2) format("woff2");font-weight:600}
    body{margin:0;background:transparent} #w{display:inline-flex;align-items:center;gap:14px;padding:8px 10px;color:${C};white-space:nowrap}
  </style></head><body><div id="w">${icons[name]}${words[name]}</div></body></html>`);
  await p.evaluate(async () => { await Promise.all([document.fonts.load("500 40px Satoshi"), document.fonts.load("700 40px Satoshi"), document.fonts.load("800 40px Satoshi")]); await document.fonts.ready; });
  await p.waitForTimeout(200);
  await p.locator("#w").screenshot({ path: `public/assets/logos/${name}.png`, omitBackground: true });
}
const m = await b.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 2 });
for (const [name, svg] of Object.entries(icons)) {
  await m.setContent(`<html><body style="margin:0;background:transparent"><div id="w" style="width:96px;height:96px;display:grid;place-items:center;background:#fff;border-radius:22px;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.08)"><div style="width:48px;height:48px;display:grid;place-items:center">${svg.replace(/width="\d+" height="\d+"/, 'width="46" height="44"')}</div></div></body></html>`);
  await m.locator("#w").screenshot({ path: `public/assets/logos/mark-${name}.png`, omitBackground: true });
  console.log("made", name);
}
await b.close();
