/**
 * Catalog sync: a seller points Proteus at its own catalog endpoint (https, JSON) and Proteus keeps each product's
 * stock, cost and order rules current from it, every 15 minutes or on demand.
 *
 * What sync may change: listed or not, capacity, cost per unit, prepaid minimum, approval threshold, maximum discount
 * and margin floor. Every change goes through the same versioned path as a dashboard edit (product-rules.ts), and only
 * when a value actually differs, so a quiet feed never creates new versions. List prices and product text are not
 * synced: they are part of the public terms buyers sign. A product is never listed by sync before the seller is
 * registered on Arc. Products missing from the feed are left alone.
 *
 * The endpoint is fetched like a webhook in reverse: https only, private and metadata addresses refused (checked at
 * save and at fetch), no redirects, 8 s timeout, 1 MB cap. Its secret is stored encrypted and never returned.
 */
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { toMicro } from "@proteus/domain";
import { db, schema } from "../db";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { HttpError } from "../lib/http";
import { loadProductById } from "./catalog";
import { assertPublicHttps } from "./notify";
import { updateCost, updatePolicy } from "./product-rules";

const SYNC_EVERY_MS = 15 * 60 * 1000;
const MAX_BYTES = 1_000_000;

const Usd = z.union([z.string(), z.number()]).transform((v) => String(v).trim()).refine((v) => /^\d+(\.\d{1,6})?$/.test(v), "a dollar amount like \"12.50\"");
const Pct = z.number().min(0).max(90);
const FeedItem = z.object({
  slug: z.string().min(1).max(80),
  available: z.boolean().optional(),
  capacityUnits: z.union([z.string().regex(/^\d+$/), z.number().int().min(0)]).transform(String).optional(),
  costPerUnitUsd: Usd.optional(),
  prepaidMinimumUsd: Usd.optional(),
  approvalThresholdUsd: Usd.optional(),
  maxDiscountPct: Pct.optional(),
  minMarginPct: Pct.optional(),
});
export const CatalogFeed = z.object({ products: z.array(FeedItem).max(200) });

type Change = { slug: string; changes: string[] };
export interface SyncResult {
  at: string;
  status: "ok" | "error";
  updated: Change[];
  unchanged: string[];
  notOnProteus: string[];
  errors: string[];
}

