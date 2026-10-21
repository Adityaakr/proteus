/**
 * The seller deal agent that sellers embed on their own websites (/embed/<seller>). It shows the seller's public
 * products and prices and runs the same negotiation as the market; offers come from the seller's rules in code, never
 * from model text. Signing and funding always open a top-level Proteus window, so an embedding page can never capture
 * a signature. Sellers may restrict which sites can embed them.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";

const ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;

/** CSP frame-ancestors value for a seller's embed page: its listed origins, or any site when none are listed. */
export async function embedAncestors(slug: string): Promise<string> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return "'self'";
  const [org] = await db.select({ d: schema.orgs.embedDomains }).from(schema.orgs).where(eq(schema.orgs.slug, slug));
  const list = (org?.d ?? []).filter((d) => ORIGIN.test(d));
  return list.length ? ["'self'", ...list].join(" ") : "*";
}

export async function embedSettings(orgId: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "seller not found");
  return { slug: org.slug, label: org.label, domains: org.embedDomains ?? [] };
}

export async function setEmbedDomains(orgId: string, domains: string[]) {
  const clean = [...new Set(domains.map((d) => d.trim().replace(/\/+$/, "").toLowerCase()).filter(Boolean))];
  const bad = clean.filter((d) => !ORIGIN.test(d));
  if (bad.length) throw new HttpError(400, `Use full https origins like https://shop.example.com (not: ${bad.join(", ")})`);
  if (clean.length > 10) throw new HttpError(400, "At most 10 sites");
  await db.update(schema.orgs).set({ embedDomains: clean }).where(eq(schema.orgs.id, orgId));
  return embedSettings(orgId);
}
