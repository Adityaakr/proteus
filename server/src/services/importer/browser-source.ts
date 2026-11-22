/**
 * Reads a site the way a shopper would, in a real browser: the homepage first, then the pages a shopper would open
 * to find products (menu and shop links, category and collection pages, client-side routes behind shop buttons,
 * "next page" links), scrolling and pressing "load more" on each. On every page it takes, in this order:
 *
 * 1. structured product data the page carries once rendered (exact, like the static sources);
 * 2. product cards and a product's own page, read from the layout: the name and the price exactly as shown;
 * 3. when nothing has a price, the project's model reads the rendered text (if one is configured), and every name and
 *    price it returns must appear in that text;
 * 4. on a site with no prices at all, the repeated list of product types it offers, with no price.
 *
 * (2) to (4) are marked for the seller to check. Prices are never guessed: a product without a visible price stays
 * "price to set".
 */
import type { DomCard, DomDetail, DomLink } from "./dom-script";
import type { PageRenderer, RenderSession } from "./browser";
import { cleanText, hintsFrom, jsonLdObjects, normPrice, productFromMeta, productsFromJsonLd, stableKey } from "./html";
import type { SiteFetcher } from "./site-fetcher";
import { PRODUCT_PATH, verifyAgainstText, type PageExtractor, type PageText } from "./sources";
import { LIMITS, type ImportProgress, type ImportedProduct, type SourceReport } from "./types";

/* ---------------------------------------------------------------- prices as shown */

const SYMBOLS: [RegExp, string][] = [
  [/₹|\bRs\.?|\bINR\b/i, "INR"],
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/¥|\bJPY\b/i, "JPY"],
  [/\bAED\b/i, "AED"],
  [/\bCHF\b/i, "CHF"],
  [/US\$|\bUSD\b/i, "USD"],
  [/\bSGD\b|S\$/i, "SGD"],
  [/\bAU\$|\bA\$|\bAUD\b/i, "AUD"],
  [/\bCA\$|\bC\$|\bCAD\b/i, "CAD"],
  [/R\$|\bBRL\b/i, "BRL"],
];

/** A "$" price on a site whose address says which dollar it is. */
const DOLLAR_BY_TLD: Record<string, string> = { au: "AUD", ca: "CAD", sg: "SGD", nz: "NZD", hk: "HKD" };

