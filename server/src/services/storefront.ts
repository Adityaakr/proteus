/**
 * The store-wide deal desk: one conversation for everything a seller lists. Each buyer message is routed to the
 * product it is about, and that product's agent (which also knows the rest of the catalog) negotiates within that
 * product's rules. An open question that names no product ("suggest me some good merch") is not routed anywhere: the
 * conversation stays on all products and the agent recommends (services/consult.ts). Routing is deterministic and
 * explainable (routeMessage in @proteus/domain): words from the message matched against each product's name, unit,
 * capabilities and summary.
 */
import { and, eq } from "drizzle-orm";
import { routeMessage, type ConsultProduct } from "@proteus/domain";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { loadProductById, publicProduct } from "./catalog";

type PublicProduct = ReturnType<typeof publicProduct>;

/** A listed product as the router and the recommender see it: public data only, prices from its tiers. */
export function consultProduct(p: PublicProduct): ConsultProduct {
  const tiers = [...p.tiers].sort((a, b) => Number(a.unitPriceUsd.replace(/[^0-9.]/g, "")) - Number(b.unitPriceUsd.replace(/[^0-9.]/g, "")));
  const units = p.tiers.map((t) => Number(t.includedUnits)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    slug: p.slug,
    name: p.name,
    unitLabel: p.unitLabel,
    summary: p.summary,
    capabilities: p.capabilities,
    fromPrice: tiers[0]?.unitPriceUsd ?? null,
    minUnits: units.length ? Math.min(...units) : null,
    notes: p.knowledge?.notes ?? [],
  };
}

/** Every listed product of a seller, in the seller's order. */
export async function storeCatalog(sellerSlug: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, sellerSlug));
  if (!org) throw new HttpError(404, "seller not found");
  const rows = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.active, true)));
  if (!rows.length) throw new HttpError(404, "this seller has no listed products");
  const products: ConsultProduct[] = [];
  for (const r of rows) products.push(consultProduct(publicProduct(await loadProductById(r.id))));
  return { org, products };
}

/**
 * Which product a message is about. `mode: "consult"`: an open question, so the conversation stays on all products
 * and the client asks for a recommendation instead of switching (`matched` is false and `productSlug` is the current
 * product, or the first one, only so older clients keep working).
 */
export async function routeToProduct(sellerSlug: string, message: string, current?: string) {
  const { org, products } = await storeCatalog(sellerSlug);
  const d = routeMessage(message, products, { current, sellerName: org.name });
  if (d.mode === "product") {
    const p = products.find((x) => x.slug === d.slug)!;
    return { mode: d.mode, productSlug: p.slug, productName: p.name, matched: true, switched: d.switched, reason: d.reason, suggested: [] as string[] };
  }
  const stay = products.find((x) => x.slug === current) ?? products[0]!;
  return { mode: d.mode, productSlug: stay.slug, productName: stay.name, matched: false, switched: false, reason: d.reason, suggested: d.slugs, exclude: d.exclude };
}
