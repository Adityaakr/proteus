/**
 * From an imported catalog and the seller's answers to the exact inputs the product form produces (ProductCreateInput):
 * public tiers at the seller's list price, and a private floor the engine enforces as the FLOOR_PRICE rule. Nothing here
 * writes to the database; the service publishes only after the seller confirms.
 *
 * Money is integer micro-USDC (bigint). Website prices are converted at the rate the seller confirmed.
 */
import { fromMicro, pluralUnit, toMicro, type CostModel, type Micro, type Policy, type Product } from "@proteus/domain";
import type { ProductCreateInput } from "../accounts";
import { CHECK_SOURCES, type BusinessType, type ImportResult, type ImportedProduct } from "./types";

/** Per product, per category or store-wide rules. Every value is a decimal string as the seller typed it. */
export interface PriceRule {
  /** USD list price, for items the website shows without a price (or to override the converted one). */
  priceUsd?: string;
  /** Lowest USD price per unit the agent may offer. */
  floorUsd?: string;
  /** The same floor stated in the website currency; converted at the current rate whenever the draft is built. */
  floorLocal?: string;
  /** Most the agent may take off the list price, in percent. Used when no floorUsd is set. */
  maxDiscountPct?: string;
  /** Smallest order in units: the first tier's size. */
  moq?: string;
  bulkMinUnits?: string;
  bulkDiscountPct?: string;
}

export interface BuilderAnswers {
  businessName?: string;
  businessType?: BusinessType;
  tagline?: string;
  /** Website currency per 1 USD, e.g. "92.68" for INR. */
  usdRate?: string;
  /** Product key → open to deals. Products not listed follow the default (priced products in, quote-only out). */
  include: Record<string, boolean>;
  products: Record<string, PriceRule>;
  categories: Record<string, PriceRule>;
  defaults: PriceRule & { maxUnitsPerDeal?: string; approvalThresholdUsd?: string; termDays?: string };
  /** The seller has answered how low the agent may go (a 0% answer counts). */
  floorsSet?: boolean;
  bulkAnswered?: boolean;
  customOrders?: { accepted: boolean; note?: string };
}

export const emptyAnswers = (): BuilderAnswers => ({ include: {}, products: {}, categories: {}, defaults: {} });

export interface DraftItem {
  key: string;
  name: string;
  slug: string;
  category: string;
  included: boolean;
  source?: { amount: string; currency: string };
  listUsd?: Micro;
  floorUsd?: Micro;
  /** How the floor was set, for the seller: "15% below list", "your floor", "list price (no discount)". */
  floorBasis?: string;
  moq: bigint;
  bulk?: { minUnits: bigint; priceUsd: Micro };
  unitLabel: string;
  /** Read from what the page shows (layout or model), not from catalog data: the seller checks it before publishing. */
  check: boolean;
  /** Blocking: the product cannot be published until these are fixed. */
  issues: string[];
}

export interface Draft {
  items: DraftItem[];
  included: number;
  /** Included products whose rules are complete. */
  ready: number;
  /** What the seller still has to answer, in order. */
  next: Question[];
}

export type Question = "business" | "rate" | "products" | "prices" | "floors" | "bulk" | "custom";

export const MAX_PUBLISH = 40;

/* ---------------------------------------------------------------- money */

const MICRO = 1_000_000n;
const DEC = /^\d+(\.\d{1,6})?$/;
const clean = (v: string | undefined) => (v ?? "").replace(/[$,\s]/g, "");
export const isDecimal = (v: string | undefined) => DEC.test(clean(v));
const micro = (v: string) => toMicro(clean(v));

/** Percent string to basis points: "15" → 1500, "12.5" → 1250. Undefined unless 0 to 90. */
export function pctBps(v: string | undefined): bigint | undefined {
  const s = clean(v).replace(/%$/, "");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return undefined;
  const [w, f = ""] = s.split(".");
  const b = BigInt(w!) * 100n + BigInt((f + "00").slice(0, 2));
  return b <= 9000n ? b : undefined;
}