/** "₹1,299.00" → { amount: "1299.00", currency: "INR" }; "From $12" on example.com → USD. Unreadable → undefined. */
export function parseShownPrice(text: string | undefined, host: string): { amount: string; currency?: string } | undefined {
  if (!text) return undefined;
  const num = /\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d{1,2})?|\d{1,3}(?:[,.\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/.exec(text.replace(/ /g, " "))?.[0];
  const amount = normPrice(num?.replace(/\s/g, ""));
  if (!amount) return undefined;
  let currency = SYMBOLS.find(([re]) => re.test(text))?.[1];
  if (!currency && text.includes("$")) currency = DOLLAR_BY_TLD[host.split(".").pop() ?? ""] ?? "USD";
  return { amount, currency };
}

const lowest = (prices: string[], host: string) =>
  prices
    .map((p) => parseShownPrice(p, host))
    .filter((p): p is { amount: string; currency?: string } => Boolean(p))
    .sort((a, b) => Number(a.amount) - Number(b.amount))[0];

/** "T-SHIRTS" → "T-Shirts"; mixed case is kept as written. */
export function tidyName(s: string): string {
  const t = cleanText(s, 140);
  if (t !== t.toUpperCase() || !/[A-Z]{3}/.test(t)) return t;
  return t.toLowerCase().replace(/(^|[\s\-(/&])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

function httpsUrl(u: string | undefined): string | undefined {
  try {
    return u && new URL(u).protocol === "https:" ? new URL(u).toString() : undefined;
  } catch {
    return undefined;
  }
}

export function fromCard(card: DomCard, host: string, category: string | undefined): ImportedProduct | undefined {
  const name = tidyName(card.name);
  if (!name || name.length < 2) return undefined;
  const price = lowest(card.prices, host);
  const url = httpsUrl(card.url);
  return {
    key: stableKey(url, name),
    name,
    url,
    imageUrl: httpsUrl(card.imageUrl),
    category,
    price: price?.amount,
    currency: price?.currency,
    available: card.soldOut ? false : undefined,
    variants: [],
    options: [],
    hints: hintsFrom(card.extra.join(". "), 2),
    source: "page-layout",
  };
}

export function fromDetail(d: DomDetail, url: string, host: string, category: string | undefined): ImportedProduct | undefined {
  const name = tidyName(d.name);
  if (!name) return undefined;
  const price = lowest(d.prices, host);
  const description = cleanText(d.description, LIMITS.textPerField) || undefined;
  return {
    key: stableKey(url, name),
    name,
    description,
    url,
    imageUrl: httpsUrl(d.imageUrl),
    category,
    price: price?.amount,
    currency: price?.currency,
    available: d.soldOut ? false : undefined,
    variants: [],
    options: d.options.map((o) => ({ name: cleanText(o.name, 30), values: o.values.map((v) => cleanText(v, 40)).filter(Boolean).slice(0, 30) })).filter((o) => o.name && o.values.length),
    hints: description ? hintsFrom(description, 3) : [],
    source: "page-layout",
  };
}

/* ---------------------------------------------------------------- which pages to open */

const SKIP_PATH = /\/(blogs?|news|press|journal|stories|about[\w-]*|our-story|team|contact[\w-]*|log-?in|sign-?in|sign-?up|register|account|my-account|cart|basket|bag|checkout|wishlist|careers?|jobs|privacy|terms|polic(y|ies)|refunds?|returns?|shipping|faqs?|help|support|search|cdn-cgi|wp-admin|wp-login|feed|tags?|author|cookies?|legal|sitemap)(\/|$|\.)/i;
const SHOP_WORDS = /\b(shop|store|catalog|catalogue|collections?|categor(y|ies)|products?|merch|range|buy|order online|menu|all items|new arrivals|best ?sellers?|sale|apparel|accessories|gifts?|price list|pricing)\b/i;
const SHOP_PATH = /\/(shop|store|catalog|catalogue|collections?|categor(y|ies)|products|merch|range|menu|all|items|pricing|price-list)(\/|$)/i;
const PAGINATION = /[?&](page|p|pg|offset|start)=\d+|\/page\/\d+/i;
const FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|pptx?|csv)$/i;
const ELSEWHERE_HOSTS = /(^|\.)(docsend\.com|drive\.google\.com|docs\.google\.com|dropbox\.com|notion\.site|notion\.so|canva\.com|canva\.site|issuu\.com|flipsnack\.com|heyzine\.com|yumpu\.com|onedrive\.live\.com|1drv\.ms|wetransfer\.com|figma\.com|pitch\.com|gamma\.app)$/i;
const CATALOGUE_WORDS = /catalog|catalogue|price ?list|brochure|lookbook|menu|rate ?card/i;

/** The URL a crawl treats as one page: no fragment unless it is a client-side route (#/shop), no tracking tags. */
export function pageKey(raw: string): string {
  const u = new URL(raw);
  if (!/^#!?\//.test(u.hash)) u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|srsltid)/i.test(k)) u.searchParams.delete(k);
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}

/** How promising a link is for finding products; below zero means never open it. */
export function scoreLink(link: Pick<DomLink, "url" | "text" | "area">, depth: number, pageHadProducts: boolean): number {
  const u = new URL(link.url);
  const path = u.pathname + (/^#!?\//.test(u.hash) ? u.hash.slice(1) : "");
  if (FILE.test(u.pathname) || SKIP_PATH.test(path)) return -1;
  let s = 1;
  if (link.area === "nav") s += 3;
  if (link.area === "footer") s -= 1;
  if (SHOP_WORDS.test(link.text) || SHOP_PATH.test(path)) s += 6;
  if (PRODUCT_PATH.test(path)) s += pageHadProducts ? 1 : 3;
  if (PAGINATION.test(u.search + u.pathname)) s += pageHadProducts ? 6 : 1;
  return s - depth * 2;
}

/** A link to a catalogue the importer will not open: another service (DocSend, Drive) or a file. */
export function elsewhereOf(link: Pick<DomLink, "url" | "text">, sameSite: (u: URL) => boolean): { url: string; host: string; label: string } | undefined {
  let u: URL;
  try {
    u = new URL(link.url);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(u.protocol)) return undefined;
  const host = u.hostname.replace(/^www\./, "");
  const file = FILE.test(u.pathname) && /\.(pdf|docx?|xlsx?|pptx?|csv)$/i.test(u.pathname);
  if (sameSite(u) && !(file && (CATALOGUE_WORDS.test(link.text) || CATALOGUE_WORDS.test(u.pathname)))) return undefined;
  if (!sameSite(u) && !ELSEWHERE_HOSTS.test(host) && !(CATALOGUE_WORDS.test(link.text) && file)) return undefined;
  return { url: u.toString().slice(0, 300), host, label: tidyName(cleanText(link.text, 60)) || (file ? "a file" : host) };
}

/* ---------------------------------------------------------------- the crawl */

export interface BrowserReadResult {
  products: ImportedProduct[];
  reports: SourceReport[];
  /** The rendered homepage, for the brand, policies and order hints when the plain HTML is an empty app shell. */
  home?: { url: string; html: string; text: string };
  /** Pages on the site seen while reading, for the policy step. */
  links: string[];
  /** Rendered text of the pages read, for order hints. */
  pages: PageText[];
  elsewhere: { url: string; host: string; label: string }[];
  rendered: number;
  engine: string;
}

export interface BrowserReadOptions {
  extractor?: PageExtractor;
  siteName: string;
  progress: (label: string, state?: ImportProgress["state"], detail?: string) => void;
  delayMs?: number;
  maxPages?: number;
  crawlMs?: number;
}

export async function browserSource(site: SiteFetcher, renderer: PageRenderer, homeUrl: string, opts: BrowserReadOptions): Promise<BrowserReadResult> {
  const out: BrowserReadResult = { products: [], reports: [], links: [], pages: [], elsewhere: [], rendered: 0, engine: renderer.name };
  const host = new URL(homeUrl).hostname.replace(/^www\./, "");
  let session: RenderSession;
  try {
    opts.progress(`Opening ${host} in a browser`, "working", renderer.name);
    session = await renderer.open({ allowed: (u) => site.robots.allowed(u.pathname + u.search), sameSite: (u) => site.sameSite(u) });
  } catch (e) {
    out.reports.push({ source: "browser", status: "failed", detail: cleanText((e as Error).message, 200) });
    opts.progress("The browser could not start", "blocked", cleanText((e as Error).message, 160));
    return out;
  }

  const maxPages = opts.maxPages ?? LIMITS.renderedPages;
  const deadline = Date.now() + (opts.crawlMs ?? LIMITS.crawlMs);
  const queue = new Map<string, { url: string; score: number; depth: number; category?: string }>();
  const visited = new Set<string>();
  const seenLinks = new Set<string>();
  const exact: ImportedProduct[] = [];
  const layout: ImportedProduct[] = [];
  const offerings = new Map<string, string>();
  let structuredPages = 0;
  let cardPages = 0;
  let skipped = 0;
  const failures: string[] = [];

  const enqueue = (url: string, score: number, depth: number, category?: string) => {
    let key: string;
    try {
      key = pageKey(url);
    } catch {
      return;
    }
    if (visited.has(key) || !site.sameSite(new URL(key))) return;
    const prev = queue.get(key);
    if (!prev || prev.score < score) queue.set(key, { url: key, score, depth, category: category ?? prev?.category });
  };
  enqueue(homeUrl, 100, 0);

  try {
    while (queue.size && out.rendered < maxPages && Date.now() < deadline) {
      const next = [...queue.values()].sort((a, b) => b.score - a.score)[0]!;
      queue.delete(next.url);
      visited.add(next.url);
      if (next.score < 2 && out.rendered > 0) break;
      const nu = new URL(next.url);
      if (!site.robots.allowed(nu.pathname + nu.search)) {
        site.disallowed++;
        continue;
      }
      if (out.rendered > 0) await new Promise((r) => setTimeout(r, opts.delayMs ?? LIMITS.delayMs));
      const path = nu.pathname + nu.search + nu.hash;
      if (out.rendered > 0) opts.progress(`Reading pages in the browser (${out.rendered + 1} of up to ${maxPages})`, "working", path.length > 60 ? path.slice(0, 59) + "…" : path);
      const r = await session.render(next.url, { scroll: true, loadMore: true, tryShopButtons: next.depth === 0 });
      out.rendered++;
      if (!r.ok) {
        skipped++;
        if (failures.length < 3) failures.push(`${path}: ${r.why}`);
        continue;
      }
      const page = r.page;
      visited.add(pageKey(page.url));
      if (next.depth === 0) out.home = { url: page.url, html: page.html, text: page.text };
      out.pages.push({ url: page.url, text: cleanText(page.text, 12_000) });

      // 1. Structured data in the rendered page (exact).
      const ld = productsFromJsonLd(jsonLdObjects(page.html), page.url);
      const meta = ld.length ? [] : [productFromMeta(page.html, page.url)].filter((p): p is ImportedProduct => Boolean(p?.price));
      for (const p of [...ld, ...meta]) exact.push({ ...p, category: p.category ?? next.category, source: "browser", hints: p.description ? hintsFrom(p.description, 3) : [] });
      if (ld.length || meta.length) structuredPages++;

      // 2. Cards and a product's own page, read from the layout.
      const category = next.depth > 0 && page.heading && page.heading.length <= 40 && page.cards.length > 1 ? tidyName(page.heading) : next.category;
      const cards = page.cards.map((c) => fromCard(c, host, category)).filter((p): p is ImportedProduct => Boolean(p));
      const own = !ld.length && page.detail ? fromDetail(page.detail, page.url, host, next.category) : undefined;
      layout.push(...cards, ...(own ? [own] : []));
      if (cards.length || own) cardPages++;
      for (const o of page.offerings) if (!offerings.has(o.toLowerCase())) offerings.set(o.toLowerCase(), o);

      // Where to go next.
      const hadProducts = ld.length > 0 || cards.length > 1;
      for (const l of page.links) {
        const away = elsewhereOf(l, (u) => site.sameSite(u));
        if (away && !out.elsewhere.some((e) => e.url === away.url)) out.elsewhere.push(away);
        let lu: URL;
        try {
          lu = new URL(l.url);
        } catch {
          continue;
        }
        if (!site.sameSite(lu)) continue;
        seenLinks.add(lu.toString());
        const s = scoreLink(l, next.depth + 1, hadProducts);
        if (s >= 2) enqueue(l.url, s, next.depth + 1, SHOP_WORDS.test(l.text) || l.area === "nav" ? tidyName(l.text) || undefined : undefined);
      }
      if (page.nextPage && hadProducts) enqueue(page.nextPage, 20 - next.depth, next.depth, category);
      for (const route of r.routes) enqueue(route, 30, next.depth + 1);
      for (const p of r.popups) {
        const away = elsewhereOf({ url: p, text: "catalogue" }, (u) => site.sameSite(u));
        if (away && !out.elsewhere.some((e) => e.url === away.url)) out.elsewhere.push(away);
      }
      if ([...exact, ...layout].filter((p) => p.price).length >= LIMITS.products) break;
    }
  } finally {
    const stats = session.stats();
    await session.close();
    out.reports.push({
      source: "browser",
      status: out.rendered - skipped > 0 ? "used" : "failed",
      detail: `opened ${out.rendered} page${out.rendered === 1 ? "" : "s"} with ${renderer.name}${skipped ? `, ${skipped} could not be read (${failures.join("; ")})` : ""}; ${stats.requests} requests${stats.blocked ? `, ${stats.blocked} blocked (images, other sites, robots.txt)` : ""}${stats.overBudget ? "; stopped at the download limit" : ""}`,
    });
  }
  out.links = [...seenLinks];

  const dedupe = (list: ImportedProduct[]) => {
    const seen = new Map<string, ImportedProduct>();
    for (const p of list) {
      const k = (p.url ? p.url.replace(/[?#].*$/, "") + "|" : "") + p.name.toLowerCase();
      const prev = seen.get(k) ?? [...seen.values()].find((x) => x.name.toLowerCase() === p.name.toLowerCase());
      if (!prev) seen.set(k, p);
      else if (!prev.price && p.price) seen.set(k, { ...p, key: prev.key, category: prev.category ?? p.category });
      else if (!prev.options.length && p.options.length) prev.options = p.options;
    }
    return [...seen.values()];
  };

  if (exact.length) {
    out.products = dedupe(exact);
    out.reports.push({ source: "browser", status: "used", detail: `${out.products.length} products from product data on ${structuredPages} rendered page${structuredPages === 1 ? "" : "s"}`, products: out.products.length });
    // Layout cards fill in what the data lacked (products the data does not list).
    const extra = dedupe(layout).filter((p) => !out.products.some((x) => x.name.toLowerCase() === p.name.toLowerCase()));
    if (extra.length) out.products.push(...extra);
  }
  const fromLayout = dedupe(layout);
  if (!exact.length && fromLayout.length) {
    out.products = fromLayout;
    const priced = fromLayout.filter((p) => p.price).length;
    out.reports.push({ source: "page-layout", status: "used", detail: `${fromLayout.length} products read from the layout of ${cardPages} page${cardPages === 1 ? "" : "s"}${priced < fromLayout.length ? `, ${priced} with a price shown` : ""}; please check them`, products: fromLayout.length });
  }

  // 3. Nothing priced yet: the model reads the rendered text, and keeps only what the text says.
  if (!out.products.some((p) => p.price)) {
    if (!opts.extractor) out.reports.push({ source: "page-text", status: "skipped", detail: "no model is set up on this server, so the page text was not read for products" });
    else if (out.pages.length) {
      const pages = [...out.pages].sort((a, b) => priceDensity(b.text) - priceDensity(a.text)).slice(0, 5);
      opts.progress("Reading the page text for products", "working", opts.extractor.name);
      const items = await opts.extractor.extract(pages, opts.siteName).catch(() => []);
      const { products, dropped } = verifyAgainstText(items, pages, "page-text");
      out.reports.push({ source: "page-text", status: products.length ? "used" : "not-found", detail: `read the text of ${pages.length} rendered page${pages.length === 1 ? "" : "s"} with ${opts.extractor.name}; ${products.length} products confirmed in the text${dropped ? `, ${dropped} dropped as not on the page` : ""}`, products: products.length });
      if (products.length) out.products = dedupe([...products.map((p) => ({ ...p, name: tidyName(p.name) })), ...out.products]);
    }
  }

  // 4. No prices anywhere: the product types the site lists (with what the model found, if anything), with no price.
  if (!out.products.some((p) => p.price) && offerings.size) {
    const types = [...offerings.values()].map(tidyName).filter((name) => !out.products.some((p) => p.name.toLowerCase() === name.toLowerCase()));
    out.products.push(...types.slice(0, LIMITS.products - out.products.length).map((name) => ({ key: stableKey(homeUrl, name), name, variants: [], options: [], hints: [], source: "page-layout" as const })));
    out.reports.push({ source: "page-layout", status: "used", detail: `the site lists ${offerings.size} product types and shows no prices; each needs a price from you`, products: offerings.size });
  }
  if (!out.products.length) out.reports.push({ source: "page-layout", status: "not-found", detail: `no products, prices or product lists on the ${out.rendered} page${out.rendered === 1 ? "" : "s"} opened` });
  return out;
}

function priceDensity(text: string): number {
  return (text.match(/(?:₹|€|£|\$|Rs\.?|INR|USD|EUR)\s?\d/gi) ?? []).length;
}
