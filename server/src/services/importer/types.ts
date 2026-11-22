/**
 * The website importer reads a seller's public catalog so the seller does not type it in. Everything here is scraped
 * from someone else's website: untrusted data, length-capped, shown to the seller, and published only after the
 * seller confirms it. Prices stay in the website's currency until the seller confirms a USDC conversion.
 */

export type SourceId = "shopify" | "woocommerce" | "json-ld" | "firecrawl" | "page-text";

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
}

export type BusinessType = "merch" | "apparel" | "packaging" | "food" | "beauty" | "home" | "electronics" | "services" | "other";

export const LIMITS = {
  /** Product pages read through the structured-data source. */
  productPages: 60,
  /** Every request in one import, including robots.txt and sitemaps. */
  totalRequests: 90,
  /** Products kept from any source. */
  products: 120,
  bytesPerResponse: 2 * 1024 * 1024,
  /** Pause between two requests to the seller's site. */
  delayMs: 400,
  textPerField: 600,
} as const;
