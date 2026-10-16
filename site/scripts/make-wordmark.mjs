// Renders the "PROTEUS AI" wordmark: the existing knot mark (cropped from proteus-wordmark.png) plus the text.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const png = readFileSync("public/assets/proteus-wordmark.png").toString("base64");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 2 });
await p.setContent(`<html><body style="margin:0;background:transparent">
<div id="w" style="display:inline-flex;align-items:center;gap:36px;padding:4px 8px 4px 4px">
  <canvas id="c" height="164" style="display:block"></canvas>
  <span id="t" style="font-family:'Helvetica Neue',Inter,Arial,sans-serif;font-weight:500;font-size:117px;line-height:1;letter-spacing:-0.5px;color:#000;white-space:nowrap;padding-bottom:2px">PROTEUS AI</span>
</div>
<script>
  const img = new Image(); img.src = "data:image/png;base64,${png}";
  img.onload = () => {
    const probe = document.createElement("canvas"); probe.width = img.width; probe.height = img.height;
    const pc = probe.getContext("2d"); pc.drawImage(img, 0, 0);
    const d = pc.getImageData(0, 0, img.width, img.height).data;
    let end = 0, gap = 0;
    for (let x = 0; x < img.width; x++) { let any = false; for (let y = 0; y < img.height; y += 2) if (d[(y * img.width + x) * 4 + 3] > 10) { any = true; break; } if (any) { end = x; gap = 0; } else if (end) { gap++; if (gap > 20) break; } }
    const c = document.getElementById("c"); const scale = 164 / img.height; c.width = Math.round((end + 1) * scale);
    c.getContext("2d").drawImage(img, 0, 0, end + 1, img.height, 0, 0, c.width, 164);
    document.body.dataset.ready = "1";
  };
</script></body></html>`);
await p.waitForSelector("body[data-ready='1']");
const el = p.locator("#w");
await el.screenshot({ path: "public/assets/proteus-ai-wordmark.png", omitBackground: true });
const box = await el.boundingBox(); console.log("box", box.width, box.height, "ratio", (box.width / box.height).toFixed(3));
await b.close();
