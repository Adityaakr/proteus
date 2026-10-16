// Square brand marks (icon only) for cards and avatars, from the same icons as make-logos.mjs.
import { chromium } from "playwright";
const C = "#1f1f24";
const marks = {
  northwind: `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M8 14h22a6 6 0 1 0-6-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M8 22h28a6 6 0 1 1-6 6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M8 30h14" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/></svg>`,
  lumen: `<svg width="46" height="44" viewBox="0 0 46 44"><g stroke="${C}" stroke-width="5" stroke-linecap="round"><line x1="6" y1="18" x2="6" y2="26"/><line x1="15" y1="10" x2="15" y2="34"/><line x1="24" y1="4" x2="24" y2="40"/><line x1="33" y1="12" x2="33" y2="32"/><line x1="42" y1="18" x2="42" y2="26"/></g></svg>`,
  harbor: `<svg width="42" height="44" viewBox="0 0 42 44"><path d="M21 3 38 12.5v19L21 41 4 31.5v-19z" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/><path d="M4 12.5 21 22l17-9.5M21 22v19" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/></svg>`,
  kaidata: `<svg width="46" height="44" viewBox="0 0 46 44"><g fill="${C}"><rect x="4" y="26" width="8" height="14" rx="2"/><rect x="16" y="16" width="8" height="24" rx="2"/><rect x="28" y="22" width="8" height="18" rx="2"/></g><path d="M6 18 20 8l10 6 12-10" fill="none" stroke="${C}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  meridian: `<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="${C}" stroke-width="4.5"/><ellipse cx="22" cy="22" rx="8" ry="18" fill="none" stroke="${C}" stroke-width="4.5"/><line x1="4" y1="22" x2="40" y2="22" stroke="${C}" stroke-width="4.5"/></svg>`,
  vantage: `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M4 34 16 10l8 16 6-9 10 17z" fill="none" stroke="${C}" stroke-width="4.5" stroke-linejoin="round"/></svg>`,
  orbit: `<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="8" fill="${C}"/><ellipse cx="22" cy="22" rx="19" ry="8" fill="none" stroke="${C}" stroke-width="4" transform="rotate(-30 22 22)"/></svg>`,
  tidewater: `<svg width="46" height="44" viewBox="0 0 46 44"><path d="M4 16c6 0 6-6 12-6s6 6 12 6 6-6 12-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/><path d="M4 28c6 0 6-6 12-6s6 6 12 6 6-6 12-6" fill="none" stroke="${C}" stroke-width="4.5" stroke-linecap="round"/></svg>`,
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 2 });
for (const [name, svg] of Object.entries(marks)) {
  await p.setContent(`<html><body style="margin:0;background:transparent"><div id="w" style="width:96px;height:96px;display:grid;place-items:center;background:#fff;border-radius:22px;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.08)"><div style="width:48px;height:48px;display:grid;place-items:center">${svg.replace(/width="\d+" height="\d+"/, 'width="46" height="44"')}</div></div></body></html>`);
  await p.locator("#w").screenshot({ path: `public/assets/logos/mark-${name}.png`, omitBackground: true });
  console.log("mark", name);
}
await b.close();