/** A website price converted at `rate` (website currency per 1 USD), rounded to cents (4 decimals under $1). */
export function convert(amount: string, rate: string): Micro | undefined {
  if (!isDecimal(amount) || !isDecimal(rate) || micro(rate) <= 0n) return undefined;
  return roundPrice((micro(amount) * MICRO) / micro(rate));
}

export function roundPrice(m: Micro): Micro {
  const step = m >= MICRO ? 10_000n : 100n;
  return ((m + step / 2n) / step) * step;
}

/** Rounded up to the same step, for prices that must never fall below an exact limit (a bulk price against the floor). */
export function roundPriceUp(m: Micro): Micro {
  const step = m >= MICRO ? 10_000n : 100n;
  return ((m + step - 1n) / step) * step;
}

/** The floor for a percent off list, rounded up so it is never below what the seller said. */
export const floorFromPct = (list: Micro, bps: bigint): Micro => (list * (10_000n - bps) + 9_999n) / 10_000n;

export const usdString = (m: Micro) => fromMicro(m, { trim: true });

/* ---------------------------------------------------------------- draft */

const UNIT_WORDS: [RegExp, string][] = [
  [/\b(t-?shirts?|tees?)\b/i, "tee"],
  [/\bpolos?\b/i, "polo"],
  [/\bhoodies?\b/i, "hoodie"],
  [/\bsweatshirts?\b/i, "sweatshirt"],
  [/\b(caps?|hats?)\b/i, "cap"],
  [/\bmugs?\b/i, "mug"],
  [/\b(bottles?|flasks?|tumblers?)\b/i, "bottle"],
  [/\bstickers?\b/i, "sticker"],
  [/\b(totes?|bags?|backpacks?)\b/i, "bag"],
  [/\bkits?\b/i, "kit"],
  [/\b(boxes|box|cartons?)\b/i, "box"],
  [/\bcards?\b/i, "card"],
  [/\b(diar(y|ies)|notebooks?|journals?)\b/i, "notebook"],
  [/\b(pins?|badges?)\b/i, "pin"],
  [/\bkeychains?\b/i, "keychain"],
  [/\bjerseys?\b/i, "jersey"],
  [/\bsoaps?\b/i, "bar"],
  [/\bcandles?\b/i, "candle"],
  [/\bumbrellas?\b/i, "umbrella"],
  [/\bmagnets?\b/i, "magnet"],
  [/\b(socks?|sliders?|slippers?|sandals?|shoes?|sneakers?|footwear)\b/i, "pair"],
  [/\b(plush(ie|y)?s?|toys?)\b/i, "toy"],
  [/\blanyards?\b/i, "lanyard"],
  [/\b(posters?|prints?)\b/i, "print"],
];

/** The unit a buyer counts in, from the product's name ("Logo Hoodie" → hoodie), else its description (a soap → bar). */
export function unitLabelFor(name: string, description?: string): string {
  return UNIT_WORDS.find(([re]) => re.test(name))?.[1] ?? (description && /\bsoaps?\b/i.test(description) ? "bar" : undefined) ?? "piece";
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product";
}

const categoryOf = (p: ImportedProduct) => (p.category?.trim() || "Other");

/** Default: products the website prices are open to deals; quote-only ones wait until the seller gives a price. */
export function isIncluded(p: ImportedProduct, a: BuilderAnswers): boolean {
  const set = a.include[p.key];
  if (set !== undefined) return set;
  return Boolean(p.price) || Boolean(a.products[p.key]?.priceUsd);
}

function rule(p: ImportedProduct, a: BuilderAnswers): PriceRule {
  const cat = a.categories[categoryOf(p)] ?? {};
  const own = a.products[p.key] ?? {};
  const pick = <K extends keyof PriceRule>(k: K) => own[k] ?? cat[k] ?? a.defaults[k];
  return { priceUsd: own.priceUsd, floorUsd: own.floorUsd, floorLocal: own.floorLocal, maxDiscountPct: own.floorUsd || own.floorLocal ? undefined : pick("maxDiscountPct"), moq: pick("moq"), bulkMinUnits: pick("bulkMinUnits"), bulkDiscountPct: pick("bulkDiscountPct") };
}

