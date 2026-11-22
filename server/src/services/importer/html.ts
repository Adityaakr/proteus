/**
 * Pure parsing of untrusted pages: JSON-LD, meta tags, links, visible text and sitemaps. No network. Every string that
 * leaves here is plain text (markup stripped, entities decoded, control characters removed) and length-capped.
 */
import { createHash } from "node:crypto";
import { LIMITS, type ImportedProduct, type ImportedVariant } from "./types";

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", rupee: "₹", euro: "€", pound: "£", copy: "©", reg: "®", trade: "™" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Markup-free, single-spaced, without control characters, at most `max` characters. */
export function cleanText(s: unknown, max: number = LIMITS.textPerField): string {
  if (typeof s !== "string") return "";
  const t = decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export function visibleText(html: string, max = 20_000): string {
  const body = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");
  return cleanText(body, max);
}

export function titleOf(html: string): string {
  return cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "", 200);
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) out[m[1]!.toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

/** meta property/name → content, first occurrence wins. */
export function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const k = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (k && a.content !== undefined && !(k in out)) out[k] = a.content;
  }
  return out;
}

export function linksOf(html: string, base: string): { url: string; text: string; rel: string }[] {
  const out: { url: string; text: string; rel: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = attrs(m[1]!);
    if (!a.href || a.href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(a.href)) continue;
    try {
      out.push({ url: new URL(a.href, base).toString().replace(/#.*$/, ""), text: cleanText(m[2]!, 80), rel: a.rel ?? "" });
    } catch {
      /* not a URL */
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (!a.href) continue;
    try {
      out.push({ url: new URL(a.href, base).toString(), text: "", rel: (a.rel ?? "").toLowerCase() });
    } catch {
      /* not a URL */
    }
  }
  return out;
}

/** Every JSON-LD object on the page, with @graph and arrays flattened. Malformed blocks are skipped. */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (Array.isArray(o["@graph"])) push(o["@graph"]);
      out.push(o);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      push(JSON.parse(m[1]!.trim()));
    } catch {
      /* skip */
    }
    if (out.length > 200) break;
  }
  return out;
}

export function typeIs(o: Record<string, unknown>, t: string): boolean {
  const v = o["@type"];
  return Array.isArray(v) ? v.some((x) => String(x).toLowerCase() === t.toLowerCase()) : String(v ?? "").toLowerCase() === t.toLowerCase();
}

export function sitemapLocs(xml: string): { urls: string[]; isIndex: boolean } {
  const urls = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]!.trim())).filter((u) => /^https:\/\//i.test(u));
  return { urls: urls.slice(0, 5000), isIndex: /<sitemapindex\b/i.test(xml) };
}

/** "1,050.00", "₹ 1050", 1050 → "1050.00" style plain decimal; zero, negative or unreadable → undefined. */
export function normPrice(v: unknown): string | undefined {
  let s: string;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return undefined;
    s = v.toFixed(6).replace(/\.?0+$/, "");
  } else if (typeof v === "string") {
    s = v.replace(/[^\d.,]/g, "");
    // "1.050,00" (comma decimals) vs "1,050.00": the last separator with 1-2 digits after it is the decimal point.
    const m = /^(.*?)[.,](\d{1,2})$/.exec(s);
    s = m ? `${m[1]!.replace(/[.,]/g, "")}.${m[2]}` : s.replace(/[.,]/g, "");
  } else return undefined;
  if (!/^\d+(\.\d+)?$/.test(s) || Number(s) <= 0) return undefined;
  return s.replace(/^0+(?=\d)/, "");
}

export function stableKey(...parts: (string | undefined)[]): string {
  return "p_" + createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 12);
}

function firstUrl(v: unknown, base: string): string | undefined {
  const pick = (x: unknown): string | undefined => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object") return pick((x as Record<string, unknown>).url ?? (x as Record<string, unknown>).contentUrl);
    return undefined;
  };
  const raw = Array.isArray(v) ? v.map(pick).find(Boolean) : pick(v);
  if (!raw) return undefined;
  try {
    const u = new URL(raw, base);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown, max = 140) => cleanText(typeof v === "number" ? String(v) : v, max);

