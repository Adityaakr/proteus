import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { agentRegistryId } from "@proteus/domain";
import { env } from "../env";
import { ratingSummaries } from "./ratings";

export interface Brand {
  logoUrl?: string;
  /** Square icon for avatars and small slots; the wordmark stays in logoUrl. */
  markUrl?: string;
  tagline?: string;
  category?: string;
  website?: string;
  /** Accent hex color for the monogram, e.g. "#1b4dff". */
  accent?: string;
  /** Public profiles, each an https link on that network's own domain. */
  socials?: Partial<Record<SocialKey, string>>;
  /** Set by the platform operator, never by the seller's own brand form. */
  verified?: boolean;
}

export const CATEGORIES = ["support", "voice", "infra", "devtools", "treasury", "payables", "vendors", "operations", "compliance", "logistics", "merch", "data", "legal", "risk", "media", "finance", "health", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

const MAX_DATA_URL = 96 * 1024;

/** Social profiles a seller may show, and the hosts each link must point to. */
const SOCIAL_HOSTS = { x: ["x.com", "twitter.com"], instagram: ["instagram.com"], farcaster: ["farcaster.xyz", "warpcast.com"] } as const;
export type SocialKey = keyof typeof SOCIAL_HOSTS;

function validateSocials(input: Brand["socials"]): Brand["socials"] | undefined {
  if (!input) return undefined;
  const out: NonNullable<Brand["socials"]> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!raw?.trim()) continue;
    const hosts = SOCIAL_HOSTS[key as SocialKey] as readonly string[] | undefined;
    if (!hosts) throw new HttpError(400, `unknown social profile "${key}"`);
    let u: URL;
    try {
      u = new URL(raw.trim());
    } catch {
      throw new HttpError(400, `${key} must be an https link`);
    }
    const host = u.hostname.replace(/^www\./, "");
    if (u.protocol !== "https:" || !hosts.includes(host) || u.pathname.length < 2) throw new HttpError(400, `${key} must be a profile link on ${hosts[0]}`);
    out[key as SocialKey] = u.toString();
  }
  return Object.keys(out).length ? out : undefined;
}

/** Accepts https URLs, same-site asset paths, or small raster/SVG data URLs. */
export function validateLogoUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (v.startsWith("/assets/") && !v.includes("..")) return v;
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v)) {
    if (v.length > MAX_DATA_URL) throw new HttpError(400, "logo must be under 96 KB; upload a smaller PNG or SVG");
    return v;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") throw new Error();
    return u.toString();
  } catch {
    throw new HttpError(400, "logo must be an https URL or a small PNG/SVG upload");
  }
}

export function validateBrand(input: Partial<Brand> | undefined): Brand | undefined {
  if (!input) return undefined;
  const b: Brand = {};
  const logo = validateLogoUrl(input.logoUrl);
  if (logo) b.logoUrl = logo;
  const mark = validateLogoUrl(input.markUrl);
  if (mark) b.markUrl = mark;
  if (input.tagline?.trim()) {
    if (input.tagline.trim().length > 140) throw new HttpError(400, "tagline must be 140 characters or fewer");
    b.tagline = input.tagline.trim();
  }
  if (input.category) {
    if (!(CATEGORIES as readonly string[]).includes(input.category)) throw new HttpError(400, "unknown category");
    b.category = input.category;
  }
  if (input.website?.trim()) {
    try {
      const u = new URL(input.website.trim());
      if (u.protocol !== "https:") throw new Error();
      b.website = u.toString();
    } catch {
      throw new HttpError(400, "website must be an https URL");
    }
  }
  if (input.accent) {
    if (!/^#[0-9a-fA-F]{6}$/.test(input.accent)) throw new HttpError(400, "accent must be a hex color like #1b4dff");
    b.accent = input.accent.toLowerCase();
  }
  const socials = validateSocials(input.socials);
  if (socials) b.socials = socials;
  return b;
}

export interface SellerStats {
  /** Deals that reached escrow funding (funded, active or closed). Real rows, never estimated. */
  dealsFunded: number;
  /** micro-USDC settled to this seller across all deals. */
  settled: bigint;
  /** micro-USDC currently held in escrow for this seller's deals. */
  inEscrow: bigint;
  /** Verified ERC-8004 ratings from buyers of settled deals (services/ratings.ts), or null if none yet. */
  ratings: { count: number; average: number; settledBehind: bigint } | null;
  since: Date;
}

/** Real per-seller numbers from the deals table. Demo sellers get the same math; the label tells the reader. */
export async function sellerStats(orgIds: string[]): Promise<Map<string, SellerStats>> {
  const out = new Map<string, SellerStats>();
  if (!orgIds.length) return out;
  const orgs = await db.select({ id: schema.orgs.id, createdAt: schema.orgs.createdAt }).from(schema.orgs).where(inArray(schema.orgs.id, orgIds));
  for (const o of orgs) out.set(o.id, { dealsFunded: 0, settled: 0n, inEscrow: 0n, since: o.createdAt, ratings: null });
  const rows = await db
    .select({
      orgId: schema.deals.orgId,
      n: sql<number>`count(*) filter (where ${schema.deals.status} in ('funded','active','closed'))`,
      settled: sql<string>`coalesce(sum(${schema.deals.settled}), 0)`,
      held: sql<string>`coalesce(sum(case when ${schema.deals.status} in ('funded','active') then ${schema.deals.deposit} - ${schema.deals.settled} - ${schema.deals.refunded} else 0 end), 0)`,
    })
    .from(schema.deals)
    .where(inArray(schema.deals.orgId, orgIds))
    .groupBy(schema.deals.orgId);
  for (const r of rows) {
    const s = out.get(r.orgId);
    if (s) {
      s.dealsFunded = Number(r.n);
      s.settled = BigInt(r.settled);
      s.inEscrow = BigInt(r.held);
    }
  }
  for (const [orgId, r] of await ratingSummaries(orgIds)) {
    const s = out.get(orgId);
    if (s) s.ratings = { count: r.count, average: r.average, settledBehind: r.settledBehind };
  }
  return out;
}

export function sellerCard(org: typeof schema.orgs.$inferSelect, stats?: SellerStats) {
  const brand = (org.brand as Brand | null) ?? {};
  return {
    slug: org.slug,
    name: org.name,
    label: org.label as "sandbox" | "live",
    brand,
    stats: stats ? { dealsFunded: stats.dealsFunded, settled: stats.settled, inEscrow: stats.inEscrow, since: stats.since, ratings: stats.ratings } : undefined,
    /** The seller's ERC-8004 agent on Arc, owned by its own wallet; null until it registers. */
    agent: org.agentId ? { agentId: org.agentId, agentRegistry: agentRegistryId(env.CHAIN_ID), registeredTx: org.agentRegisteredTx ?? null } : null,
  };
}

export async function updateBrand(orgId: string, patch: { name?: string; brand?: Partial<Brand> }) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "org not found");
  const current = (org.brand as Brand | null) ?? {};
  const next = validateBrand({ ...current, ...(patch.brand ?? {}) }) ?? current;
  if (current.verified) next.verified = true;
  // Explicit empty strings clear a field.
  for (const k of ["logoUrl", "markUrl", "tagline", "category", "website", "accent"] as const) if (patch.brand && patch.brand[k] === "") delete next[k];
  const name = patch.name?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 80)) throw new HttpError(400, "name must be 2 to 80 characters");
  const [updated] = await db.update(schema.orgs).set({ brand: next, ...(name ? { name } : {}) }).where(eq(schema.orgs.id, orgId)).returning();
  return sellerCard(updated!);
}
