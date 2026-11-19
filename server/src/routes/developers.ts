/**
 * Developers: seller API keys and the webhook (managed from the dashboard with an owner session), and the seller API
 * itself at /api/v1/seller/*, authenticated by those keys and checked against each key's permissions.
 */
import { desc, eq } from "drizzle-orm";
import { Hono, type Context, type Next } from "hono";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError, json } from "../lib/http";
import { apiKeyAuth, apiKeyOf, createKey, dbKeyStore, envForNetwork, listKeys, regenerateKey, revokeKey, SCOPE_INFO, SCOPES, DEFAULT_OVERLAP_HOURS, MAX_OVERLAP_HOURS, type KeyStore, type Network, type Scope } from "../services/api-keys";
import { loadProductById, publicProduct } from "../services/catalog";
import { dealView, listDeals } from "../services/deals";
import { confirmDelivery } from "../services/delivery";
import { postOrderUpdate } from "../services/orders";
import { replaceTiers, setListing } from "../services/product-rules";
import { financeView, usageView, withEffectiveStatus } from "../services/seller-reports";
import { rotateWebhookSecret, sendWebhookTest, setWebhookUrl, webhookView } from "../services/notify";
import { requireSession, session } from "./session";

const noStore = (c: Context) => c.header("cache-control", "no-store");

/** Keys and webhooks hand out credentials, so only the signed-in owner manages them (never the shared example seller). */
function owner(c: Context) {
  const s = session(c);
  if (s.kind !== "privy") throw new HttpError(403, "Sign in as the seller owner to manage API keys and webhooks.");
  return s;
}

const origin = () => env.WEB_ORIGIN.replace(/\/$/, "");

/* ---------------------------------------------------------------- dashboard management */

export function developerRoutes(store: KeyStore = dbKeyStore, network: () => Network = () => features.network) {
  const r = new Hono();
  // The /app router already resolves the session when mounted next to it; resolve it here only when it has not.
  r.use("/app/developers/*", async (c: Context, next: Next) => (c.get("session") ? next() : requireSession(c, next)));

  r.get("/app/developers", async (c) => {
    const s = owner(c);
    noStore(c);
    const n = network();
    return json(c, {
      env: envForNetwork(n),
      network: n,
      peer: env.PEER_NETWORK_URL ? { network: n === "testnet" ? "mainnet" : "testnet", env: n === "testnet" ? "live" : "test", url: env.PEER_NETWORK_URL } : null,
      apiBase: `${origin()}/api/v1/seller`,
      scopes: SCOPES.map((id) => ({ id, ...SCOPE_INFO[id] })),
      overlap: { defaultHours: DEFAULT_OVERLAP_HOURS, maxHours: MAX_OVERLAP_HOURS },
      keys: await listKeys(store, s.orgId),
    });
  });

  r.post("/app/developers/keys", async (c) => {
    const s = owner(c);
    noStore(c);
    const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; scopes?: unknown };
    return json(c, await createKey(store, { orgId: s.orgId, name: b.name, scopes: b.scopes, env: envForNetwork(network()), createdBy: s.address ?? s.kind }), 201);
  });

  r.post("/app/developers/keys/:id/regenerate", async (c) => {
    const s = owner(c);
    noStore(c);
    const b = (await c.req.json().catch(() => ({}))) as { overlapHours?: unknown };
    return json(c, await regenerateKey(store, s.orgId, c.req.param("id"), { overlapHours: b.overlapHours, createdBy: s.address ?? s.kind }), 201);
  });

  r.post("/app/developers/keys/:id/revoke", async (c) => {
    const s = owner(c);
    return json(c, await revokeKey(store, s.orgId, c.req.param("id")));
  });

  r.get("/app/developers/webhook", async (c) => json(c, await webhookView(owner(c).orgId)));
  r.put("/app/developers/webhook", async (c) => {
    const s = owner(c);
    noStore(c);
    const b = (await c.req.json().catch(() => ({}))) as { url?: unknown };
    if (b.url !== null && typeof b.url !== "string") throw new HttpError(400, "url must be an https URL, or null to remove the webhook");
    if (typeof b.url === "string" && b.url.length > 500) throw new HttpError(400, "That URL is too long.");
    return json(c, await setWebhookUrl(s.orgId, b.url));
  });
  r.post("/app/developers/webhook/secret", async (c) => {
    const s = owner(c);
    noStore(c);
    return json(c, await rotateWebhookSecret(s.orgId));
  });
  r.post("/app/developers/webhook/test", async (c) => json(c, await sendWebhookTest(owner(c).orgId)));

  return r;
}

/* ---------------------------------------------------------------- the seller API */