interface OfferInfo {
  price?: string;
  currency?: string;
  available?: boolean;
  name?: string;
  sku?: string;
}

function offersOf(o: Record<string, unknown>): OfferInfo[] {
  const out: OfferInfo[] = [];
  for (const raw of asArray(o.offers)) {
    if (!raw || typeof raw !== "object") continue;
    const off = raw as Record<string, unknown>;
    const spec = (asArray(off.priceSpecification)[0] ?? {}) as Record<string, unknown>;
    const currency = str(off.priceCurrency ?? spec.priceCurrency, 3).toUpperCase() || undefined;
    const availability = String(off.availability ?? "");
    const available = availability ? /InStock|LimitedAvailability|PreOrder|OnlineOnly/i.test(availability) : undefined;
    if (typeIs(off, "AggregateOffer")) {
      const inner = offersOf(off);
      if (inner.length) out.push(...inner.map((i) => ({ ...i, currency: i.currency ?? currency })));
      else out.push({ price: normPrice(off.lowPrice ?? off.price), currency, available });
      continue;
    }
    out.push({ price: normPrice(off.price ?? spec.price), currency, available, name: str(off.name) || undefined, sku: str(off.sku, 64) || undefined });
  }
  return out;
}

function optionValues(o: Record<string, unknown>, key: string): string[] {
  return asArray(o[key]).map((v) => str(typeof v === "object" && v ? (v as Record<string, unknown>).name : v, 40)).filter(Boolean);
}

/** Products from schema.org Product / ProductGroup objects on one page. */
export function productsFromJsonLd(objects: Record<string, unknown>[], pageUrl: string): ImportedProduct[] {
  const out: ImportedProduct[] = [];
  const variantIds = new Set<unknown>();
  for (const g of objects.filter((o) => typeIs(o, "ProductGroup"))) for (const v of asArray(g.hasVariant)) variantIds.add(v);
  for (const o of objects) {
    const group = typeIs(o, "ProductGroup");
    if (!group && !typeIs(o, "Product")) continue;
    if (variantIds.has(o)) continue;
    const name = str(o.name);
    if (!name) continue;
    const variants: ImportedVariant[] = [];
    const colors = new Set(optionValues(o, "color"));
    const sizes = new Set(optionValues(o, "size"));
    let offers = offersOf(o);
    if (group) {
      for (const raw of asArray(o.hasVariant)) {
        if (!raw || typeof raw !== "object") continue;
        const v = raw as Record<string, unknown>;
        const vo = offersOf(v);
        optionValues(v, "color").forEach((c) => colors.add(c));
        optionValues(v, "size").forEach((s) => sizes.add(s));
        variants.push({ name: str(v.name) || name, sku: str(v.sku, 64) || undefined, price: vo[0]?.price, available: vo[0]?.available });
        offers = offers.concat(vo);
      }
    } else if (offers.length > 1) {
      for (const off of offers) variants.push({ name: off.name ?? off.sku ?? name, sku: off.sku, price: off.price, available: off.available });
    }
    const priced = offers.filter((x) => x.price);
    const lowest = priced.sort((a, b) => Number(a.price) - Number(b.price))[0];
    const url = firstUrl(o.url, pageUrl) ?? pageUrl;
    const category = str(asArray(o.category)[0], 60) || undefined;
    const options = [colors.size ? { name: "Colour", values: [...colors].slice(0, 30) } : null, sizes.size ? { name: "Size", values: [...sizes].slice(0, 30) } : null].filter((x): x is { name: string; values: string[] } => Boolean(x));
    out.push({
      key: stableKey(url, name),
      name,
      description: str(o.description, LIMITS.textPerField) || undefined,
      url,
      imageUrl: firstUrl(o.image, pageUrl),
      category,
      price: lowest?.price,
      currency: lowest?.currency ?? offers.find((x) => x.currency)?.currency,
      available: offers.some((x) => x.available === true) ? true : offers.length && offers.every((x) => x.available === false) ? false : undefined,
      variants: variants.slice(0, 30),
      options,
      hints: [],
      source: "json-ld",
    });
  }
  return out;
}

