/**
 * Store conversations that are not about one product yet. A buyer who asks something open ("suggest me some good
 * merch", "gift ideas for 200 employees") is consulted: the agent stays on all products, recommends a few of the
 * seller's real products with a short reason and their "from" price, and asks one or two questions to narrow down.
 * A message moves to one product only when it names one (or picks one of the recommendations by position).
 *
 * Everything here is deterministic. It is the router for the store deal desk and the embedded agent, the fallback
 * recommendation when no model key is set, and the guard rails a model-written recommendation is checked against:
 * every product comes from the seller's catalogue and every price from its tiers.
 */
import { pluralUnit, unitFor } from "./money";
import { greetingFacts, type GreetingFact, type GreetingFactKind } from "./greeting";

/** A listed product as the router and the recommender see it: public data only. */
export interface ConsultProduct {
  slug: string;
  name: string;
  unitLabel: string;
  summary?: string | null;
  capabilities?: readonly string[];
  /** Lowest list unit price as the seller's tiers display it, e.g. "$15.00". */
  fromPrice?: string | null;
  /** Units in the smallest tier (the minimum order), when the tiers give one. */
  minUnits?: number | null;
  /** Public lines from the seller's own website (minimum order, production time, samples). */
  notes?: readonly string[];
}

/* ------------------------------------------------------------------ */
/* routing                                                              */
/* ------------------------------------------------------------------ */

export type RouteDecision =
  | { mode: "product"; slug: string; switched: boolean; reason: string }
  /** Stay on all products and recommend. `slugs`: products the message points at, best first (may be empty). */
  | { mode: "consult"; slugs: string[]; exclude: string[]; reason: string };

/** Words that appear in many product names and say nothing about which one is meant. */
const GENERIC = new Set(["custom", "event", "events", "pack", "bulk", "your", "with", "from", "for", "and", "the", "per", "design", "logo", "printed", "branded", "service", "plan", "team", "teams", "one", "each", "included", "delivery", "merch", "merchandise", "swag", "product", "products", "item", "items", "stuff", "thing", "things", "good", "best", "some", "any", "all", "other", "else", "piece", "pieces", "unit", "units", "pcs"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !GENERIC.has(w));
/** Light stemming so "bags" matches "bag" and "boxes" matches "box". */
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(xes|ches|shes|ses)$/, (m) => m.slice(0, -2)).replace(/s$/, "");

/**
 * The buyer is asking for help choosing rather than about the product at hand: suggestions, ideas, what else. Kept to
 * explicit asks, since "what are my options?" or "which one is cheaper?" on a product are about that product.
 */