/** Every seller API route with the permission it needs. `null` means any valid key. */
export const SELLER_API: { method: "GET" | "POST" | "PATCH"; path: string; scope: Scope | null; summary: string }[] = [
  { method: "GET", path: "/v1/seller/me", scope: null, summary: "The key's seller, name, environment and permissions" },
  { method: "GET", path: "/v1/seller/products", scope: null, summary: "Your products with public tiers, endpoint and docs links" },
  { method: "PATCH", path: "/v1/seller/products/:id/tiers", scope: "products:write", summary: "Replace a product's public price tiers" },
  { method: "PATCH", path: "/v1/seller/products/:id/listing", scope: "products:write", summary: "List or unlist a product in the market" },
  { method: "GET", path: "/v1/seller/deals", scope: "deals:read", summary: "Your deals, newest first, with balances" },
  { method: "GET", path: "/v1/seller/deals/:id", scope: "deals:read", summary: "One deal: terms, balances, usage and transactions" },
  { method: "POST", path: "/v1/seller/deals/:id/deliveries", scope: "deliveries:write", summary: "Record delivered units with proof (a signed receipt)" },
  { method: "POST", path: "/v1/seller/deals/:id/order-updates", scope: "deliveries:write", summary: "Post an order status update the buyer sees" },
  { method: "GET", path: "/v1/seller/usage", scope: "usage:read", summary: "Metered requests and delivery totals" },
  { method: "GET", path: "/v1/seller/payments", scope: "payments:read", summary: "Funded, settled, refunded and held totals" },
];

async function ownProduct(orgId: string, productId: string) {
  const lp = await loadProductById(productId).catch(() => null);
  if (!lp || lp.org.id !== orgId) throw new HttpError(404, "product not found");
  return lp;
}

async function ownDeal(orgId: string, dealId: string) {
  const [d] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!d || d.orgId !== orgId) throw new HttpError(404, "deal not found");
  return d;
}

function productOut(lp: Awaited<ReturnType<typeof loadProductById>>) {
  const pub = publicProduct(lp);
  return { id: lp.row.id, slug: pub.slug, name: pub.name, active: lp.row.active, unitLabel: pub.unitLabel, tiers: pub.tiers, payPerCallUsd: pub.payPerCallUsd ?? null, endpoint: `${origin()}/api/services/${pub.slug}/execute`, docsUrl: `${origin()}/docs/${lp.org.slug}/${pub.slug}` };
}

export function sellerApiRoutes(store: KeyStore = dbKeyStore, network: () => Network = () => features.network) {
  const r = new Hono();
  const auth = (scope: Scope | null) => apiKeyAuth({ store, network, scope: scope ?? undefined });
  const handlers: Record<string, (c: Context) => Promise<Response>> = {
    "GET /v1/seller/me": async (c) => {
      const k = apiKeyOf(c);
      return json(c, { orgId: k.orgId, key: { id: k.keyId, name: k.name, env: k.env, scopes: k.scopes }, network: network() });
    },
    "GET /v1/seller/products": async (c) => {
      const rows = await db.select().from(schema.products).where(eq(schema.products.orgId, apiKeyOf(c).orgId)).orderBy(desc(schema.products.createdAt));
      const out = [];
      for (const row of rows) out.push(productOut(await loadProductById(row.id)));
      return json(c, { products: out });
    },
    "PATCH /v1/seller/products/:id/tiers": async (c) => {
      const lp = await ownProduct(apiKeyOf(c).orgId, c.req.param("id")!);
      await replaceTiers(lp, (await c.req.json().catch(() => ({}))) as { tiers?: unknown });
      return json(c, productOut(await loadProductById(lp.row.id)));
    },
    "PATCH /v1/seller/products/:id/listing": async (c) => {
      const lp = await ownProduct(apiKeyOf(c).orgId, c.req.param("id")!);
      await setListing(lp, ((await c.req.json().catch(() => ({}))) as { active?: unknown }).active);
      return json(c, productOut(await loadProductById(lp.row.id)));
    },
    "GET /v1/seller/deals": async (c) => json(c, { deals: await listDeals(apiKeyOf(c).orgId) }),
    "GET /v1/seller/deals/:id": async (c) => {
      const d = await ownDeal(apiKeyOf(c).orgId, c.req.param("id")!);
      return json(c, withEffectiveStatus(await dealView(d.id)));
    },
    "POST /v1/seller/deals/:id/deliveries": async (c) => {
      const k = apiKeyOf(c);
      const d = await ownDeal(k.orgId, c.req.param("id")!);
      const b = (await c.req.json().catch(() => ({}))) as { units?: unknown; note?: unknown; proofUrl?: unknown; requestId?: unknown };
      return json(c, await confirmDelivery(k.orgId, d.id, { units: Number(b.units), note: String(b.note ?? ""), proofUrl: typeof b.proofUrl === "string" && b.proofUrl ? b.proofUrl : undefined, requestId: String(b.requestId ?? "") }, `api-key:${k.keyId}`), 201);
    },
    "POST /v1/seller/deals/:id/order-updates": async (c) => {
      const k = apiKeyOf(c);
      const d = await ownDeal(k.orgId, c.req.param("id")!);
      return json(c, await postOrderUpdate(k.orgId, d.id, (await c.req.json().catch(() => ({}))) as { status?: unknown; note?: unknown; trackingUrl?: unknown }), 201);
    },
    "GET /v1/seller/usage": async (c) => json(c, await usageView(apiKeyOf(c).orgId, async (id) => (await loadProductById(id).catch(() => null))?.product.name ?? "Product")),
    "GET /v1/seller/payments": async (c) => json(c, await financeView(apiKeyOf(c).orgId, { journal: false })),
  };
  for (const route of SELLER_API) {
    const h = handlers[`${route.method} ${route.path}`];
    if (!h) throw new Error(`no handler for ${route.method} ${route.path}`);
    const m = route.method === "GET" ? r.get.bind(r) : route.method === "POST" ? r.post.bind(r) : r.patch.bind(r);
    m(route.path, auth(route.scope), (c) => h(c));
  }
  return r;
}