export function buildDraft(result: ImportResult, a: BuilderAnswers, takenSlugs: Set<string> = new Set()): Draft {
  const slugs = new Set(takenSlugs);
  const items: DraftItem[] = [];
  for (const p of result.products) {
    const r = rule(p, a);
    const issues: string[] = [];
    const included = isIncluded(p, a);
    let listUsd: Micro | undefined;
    if (r.priceUsd) {
      if (isDecimal(r.priceUsd) && micro(r.priceUsd) > 0n) listUsd = micro(r.priceUsd);
      else issues.push("enter the price as a USD amount above zero");
    } else if (p.price) {
      if (!p.currency) issues.push("the website does not say which currency this price is in; add the USD price");
      else if (p.currency === "USD") listUsd = micro(p.price);
      else if (a.usdRate) listUsd = convert(p.price, a.usdRate);
      else issues.push(`needs a ${p.currency}-to-USD rate`);
    } else issues.push("the website shows no price; add one or leave it out");

    let floorUsd: Micro | undefined;
    let floorBasis: string | undefined;
    if (r.floorUsd) {
      if (isDecimal(r.floorUsd) && micro(r.floorUsd) > 0n) {
        floorUsd = micro(r.floorUsd);
        floorBasis = "your floor";
      } else issues.push("enter the floor as a USD amount above zero");
    } else if (r.floorLocal) {
      const cur = p.currency ?? "website currency";
      if (!a.usdRate) issues.push(`your floor of ${r.floorLocal} ${cur} needs a ${cur}-to-USD rate`);
      else {
        floorUsd = convert(r.floorLocal, a.usdRate);
        if (floorUsd === undefined || floorUsd <= 0n) issues.push("the floor must be an amount above zero");
        else floorBasis = `your floor (${r.floorLocal} ${cur} at ${a.usdRate} per USD)`;
      }
    } else if (listUsd !== undefined) {
      const bps = r.maxDiscountPct !== undefined ? pctBps(r.maxDiscountPct) : 0n;
      if (bps === undefined) issues.push("the discount must be a percent from 0 to 90");
      else {
        floorUsd = floorFromPct(listUsd, bps);
        floorBasis = bps === 0n ? "list price (no discount)" : `${Number(bps) / 100}% below list`;
      }
    }
    if (listUsd !== undefined && floorUsd !== undefined && floorUsd > listUsd) issues.push("the floor is above the list price");

    const moq = /^\d+$/.test(clean(r.moq)) && BigInt(clean(r.moq)) > 0n ? BigInt(clean(r.moq)) : 1n;
    let bulk: DraftItem["bulk"];
    if (r.bulkMinUnits && r.bulkDiscountPct && listUsd !== undefined) {
      const min = /^\d+$/.test(clean(r.bulkMinUnits)) ? BigInt(clean(r.bulkMinUnits)) : 0n;
      const bps = pctBps(r.bulkDiscountPct);
      if (min <= moq) issues.push(`bulk needs more than the minimum order of ${moq}`);
      else if (bps === undefined || bps === 0n) issues.push("the bulk discount must be a percent from 1 to 90");
      else {
        const priceUsd = roundPriceUp((listUsd * (10_000n - bps) + 9_999n) / 10_000n);
        if (floorUsd !== undefined && priceUsd < floorUsd) issues.push("the bulk price is below the floor");
        bulk = { minUnits: min, priceUsd };
      }
    }

    let slug = slugify(p.name);
    for (let i = 2; slugs.has(slug); i++) slug = `${slugify(p.name).slice(0, 36)}-${i}`;
    if (included) slugs.add(slug);
    items.push({ key: p.key, name: p.name.slice(0, 80), slug, category: categoryOf(p), included, source: p.price && p.currency ? { amount: p.price, currency: p.currency } : undefined, listUsd, floorUsd, floorBasis, moq, bulk, unitLabel: unitLabelFor(p.name, p.description), check: CHECK_SOURCES.has(p.source), issues });
  }
  const inc = items.filter((i) => i.included);
  const next: Question[] = [];
  if (!a.businessName || !a.businessType) next.push("business");
  if (!a.usdRate && (result.products.some((p) => p.price && p.currency && p.currency !== "USD") || Object.values(a.products).some((r) => r.floorLocal))) next.push("rate");
  if (!Object.keys(a.include).length) next.push("products");
  if (inc.some((i) => i.listUsd === undefined && !i.source)) next.push("prices");
  if (!a.floorsSet) next.push("floors");
  if (!a.bulkAnswered) next.push("bulk");
  if (!a.customOrders) next.push("custom");
  return { items, included: inc.length, ready: inc.filter((i) => !i.issues.length).length, next };
}

