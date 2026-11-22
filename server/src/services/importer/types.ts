/**
 * The website importer reads a seller's public catalog so the seller does not type it in. Everything here is scraped
 * from someone else's website: untrusted data, length-capped, shown to the seller, and published only after the
 * seller confirms it. Prices stay in the website's currency until the seller confirms a USDC conversion.
 */

/**
 * Where a product came from. The first four are exact (a store API or structured data the site publishes, also when
 * the browser had to render the page to see it). "page-layout" and "page-text" were read off the visible page, by
 * the layout or by a model, and are shown to the seller as "read from page text, please check".
 */
export type SourceId = "shopify" | "woocommerce" | "json-ld" | "browser" | "page-layout" | "firecrawl" | "page-text";

/** Sources whose products the seller must check: they were read from what the page shows, not from catalog data. */
export const CHECK_SOURCES: ReadonlySet<SourceId> = new Set(["page-layout", "firecrawl", "page-text"]);

export interface ImportedVariant {
  name: string;
  sku?: string;
  /** Decimal string in the product's currency. */
  price?: string;
  available?: boolean;
}

export interface ImportedProduct {
  /** Stable within one import: used to attach the seller's answers. */
  key: string;
  name: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  category?: string;
  /** Decimal string in `currency` (the lowest price when the site shows a range). Absent: the site gives no price. */
  price?: string;
  currency?: string;
  available?: boolean;
  variants: ImportedVariant[];
  options: { name: string; values: string[] }[];
  /** Minimum order, bulk, custom-order and lead-time lines found next to the product. */
  hints: string[];
  source: SourceId;
}

export interface ImportedBrand {
  name?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  website: string;
  socials: { x?: string; instagram?: string; farcaster?: string };
}

export interface ImportedPolicy {
  kind: "shipping" | "returns" | "terms" | "custom-orders" | "faq";
  url: string;
  /** Plain-text excerpt, at most 600 characters. */
  summary: string;
}

export interface SourceReport {
  source: SourceId | "robots" | "sitemap" | "policies";
  status: "used" | "not-found" | "skipped" | "failed" | "blocked";
  detail: string;
  products?: number;
}

export interface ImportProgress {
  at: string;
  label: string;
  state: "done" | "working" | "blocked";
  detail?: string;
}

export interface ImportResult {
  site: { url: string; host: string; platform: string };
  brand: ImportedBrand;
  products: ImportedProduct[];
  policies: ImportedPolicy[];
  /** Store-wide lines about minimum orders, bulk, custom work and delivery. */
  hints: string[];
  /** Business type guessed from categories and words on the site; the seller confirms it. */
  businessType: { guess: BusinessType; reason: string };
  sources: SourceReport[];
  pagesFetched: number;
  /** Set when a cap stopped the read early. */
  limited?: string;
  /**
   * Product pages a time, byte or request budget kept this read from, in reading order. The seller can continue the
   * read from here; `total` is how many product pages the site lists.
   */
  unread?: { urls: string[]; total: number; stoppedBy?: string };
  /** Catalogues the site points to on another service (DocSend, Google Drive, a PDF) that the importer does not open. */
  elsewhere?: { url: string; host: string; label: string }[];
  /** Set when pages were opened in a browser. */
  browser?: { engine: string; pages: number };
}

export type BusinessType = "merch" | "apparel" | "packaging" | "food" | "beauty" | "home" | "electronics" | "services" | "other";

export const LIMITS = {
  /** Product pages read through the structured-data source: a whole catalogue of a few hundred products. */
  productPages: 400,
  /** Reading product pages in one go stops after this long; the seller can continue the read. */
  productPagesMs: 180_000,
  /** And after this many bytes of product pages. */
  productPageBytes: 160 * 1024 * 1024,
  /** Every request in one import, including robots.txt and sitemaps. */
  totalRequests: 480,
  /** Requests kept back from the product pages for the policy pages and the logo that follow them. */
  reservedRequests: 16,
  /** Products kept from any source. */
  products: 400,
  bytesPerResponse: 2 * 1024 * 1024,
  /** Pages opened in the browser in one import (home, shop and category pages, next pages, product pages). */
  renderedPages: 24,
  /** The whole browser read, after which the products found so far are kept. */
  crawlMs: 150_000,
  /** One page: load, scroll and "load more". */
  renderMs: 20_000,
  /** Requests the browser may make in one import (scripts, data calls). */
  renderRequests: 4_000,
  /** Bytes in and out of the browser in one import. */
  renderBytes: 60 * 1024 * 1024,
  renderTextChars: 30_000,
  /** Pause between two requests to the seller's site. */
  delayMs: 400,
  textPerField: 600,
} as const;
