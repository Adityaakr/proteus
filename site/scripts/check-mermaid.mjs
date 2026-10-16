import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const blocks = JSON.parse(readFileSync(process.argv[2], "utf8"));
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(`<html><body><script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs"; window.mermaid = mermaid; mermaid.initialize({ startOnLoad: false }); window.ready = true;</script></body></html>`);
await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
for (const [i, src] of blocks.entries()) {
  const r = await p.evaluate(async (src) => { try { const ok = await window.mermaid.parse(src); const { svg } = await window.mermaid.render("d" + Math.random().toString(36).slice(2), src); return { ok: Boolean(ok), svg: svg.length }; } catch (e) { return { error: String(e.message || e).slice(0, 300) }; } }, src);
  console.log(`block ${i + 1}:`, JSON.stringify(r));
}
await b.close();