/** A product from Open Graph product tags, when a page has no JSON-LD. */
export function productFromMeta(html: string, pageUrl: string): ImportedProduct | undefined {
  const m = metaTags(html);
  const isProduct = (m["og:type"] ?? "").toLowerCase().includes("product") || Boolean(m["product:price:amount"] ?? m["og:price:amount"]);
  const name = str(m["og:title"] ?? titleOf(html));
  if (!isProduct || !name) return undefined;
  return {
    key: stableKey(pageUrl, name),
    name,
    description: str(m["og:description"] ?? m.description, LIMITS.textPerField) || undefined,
    url: pageUrl,
    imageUrl: firstUrl(m["og:image"], pageUrl),
    price: normPrice(m["product:price:amount"] ?? m["og:price:amount"]),
    currency: (m["product:price:currency"] ?? m["og:price:currency"] ?? "").toUpperCase().slice(0, 3) || undefined,
    variants: [],
    options: [],
    hints: [],
    source: "json-ld",
  };
}

const HINT_RE = /\bMOQ\b|\bsamples?\b|\b\d+\s*(?:[-–]|to)\s*\d+\s*(?:working |business )?days\b|minimum order|min\.? order|minimum quantity|\bbulk\b|wholesale|custom(?:i[sz]ed|i[sz]able)? (?:order|print|logo|branding)|made to order|lead time|dispatch(?:es|ed)? (?:in|within)|ships? (?:in|within)|deliver(?:y|ed)? (?:in|within)|request a quote/i;

/**
 * Short sentences about minimum orders, bulk, custom work and delivery times, deduplicated. Only real sentences count:
 * a run of menu labels has no full stop and is longer than any sentence, so it is skipped.
 */
export function hintsFrom(text: string, max = 6): string[] {
  const out: string[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const line = cleanText(raw, 400);
    // A question on its own ("What's the MOQ?") is not a fact; faqHints pairs it with its answer.
    if (line.length < 12 || line.length > 220 || line.endsWith("?") || !HINT_RE.test(line)) continue;
    // A list of search keywords ("handmade soap wholesale, natural soap brands, ...") is not an order fact.
    const parts = line.split(",").filter((x) => x.trim());
    if (parts.length >= 3 && parts.every((x) => x.trim().split(/\s+/).length <= 5)) continue;
    const norm = line.toLowerCase();
    if (out.some((x) => x.toLowerCase() === norm)) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

const SOCIAL: [keyof { x: 1; instagram: 1; farcaster: 1 }, RegExp][] = [
  ["x", /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,30}\/?$/i],
  ["instagram", /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{1,40}\/?$/i],
  ["farcaster", /^https:\/\/(www\.)?(farcaster\.xyz|warpcast\.com)\/[A-Za-z0-9_.-]{1,40}\/?$/i],
];

export function socialLinks(links: { url: string }[]): { x?: string; instagram?: string; farcaster?: string } {
  const out: { x?: string; instagram?: string; farcaster?: string } = {};
  for (const l of links) {
    // Share links carry tracking tags ("?s=21&t=..."): the profile is the path.
    const bare = l.url.replace(/[?#].*$/, "");
    for (const [k, re] of SOCIAL) if (!out[k] && re.test(bare)) out[k] = bare.replace(/\/$/, "");
  }
  return out;
}

/**
 * An FAQ written as a question line followed by its answer ("What's the MOQ?" / "Usually starts at 50 pieces") reads
 * as one line, so an order fact keeps its question. Only pairs about orders, samples or lead times are kept.
 */
export function faqHints(text: string, max = 6): string[] {
  const lines = text.split(/\n+/).map((l) => cleanText(l, 300)).filter((l) => l && !/^[+\-–×✕›‹⌄∨]$/.test(l));
  const out: string[] = [];
  for (let i = 0; i < lines.length - 1 && out.length < max; i++) {
    const q = lines[i]!;
    const a = lines[i + 1]!;
    if (!q.endsWith("?") || q.length > 120 || a.endsWith("?") || a.length < 3) continue;
    const line = `${q} ${a}`;
    if (line.length <= 220 && HINT_RE.test(line) && !out.some((x) => x.toLowerCase() === line.toLowerCase())) out.push(line);
  }
  return out;
}