/* ---------------------------------------------------------------- to the product form */

export const STORE_CATEGORY: Record<BusinessType, string> = { merch: "merch", apparel: "merch", packaging: "merch", food: "other", beauty: "other", home: "other", electronics: "other", services: "other", other: "other" };

export interface PublishContext {
  businessName: string;
  answers: BuilderAnswers;
  result: ImportResult;
}

export function toCreateInput(item: DraftItem, p: ImportedProduct, ctx: PublishContext): ProductCreateInput {
  if (item.listUsd === undefined || item.floorUsd === undefined || item.issues.length) throw new Error(`${item.name}: ${item.issues[0] ?? "incomplete"}`);
  const plural = pluralUnit(item.unitLabel);
  const d = ctx.answers.defaults;
  const options = p.options.filter((o) => o.values.length);
  const custom = ctx.answers.customOrders;
  const tiers = [
    { name: item.moq > 1n ? "Minimum order" : "Single", includedUnits: item.moq.toString(), unitPriceUsd: usdString(item.listUsd), includes: ["Delivery to your address", ...(custom?.accepted ? ["Your logo or artwork"] : [])] },
    ...(item.bulk ? [{ name: "Bulk", includedUnits: item.bulk.minUnits.toString(), unitPriceUsd: usdString(item.bulk.priceUsd), includes: [`${item.bulk.minUnits}+ ${plural}`, "Delivery to your address", ...(custom?.accepted ? ["Your logo or artwork"] : [])] }] : []),
  ];
  const highest = tiers.reduce((m, t) => (toMicro(t.unitPriceUsd) > m ? toMicro(t.unitPriceUsd) : m), 0n);
  // The floor is the exact limit (FLOOR_PRICE). The discount cap is set just wide enough never to refuse a price at or
  // above the floor on any tier, so the two rules cannot disagree.
  const maxDiscountBps = highest > 0n ? Number(((highest - item.floorUsd) * 10_000n + highest - 1n) / highest) : 0;
  const maxUnits = /^\d+$/.test(clean(d.maxUnitsPerDeal)) ? BigInt(clean(d.maxUnitsPerDeal)) : item.bulk ? item.bulk.minUnits * 20n : 1000n;
  const termDays = /^\d+$/.test(clean(d.termDays)) ? Math.min(365, Math.max(1, Number(clean(d.termDays)))) : 30;
  const notes = [
    ...(item.moq > 1n ? [`Minimum order ${item.moq} ${plural}.`] : []),
    ...(item.bulk ? [`${item.bulk.minUnits} or more ${plural} get the bulk price.`] : []),
    ...(custom ? [custom.accepted ? `Custom orders welcome${custom.note ? `: ${custom.note}` : ""}.` : "Sold as listed; no custom work."] : []),
    ...p.hints.slice(0, 2),
    // Store-wide facts the site states (an FAQ's lead times, samples, minimums), screened when the site was read.
    ...ctx.result.hints.filter((h) => !p.hints.includes(h)).slice(0, 4),
  ].map((n) => n.slice(0, 220));
  return {
    name: item.name,
    slug: item.slug,
    unitLabel: item.unitLabel,
    // "Jerseys (one piece)": a site may name a product type in the plural, so the unit carries the count.
    billableUnit: `${item.name.slice(0, 120)} (one ${item.unitLabel}), delivered to the buyer's address and confirmed by ${ctx.businessName.slice(0, 80)} with proof.`,
    capabilities: [
      ...options.map((o) => `${o.values.length} ${o.name.toLowerCase()}${o.values.length > 1 && !/s$/i.test(o.name) ? "s" : ""}`),
      ...(custom?.accepted ? ["Custom branding"] : []),
      "Delivery confirmed with proof",
    ].slice(0, 6),
    supportedIntegrations: [],
    tiers,
    maxUnitsPerDeal: (maxUnits < (item.bulk?.minUnits ?? item.moq) ? (item.bulk?.minUnits ?? item.moq) : maxUnits).toString(),
    termDays,
    refundPolicy: `Anything not delivered within the ${termDays}-day term can be refunded to the buyer's wallet after the term ends.`,
    cost: { variableCostPerUnitUsd: "0", directCostPerDealUsd: "0", txCostBps: 0, floorUnitPriceUsd: fromMicro(item.floorUsd) },
    policy: {
      minMarginBps: 0,
      maxDiscountBps: Math.min(10_000, maxDiscountBps),
      approvalThresholdUsd: isDecimal(d.approvalThresholdUsd) ? clean(d.approvalThresholdUsd) : "2000",
      prepaidMinimumUsd: "0",
      availableCapacityUnits: (maxUnits * 10n).toString(),
      quoteTtlSeconds: 24 * 3600,
    },
    summary: (p.description ?? `${item.name} from ${ctx.businessName}.`).slice(0, 160),
    category: STORE_CATEGORY[ctx.answers.businessType ?? "other"],
    request: {
      intro: "What you need and where it goes.",
      fields: [
        { key: "quantity", label: "Quantity", type: "number", required: true, placeholder: String(item.bulk?.minUnits ?? item.moq) },
        ...(options.length ? [{ key: "variant", label: options.map((o) => o.name).join(" and ").slice(0, 60), type: "text" as const, required: true, placeholder: options.map((o) => o.values[0]).join(", ").slice(0, 120) }] : []),
        { key: "delivery", label: "Delivery city and date", type: "text", required: true, placeholder: "City, by date" },
        ...(custom?.accepted ? [{ key: "artwork", label: "Logo or artwork", type: "file" as const, required: false, hint: "PNG, SVG or PDF, up to 512 KB" }] : []),
        { key: "notes", label: "Notes", type: "textarea", required: false },
      ],
    },
    sellerDelivered: true,
    knowledge: {
      sourceUrl: p.url,
      ...(item.source ? { listPrice: { amount: item.source.amount, currency: item.source.currency, ...(ctx.answers.usdRate && item.source.currency !== "USD" ? { usdRate: ctx.answers.usdRate } : {}) } } : {}),
      variants: p.variants.map((v) => v.name).filter((n) => n && n !== p.name).slice(0, 30),
      options: options.map((o) => ({ name: o.name, values: o.values.slice(0, 30) })),
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      category: item.category,
      notes,
      policies: ctx.result.policies.map((x) => ({ kind: x.kind, summary: x.summary.slice(0, 240), url: x.url })).slice(0, 3),
      importedAt: new Date().toISOString(),
    },
    starters: [`Price for ${(item.bulk?.minUnits ?? item.moq * 10n).toString()} ${plural}?`, ...(options.length ? [`Which ${options[0]!.name.toLowerCase()}s do you have?`] : []), "How fast can you deliver?"],
  };
}

