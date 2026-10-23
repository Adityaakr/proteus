/**
 * The store-wide deal desk: one conversation for everything a seller lists. Each buyer message is routed to the
 * product it is about, and that product's agent (which also knows the rest of the catalog) negotiates within that
 * product's rules. Routing is deterministic and explainable: words from the message matched against each product's
 * name, unit, capabilities and summary. With no clear match the conversation stays on the product it is on.
 */
import { and, eq } from "drizzle-orm";
import { pluralUnit } from "@proteus/domain";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { loadProductById, publicProduct } from "./catalog";

/** Words that appear in many product names and say nothing about which one is meant. */
const GENERIC = new Set(["custom", "event", "events", "pack", "bulk", "your", "with", "from", "for", "and", "the", "per", "design", "logo", "printed", "branded", "service", "plan", "team", "teams", "one", "each", "included", "delivery"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !GENERIC.has(w));
/** Light stemming so "bags" matches "bag" and "boxes" matches "box". */
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(xes|ches|shes|ses)$/, (m) => m.slice(0, -2)).replace(/s$/, "");

export async function routeToProduct(sellerSlug: string, message: string, current?: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, sellerSlug));
  if (!org) throw new HttpError(404, "seller not found");
  const rows = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.active, true)));
  if (!rows.length) throw new HttpError(404, "this seller has no listed products");
  const said = new Set(words(message).map(stem));
  const scored = [];
  for (const r of rows) {
    const p = publicProduct(await loadProductById(r.id));
    const strong = new Set([...words(p.name), p.unitLabel.toLowerCase(), pluralUnit(p.unitLabel).toLowerCase()].map(stem));
    const weak = new Set([...p.capabilities.flatMap(words), ...words(p.summary ?? "")].map(stem));
    const hits = [...said].filter((w) => strong.has(w));
    const weakHits = [...said].filter((w) => !strong.has(w) && weak.has(w));
    scored.push({ slug: p.slug, name: p.name, score: hits.length * 3 + weakHits.length, hits: [...hits, ...weakHits] });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const cur = scored.find((s) => s.slug === current);
  // Stay on the current product unless the message clearly points elsewhere.
  if (cur && (best.score === 0 || best.score <= cur.score)) return { productSlug: cur.slug, productName: cur.name, matched: true, switched: false, reason: "continuing the current product" };
  if (best.score === 0) return { productSlug: best.slug, productName: best.name, matched: false, switched: false, reason: "no product named yet" };
  return { productSlug: best.slug, productName: best.name, matched: true, switched: Boolean(current && current !== best.slug), reason: `matched ${best.hits.join(", ")}` };
}
