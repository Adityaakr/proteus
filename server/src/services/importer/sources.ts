/**
 * The source chain, tried in order until one yields products: the platform's own public catalog API (Shopify,
 * WooCommerce), then schema.org structured data on product pages found through the sitemap, then (optional) a
 * rendered-page provider, then the page text read by a model. Each source says what it tried and why it stopped.
 */
import { cleanText, hintsFrom, jsonLdObjects, linksOf, normPrice, productFromMeta, productsFromJsonLd, sitemapLocs, stableKey, visibleText } from "./html";
import type { SiteFetcher } from "./site-fetcher";
import { LIMITS, type ImportedProduct, type SourceReport } from "./types";

export interface SourceOutcome {
  products: ImportedProduct[];
  report: SourceReport;
  /** Pages whose text a later source may reuse. */
  pages?: { url: string; html: string }[];
}

export const PRODUCT_PATH = /\/(products?|p|item|items|shop\/[^/]+\/[^/]+|store\/[^/]+)\/[^/?#]{2,}/i;

const isJson = (ct: string, body: string) => /json/i.test(ct) || /^\s*[[{]/.test(body);
const safeJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/* ---------------------------------------------------------------- Shopify */

/** Shopify's public storefront catalog: /products.json. Currency comes from the theme's Shopify.currency object. */
export async function shopifySource(site: SiteFetcher, homepage: string): Promise<SourceOutcome> {
  const currency = /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(homepage)?.[1] ?? /"currencyCode"\s*:\s*"([A-Z]{3})"/.exec(homepage)?.[1];
  const products: ImportedProduct[] = [];
  for (let page = 1; page <= 2; page++) {
    const { res, why } = await site.get(`/products.json?limit=250&page=${page}`, { accept: "application/json" });
    if (!res) return { products, report: { source: "shopify", status: page === 1 ? "skipped" : "used", detail: page === 1 ? `products.json not read: ${why}` : `read ${products.length} products`, products: products.length } };
    const data = res.status === 200 && isJson(res.contentType, res.body) ? (safeJson(res.body) as { products?: unknown[] } | undefined) : undefined;
    if (!data || !Array.isArray(data.products)) {
      if (page === 1) return { products, report: { source: "shopify", status: "not-found", detail: `not a Shopify store (products.json answered HTTP ${res.status})` } };
      break;
    }
    for (const raw of data.products) {
      const p = raw as Record<string, unknown>;
      const name = cleanText(p.title, 140);
      if (!name) continue;
      const variants = (Array.isArray(p.variants) ? p.variants : []) as Record<string, unknown>[];
      const prices = variants.map((v) => normPrice(v.price)).filter((x): x is string => Boolean(x));
      const options = ((Array.isArray(p.options) ? p.options : []) as Record<string, unknown>[])
        .map((o) => ({ name: cleanText(o.name, 30), values: (Array.isArray(o.values) ? o.values : []).map((v) => cleanText(v, 40)).filter(Boolean).slice(0, 30) }))
        .filter((o) => o.name && o.values.length && !(o.values.length === 1 && /default title/i.test(o.values[0]!)));
      const handle = cleanText(p.handle, 120);
      const url = handle ? new URL(`/products/${encodeURIComponent(handle)}`, site.origin).toString() : undefined;
      const image = ((Array.isArray(p.images) ? p.images : []) as Record<string, unknown>[])[0]?.src;
      const description = cleanText(p.body_html, LIMITS.textPerField) || undefined;
      products.push({
        key: stableKey(url, name),
        name,
        description,
        url,
        imageUrl: typeof image === "string" && image.startsWith("https://") ? image : undefined,
        category: cleanText(p.product_type, 60) || undefined,
        price: prices.sort((a, b) => Number(a) - Number(b))[0],
        currency,
        available: variants.some((v) => v.available === true) ? true : variants.length ? false : undefined,
        variants: variants.slice(0, 30).map((v) => ({ name: cleanText(v.title, 80) || name, sku: cleanText(v.sku, 64) || undefined, price: normPrice(v.price), available: typeof v.available === "boolean" ? v.available : undefined })),
        options,
        hints: description ? hintsFrom(description, 3) : [],
        source: "shopify",
      });
      if (products.length >= LIMITS.products) break;
    }
    if (data.products.length < 250 || products.length >= LIMITS.products) break;
  }
  return { products, report: { source: "shopify", status: products.length ? "used" : "not-found", detail: products.length ? `read ${products.length} products from products.json${currency ? ` (${currency})` : ", currency not stated"}` : "products.json has no products", products: products.length } };
}

/* ---------------------------------------------------------------- WooCommerce */

/** WooCommerce Store API (public, no key): /wp-json/wc/store/v1/products. Prices arrive in minor units. */
export async function wooSource(site: SiteFetcher, homepage: string): Promise<SourceOutcome> {
  if (!/wp-content|woocommerce|wp-json/i.test(homepage)) return { products: [], report: { source: "woocommerce", status: "skipped", detail: "no WordPress or WooCommerce markers on the homepage" } };
  const { res, why } = await site.get("/wp-json/wc/store/v1/products?per_page=100", { accept: "application/json" });
  if (!res) return { products: [], report: { source: "woocommerce", status: "skipped", detail: `Store API not read: ${why}` } };
  const data = res.status === 200 && isJson(res.contentType, res.body) ? safeJson(res.body) : undefined;
  if (!Array.isArray(data)) return { products: [], report: { source: "woocommerce", status: "not-found", detail: `WooCommerce Store API answered HTTP ${res.status}` } };
  const products: ImportedProduct[] = [];
  for (const raw of data.slice(0, LIMITS.products)) {
    const p = raw as Record<string, unknown>;
    const name = cleanText(p.name, 140);
    if (!name) continue;
    const prices = (p.prices ?? {}) as Record<string, unknown>;
    const minor = Number(prices.currency_minor_unit ?? 2);
    const amount = typeof prices.price === "string" && /^\d+$/.test(prices.price) && Number.isInteger(minor) && minor >= 0 && minor <= 4 ? (Number(prices.price) / 10 ** minor).toFixed(minor) : undefined;
    const url = typeof p.permalink === "string" && p.permalink.startsWith("https://") ? p.permalink : undefined;
    const image = ((Array.isArray(p.images) ? p.images : []) as Record<string, unknown>[])[0]?.src;
    const attrs = ((Array.isArray(p.attributes) ? p.attributes : []) as Record<string, unknown>[]).map((a) => ({ name: cleanText(a.name, 30), values: ((Array.isArray(a.terms) ? a.terms : []) as Record<string, unknown>[]).map((t) => cleanText(t.name, 40)).filter(Boolean).slice(0, 30) })).filter((a) => a.name && a.values.length);
    const description = cleanText(p.short_description ?? p.description, LIMITS.textPerField) || undefined;
    products.push({
      key: stableKey(url, name),
      name,
      description,
      url,
      imageUrl: typeof image === "string" && image.startsWith("https://") ? image : undefined,
      category: cleanText(((Array.isArray(p.categories) ? p.categories : []) as Record<string, unknown>[])[0]?.name, 60) || undefined,
      price: normPrice(amount),
      currency: cleanText(prices.currency_code, 3).toUpperCase() || undefined,
      available: typeof p.is_in_stock === "boolean" ? p.is_in_stock : undefined,
      variants: [],
      options: attrs,
      hints: description ? hintsFrom(description, 3) : [],
      source: "woocommerce",
    });
  }
  return { products, report: { source: "woocommerce", status: products.length ? "used" : "not-found", detail: products.length ? `read ${products.length} products from the WooCommerce Store API` : "the Store API has no products", products: products.length } };
}

/* ---------------------------------------------------------------- structured data */

const CATALOG_PATH = /\/(shop|store|catalog|catalogue|collections?|categor(y|ies)|products)(\/|$)/i;

/** Product URLs from the sitemap (following a sitemap index), else product-looking links on the homepage. */
async function productUrls(site: SiteFetcher, homepage: string): Promise<{ urls: string[]; all: string[]; report: SourceReport }> {
  const listed = site.robots.sitemaps.filter((u) => /^https:\/\//i.test(u));
  const candidates = listed.length ? listed.slice(0, 3) : ["/sitemap.xml", "/sitemap_index.xml"];
  const found: string[] = [];
  let read = 0;
  const queue = [...candidates];
  while (queue.length && read < 6) {
    const next = queue.shift()!;
    const { res } = await site.get(next, { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
    if (!res || res.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(res.body)) continue;
    read++;
    const { urls, isIndex } = sitemapLocs(res.body);
    if (isIndex) queue.push(...urls.sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a))).slice(0, 4));
    else found.push(...urls);
  }
  // Plain /products/<x> pages first: they are the most likely to carry one product's structured data.
  let urls = found.filter((u) => PRODUCT_PATH.test(new URL(u).pathname)).sort((a, b) => Number(/\/products?\//i.test(new URL(b).pathname)) - Number(/\/products?\//i.test(new URL(a).pathname)));
  let detail = read ? `sitemap lists ${found.length} pages, ${urls.length} look like products` : "no sitemap";
  if (!urls.length) {
    urls = linksOf(homepage, site.origin.toString()).map((l) => l.url).filter((u) => PRODUCT_PATH.test(new URL(u).pathname));
    detail += urls.length ? `; ${urls.length} product links on the homepage` : "; no product links on the homepage";
  }
  urls = [...new Set(urls)].filter((u) => site.sameSite(new URL(u)));
  return { urls, all: found, report: { source: "sitemap", status: urls.length ? "used" : "not-found", detail } };
}

export async function structuredSource(site: SiteFetcher, homepage: string, homeUrl: string, onPage?: (n: number, of: number) => void): Promise<SourceOutcome & { sitemap: SourceReport; siteUrls: string[] }> {
  const fromHome = productsFromJsonLd(jsonLdObjects(homepage), homeUrl);
  const { urls, all, report: sitemap } = await productUrls(site, homepage);
  const products: ImportedProduct[] = [...fromHome];
  const pages: { url: string; html: string }[] = [];
  const take = urls.slice(0, LIMITS.productPages);
  let withData = 0;
  let skipped = 0;
  for (let i = 0; i < take.length; i++) {
    onPage?.(i + 1, take.length);
    const { res } = await site.get(take[i]!);
    if (!res || res.status !== 200 || !/html/i.test(res.contentType)) {
      skipped++;
      continue;
    }
    pages.push({ url: res.url, html: res.body });
    const found = productsFromJsonLd(jsonLdObjects(res.body), res.url);
    const one = found.length ? found : [productFromMeta(res.body, res.url)].filter((p): p is ImportedProduct => Boolean(p));
    if (one.length) withData++;
    for (const p of one) p.hints = p.description ? hintsFrom(p.description, 3) : [];
    products.push(...one);
    if (products.length >= LIMITS.products) break;
  }
  const more = urls.length > take.length ? ` (the first ${take.length} of ${urls.length})` : "";
  return {
    products,
    pages,
    sitemap,
    siteUrls: all,
    report: {
      source: "json-ld",
      status: products.length ? "used" : take.length ? "not-found" : "skipped",
      detail: take.length ? `read ${take.length} product pages${more}: ${withData} carry product data${skipped ? `, ${skipped} could not be read` : ""}` : "no product pages to read",
      products: products.length,
    },
  };
}

/** Catalog-looking pages linked from the homepage, for the text sources. */
export function catalogLinks(site: SiteFetcher, homepage: string, max = 3): string[] {
  const links = linksOf(homepage, site.origin.toString()).filter((l) => site.sameSite(new URL(l.url)));
  const ranked = links.filter((l) => CATALOG_PATH.test(new URL(l.url).pathname) || /shop|catalog|products|collection|merch|store/i.test(l.text));
  return [...new Set(ranked.map((l) => l.url))].slice(0, max);
}

/* ---------------------------------------------------------------- page text (model) */

export interface PageText {
  url: string;
  text: string;
}

/** A model that lists products from page text. The text is untrusted; results are checked against it. */
export interface PageExtractor {
  readonly name: string;
  extract(pages: PageText[], siteName: string): Promise<{ name: string; price?: string; currency?: string; category?: string; description?: string; url?: string }[]>;
}

/** A rendered-page provider (Firecrawl) for sites whose catalog only appears after JavaScript runs. */
export interface RenderedPages {
  readonly name: string;
  markdown(url: string): Promise<string | undefined>;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹$€£]+/g, " ").trim();

/**
 * Keeps only what the page text actually says: the product name must appear in the text, and so must its price's
 * digits. A model that invents a product or a price (or follows an instruction planted in the page) gets dropped here.
 */
export function verifyAgainstText(items: Awaited<ReturnType<PageExtractor["extract"]>>, pages: PageText[], source: "page-text" | "firecrawl"): { products: ImportedProduct[]; dropped: number } {
  const corpus = squash(pages.map((p) => p.text).join(" \n "));
  const digits = pages.map((p) => p.text).join(" ").replace(/[,\s]/g, "");
  const products: ImportedProduct[] = [];
  let dropped = 0;
  for (const it of items.slice(0, LIMITS.products)) {
    const name = cleanText(it.name, 140);
    if (!name || !corpus.includes(squash(name))) {
      dropped++;
      continue;
    }
    let price = normPrice(it.price);
    if (price && !digits.includes(price.replace(/\.0+$/, ""))) price = undefined;
    const url = (() => {
      try {
        return it.url && new URL(it.url).protocol === "https:" ? new URL(it.url).toString() : undefined;
      } catch {
        return undefined;
      }
    })();
    const description = cleanText(it.description, LIMITS.textPerField) || undefined;
    products.push({ key: stableKey(url, name), name, description, url, category: cleanText(it.category, 60) || undefined, price, currency: price ? cleanText(it.currency, 3).toUpperCase() || undefined : undefined, variants: [], options: [], hints: description ? hintsFrom(description, 3) : [], source });
  }
  return { products, dropped };
}

export async function pageTextSource(site: SiteFetcher, homepage: string, homeUrl: string, extractor: PageExtractor | undefined, siteName: string, rendered?: RenderedPages): Promise<SourceOutcome[]> {
  const out: SourceOutcome[] = [];
  const targets = [homeUrl, ...catalogLinks(site, homepage)];
  if (rendered) {
    if (!extractor) out.push({ products: [], report: { source: "firecrawl", status: "skipped", detail: "a rendering provider is set but no model is configured to read its output" } });
    else {
      const pages: PageText[] = [];
      for (const u of targets.slice(0, 3)) {
        if (!site.robots.allowed(new URL(u).pathname)) continue;
        const md = await rendered.markdown(u).catch(() => undefined);
        if (md) pages.push({ url: u, text: cleanText(md, 12_000) });
      }
      const items = pages.length ? await extractor.extract(pages, siteName).catch(() => []) : [];
      const { products, dropped } = verifyAgainstText(items, pages, "firecrawl");
      out.push({ products, report: { source: "firecrawl", status: products.length ? "used" : pages.length ? "not-found" : "failed", detail: pages.length ? `rendered ${pages.length} pages with ${rendered.name}; ${products.length} products confirmed in the text${dropped ? `, ${dropped} dropped as not on the page` : ""}` : `${rendered.name} returned nothing`, products: products.length } });
      if (products.length) return out;
    }
  }
  if (!extractor) {
    out.push({ products: [], report: { source: "page-text", status: "skipped", detail: "no model is configured, so page text is not read for products" } });
    return out;
  }
  const pages: PageText[] = [{ url: homeUrl, text: visibleText(homepage, 12_000) }];
  for (const u of targets.slice(1)) {
    const { res } = await site.get(u);
    if (res?.status === 200 && /html/i.test(res.contentType)) pages.push({ url: res.url, text: visibleText(res.body, 12_000) });
  }
  const items = await extractor.extract(pages, siteName).catch(() => []);
  const { products, dropped } = verifyAgainstText(items, pages, "page-text");
  out.push({ products, report: { source: "page-text", status: products.length ? "used" : "not-found", detail: `read the text of ${pages.length} page${pages.length > 1 ? "s" : ""} with ${extractor.name}; ${products.length} products confirmed in the text${dropped ? `, ${dropped} dropped as not on the page` : ""}`, products: products.length } });
  return out;
}