/** The engine's view of a product before it exists, for the test negotiation. Mirrors createProduct's mapping. */
export function engineFor(input: ProductCreateInput, id: string): { product: Product; cost: CostModel; policy: Policy } {
  const product: Product = {
    id,
    slug: input.slug ?? slugify(input.name),
    name: input.name,
    billableUnit: input.billableUnit,
    unitLabel: input.unitLabel,
    supportedIntegrations: input.supportedIntegrations,
    capabilities: input.capabilities,
    tiers: input.tiers.map((t, i) => ({ id: slugify(t.name) || `tier-${i}`, name: t.name, includedUnits: BigInt(t.includedUnits), unitPrice: { num: toMicro(t.unitPriceUsd), den: 1n }, includes: t.includes })),
    maxUnitsPerDeal: BigInt(input.maxUnitsPerDeal),
    termDays: input.termDays,
    refundPolicy: input.refundPolicy,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.knowledge ? { knowledge: input.knowledge } : {}),
  };
  const cost: CostModel = { version: 1, variableCostPerUnit: toMicro(input.cost.variableCostPerUnitUsd), directCostPerDeal: toMicro(input.cost.directCostPerDealUsd), txCostBps: BigInt(input.cost.txCostBps), freshUntil: Date.now() + 30 * 86_400_000, ...(input.cost.floorUnitPriceUsd ? { floorUnitPrice: toMicro(input.cost.floorUnitPriceUsd) } : {}) };
  const policy: Policy = { version: 1, minMarginBps: BigInt(input.policy.minMarginBps), maxDiscountBps: BigInt(input.policy.maxDiscountBps), approvalThreshold: toMicro(input.policy.approvalThresholdUsd), prepaidMinimum: toMicro(input.policy.prepaidMinimumUsd), availableCapacityUnits: BigInt(input.policy.availableCapacityUnits), quoteTtlSeconds: input.policy.quoteTtlSeconds, allowNonPositiveContribution: false };
  return { product, cost, policy };
}