const DISCOVERY = /\b(suggest\w*|recommend\w*|ideas?|help me (choose|pick|decide|find)|what (do|can) you (have|make|offer|sell)|what else|anything else|something else|alternatives?|other products|browse|(your|the) catalog(ue)?|not sure what)\b/i;
/** "...besides hoodies", "other than tees": the named product is the one to leave out. */
const EXCLUDE = /\b(besides|other than|apart from|instead of|except|not the|no more)\b/i;
const ORDINALS: [RegExp, number][] = [
  [/\b(first|1st)\b|\boption (1|one)\b|#1\b/i, 0],
  [/\b(second|2nd)\b|\boption (2|two)\b|#2\b/i, 1],
  [/\b(third|3rd)\b|\boption (3|three)\b|#3\b/i, 2],
  [/\b(fourth|4th)\b|\boption (4|four)\b|#4\b/i, 3],
];

/**
 * Which product a buyer message is about, or that it is an open question to consult on.
 *
 * - One product clearly named (its name or unit): that product.
 * - An open question (suggestions, ideas, what else), several products named equally, or nothing matched while no
 *   product is chosen: consult, with the products the message did point at first.
 * - Nothing matched while on a product ("make it 200"): stay on it.
 *
 * `picks`: the products the last recommendation offered, so "the second one" picks one of them.
 */
export function routeMessage(message: string, products: readonly ConsultProduct[], opts: { current?: string; picks?: readonly string[]; sellerName?: string } = {}): RouteDecision {
  const own = new Set(words(opts.sellerName ?? "").map(stem));
  const said = new Set(words(message).map(stem).filter((w) => !own.has(w)));
  const current = products.find((p) => p.slug === opts.current)?.slug;
  const discovery = DISCOVERY.test(message);
  const excluding = EXCLUDE.test(message);

  // A word in most product summaries ("merch", the seller's name) says nothing about which product is meant.
  const weakOf = (p: ConsultProduct) => new Set([...(p.capabilities ?? []).flatMap(words), ...words(p.summary ?? "")].map(stem).filter((w) => !own.has(w)));
  const weakSets = products.map(weakOf);
  const common = new Set([...said].filter((w) => weakSets.filter((s) => s.has(w)).length > Math.max(1, products.length / 2)));
  const scored = products.map((p, i) => {
    const strong = new Set([...words(p.name), p.unitLabel.toLowerCase(), pluralUnit(p.unitLabel).toLowerCase()].map(stem));
    const hits = [...said].filter((w) => strong.has(w));
    const weakHits = [...said].filter((w) => !strong.has(w) && !common.has(w) && weakSets[i]!.has(w));
    return { slug: p.slug, strong: hits.length, weak: weakHits.length, hits: [...hits, ...weakHits] };
  });
  const named = scored.filter((s) => s.strong > 0).sort((a, b) => b.strong - a.strong || b.weak - a.weak);
  const pointed = scored.filter((s) => s.strong > 0 || s.weak > 0).sort((a, b) => b.strong * 3 + b.weak - (a.strong * 3 + a.weak));

  if (excluding && named.length) return { mode: "consult", slugs: [], exclude: named.map((s) => s.slug), reason: "asked for something other than a named product" };

  const top = named[0];
  const tied = top ? named.filter((s) => s.strong === top.strong && s.weak === top.weak) : [];
  if (top && tied.length === 1) {
    return { mode: "product", slug: top.slug, switched: Boolean(current && current !== top.slug), reason: `named ${top.hits.join(", ")}` };
  }
  if (tied.length > 1) {
    if (current && tied.some((s) => s.slug === current) && !discovery) return { mode: "product", slug: current, switched: false, reason: "continuing the current product" };
    return { mode: "consult", slugs: tied.slice(0, 4).map((s) => s.slug), exclude: [], reason: `several products match ${top!.hits.join(", ")}` };
  }

  // Nothing named. "The second one" picks from the last recommendation.
  if (opts.picks?.length && message.length <= 80) {
    for (const [re, i] of ORDINALS) {
      const slug = opts.picks[i];
      if (re.test(message) && slug && products.some((p) => p.slug === slug)) return { mode: "product", slug, switched: Boolean(current && current !== slug), reason: "picked from the recommendations" };
    }
  }
  if (discovery) return { mode: "consult", slugs: pointed.slice(0, 4).map((s) => s.slug), exclude: current ? [current] : [], reason: "an open question" };
  if (current && (!pointed.length || pointed.some((s) => s.slug === current))) return { mode: "product", slug: current, switched: false, reason: "continuing the current product" };
  return { mode: "consult", slugs: pointed.slice(0, 4).map((s) => s.slug), exclude: [], reason: pointed.length ? "related products, none named" : "no product named yet" };
}

/* ------------------------------------------------------------------ */
/* what the buyer has said they need                                    */
/* ------------------------------------------------------------------ */

export interface ConsultNeeds {
  /** "hackathon", "gift", "conference". */
  occasion?: string;
  /** "employees", "attendees", "clients". */
  audience?: string;
  quantity?: number;
  /** Budget in USD for the whole order. */
  budgetTotal?: number;
  /** Budget in USD per piece. */
  budgetUnit?: number;
  /** As the buyer said it: "by 10 December", "in 2 weeks". */
  deadline?: string;
  /** The buyer mentioned a logo, artwork or printing. */
  branding?: boolean;
}

const OCCASIONS = /\b(hackathons?|conferences?|meetups?|summits?|events?|festivals?|fests?|workshops?|booths?|trade ?shows?|expos?|launch(es)?|offsites?|onboarding|welcome kits?|gifts?|gifting|giveaways?|diwali|christmas|holidays?|new year|birthdays?|weddings?|anniversar(y|ies)|team ?outings?|sports? days?|tournaments?|campaigns?)\b/i;
const AUDIENCES = /\b(employees|staff|team( members)?|colleagues|clients|customers|attendees|participants|hackers|developers|devs|students|volunteers|speakers|sponsors|members|guests|community|partners|interns|new hires)\b/i;
const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DEADLINE = new RegExp(`\\b(?:(?:by|before|until|for|on)\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b|(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b)|\\b(?:by|before|until)\\s+(?:next\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|weekend|week|month|end of (?:the )?(?:week|month)|(?:${MONTHS}))\\b|\\bin\\s+(?:\\d+|a|one|two|three|four)\\s+(?:days?|weeks?|months?)\\b|\\bnext\\s+(?:week|month)\\b|\\btomorrow\\b|\\b(?:asap|urgent(?:ly)?|rush)\\b|\\bdeadline\\b[^.?!]{0,30}`, "i");
const BRANDING = /\b(logos?|brand(ed|ing)?|print(ed|ing)?|embroider(ed|y)?|artwork|our design|custom design)\b/i;
const PER_UNIT = /^\s*(?:usd|usdc|dollars?)?\s*(?:each|apiece|a piece|per\s+\w+|a\s+(?:pc|unit|item|person|head|tee|shirt|hoodie|bottle|bag)|\/\s?\w+)/i;

const num = (s: string, k?: string) => {
  const n = Number(s.replace(/,/g, ""));
  return k && /k/i.test(k) ? n * 1000 : n;
};

/** What the buyer's messages say about the order. A later message overrides an earlier one. */
export function consultNeeds(buyerTexts: readonly string[]): ConsultNeeds {
  const needs: ConsultNeeds = {};
  for (const raw of buyerTexts) {
    let text = ` ${raw} `;
    const occ = OCCASIONS.exec(text);
    if (occ) needs.occasion = occ[1]!.toLowerCase();
    const aud = AUDIENCES.exec(text);
    if (aud) needs.audience = aud[1]!.toLowerCase();
    if (BRANDING.test(text)) needs.branding = true;
    const dl = DEADLINE.exec(text);
    if (dl) {
      needs.deadline = dl[0].trim().replace(/[,.;]+$/, "");
      text = text.replace(dl[0], " ");
    }
    // Budgets: "$15 each", "under $3,000", "budget of 2k", "500 usd".
    const money = /(?:\$|\busd\s?|\bus\$)\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?|\b(\d[\d,]*(?:\.\d+)?)(\s?k)?\s?(?:usd|usdc|dollars?|bucks)\b|\bbudget\s+(?:is|of|around|about|~|is around|is about)?\s*(\d[\d,]*(?:\.\d+)?)(\s?k\b)?/gi;
    for (const m of text.matchAll(money)) {
      const value = num(m[1] ?? m[3] ?? m[5] ?? "0", m[2] ?? m[4] ?? m[6]);
      if (!(value > 0)) continue;
      const after = text.slice((m.index ?? 0) + m[0].length);
      if (PER_UNIT.test(after) || /\b(per (piece|unit|item|person)|each)\s*$/i.test(text.slice(0, m.index ?? 0))) {
        needs.budgetUnit = value;
        delete needs.budgetTotal;
      } else {
        needs.budgetTotal = value;
        delete needs.budgetUnit;
      }
      text = text.replace(m[0], " ");
    }
    text = text.replace(/\b(19|20)\d{2}\b/g, " ");
    const qty = /(?<![\d.,$₹€£])\b(\d{1,3}(?:,\d{3})+|\d+)(\s?k\b)?(?![.,]?\d)(?!\s*(?:%|percent|days?|weeks?|months?|years?|hrs?|hours?|mins?|minutes?|rs\b|inr\b|rupees?|eur|gbp|cm|mm|ml|kg|g\b|oz|inch|in\b))/i.exec(text);
    if (qty) {
      const q = num(qty[1]!, qty[2]);
      if (q >= 2) needs.quantity = q;
    }
  }
  return needs;
}

/** The order's budget per piece, from a per-piece budget or a total over the quantity. */
export function unitBudget(n: ConsultNeeds): number | undefined {
  if (n.budgetUnit) return n.budgetUnit;
  if (n.budgetTotal && n.quantity) return n.budgetTotal / n.quantity;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* recommendation                                                       */
/* ------------------------------------------------------------------ */

export interface ConsultPick {
  slug: string;
  name: string;
  unitLabel: string;
  /** One short line on why it fits. */
  reason: string;
  /** "$15.00", the lowest list unit price; null when the tiers give none. */
  fromPrice: string | null;
}

export interface Consultation {
  /** The opening line (answers a store-wide fact question first when the buyer asked one). */
  intro: string;
  picks: ConsultPick[];
  /** One or two short questions that narrow the choice down. */
  questions: string[];
  needs: ConsultNeeds;
}

/** Broad kinds of goods, used only to order and vary recommendations when the buyer named nothing. */
const KINDS: { kind: string; words: string[]; why: string }[] = [
  { kind: "apparel", words: ["t-shirt", "tshirt", "tee", "hoodie", "sweatshirt", "jersey", "polo", "jacket", "cap", "hat", "beanie", "sock"], why: "something people wear again and again" },
  { kind: "drinkware", words: ["bottle", "stanley", "tumbler", "mug", "flask", "cup"], why: "used every day, so your logo stays in sight" },
  { kind: "bags", words: ["tote", "backpack", "bag", "pouch"], why: "carries your brand wherever it goes" },
  { kind: "giveaway", words: ["sticker", "keychain", "magnet", "badge", "pin", "lanyard", "coaster", "supplies"], why: "easy to hand out in bulk" },
  { kind: "desk", words: ["notebook", "diary", "planner", "pen", "mobile", "phone", "mouse"], why: "handy at a desk or on the go" },
  { kind: "keepsake", words: ["plush", "toy", "umbrella", "slider", "footwear"], why: "a fun keepsake that stands out" },
];
const EVENTLIKE = /hackathon|conference|meetup|summit|event|festival|fest|workshop|booth|show|expo|launch|tournament|campaign|sports/;
const GIFTLIKE = /gift|onboarding|welcome|diwali|christmas|holiday|new year|birthday|wedding|anniversar|offsite|outing/;
/** Kind order and the preferred product word within a kind, per kind of occasion. */
const PREFER: Record<"event" | "gift" | "default", { kinds: string[]; first: Record<string, string[]> }> = {
  event: { kinds: ["apparel", "giveaway", "drinkware", "bags"], first: { apparel: ["tee", "t-shirt", "hoodie"], giveaway: ["sticker"] } },
  gift: { kinds: ["drinkware", "apparel", "bags", "desk"], first: { drinkware: ["stanley", "tumbler", "bottle"], apparel: ["hoodie"], bags: ["backpack"] } },
  default: { kinds: ["apparel", "drinkware", "bags", "giveaway"], first: { apparel: ["hoodie", "tee", "t-shirt"], bags: ["tote"] } },
};

function kindOfProduct(p: ConsultProduct): { kind: string; rank: number; why: string } | null {
  const text = `${p.name} ${p.unitLabel}`.toLowerCase();
  for (const k of KINDS) {
    const rank = k.words.findIndex((w) => text.includes(w));
    if (rank >= 0) return { kind: k.kind, rank, why: k.why };
  }
  return null;
}

const priceOf = (p: ConsultProduct) => {
  const n = Number((p.fromPrice ?? "").replace(/[^0-9.]/g, ""));
  return p.fromPrice && Number.isFinite(n) && n > 0 ? n : undefined;
};
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** A summary the importer wrote from the name alone ("Hoodies from Merch Onchain.") says nothing more. */
const informative = (p: ConsultProduct) => {
  const s = (p.summary ?? "").trim();
  return s && !new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(from|by)\\b`, "i").test(s) ? s : null;
};

/** One line on why a product fits: what kind of thing it is, the seller's minimum order, and the budget when it fits. */
export function pickReason(p: ConsultProduct, budget: number | undefined): string {
  const k = kindOfProduct(p);
  const parts: string[] = [];
  const own = informative(p);
  if (k) parts.push(k.why);
  else if (own) parts.push(own.replace(/[.!]+$/, "").slice(0, 90));
  else if (p.capabilities?.[0]) parts.push(p.capabilities[0]);
  const price = priceOf(p);
  if (budget && price && price <= budget) parts.push("within your budget");
  if (p.minUnits && p.minUnits > 1) parts.push(`minimum ${p.minUnits.toLocaleString("en-US")} ${unitFor(p.minUnits, p.unitLabel)}`);
  const line = parts.join("; ");
  return line ? line[0]!.toUpperCase() + line.slice(1) : "";
}

/** Store-wide facts the buyer asked about ("What is the minimum order?"), as the seller's own site states them. */
const FACT_ASKS: [GreetingFactKind, RegExp][] = [
  ["moq", /\b(moq|minimum( order| quantity)?|min\.? order|smallest order|how few)\b/i],
  ["production", /\b(production|lead[- ]time|turnaround|how long|how fast|how quick)\b/i],
  ["samples", /\bsamples?\b/i],
  ["delivery", /\b(deliver(y|ed)?|shipping|ship|arrive|dispatch)\b/i],
];

/**
 * A recommendation for an open question: two to four of the seller's products with why each fits and its "from"
 * price, plus one or two questions to narrow down. `buyerTexts`: what the buyer said in this conversation, oldest
 * first. `pointed`/`exclude`: products the router found the message pointing at, or asked to leave out.
 */
export function consult(sellerName: string, products: readonly ConsultProduct[], buyerTexts: readonly string[], opts: { pointed?: readonly string[]; exclude?: readonly string[] } = {}): Consultation {
  const needs = consultNeeds(buyerTexts);
  const latest = buyerTexts.at(-1) ?? "";
  const budget = unitBudget(needs);
  const occasion = `${needs.occasion ?? ""} ${needs.audience ?? ""}`;
  const prefer = GIFTLIKE.test(occasion) || /employees|staff|clients|customers|partners|new hires|interns/.test(occasion) ? PREFER.gift : EVENTLIKE.test(occasion) ? PREFER.event : PREFER.default;
  const exclude = new Set(opts.exclude ?? []);
  const pool = products.filter((p) => !exclude.has(p.slug));
  const within = budget ? pool.filter((p) => (priceOf(p) ?? Infinity) <= budget) : pool;
  const usable = within.length ? within : pool;

  const picks: ConsultProduct[] = [];
  const add = (p: ConsultProduct | undefined) => {
    if (p && !picks.some((x) => x.slug === p.slug) && picks.length < 4) picks.push(p);
  };
  for (const slug of opts.pointed ?? []) add(usable.find((p) => p.slug === slug));
  // Then one product of each kind, in the order that suits the occasion, so the picks cover different needs.
  const target = Math.max(3, Math.min(picks.length, 4));
  const byKind = (kind: string) =>
    usable
      .map((p, i) => ({ p, i, k: kindOfProduct(p) }))
      .filter((x) => x.k?.kind === kind)
      .sort((a, b) => {
        const first = prefer.first[kind] ?? [];
        const fa = first.findIndex((w) => `${a.p.name} ${a.p.unitLabel}`.toLowerCase().includes(w));
        const fb = first.findIndex((w) => `${b.p.name} ${b.p.unitLabel}`.toLowerCase().includes(w));
        return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb) || a.k!.rank - b.k!.rank || a.i - b.i;
      })
      .map((x) => x.p);
  for (const kind of prefer.kinds) if (picks.length < target && !picks.some((p) => kindOfProduct(p)?.kind === kind)) add(byKind(kind)[0]);
  // A catalogue the kinds do not describe (services, one-off goods): the seller's own order.
  for (const p of usable) if (picks.length < target) add(p);
  // A tight budget: cheapest first, so the closest fits lead.
  if (budget && !within.length) picks.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));

  const facts = greetingFacts(products.map((p) => ({ name: p.name, notes: p.notes ?? [] })));
  const asked = FACT_ASKS.filter(([, re]) => re.test(latest)).map(([k]) => facts.find((f) => f.kind === k)).filter((f): f is GreetingFact => Boolean(f));

  const lead = asked.length ? `${asked.map((f) => `${f.label}: ${f.text}`).join(" ")} ` : "";
  const forWhat = needs.occasion
    ? GIFTLIKE.test(needs.occasion) ? `For ${/^gift/.test(needs.occasion) ? "gifts" : needs.occasion}${needs.audience ? ` for your ${needs.audience}` : ""}` : `For your ${needs.occasion}${needs.audience ? ` and its ${needs.audience}` : ""}`
    : needs.audience ? `For your ${needs.audience}` : "";
  const fit = budget ? (within.length ? ` within about ${money(budget)} a piece` : `, closest to ${money(budget)} a piece`) : "";
  const intro = forWhat
    ? `${lead}${forWhat}, these ${sellerName} picks work well${fit}:`
    : `${lead}${asked.length ? "If you are still choosing, here" : "Happy to help you choose. Here"} are a few ${sellerName} picks to start with${fit}:`;

  const questions: string[] = [];
  if (!needs.occasion && !needs.audience) questions.push("What is it for, and who will get it (an event, your team, clients)?");
  if (!needs.quantity) questions.push("Roughly how many do you need?");
  if (!needs.budgetTotal && !needs.budgetUnit) questions.push("Do you have a budget, per piece or in total?");
  if (!needs.deadline) questions.push("When do you need them by?");
  const brandable = products.some((p) => (p.capabilities ?? []).some((c) => /brand|logo|print|custom/i.test(c)));
  if (!needs.branding && brandable) questions.push("Should they carry your logo?");

  return {
    intro,
    picks: picks.map((p) => ({ slug: p.slug, name: p.name, unitLabel: p.unitLabel, reason: pickReason(p, budget), fromPrice: p.fromPrice ?? null })),
    questions: questions.slice(0, 2),
    needs,
  };
}

/** "T-Shirts, from $6.00 a tee: something people wear again and again." */
export function pickLine(p: ConsultPick): string {
  return `${p.name}${p.fromPrice ? `, from ${p.fromPrice} a ${p.unitLabel}` : ""}${p.reason ? `: ${p.reason}` : ""}${/[.!?]$/.test(p.reason) || !p.reason ? "" : "."}`;
}

/** The recommendation as one plain-text message (stored as the agent's turn; the chat shows the picks as chips). */
export function consultText(c: Pick<Consultation, "intro" | "picks" | "questions">): string {
  const close = c.questions.length ? `To narrow it down: ${c.questions.join(" ")}` : "Tap one and I will put together exact offers.";
  return [c.intro, c.picks.map((p) => `• ${pickLine(p)}`).join("\n"), close].filter(Boolean).join("\n\n");
}

/**
 * What the buyer sends when they tap a recommended product: a quote request that carries what they already said,
 * so that product's agent can price it straight away. A per-piece budget is turned into a total only when the
 * quantity is known; otherwise it is left out, since a bare "$5" would read as the whole budget.
 */
export function pickMessage(p: Pick<ConsultPick, "name" | "unitLabel">, needs: ConsultNeeds = {}): string {
  const parts: string[] = [];
  if (needs.quantity) parts.push(`${needs.quantity.toLocaleString("en-US")} ${unitFor(needs.quantity, p.unitLabel)}`);
  const total = needs.budgetTotal ?? (needs.budgetUnit && needs.quantity ? needs.budgetUnit * needs.quantity : undefined);
  if (total) parts.push(`budget about ${money(Math.round(total * 100) / 100)}`);
  if (needs.deadline) parts.push(`needed ${/^(by|before|until|in|on|for|next|asap|urgent|rush|tomorrow)\b/i.test(needs.deadline) ? needs.deadline : `by ${needs.deadline}`}`);
  const what = !needs.occasion ? "" : /^gift/.test(needs.occasion) ? " as gifts" : GIFTLIKE.test(needs.occasion) ? ` for ${needs.occasion}` : ` for our ${needs.occasion}`;
  return `I would like a quote for ${p.name.toLowerCase()}${what}${parts.length ? `: ${parts.join(", ")}` : ""}.`;
}
