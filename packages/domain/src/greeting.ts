/**
 * How a seller's deal agent greets a buyer: a short welcome, the two or three facts that matter most before ordering
 * (minimum order, production time, samples, delivery) and a few quick-start questions. Used by the store deal desk
 * (server) and by the embedded agent (site) so both open the same way.
 *
 * Every fact is a line the seller's own website gave (product knowledge notes). Nothing here is invented and nothing
 * here is a price: prices come only from the seller's tiers and the pricing engine.
 */

export interface GreetingProduct {
  name: string;
  /** Short public lines from the seller's site, e.g. "Minimum order 50 bags." or "Can I get samples? Yes! ...". */
  notes?: readonly string[];
}

export type GreetingFactKind = "moq" | "production" | "samples" | "delivery";

export interface GreetingFact {
  kind: GreetingFactKind;
  label: string;
  text: string;
}

export interface GreetingChip {
  label: string;
  /** What the chip sends as the buyer's message. */
  message: string;
}

export interface SellerGreeting {
  /** "Hi, welcome to Merch Onchain. I can quote ..." */
  opening: string;
  /** "They make hoodies, t-shirts, jerseys and 16 more." for a store; null for one product. Names only, no prices. */
  catalog: string | null;
  facts: GreetingFact[];
  closing: string;
  chips: GreetingChip[];
}

const LABELS: Record<GreetingFactKind, string> = { moq: "Minimum order", production: "Production", samples: "Samples", delivery: "Delivery" };
/** Shown in this order; the greeting keeps the first three that the seller's notes cover. */
const ORDER: GreetingFactKind[] = ["moq", "production", "samples", "delivery"];
const MAX_FACTS = 3;
const CATALOG_NAMES = 3;
const MONEY = /[$€£¥₹]|\b(usdc?|eur|gbp|inr|rs|rupees?|dollars?|euros?)\b/i;

/** Classifies on the question of an FAQ-style note ("How long does delivery take? ..."), else on the whole line. */
function kindOf(question: string): GreetingFactKind | null {
  if (/\bsamples?\b/i.test(question)) return "samples";
  if (/\b(deliver(y|ed|s)?|shipping|ships?|arrive)\b/i.test(question)) return "delivery";
  if (/\b(production|lead[- ]time|turnaround|produce|make it|made)\b/i.test(question)) return "production";
  if (/\b(moq|minimum order|minimum quantity|min\.? order)\b/i.test(question)) return "moq";
  return null;
}

/** "What's the MOQ? Usually starts at 50 pieces." -> { q: "What's the MOQ?", a: "Usually starts at 50 pieces." } */
function split(note: string): { q: string; a: string } {
  const m = /^([^?]{3,140}\?)\s+(.+)$/s.exec(note.trim());
  return m ? { q: m[1]!, a: m[2]! } : { q: note.trim(), a: note.trim() };
}

/** First sentence of the answer, without a leading "Yes!" or the label repeated ("Minimum order 50 bags." -> "50 bags."). */
function factText(kind: GreetingFactKind, answer: string): string | null {
  let t = answer.replace(/\s+/g, " ").trim();
  t = t.replace(/^(yes|yep|sure|absolutely|of course)\b[!.,]*\s*/i, "");
  const label = LABELS[kind];
  if (t.toLowerCase().startsWith(label.toLowerCase())) t = t.slice(label.length).replace(/^[\s:,-]+/, "");
  const first = /^.+?[.!](?=\s|$)/.exec(t)?.[0] ?? t;
  let out = first.trim().replace(/!+$/, ".");
  if (!out || out.split(" ").length < 2 && !/\d/.test(out)) return null;
  if (out.length > 120 || MONEY.test(out)) return null;
  if (!/[.!]$/.test(out)) out += ".";
  // Lower-case the first letter after "Label:" unless it starts an acronym ("MOQ") or a number.
  if (/^[A-Z][a-z]/.test(out)) out = out[0]!.toLowerCase() + out.slice(1);
  return out;
}

/** The facts for one product, or for a whole store: a line every product shares wins over one product's line. */
export function greetingFacts(products: readonly GreetingProduct[]): GreetingFact[] {
  const found = new Map<GreetingFactKind, { text: string; shared: number; faq: boolean }[]>();
  const seen = new Map<string, number>();
  for (const p of products) for (const n of new Set(p.notes ?? [])) seen.set(n, (seen.get(n) ?? 0) + 1);
  for (const [note, count] of seen) {
    const { q, a } = split(note);
    const kind = kindOf(q);
    if (!kind) continue;
    const text = factText(kind, a);
    if (!text) continue;
    const list = found.get(kind) ?? [];
    list.push({ text, shared: count, faq: q !== a });
    found.set(kind, list);
  }
  const store = products.length > 1;
  const facts: GreetingFact[] = [];
  for (const kind of ORDER) {
    const list = found.get(kind);
    if (!list?.length) continue;
    // A store greets with what holds for every product; a single product with its own line first.
    const pick = store ? [...list].sort((x, y) => y.shared - x.shared || Number(y.faq) - Number(x.faq))[0]! : list[0]!;
    if (store && pick.shared < products.length) continue;
    facts.push({ kind, label: LABELS[kind], text: pick.text });
    if (facts.length === MAX_FACTS) break;
  }
  return facts;
}

/** "They make backpacks, bottles, t-shirts and 4 more." from the seller's product list, in its order. */
function catalogLine(products: readonly GreetingProduct[]): string {
  const names = products.slice(0, CATALOG_NAMES).map((p) => p.name.toLowerCase());
  const rest = products.length - names.length;
  const list = rest > 0 ? `${names.join(", ")} and ${rest} more` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `They make ${list}.`;
}

/**
 * The greeting for a seller's deal agent. `product` set: the buyer is on one product; otherwise the whole store.
 * Chips cover only what the facts can answer, plus a quote.
 */
export function sellerGreeting(sellerName: string, products: readonly GreetingProduct[], product?: GreetingProduct): SellerGreeting {
  const scope = product ? [product] : products;
  const facts = greetingFacts(scope);
  const what = product ? product.name.toLowerCase() : products.length > 1 ? "any of their products" : (products[0]?.name.toLowerCase() ?? "their products");
  const chips: GreetingChip[] = [{ label: "Get a quote", message: product ? `I would like a quote for ${product.name.toLowerCase()}.` : "I would like a quote." }];
  if (facts.some((f) => f.kind === "moq")) chips.push({ label: "Minimum order?", message: "What is the minimum order?" });
  if (facts.some((f) => f.kind === "production" || f.kind === "delivery")) chips.push({ label: "Delivery time?", message: "How long does production and delivery take?" });
  if (facts.some((f) => f.kind === "samples")) chips.push({ label: "Samples?", message: "Can I get a sample first?" });
  return {
    opening: `Hi, welcome to ${sellerName}. I can quote and set up an order for ${what} in seconds.`,
    catalog: !product && products.length > 1 ? catalogLine(products) : null,
    facts,
    closing: "Tell me what you need, how many and by when, and I will put together options the seller can actually deliver.",
    chips,
  };
}

/** The greeting as one plain-text message (the deal desk stores it as the agent's first turn). */
export function greetingText(g: SellerGreeting): string {
  const facts = g.facts.map((f) => `${f.label}: ${f.text}`).join("\n");
  return [g.catalog ? `${g.opening} ${g.catalog}` : g.opening, facts, g.closing].filter(Boolean).join("\n\n");
}