/* ---------------------------------------------------------------- rules from the seller's words */

/** One rule the seller stated, for all products, a category, or one product. */
export interface StatedRule extends PriceRule {
  target: { kind: "all" } | { kind: "category"; name: string } | { kind: "product"; key: string };
  include?: boolean;
}

export interface StatedAnswers {
  rules: StatedRule[];
  usdRate?: string;
  customOrders?: { accepted: boolean; note?: string };
  businessType?: BusinessType;
  /** "No bulk pricing": answers the bulk question without adding a tier. */
  noBulk?: boolean;
}

/** Applies stated rules to the answers. A floor stated for a category becomes a per-product floor in it. */
export function applyStated(a: BuilderAnswers, s: StatedAnswers, result: ImportResult): BuilderAnswers {
  const out: BuilderAnswers = { ...a, include: { ...a.include }, products: { ...a.products }, categories: { ...a.categories }, defaults: { ...a.defaults } };
  if (s.usdRate) out.usdRate = s.usdRate;
  if (s.customOrders) out.customOrders = s.customOrders;
  if (s.businessType) out.businessType = s.businessType;
  if (s.noBulk) out.bulkAnswered = true;
  for (const r of s.rules) {
    const { target, include, ...price } = r;
    const fields = Object.fromEntries(Object.entries(price).filter(([, v]) => v !== undefined)) as PriceRule;
    const inTarget = result.products.filter((p) => target.kind === "all" || (target.kind === "category" ? categoryOf(p).toLowerCase() === target.name.toLowerCase() : p.key === target.key));
    if (include !== undefined) for (const p of inTarget) out.include[p.key] = include;
    if (fields.maxDiscountPct !== undefined || fields.floorUsd !== undefined || fields.floorLocal !== undefined) out.floorsSet = true;
    if (fields.bulkMinUnits !== undefined || fields.bulkDiscountPct !== undefined) out.bulkAnswered = true;
    if (fields.floorUsd !== undefined || fields.floorLocal !== undefined || fields.priceUsd !== undefined) {
      for (const p of inTarget) {
        const own: PriceRule = { ...out.products[p.key] };
        if (fields.floorUsd !== undefined) {
          own.floorUsd = fields.floorUsd;
          delete own.floorLocal;
        }
        if (fields.floorLocal !== undefined) {
          own.floorLocal = fields.floorLocal;
          delete own.floorUsd;
        }
        if (fields.priceUsd !== undefined) own.priceUsd = fields.priceUsd;
        out.products[p.key] = own;
      }
      delete fields.floorUsd;
      delete fields.floorLocal;
      delete fields.priceUsd;
    }
    if (!Object.keys(fields).length) continue;
    if (target.kind === "all") out.defaults = { ...out.defaults, ...fields };
    else if (target.kind === "category") {
      const name = result.products.map(categoryOf).find((c) => c.toLowerCase() === target.name.toLowerCase()) ?? target.name;
      out.categories[name] = { ...out.categories[name], ...fields };
    } else out.products[target.key] = { ...out.products[target.key], ...fields };
  }
  return out;
}

