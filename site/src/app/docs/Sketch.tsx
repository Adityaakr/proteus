/**
 * Hand-drawn diagrams in the Excalidraw style, drawn from data: every stroke is drawn twice with a little seeded
 * wobble, so shapes look sketched but never move between renders. No dependency; the diagrams live next to the docs
 * content, so they cannot drift from it. Each diagram also has a plain-text description for /docs.md.
 */
import { useMemo } from "react";
import s from "./productDocs.module.css";

type Tone = "blue" | "green" | "amber" | "rose" | "gray" | "ink";
interface SketchNode { id: string; x: number; y: number; w: number; h: number; title: string; sub?: string; tone?: Tone }
interface SketchEdge { from: string; to: string; label?: string; dashed?: boolean; bend?: number; labelAt?: number }
export interface SketchSpec { w: number; h: number; nodes: SketchNode[]; edges: SketchEdge[]; alt: string }

const TONE: Record<Tone, { fill: string; stroke: string }> = {
  blue: { fill: "#e8efff", stroke: "#1b4dff" },
  green: { fill: "#e6f6ee", stroke: "#067647" },
  amber: { fill: "#fdf2dc", stroke: "#b54708" },
  rose: { fill: "#fdebec", stroke: "#b42318" },
  gray: { fill: "#f2f3f5", stroke: "#475467" },
  ink: { fill: "#ffffff", stroke: "#1d2939" },
};

/** Small deterministic PRNG (mulberry32) so a diagram draws the same way every time. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** One wobbly stroke from a to b: a quadratic curve with a slightly displaced middle and jittered ends. */
function sketchLine(r: () => number, ax: number, ay: number, bx: number, by: number, wobble = 1.4) {
  const j = () => (r() - 0.5) * 2 * wobble;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const bow = (r() - 0.5) * Math.min(6, len / 40);
  const mx = (ax + bx) / 2 + nx * bow + j() * 0.5;
  const my = (ay + by) / 2 + ny * bow + j() * 0.5;
  return `M${(ax + j()).toFixed(1)} ${(ay + j()).toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${(bx + j()).toFixed(1)} ${(by + j()).toFixed(1)}`;
}

function boxPaths(r: () => number, n: SketchNode) {
  const { x, y, w, h } = n;
  const out: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    out.push(sketchLine(r, x, y, x + w, y), sketchLine(r, x + w, y, x + w, y + h), sketchLine(r, x + w, y + h, x, y + h), sketchLine(r, x, y + h, x, y));
  }
  return out;
}

/** Where the line from a box's centre towards a point leaves the box. */
function exitPoint(n: SketchNode, tx: number, ty: number, pad = 6) {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const sx = dx === 0 ? Infinity : (n.w / 2 + pad) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (n.h / 2 + pad) / Math.abs(dy);
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k };
}

