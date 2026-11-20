/**
 * Hand-drawn diagrams in the Excalidraw style, drawn from data: every stroke is drawn twice with a little seeded
 * wobble, so shapes look sketched but never move between renders. No dependency; the diagrams live next to the docs
 * content, so they cannot drift from it. Each diagram also has a plain-text description for /docs.md.
 */
import { useMemo } from "react";
import s from "./productDocs.module.css";
import type { DiagramName } from "./docsContent";

type Tone = "blue" | "green" | "amber" | "rose" | "gray" | "ink";
interface SketchNode { id: string; x: number; y: number; w: number; h: number; title: string; sub?: string; tone?: Tone; /** A dashed outline: something not built yet. */ dashed?: boolean }
interface SketchEdge { from: string; to: string; label?: string; dashed?: boolean; bend?: number; labelAt?: number }
export interface SketchSpec { w: number; h: number; nodes: SketchNode[]; edges: SketchEdge[]; alt: string }

/** Tone colors come from CSS variables on the docs root, so diagrams follow the light and dark themes. */
const TONE: Record<Tone, { fill: string; stroke: string }> = {
  blue: { fill: "var(--sk-blue-f)", stroke: "var(--sk-blue-s)" },
  green: { fill: "var(--sk-green-f)", stroke: "var(--sk-green-s)" },
  amber: { fill: "var(--sk-amber-f)", stroke: "var(--sk-amber-s)" },
  rose: { fill: "var(--sk-rose-f)", stroke: "var(--sk-rose-s)" },
  gray: { fill: "var(--sk-gray-f)", stroke: "var(--sk-gray-s)" },
  ink: { fill: "var(--sk-ink-f)", stroke: "var(--sk-ink-s)" },
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
        <g key={`e${i}`} fill="none" style={{ stroke: "var(--sk-line)" }} strokeWidth={1.4} strokeLinecap="round" strokeDasharray={e.dashed ? "6 6" : undefined}>
          {shaft.map((d, k) => <path key={k} d={d} opacity={k ? 0.55 : 1} />)}
          {head.map((d, k) => <path key={`h${k}`} d={d} strokeDasharray="none" />)}
          {e.label && (
            <g>
              <rect x={lx - e.label.length * 3.3 - 6} y={ly - 10} width={e.label.length * 6.6 + 12} height={20} rx={6} style={{ fill: "var(--sk-label-bg)", stroke: "none" }} />
              <text x={lx} y={ly + 4} textAnchor="middle" className={s.sketchEdge} stroke="none" strokeDasharray="none">{e.label}</text>
            </g>
          )}
        </g>
      ))}
      {drawn.nodes.map(({ n, paths, tone }) => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} style={{ fill: tone.fill }} stroke="none" />
          <g fill="none" style={{ stroke: tone.stroke }} strokeWidth={1.6} strokeLinecap="round" strokeDasharray={n.dashed ? "7 6" : undefined}>
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

export const DIAGRAMS: Record<DiagramName, SketchSpec> = {
  system: {
    w: 780,
    h: 372,
    alt: "The system: a buyer or the buyer's AI agent negotiates with the seller's deal agent on Proteus, which quotes only from the rules the seller set. Signed terms go to the relayer, which submits transactions to DealEscrow on Arc and pays the gas. The buyer's USDC goes into DealEscrow, never to Proteus, and DealEscrow pays the seller's payee for each unit the buyer countersigns. The seller's own systems call the seller API and receive webhooks; policy commitments and the seller's identity live in Arc registries.",
    nodes: [
      { id: "buyer", x: 16, y: 30, w: 170, h: 64, title: "Buyer or AI agent", sub: "asks, signs, funds", tone: "blue" },
      { id: "agent", x: 300, y: 30, w: 180, h: 64, title: "Deal agent", sub: "quotes only from rules", tone: "amber" },
      { id: "seller", x: 594, y: 30, w: 170, h: 64, title: "Seller", sub: "rules, products, delivery", tone: "green" },
      { id: "relayer", x: 300, y: 172, w: 180, h: 64, title: "Relayer", sub: "submits, pays gas", tone: "gray" },
      { id: "systems", x: 594, y: 172, w: 170, h: 64, title: "Seller's systems", sub: "seller API · webhooks", tone: "gray" },
      { id: "escrow", x: 300, y: 296, w: 180, h: 64, title: "DealEscrow on Arc", sub: "holds USDC per deal", tone: "green" },
      { id: "payee", x: 594, y: 296, w: 170, h: 64, title: "Seller payee", sub: "paid per delivered unit", tone: "green" },
    ],
    edges: [
      { from: "buyer", to: "agent", label: "negotiate" },
      { from: "seller", to: "agent", label: "rules" },
      { from: "agent", to: "relayer", label: "signed terms" },
      { from: "relayer", to: "escrow", dashed: true },
      { from: "buyer", to: "escrow", label: "USDC", labelAt: 0.62 },
      { from: "escrow", to: "payee", label: "settle" },
      { from: "systems", to: "agent", bend: 26, label: "seller API", labelAt: 0.5 },
      { from: "agent", to: "systems", dashed: true, bend: 26, label: "webhooks", labelAt: 0.5 },
    ],
  },
  apiAuth: {
    w: 780,
    h: 360,
    alt: "Seller API authentication: your server sends a bearer key. Proteus looks up the key's SHA-256 hash (missing, unknown, revoked or expired: 401), checks its environment against the network (a test key on mainnet or a live key on testnet: 401), checks the route's permission (missing: 403 naming it), then answers with your seller's data only (another seller's deal or product: 404). The public sandbox key goes to /api/v1/sandbox/seller instead, which answers from fixed demo data and runs writes as dry runs.",
    nodes: [
      { id: "you", x: 8, y: 40, w: 124, h: 64, title: "Your server", sub: "Bearer psk_…", tone: "blue" },
      { id: "key", x: 170, y: 40, w: 124, h: 64, title: "Key", sub: "SHA-256 lookup", tone: "gray" },
      { id: "env", x: 332, y: 40, w: 124, h: 64, title: "Environment", sub: "test ↔ testnet", tone: "gray" },
      { id: "scope", x: 494, y: 40, w: 124, h: 64, title: "Permission", sub: "scope for route", tone: "gray" },
      { id: "data", x: 656, y: 40, w: 116, h: 64, title: "Your data", sub: "your seller only", tone: "green" },
      { id: "e401", x: 232, y: 176, w: 162, h: 56, title: "401", sub: "unknown, revoked, other env", tone: "rose" },
      { id: "e403", x: 470, y: 176, w: 136, h: 56, title: "403", sub: "names the scope", tone: "rose" },
      { id: "e404", x: 640, y: 176, w: 132, h: 56, title: "404", sub: "not your seller", tone: "rose" },
      { id: "sbx", x: 8, y: 286, w: 214, h: 56, title: "Sandbox key", sub: "/api/v1/sandbox/seller", tone: "amber" },
      { id: "demo", x: 444, y: 286, w: 328, h: 56, title: "Demo seller, fixed data", sub: "reads: demo records · writes: dry runs", tone: "amber" },
    ],
    edges: [
      { from: "you", to: "key" },
      { from: "key", to: "env" },
      { from: "env", to: "scope" },
      { from: "scope", to: "data" },
      { from: "key", to: "e401", dashed: true },
      { from: "env", to: "e401", dashed: true },
      { from: "scope", to: "e403", dashed: true },
      { from: "data", to: "e404", dashed: true },
      { from: "sbx", to: "demo", label: "never real data" },
    ],
  },
  webhooks: {
    w: 780,
    h: 280,
    alt: "Webhook delivery: a deal event is queued once in the outbox. After each reconciler tick Proteus checks your host resolves to a public address, signs t.body with HMAC-SHA256 and your secret, and POSTs it with X-Proteus-Signature. Any 2xx within 5 seconds is delivered; anything else is retried on later runs, up to 5 attempts. Your receiver checks the timestamp, recomputes the HMAC over the raw body, compares it in constant time, and deduplicates on the event id.",
    nodes: [
      { id: "event", x: 8, y: 40, w: 136, h: 64, title: "Deal event", sub: "funded, settled, …", tone: "blue" },
      { id: "outbox", x: 196, y: 40, w: 136, h: 64, title: "Outbox", sub: "queued once", tone: "gray" },
      { id: "post", x: 384, y: 40, w: 160, h: 64, title: "Signed POST", sub: "HMAC-SHA256 · 5 s", tone: "green" },
      { id: "you", x: 596, y: 40, w: 176, h: 64, title: "Your receiver", sub: "your https URL", tone: "ink" },
      { id: "retry", x: 384, y: 186, w: 160, h: 64, title: "Retry", sub: "later runs, 5 attempts", tone: "rose" },
      { id: "verify", x: 596, y: 186, w: 176, h: 64, title: "Verify, then dedupe", sub: "time · HMAC · event id", tone: "amber" },
    ],
    edges: [
      { from: "event", to: "outbox" },
      { from: "outbox", to: "post" },
      { from: "post", to: "you" },
      { from: "post", to: "retry", dashed: true, label: "not 2xx" },
      { from: "retry", to: "outbox", dashed: true },
      { from: "you", to: "verify", label: "on receipt" },
    ],
  },
  lifecycle: {
    w: 780,
    h: 396,
    alt: "Deal lifecycle: Negotiating, then Quoted (an engine-made offer), then Awaiting funding (buyer signed the terms, seller signer countersigned), then Funding pending (transaction submitted), then Active (USDC in DealEscrow). A quote above the seller's approval threshold waits for the seller before the buyer can sign. While Active, usage is settled any number of times. A dispute freezes the deal for the arbiter: a partial split returns it to Active, a full split closes it. refundUnused after end plus grace, or after the seller closes the term, refunds the rest and closes the deal.",
    nodes: [
      { id: "neg", x: 16, y: 36, w: 160, h: 64, title: "Negotiating", sub: "buyer ⇄ deal agent", tone: "gray" },
      { id: "quote", x: 216, y: 36, w: 160, h: 64, title: "Quoted", sub: "engine-made offer", tone: "blue" },
      { id: "await", x: 416, y: 36, w: 160, h: 64, title: "Awaiting funding", sub: "both signed the terms", tone: "blue" },
      { id: "pending", x: 616, y: 36, w: 160, h: 64, title: "Funding pending", sub: "transaction submitted", tone: "blue" },
      { id: "approve", x: 216, y: 176, w: 160, h: 64, title: "Seller approves", sub: "above threshold", tone: "amber" },
      { id: "settle", x: 396, y: 176, w: 150, h: 64, title: "Settle usage", sub: "repeat per delivery", tone: "green" },
      { id: "active", x: 616, y: 176, w: 160, h: 64, title: "Active", sub: "Funded on chain", tone: "green" },
      { id: "dispute", x: 216, y: 316, w: 180, h: 64, title: "Disputed", sub: "frozen for the arbiter", tone: "rose" },
      { id: "closed", x: 616, y: 316, w: 160, h: 64, title: "Closed", sub: "refund or full split", tone: "gray" },
    ],
    edges: [
      { from: "neg", to: "quote" },
      { from: "quote", to: "await", label: "sign" },
      { from: "await", to: "pending", label: "fund" },
      { from: "pending", to: "active", label: "on chain" },
      { from: "quote", to: "approve", dashed: true, label: "large order" },
      { from: "approve", to: "await", dashed: true, label: "approved", labelAt: 0.5 },
      { from: "active", to: "settle", bend: 12 },
      { from: "settle", to: "active", bend: 12 },
      { from: "active", to: "dispute", dashed: true, bend: 30, label: "dispute", labelAt: 0.5 },
      { from: "dispute", to: "active", dashed: true, bend: 30, label: "partial split", labelAt: 0.5 },
      { from: "dispute", to: "closed", dashed: true, label: "full split" },
      { from: "active", to: "closed", label: "refundUnused", labelAt: 0.5 },
    ],
  },
  money: {
    w: 780,
    h: 330,
    alt: "Money path: the buyer's wallet signs the terms and a USDC permit; the relayer submits the transaction and pays gas; USDC moves into DealEscrow. DealEscrow pays the seller's payee only against the buyer's Acceptance and the seller's Delivery, refunds the remainder to the buyer after the term plus grace or a seller close, and in a dispute the arbiter can split only the unspent balance. Pay per call (x402) is outside escrow.",
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
  pricing: {
    w: 780,
    h: 372,
    alt: "How an offer is made: the buyer's message is read by Claude Haiku into fields (units, budget, integrations). The pricing engine, which is code, builds candidates from the seller's tiers and checks each against the seller's rules. A candidate that passes is an offer; one above the approval threshold waits for the seller; one that breaks a rule is refused with a public reason. Claude Sonnet writes the reply from the offers only, and a figure check replaces any reply with an unlisted figure by a fixed reply before the buyer sees it.",
    nodes: [
      { id: "msg", x: 16, y: 34, w: 150, h: 64, title: "Buyer message", sub: "units, budget, dates", tone: "blue" },
      { id: "read", x: 206, y: 34, w: 170, h: 64, title: "Read the request", sub: "Claude Haiku → fields", tone: "gray" },
      { id: "engine", x: 416, y: 34, w: 170, h: 64, title: "Pricing engine", sub: "code: candidates", tone: "amber" },
      { id: "rules", x: 626, y: 34, w: 140, h: 64, title: "Seller's rules", sub: "floor · cap · min · stock", tone: "amber" },
      { id: "offer", x: 206, y: 170, w: 170, h: 64, title: "Offers", sub: "passed every rule", tone: "green" },
      { id: "approve", x: 416, y: 170, w: 170, h: 64, title: "Seller approves", sub: "above threshold", tone: "amber" },
      { id: "refused", x: 626, y: 170, w: 140, h: 64, title: "Refused", sub: "one public reason", tone: "rose" },
      { id: "buyer", x: 16, y: 294, w: 150, h: 64, title: "Buyer sees", sub: "offers + reply", tone: "blue" },
      { id: "guard", x: 206, y: 294, w: 170, h: 64, title: "Figure check", sub: "unlisted → fixed reply", tone: "gray" },
      { id: "reply", x: 416, y: 294, w: 170, h: 64, title: "Write the reply", sub: "Claude Sonnet, words only", tone: "gray" },
    ],
    edges: [
      { from: "msg", to: "read" },
      { from: "read", to: "engine" },
      { from: "engine", to: "rules" },
      { from: "rules", to: "offer", label: "pass", labelAt: 0.3 },
      { from: "rules", to: "approve", dashed: true, label: "large", labelAt: 0.45 },
      { from: "rules", to: "refused", dashed: true },
      { from: "offer", to: "reply" },
      { from: "reply", to: "guard" },
      { from: "guard", to: "buyer" },
    ],
  },
  aiStack: {
    w: 840,
    h: 372,
    alt: "Where Claude works. Deal desk: buyer text from any channel has emails, phone and card numbers removed, Claude Haiku reads it into fields, the pricing engine (code) computes the offers, Claude Sonnet writes the words, and a figure check falls back to a fixed reply if the words carry an unlisted figure. Services Proteus runs: a request goes to a service agent on the Claude model chosen for that job (Haiku, Sonnet or Opus); a delivered result is one billed unit with a signed receipt; a refusal, failure, cut-off or handoff to a person is never billed.",
    nodes: [
      { id: "text", x: 10, y: 40, w: 112, h: 64, title: "Buyer text", sub: "any channel", tone: "blue" },
      { id: "redact", x: 152, y: 40, w: 112, h: 64, title: "Redact", sub: "contact details", tone: "gray" },
      { id: "haiku", x: 294, y: 40, w: 112, h: 64, title: "Haiku reads", sub: "→ units, budget", tone: "amber" },
      { id: "engine", x: 436, y: 40, w: 112, h: 64, title: "Engine prices", sub: "code, no model", tone: "green" },
      { id: "sonnet", x: 578, y: 40, w: 112, h: 64, title: "Sonnet writes", sub: "words only", tone: "amber" },
      { id: "check", x: 720, y: 40, w: 112, h: 64, title: "Figure check", sub: "or fixed reply", tone: "gray" },
      { id: "req", x: 12, y: 236, w: 160, h: 64, title: "Service request", sub: "API call or chat", tone: "blue" },
      { id: "worker", x: 232, y: 236, w: 210, h: 64, title: "Service agent", sub: "Haiku · Sonnet · Opus per job", tone: "amber" },
      { id: "done", x: 592, y: 176, w: 220, h: 64, title: "Delivered: billed", sub: "1 unit, signed receipt", tone: "green" },
      { id: "nobill", x: 592, y: 292, w: 220, h: 64, title: "Not billed", sub: "refused · failed · handoff", tone: "rose" },
    ],
    edges: [
      { from: "text", to: "redact" },
      { from: "redact", to: "haiku" },
      { from: "haiku", to: "engine" },
      { from: "engine", to: "sonnet" },
      { from: "sonnet", to: "check" },
      { from: "req", to: "worker" },
      { from: "worker", to: "done" },
      { from: "worker", to: "nobill", dashed: true },
    ],
  },
  frontDesk: {
    w: 780,
    h: 380,
    alt: "Front desk: a customer chats or speaks on the business's customer link or website embed. The AI assistant answers from the business profile and asks for one missing detail at a time; follow-up questions are never billed. When the request is complete it is metered once as one unit on the business's deal. The customer sees only the reply meant for them; the full note goes to the business's inbox, and an alert goes out by webhook, Telegram or email, flagged urgent for emergencies.",
    nodes: [
      { id: "cust", x: 16, y: 40, w: 130, h: 64, title: "Customer", sub: "types or speaks", tone: "blue" },
      { id: "link", x: 226, y: 40, w: 150, h: 64, title: "Customer link", sub: "page or website embed", tone: "gray" },
      { id: "asst", x: 456, y: 40, w: 150, h: 64, title: "AI assistant", sub: "one question at a time", tone: "amber" },
      { id: "profile", x: 646, y: 40, w: 120, h: 64, title: "Profile", sub: "hours, services", tone: "gray" },
      { id: "done", x: 456, y: 180, w: 150, h: 64, title: "Finished request", sub: "1 unit, billed once", tone: "green" },
      { id: "inbox", x: 646, y: 180, w: 120, h: 64, title: "Inbox", sub: "the full note", tone: "gray" },
      { id: "alerts", x: 646, y: 300, w: 120, h: 64, title: "Alerts", sub: "urgent flagged", tone: "gray" },
    ],
    edges: [
      { from: "cust", to: "link" },
      { from: "link", to: "asst" },
      { from: "profile", to: "asst" },
      { from: "asst", to: "done", label: "complete" },
      { from: "done", to: "inbox" },
      { from: "done", to: "alerts" },
      { from: "done", to: "cust", label: "their reply only", labelAt: 0.55 },
    ],
  },
  channels: {
    w: 800,
    h: 410,
    alt: "Ways to use Proteus AI: buyers reach the same deal agent from the web app, a seller's website embed, the seller's WhatsApp number, an MCP client such as Claude, their own agent over HTTP, and later a phone app (coming soon). The deal agent prices only from the seller's rules. The seller sets those rules in the seller console and connects its own systems through the seller API and webhooks. Every channel ends in the same signed terms and the same DealEscrow contract on Arc.",
    nodes: [
      { id: "web", x: 12, y: 16, w: 124, h: 56, title: "Web app", sub: "store, deal pages", tone: "blue" },
      { id: "embed", x: 142, y: 16, w: 124, h: 56, title: "Website embed", sub: "one script tag", tone: "blue" },
      { id: "wa", x: 272, y: 16, w: 124, h: 56, title: "WhatsApp", sub: "seller's number", tone: "blue" },
      { id: "mcp", x: 402, y: 16, w: 124, h: 56, title: "MCP client", sub: "Claude and others", tone: "blue" },
      { id: "http", x: 532, y: 16, w: 124, h: 56, title: "Your agent", sub: "HTTP skill · x402", tone: "blue" },
      { id: "phone", x: 662, y: 16, w: 124, h: 56, title: "Phone app", sub: "coming soon", tone: "gray", dashed: true },
      { id: "agent", x: 290, y: 190, w: 200, h: 72, title: "Deal agent", sub: "prices only from the rules", tone: "amber" },
      { id: "console", x: 600, y: 160, w: 186, h: 60, title: "Seller console", sub: "products and rules", tone: "green" },
      { id: "api", x: 600, y: 246, w: 186, h: 60, title: "Seller API", sub: "keys · webhooks", tone: "gray" },
      { id: "escrow", x: 290, y: 334, w: 200, h: 64, title: "DealEscrow on Arc", sub: "same terms, same escrow", tone: "green" },
    ],
    edges: [
      { from: "web", to: "agent" },
      { from: "embed", to: "agent" },
      { from: "wa", to: "agent" },
      { from: "mcp", to: "agent" },
      { from: "http", to: "agent" },
      { from: "phone", to: "agent", dashed: true },
      { from: "console", to: "agent", label: "rules" },
      { from: "api", to: "agent", label: "your systems", labelAt: 0.5 },
      { from: "agent", to: "escrow", label: "signed terms" },
    ],
  },
  mcp: {
    w: 780,
    h: 372,
    alt: "Buying through MCP: you set the mandate (the largest prepaid amount per deal) in the MCP server's environment. Your MCP client, such as Claude, calls the Proteus MCP server's tools. The server runs on your machine: it talks to the Proteus API to negotiate, quote and fund, reads Arc directly to verify the seller's ERC-8004 identity and policy commitment, and signs with your buyer key or returns typed data for a Circle Agent Wallet to sign. The relayer submits the funding and settlement to DealEscrow on Arc.",
    nodes: [
      { id: "you", x: 16, y: 30, w: 176, h: 64, title: "You", sub: "set the mandate", tone: "blue" },
      { id: "client", x: 16, y: 170, w: 176, h: 64, title: "MCP client", sub: "Claude or any MCP app", tone: "blue" },
      { id: "server", x: 290, y: 170, w: 200, h: 64, title: "Proteus MCP server", sub: "on your machine · 9 tools", tone: "amber" },
      { id: "api", x: 590, y: 50, w: 176, h: 64, title: "Proteus API", sub: "negotiate · quote · fund", tone: "gray" },
      { id: "arc", x: 590, y: 280, w: 176, h: 64, title: "Arc", sub: "registries · DealEscrow", tone: "green" },
      { id: "key", x: 290, y: 290, w: 200, h: 64, title: "Your key or Circle wallet", sub: "signs terms, permit, acceptance", tone: "gray" },
    ],
    edges: [
      { from: "you", to: "server", dashed: true, label: "mandate", labelAt: 0.5 },
      { from: "client", to: "server", label: "tool calls" },
      { from: "server", to: "api", label: "HTTPS" },
      { from: "server", to: "arc", label: "verify seller", labelAt: 0.5 },
      { from: "server", to: "key", label: "sign" },
      { from: "api", to: "arc", dashed: true, label: "relayer submits", labelAt: 0.5 },
    ],
  },
  whatsapp: {
    w: 780,
    h: 300,
    alt: "WhatsApp: the buyer messages the seller's own WhatsApp Business number. Meta's Cloud API sends a signed webhook to Proteus, which checks the signature, keys the buyer by a pseudonym and runs the same deal agent and pricing rules. Offers go back through Meta as reply buttons. To sign and pay, the buyer gets an opaque link that works for 30 minutes and opens the offer on the web; nothing about money happens inside the chat. HUMAN hands the chat to the seller's team, STOP ends messages.",
    nodes: [
      { id: "buyer", x: 16, y: 40, w: 130, h: 64, title: "Buyer", sub: "in WhatsApp", tone: "blue" },
      { id: "meta", x: 236, y: 40, w: 150, h: 64, title: "Meta Cloud API", sub: "seller's own number", tone: "gray" },
      { id: "proteus", x: 476, y: 40, w: 150, h: 64, title: "Proteus", sub: "checks signature", tone: "amber" },
      { id: "agent", x: 656, y: 40, w: 110, h: 64, title: "Deal agent", sub: "same rules", tone: "amber" },
      { id: "team", x: 236, y: 206, w: 150, h: 64, title: "Seller's team", sub: "after HUMAN", tone: "green" },
      { id: "web", x: 476, y: 206, w: 150, h: 64, title: "Offer page", sub: "sign and pay on the web", tone: "green" },
    ],
    edges: [
      { from: "buyer", to: "meta", bend: 16, label: "message" },
      { from: "meta", to: "buyer", bend: 16, label: "offers" },
      { from: "meta", to: "proteus", bend: 16, label: "webhook" },
      { from: "proteus", to: "meta", bend: 16, label: "reply" },
      { from: "proteus", to: "agent" },
      { from: "proteus", to: "web", label: "30-minute link", labelAt: 0.5 },
      { from: "proteus", to: "team", dashed: true, label: "HUMAN", labelAt: 0.5 },
    ],
  },
};