const NUM = String.raw`(\d+(?:\.\d{1,2})?)`;

/**
 * Rules from plain words, without a model: "apparel 15% off", "stickers no discount", "100+ at 10% off",
 * "minimum order 25", "rate 92.5", "floor for the NFC card is 9.50", "skip packaging", "we do custom logos".
 * Every number comes from the seller's own text.
 */
export function parseStated(text: string, result: ImportResult): StatedAnswers {
  const out: StatedAnswers = { rules: [] };
  const lower = text.toLowerCase();
  const rate = new RegExp(String.raw`(?:rate(?: is| of)?|1\s*(?:usd|\$|dollar)\s*=|usd\s*=)\s*(?:₹|rs\.?|inr)?\s*${NUM}`, "i").exec(lower);
  if (rate) out.usdRate = rate[1];
  if (/\b(custom|logo|branding|print(ing)?)\b/.test(lower)) {
    if (/\b(no|not|don'?t|do not|never)\b[^.]{0,30}\b(custom|logo|branding|print)/.test(lower)) out.customOrders = { accepted: false };
    else if (/\b(yes|we do|we can|accept|welcome|available|offer)\b/.test(lower)) out.customOrders = { accepted: true, note: /\blogos?\b/.test(lower) ? "logo printing" : undefined };
  }
  const categories = [...new Set(result.products.map(categoryOf))];
  const clauses = text.split(/[;\n]|,(?!\d{3})|\.(?:\s|$)|\band\b|\bbut\b/i).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const c = clause.toLowerCase();
    const target = targetOf(c, categories, result.products);
    const r: StatedRule = { target };
    const bulk = new RegExp(String.raw`(\d+)\s*(?:\+|or more|and above|and up|units? or more|plus)[^%]{0,24}?${NUM}\s*%|bulk[^%\d]{0,20}(\d+)[^%]{0,24}?${NUM}\s*%`, "i").exec(c);
    if (bulk) {
      r.bulkMinUnits = bulk[1] ?? bulk[3];
      r.bulkDiscountPct = bulk[2] ?? bulk[4];
    } else if (/\bno (bulk|volume)\b/.test(c)) {
      out.noBulk = true;
      continue;
    } else if (/\b(no|zero|without)\s+discounts?\b|\blist price only\b|\bfull price\b|\b0\s*%/.test(c)) r.maxDiscountPct = "0";
    else {
      const pct = new RegExp(String.raw`${NUM}\s*%`).exec(c);
      if (pct && /off|lower|discount|less|below|down|go|max|up to|upto/.test(c)) r.maxDiscountPct = pct[1];
    }
    const floor = new RegExp(String.raw`(?:floor|lowest|min(?:imum)? price|(?:not|nothing|never) below|no lower than|down to)[^\d₹$]{0,20}?(₹|\brs\.?|\binr\b|\$|\busd\b)?\s*([\d,]+(?:\.\d{1,2})?)\s*(₹|rs\b|inr\b|usd\b|dollars?\b)?`, "i").exec(c);
    if (floor && !/%/.test(c.slice(floor.index, floor.index + floor[0].length + 2))) {
      const amount = floor[2]!.replace(/,/g, "");
      if ([floor[1], floor[3]].some((g) => g !== undefined && /^(₹|rs\.?|inr)$/i.test(g))) r.floorLocal = amount;
      else r.floorUsd = amount;
    }
    const moq = /(?:moq|minimum order|min(?:imum)?\.? (?:order|qty|quantity)|at least)\D{0,12}(\d+)/i.exec(c);
    if (moq) r.moq = moq[1];
    if (/\b(skip|exclude|leave out|remove|don'?t sell|do not sell|not for sale)\b/.test(c) && target.kind !== "all") r.include = false;
    if (/\b(include|add|also sell|open to deals)\b/.test(c) && target.kind !== "all") r.include = true;
    if (Object.keys(r).length > 1) out.rules.push(r);
  }
  return out;
}

function targetOf(clause: string, categories: string[], products: ImportedProduct[]): StatedRule["target"] {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
  const said = new Set(words(clause).map(stem));
  const byName = products.find((p) => clause.includes(p.name.toLowerCase()));
  if (byName) return { kind: "product", key: byName.key };
  const cat = categories.find((c) => words(c).some((w) => said.has(stem(w)) && !["and", "the", "other", "others"].includes(w)));
  if (cat) return { kind: "category", name: cat };
  const prod = products.find((p) => {
    const ws = words(p.name).filter((w) => !["custom", "the", "with", "and", "for"].includes(w));
    return ws.length >= 2 && ws.filter((w) => said.has(stem(w))).length >= 2;
  });
  if (prod) return { kind: "product", key: prod.key };
  return { kind: "all" };
}

/* ---------------------------------------------------------------- CSV */

const HEADERS: Record<string, keyof PriceRule | "id"> = {
  product: "id", name: "id", title: "id", sku: "id", key: "id", url: "id",
  floor: "floorUsd", floor_usd: "floorUsd", floor_price: "floorUsd", min_price: "floorUsd", lowest_price: "floorUsd",
  max_discount: "maxDiscountPct", max_discount_pct: "maxDiscountPct", discount: "maxDiscountPct", discount_pct: "maxDiscountPct",
  moq: "moq", min_order: "moq", minimum_order: "moq",
  bulk_min: "bulkMinUnits", bulk_units: "bulkMinUnits", bulk_min_units: "bulkMinUnits",
  bulk_discount: "bulkDiscountPct", bulk_discount_pct: "bulkDiscountPct", bulk_pct: "bulkDiscountPct",
  price: "priceUsd", price_usd: "priceUsd", list_price: "priceUsd", list_price_usd: "priceUsd",
};

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/**
 * Floors from a spreadsheet: a header row naming the product (product, name, sku or url) and any of floor (USD),
 * max_discount (%), moq, bulk_min, bulk_discount (%), price (USD). Rows match by key, URL, SKU or exact name.
 */
export function parseFloorsCsv(text: string, result: ImportResult): { rules: StatedRule[]; applied: number; unmatched: string[]; errors: string[] } {
  if (text.length > 64 * 1024) return { rules: [], applied: 0, unmatched: [], errors: ["the file is larger than 64 KB"] };
  const rows = csvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { rules: [], applied: 0, unmatched: [], errors: ["add a header row and at least one product row"] };
  const head = rows[0]!.map((h) => HEADERS[h.toLowerCase().replace(/[^a-z_]+/g, "_").replace(/^_|_$/g, "")]);
  const idCol = head.indexOf("id");
  if (idCol === -1) return { rules: [], applied: 0, unmatched: [], errors: ["one column must name the product: product, name, sku or url"] };
  const rules: StatedRule[] = [];
  const unmatched: string[] = [];
  const errors: string[] = [];
  for (const [n, row] of rows.slice(1, 501).entries()) {
    const id = (row[idCol] ?? "").trim();
    if (!id) continue;
    const lid = id.toLowerCase();
    const p = result.products.find((x) => x.key === id || x.url?.toLowerCase() === lid || x.variants.some((v) => v.sku?.toLowerCase() === lid) || x.name.toLowerCase() === lid);
    if (!p) {
      unmatched.push(id.slice(0, 80));
      continue;
    }
    const r: StatedRule = { target: { kind: "product", key: p.key } };
    head.forEach((h, i) => {
      if (!h || h === "id") return;
      const v = (row[i] ?? "").replace(/[$%\s]/g, "");
      if (!v) return;
      const usd = h === "floorUsd" || h === "priceUsd";
      const ok = h === "moq" || h === "bulkMinUnits" ? /^\d+$/.test(v) : h.endsWith("Pct") ? pctBps(v) !== undefined : isDecimal(v) && micro(v) > 0n;
      if (!ok) errors.push(`row ${n + 2}: ${rows[0]![i]} "${row[i]}" is not valid${usd ? "; enter a USD amount" : ""}`);
      else r[h] = v;
    });
    if (Object.keys(r).length > 1) rules.push(r);
  }
  return { rules, applied: rules.length, unmatched: unmatched.slice(0, 20), errors: errors.slice(0, 20) };
}