export function Sketch({ spec, seed = 7 }: { spec: SketchSpec; seed?: number }) {
  const drawn = useMemo(() => {
    const r = rng(seed);
    const byId = new Map(spec.nodes.map((n) => [n.id, n]));
    const nodes = spec.nodes.map((n) => ({ n, paths: boxPaths(r, n), tone: TONE[n.tone ?? "ink"] }));
    const edges = spec.edges.map((e) => {
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      const p = exitPoint(a, b.x + b.w / 2, b.y + b.h / 2);
      const q = exitPoint(b, a.x + a.w / 2, a.y + a.h / 2, 8);
      const mx = (p.x + q.x) / 2 + (e.bend ?? 0) * -(q.y - p.y) / (Math.hypot(q.x - p.x, q.y - p.y) || 1);
      const my = (p.y + q.y) / 2 + (e.bend ?? 0) * (q.x - p.x) / (Math.hypot(q.x - p.x, q.y - p.y) || 1);
      const shaft = [0, 1].map(() => `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${(mx + (r() - 0.5) * 2).toFixed(1)} ${(my + (r() - 0.5) * 2).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
      // Arrowhead: two short strokes back from the tip, along the curve's end tangent.
      const ang = Math.atan2(q.y - my, q.x - mx);
      const head = [0.45, -0.45].map((d) => sketchLine(r, q.x, q.y, q.x - 11 * Math.cos(ang + d), q.y - 11 * Math.sin(ang + d), 0.6));
      const t = e.labelAt ?? 0.5;
      const lx = (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x;
      const ly = (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y;
      return { e, shaft, head, lx, ly };
    });
    return { nodes, edges };
  }, [spec, seed]);

  return (
    <svg viewBox={`0 0 ${spec.w} ${spec.h}`} className={s.sketch} role="img" aria-label={spec.alt}>
      {drawn.edges.map(({ e, shaft, head, lx, ly }, i) => (
        <g key={`e${i}`} fill="none" stroke="#475467" strokeWidth={1.4} strokeLinecap="round" strokeDasharray={e.dashed ? "6 6" : undefined}>
          {shaft.map((d, k) => <path key={k} d={d} opacity={k ? 0.55 : 1} />)}
          {head.map((d, k) => <path key={`h${k}`} d={d} strokeDasharray="none" />)}
          {e.label && (
            <g>
              <rect x={lx - e.label.length * 3.3 - 6} y={ly - 10} width={e.label.length * 6.6 + 12} height={20} rx={6} fill="var(--c-bg, #fafafa)" stroke="none" />
              <text x={lx} y={ly + 4} textAnchor="middle" className={s.sketchEdge} stroke="none" strokeDasharray="none">{e.label}</text>
            </g>
          )}
        </g>
      ))}
      {drawn.nodes.map(({ n, paths, tone }) => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} fill={tone.fill} stroke="none" />
          <g fill="none" stroke={tone.stroke} strokeWidth={1.6} strokeLinecap="round">
            {paths.map((d, k) => <path key={k} d={d} opacity={k < 4 ? 1 : 0.5} />)}
          </g>
          <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -4 : 5)} textAnchor="middle" className={s.sketchTitle}>{n.title}</text>
          {n.sub && <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" className={s.sketchSub}>{n.sub}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- the diagrams */

export const DIAGRAMS: Record<string, SketchSpec> = {
  lifecycle: {
    w: 780,
    h: 300,
    alt: "Deal lifecycle: Negotiate, then Quote, then Sign (buyer and seller signer), then Fund (USDC into DealEscrow), then Deliver and settle (repeat). Above the approval threshold a quote waits for the seller's approval before signing. From an active deal, a dispute freezes funds for the arbiter; when the term ends (plus grace) or the seller closes, the unspent balance is refunded and the deal closes.",
    nodes: [
      { id: "neg", x: 16, y: 44, w: 128, h: 64, title: "Negotiate", sub: "buyer ⇄ agent", tone: "gray" },
      { id: "quote", x: 172, y: 44, w: 128, h: 64, title: "Quote", sub: "engine-made offer", tone: "blue" },
      { id: "sign", x: 328, y: 44, w: 128, h: 64, title: "Sign", sub: "both, EIP-712", tone: "blue" },
      { id: "fund", x: 484, y: 44, w: 128, h: 64, title: "Fund", sub: "USDC → escrow", tone: "green" },
      { id: "settle", x: 640, y: 44, w: 128, h: 64, title: "Deliver + settle", sub: "per countersigned unit", tone: "green" },
      { id: "approve", x: 172, y: 196, w: 128, h: 60, title: "Seller approves", sub: "above threshold", tone: "amber" },
      { id: "dispute", x: 484, y: 196, w: 128, h: 60, title: "Dispute", sub: "arbiter splits rest", tone: "rose" },
      { id: "refund", x: 640, y: 196, w: 128, h: 60, title: "Refund + close", sub: "after term + grace", tone: "gray" },
    ],
    edges: [
      { from: "neg", to: "quote" },
      { from: "quote", to: "sign" },
      { from: "sign", to: "fund" },
      { from: "fund", to: "settle" },
      { from: "quote", to: "approve", dashed: true, label: "large order" },
      { from: "approve", to: "sign", dashed: true, bend: 18 },
      { from: "settle", to: "dispute", dashed: true, label: "dispute", labelAt: 0.62 },
      { from: "settle", to: "refund", label: "term ends", labelAt: 0.55 },
    ],
  },
  money: {
    w: 780,
    h: 330,
    alt: "Money path: the buyer's wallet signs the terms and a USDC permit; the relayer submits the transaction and pays gas; USDC moves into DealEscrow. DealEscrow pays the seller's payee only against the buyer's Acceptance and the seller's Delivery, refunds the remainder to the buyer after the term plus grace or a seller close, and in a dispute the arbiter can split only the unspent balance. Pay per call (x402) goes from buyer to seller directly, outside escrow.",
    nodes: [
      { id: "buyer", x: 16, y: 120, w: 150, h: 70, title: "Buyer wallet", sub: "signs terms + permit", tone: "blue" },
      { id: "relayer", x: 315, y: 12, w: 150, h: 56, title: "Relayer", sub: "submits, pays gas", tone: "gray" },
      { id: "escrow", x: 300, y: 112, w: 180, h: 86, title: "DealEscrow", sub: "holds USDC per deal", tone: "green" },
      { id: "payee", x: 612, y: 44, w: 152, h: 66, title: "Seller payee", sub: "Acceptance + Delivery", tone: "green" },
      { id: "back", x: 612, y: 200, w: 152, h: 66, title: "Buyer refund", sub: "after term + grace", tone: "blue" },
      { id: "arbiter", x: 315, y: 262, w: 150, h: 56, title: "Arbiter", sub: "splits only the rest", tone: "rose" },
    ],
    edges: [
      { from: "buyer", to: "escrow", label: "prepaid USDC" },
      { from: "relayer", to: "escrow", dashed: true },
      { from: "escrow", to: "payee", label: "settle", labelAt: 0.55 },
      { from: "escrow", to: "back", label: "refund", labelAt: 0.55 },
      { from: "arbiter", to: "escrow", dashed: true, label: "dispute" },
    ],
  },
  signers: {
    w: 780,
    h: 340,
    alt: "Who signs what: the buyer's wallet signs the Terms and the Acceptance (checked by DealEscrow) and the USDC permit (checked by USDC). The seller signer, a per-seller key held encrypted by Proteus, countersigns the Terms and the Delivery (DealEscrow) and the policy commitment (ProteusPolicyRegistry). The seller's own wallet registers the ERC-8004 identity (IdentityRegistry), which publishes the payee and the signer.",
    nodes: [
      { id: "bw", x: 16, y: 30, w: 190, h: 66, title: "Buyer wallet", sub: "terms · permit · acceptance", tone: "blue" },
      { id: "ss", x: 16, y: 136, w: 190, h: 66, title: "Seller signer", sub: "held by Proteus, encrypted", tone: "amber" },
      { id: "sw", x: 16, y: 242, w: 190, h: 66, title: "Seller wallet", sub: "owns identity + payouts", tone: "green" },
      { id: "usdc", x: 560, y: 14, w: 204, h: 58, title: "Arc USDC", sub: "checks the permit", tone: "ink" },
      { id: "esc", x: 560, y: 96, w: 204, h: 64, title: "DealEscrow", sub: "terms · acceptance · delivery", tone: "ink" },
      { id: "pol", x: 560, y: 184, w: 204, h: 58, title: "PolicyRegistry", sub: "policy commitments", tone: "ink" },
      { id: "id", x: 560, y: 266, w: 204, h: 58, title: "IdentityRegistry", sub: "ERC-8004: payee, signer", tone: "ink" },
    ],
    edges: [
      { from: "bw", to: "usdc", label: "permit" },
      { from: "bw", to: "esc", label: "terms, acceptance", labelAt: 0.55 },
      { from: "ss", to: "esc", label: "terms, delivery", labelAt: 0.55 },
      { from: "ss", to: "pol", label: "commitBySig" },
      { from: "sw", to: "id", label: "register" },
    ],
  },
};