const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`;
const bpsOf = (pct: number) => Math.round(pct * 100);

export async function catalogSyncView(orgId: string) {
  const [row] = await db.select().from(schema.catalogSyncs).where(eq(schema.catalogSyncs.orgId, orgId));
  return {
    url: row?.url ?? null,
    authHeader: row?.authHeader ?? null,
    hasSecret: Boolean(row?.secretEnc),
    enabled: row?.enabled ?? false,
    everyMinutes: SYNC_EVERY_MS / 60000,
    lastRunAt: row?.lastRunAt ?? null,
    lastStatus: row?.lastStatus ?? null,
    lastResult: (row?.lastResult as SyncResult | null) ?? null,
  };
}

export async function saveCatalogSync(orgId: string, body: Record<string, unknown>) {
  const b = z
    .object({
      url: z.string().max(2048).nullable().optional(),
      authHeader: z.string().max(64).regex(/^[A-Za-z0-9-]*$/, "header name: letters, digits and dashes").nullable().optional(),
      secret: z.string().max(4096).nullable().optional(),
      enabled: z.boolean().optional(),
    })
    .parse(body);
  const url = b.url?.trim() || null;
  if (!url) {
    await db.delete(schema.catalogSyncs).where(eq(schema.catalogSyncs.orgId, orgId));
    return catalogSyncView(orgId);
  }
  await assertPublicHttps(url);
  const [cur] = await db.select().from(schema.catalogSyncs).where(eq(schema.catalogSyncs.orgId, orgId));
  const header = b.authHeader === undefined ? (cur?.authHeader ?? null) : b.authHeader?.trim() || null;
  // A new secret replaces the old one; an empty string clears it; leaving it out keeps it.
  const secretEnc = b.secret === undefined ? (cur?.secretEnc ?? null) : b.secret?.trim() ? encryptSecret(b.secret.trim()) : null;
  const values = { url, authHeader: header, secretEnc, enabled: b.enabled ?? cur?.enabled ?? true, updatedAt: new Date() };
  await db.insert(schema.catalogSyncs).values({ orgId, ...values }).onConflictDoUpdate({ target: schema.catalogSyncs.orgId, set: values });
  return catalogSyncView(orgId);
}

async function fetchFeed(row: typeof schema.catalogSyncs.$inferSelect) {
  const u = await assertPublicHttps(row.url);
  const headers: Record<string, string> = { accept: "application/json", "user-agent": "ProteusAI-CatalogSync/1" };
  if (row.authHeader && row.secretEnc) headers[row.authHeader.toLowerCase()] = decryptSecret(row.secretEnc);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u, { headers, redirect: "manual", signal: ctl.signal });
    if (r.status !== 200) throw new Error(`the endpoint answered HTTP ${r.status}`);
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error("the catalog is larger than 1 MB");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("the endpoint did not return JSON");
    }
    const parsed = CatalogFeed.safeParse(json);
    if (!parsed.success) throw new Error(`the catalog does not match the format: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function runCatalogSync(orgId: string): Promise<SyncResult> {
  const [row] = await db.select().from(schema.catalogSyncs).where(eq(schema.catalogSyncs.orgId, orgId));
  if (!row) throw new HttpError(400, "Add your catalog endpoint first.");
  const result: SyncResult = { at: new Date().toISOString(), status: "ok", updated: [], unchanged: [], notOnProteus: [], errors: [] };
  try {
    const feed = await fetchFeed(row);
    const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
    const products = await db.select().from(schema.products).where(eq(schema.products.orgId, orgId));
    for (const item of feed.products) {
      const p = products.find((x) => x.slug === item.slug);
      if (!p) {
        result.notOnProteus.push(item.slug);
        continue;
      }
      try {
        const lp = await loadProductById(p.id);
        const pol = lp.policyRow;
        const changes: string[] = [];
        const policy: Record<string, unknown> = {};
        if (item.capacityUnits !== undefined && BigInt(item.capacityUnits) !== pol.availableCapacityUnits) {
          policy.availableCapacityUnits = item.capacityUnits;
          changes.push(`capacity ${pol.availableCapacityUnits} → ${item.capacityUnits}`);
        }
        if (item.prepaidMinimumUsd !== undefined && toMicro(item.prepaidMinimumUsd) !== pol.prepaidMinimum) {
          policy.prepaidMinimum = toMicro(item.prepaidMinimumUsd).toString();
          changes.push(`prepaid minimum ${usd(pol.prepaidMinimum)} → ${usd(toMicro(item.prepaidMinimumUsd))}`);
        }
        if (item.approvalThresholdUsd !== undefined && toMicro(item.approvalThresholdUsd) !== pol.approvalThreshold) {
          policy.approvalThreshold = toMicro(item.approvalThresholdUsd).toString();
          changes.push(`approval threshold ${usd(pol.approvalThreshold)} → ${usd(toMicro(item.approvalThresholdUsd))}`);
        }
        if (item.maxDiscountPct !== undefined && bpsOf(item.maxDiscountPct) !== pol.maxDiscountBps) {
          policy.maxDiscountBps = bpsOf(item.maxDiscountPct);
          changes.push(`max discount ${pol.maxDiscountBps / 100}% → ${item.maxDiscountPct}%`);
        }
        if (item.minMarginPct !== undefined && bpsOf(item.minMarginPct) !== pol.minMarginBps) {
          policy.minMarginBps = bpsOf(item.minMarginPct);
          changes.push(`margin floor ${pol.minMarginBps / 100}% → ${item.minMarginPct}%`);
        }
        if (Object.keys(policy).length) await updatePolicy(lp, policy);
        if (item.costPerUnitUsd !== undefined && toMicro(item.costPerUnitUsd) !== lp.costRow.variableCostPerUnit) {
          await updateCost(lp, { variableCostPerUnit: toMicro(item.costPerUnitUsd).toString() });
          changes.push(`cost per unit ${usd(lp.costRow.variableCostPerUnit)} → ${usd(toMicro(item.costPerUnitUsd))}`);
        }
        if (item.available !== undefined && item.available !== p.active) {
          if (item.available && !org?.agentId) {
            result.errors.push(`${item.slug}: not listed, because the seller is not registered on Arc yet`);
          } else {
            await db.update(schema.products).set({ active: item.available }).where(eq(schema.products.id, p.id));
            changes.push(item.available ? "listed" : "unlisted");
          }
        }
        if (changes.length) result.updated.push({ slug: item.slug, changes });
        else result.unchanged.push(item.slug);
      } catch (e) {
        result.errors.push(`${item.slug}: ${(e as Error).message.slice(0, 160)}`);
      }
    }
  } catch (e) {
    result.status = "error";
    result.errors.push((e as Error).message.slice(0, 300));
  }
  await db.update(schema.catalogSyncs).set({ lastRunAt: new Date(), lastStatus: result.status, lastResult: result }).where(eq(schema.catalogSyncs.orgId, orgId));
  return result;
}

/** Called from the reconciler tick: each enabled sync at most every 15 minutes, one failure never blocks the others. */
export async function runDueCatalogSyncs() {
  const due = await db
    .select({ orgId: schema.catalogSyncs.orgId })
    .from(schema.catalogSyncs)
    .where(and(eq(schema.catalogSyncs.enabled, true), or(isNull(schema.catalogSyncs.lastRunAt), lt(schema.catalogSyncs.lastRunAt, new Date(Date.now() - SYNC_EVERY_MS)))))
    .limit(20);
  for (const d of due) await runCatalogSync(d.orgId).catch((e) => console.warn("[catalog-sync]", d.orgId, String((e as Error).message).slice(0, 160)));
}
