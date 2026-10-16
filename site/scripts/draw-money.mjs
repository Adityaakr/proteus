// Renders docs/images/who-moves-money.png: an Excalidraw-style (rough.js) diagram of who can move money in DealEscrow.
import { chromium } from "playwright";
const out = process.argv[2];
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fff} svg{display:block}</style></head><body>
<svg id="s" width="1240" height="760" viewBox="0 0 1240 760" xmlns="http://www.w3.org/2000/svg"></svg>
<script type="module">
import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";
await document.fonts.load("16px Kalam"); await document.fonts.load("700 16px Kalam");
const svg = document.getElementById("s"); const rc = rough.svg(svg);
const F = "Kalam, 'Comic Sans MS', cursive";
const text = (x, y, t, o = {}) => { const e = document.createElementNS("http://www.w3.org/2000/svg", "text"); e.setAttribute("x", x); e.setAttribute("y", y); e.setAttribute("font-family", F); e.setAttribute("font-size", o.size ?? 17); e.setAttribute("fill", o.color ?? "#1e1e1e"); if (o.bold) e.setAttribute("font-weight", 700); if (o.anchor) e.setAttribute("text-anchor", o.anchor); e.textContent = t; svg.appendChild(e); return e; };
const lines = (x, y, arr, o = {}) => arr.forEach((t, i) => text(x, y + i * (o.lh ?? 22), t, o));
const box = (x, y, w, h, o = {}) => svg.appendChild(rc.rectangle(x, y, w, h, { roughness: 1.4, stroke: o.stroke ?? "#1e1e1e", strokeWidth: 1.6, fill: o.fill, fillStyle: "hachure", hachureGap: 7, hachureAngle: -41, fillWeight: 0.8, seed: o.seed ?? 3 }));
const arrow = (x1, y1, x2, y2, o = {}) => { svg.appendChild(rc.line(x1, y1, x2, y2, { roughness: 1.2, stroke: o.stroke ?? "#1e1e1e", strokeWidth: 1.6, seed: 5 })); const a = Math.atan2(y2 - y1, x2 - x1); const L = 12; svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5), { stroke: o.stroke ?? "#1e1e1e", strokeWidth: 1.6, roughness: 0.8, seed: 6 })); svg.appendChild(rc.line(x2, y2, x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5), { stroke: o.stroke ?? "#1e1e1e", strokeWidth: 1.6, roughness: 0.8, seed: 7 })); };

// Escrow
box(300, 40, 640, 330, { fill: "#e9f0ff", stroke: "#1b4dff", seed: 11 });
text(620, 72, "DealEscrow.sol   (Arc testnet)", { size: 24, bold: true, anchor: "middle", color: "#1b4dff" });
text(620, 96, "holds the prepaid USDC of every deal", { size: 15, anchor: "middle", color: "#555" });
// three doors
box(322, 118, 190, 150, { fill: "#fff", seed: 21 }); text(417, 143, "createAndFundDeal", { bold: true, anchor: "middle", size: 15 });
lines(332, 168, ["needs buyer sig +", "seller sig over the", "SAME terms", "pulls prepaid USDC", "from the buyer"], { size: 13, lh: 19 });
box(525, 118, 190, 150, { fill: "#fff", seed: 22 }); text(620, 143, "settleAcceptedUsage", { bold: true, anchor: "middle", size: 15 });
lines(535, 168, ["needs buyer Acceptance", "+ seller Delivery,", "same root & units,", "nonce rising", "pays payee the increment"], { size: 13, lh: 19 });
box(728, 118, 190, 150, { fill: "#fff", seed: 23 }); text(823, 143, "refundUnused", { bold: true, anchor: "middle", size: 15 });
lines(738, 168, ["no signature,", "only after end + grace", "or seller close,", "pays what remains", "to the buyer"], { size: 13, lh: 19 });
// small row
lines(322, 300, ["sellerCloseTerm  seller only        openDispute  buyer or seller", "resolveDispute  arbiter only, splits the remainder between buyer and payee", "pause / setArbiter  owner only: no transfer function, but it appoints the arbiter"], { size: 13, lh: 20, color: "#444" });
text(620, 362, "anyone may submit the three doors above: authority is in the signatures, not the sender", { size: 13, anchor: "middle", color: "#1b4dff" });

// actors
box(60, 470, 230, 150, { fill: "#fff6dc", seed: 31 }); text(175, 498, "Buyer wallet", { bold: true, anchor: "middle", size: 18 });
lines(76, 524, ["Privy embedded or your own", "signs Terms (EIP-712)", "signs cumulative Acceptance", "approves + sends USDC"], { size: 13, lh: 19 });
box(505, 470, 230, 150, { fill: "#e6f6ea", seed: 32 }); text(620, 498, "Seller's delegated signer", { bold: true, anchor: "middle", size: 18 });
lines(521, 524, ["per org, server-held,", "AES-256-GCM at rest", "signs Terms, Delivery, receipts", "may close the term"], { size: 13, lh: 19 });
box(950, 470, 230, 150, { fill: "#f3e8ff", seed: 33 }); text(1065, 498, "Relayer", { bold: true, anchor: "middle", size: 18 });
lines(966, 524, ["viem key, or Circle wallet", "(untested)", "submits calldata that already", "carries both signatures"], { size: 13, lh: 19 });
// arrows actors -> escrow
arrow(175, 468, 417, 372, { stroke: "#b8860b" }); text(240, 430, "signatures + USDC", { size: 13, color: "#8a6508" });
arrow(620, 468, 620, 372, { stroke: "#2e8b57" }); text(632, 425, "countersignatures", { size: 13, color: "#2e8b57" });
arrow(1065, 468, 823, 372, { stroke: "#7a3fd1" }); text(900, 430, "fund / settle / refund tx", { size: 13, color: "#7a3fd1" });

// money out
box(60, 655, 1120, 80, { fill: "#fff", stroke: "#1e1e1e", seed: 41 });
text(80, 684, "USDC leaves the contract only three ways:", { bold: true, size: 16 });
text(80, 712, "to the payee on settlement (buyer Acceptance + seller Delivery)   ·   to the buyer on refund (timer or seller close)   ·   split by the arbiter in a dispute. The owner holds nothing.", { size: 14, color: "#333" });
document.body.dataset.ready = "1";
</script></body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1240, height: 760 }, deviceScaleFactor: 2 });
await p.setContent(html); await p.waitForSelector("body[data-ready='1']", { timeout: 60000 }); await p.waitForTimeout(500);
await p.locator("#s").screenshot({ path: out, type: "png" });
await b.close(); console.log("wrote", out);
