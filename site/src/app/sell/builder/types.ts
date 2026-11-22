/** "Create your deal agent": the shapes /api/builder/* returns (server/src/services/importer/service.ts). */

export type BusinessType = "merch" | "apparel" | "packaging" | "food" | "beauty" | "home" | "electronics" | "services" | "other";
export type Question = "business" | "rate" | "products" | "prices" | "floors" | "bulk" | "custom";

export interface ImportProgress {
  at: string;
  label: string;
  state: "done" | "working" | "blocked";
  detail?: string;
}

export interface ImportedProduct {
  key: string;
  name: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  category?: string;
  price?: string;
  currency?: string;
  available?: boolean;
  variants: { name: string; sku?: string; price?: string }[];
  options: { name: string; values: string[] }[];
  hints: string[];
  source: string;
}

export interface SourceReport {
  source: string;
  status: "used" | "not-found" | "skipped" | "failed" | "blocked";
  detail: string;
  products?: number;
}

export interface ImportResult {
  site: { url: string; host: string; platform: string };
  brand: { name?: string; tagline?: string; description?: string; logoUrl?: string; website: string; socials: { x?: string; instagram?: string; farcaster?: string } };
  products: ImportedProduct[];
  policies: { kind: string; url: string; summary: string }[];
  hints: string[];
  businessType: { guess: BusinessType; reason: string };
  sources: SourceReport[];
  pagesFetched: number;
  limited?: string;
  fx?: { currency: string; rate: string; asOf: string; source: string } | null;
}

export interface PriceRule {
  priceUsd?: string;
  floorUsd?: string;
  maxDiscountPct?: string;
  moq?: string;
  bulkMinUnits?: string;
  bulkDiscountPct?: string;
}

export interface BuilderAnswers {
  businessName?: string;
  businessType?: BusinessType;
  tagline?: string;
  usdRate?: string;
  include: Record<string, boolean>;
  products: Record<string, PriceRule>;
  categories: Record<string, PriceRule>;
  defaults: PriceRule & { maxUnitsPerDeal?: string; approvalThresholdUsd?: string; termDays?: string };
  floorsSet?: boolean;
  bulkAnswered?: boolean;
  customOrders?: { accepted: boolean; note?: string };
}

export interface DraftItem {
  key: string;
  name: string;
  slug: string;
  category: string;
  included: boolean;
  unitLabel: string;
  source: { amount: string; currency: string } | null;
  listUsd: string | null;
  floorUsd: string | null;
  floorBasis: string | null;
  moq: string;
  bulk: { minUnits: string; priceUsd: string } | null;
  issues: string[];
}

export interface PublishedView {
  orgId: string;
  orgSlug: string;
  orgName: string;
  products: { id: string; slug: string; name: string }[];
  skipped: { slug: string; reason: string }[];
  at: string;
}

export interface BuilderImport {
  id: string;
  url: string;
  status: "running" | "ready" | "failed" | "published";
  progress: ImportProgress[];
  error: string | null;
  transcript: { at: string; role: "seller" | "agent"; text: string }[];
  org: { id: string; slug: string; name: string } | null;
  network: "testnet" | "mainnet";
  helpers: { model: string | null; firecrawl: boolean };
  result: ImportResult | null;
  answers: BuilderAnswers | null;
  draft: { included: number; ready: number; next: Question[]; items: DraftItem[]; maxPublish: number } | null;
  published: PublishedView | null;
}

export interface TestNegotiation {
  product: { key: string; name: string; unitLabel: string };
  adapter: string;
  lines: { role: "buyer" | "agent"; text: string; offers?: { tier: string; units: string; totalUsd: string; status: string }[]; decision?: string }[];
  check: { units: string; floorUsd: string; lowestTotalUsd: string; belowFloorRefused?: boolean; atFloorAccepted?: boolean };
  note: string;
}

export type AnswersPatch = Partial<Omit<BuilderAnswers, "include" | "products" | "categories" | "defaults">> & {
  include?: Record<string, boolean>;
  products?: Record<string, PriceRule>;
  categories?: Record<string, PriceRule>;
  defaults?: BuilderAnswers["defaults"];
};
