/**
 * A seller's private terms (costs, margin, discount cap, floors, approval threshold, capacity, prepaid minimum, quote
 * validity) never appear in a file the site serves or in a response anyone can request. Two guards:
 *  - every text file under site/public, with prepared listings held to a list of public fields;
 *  - every API route outside the signed-in areas, run over one product whose private values are recognisable numbers.
 *    A new public route must be exercised here or listed with the reason it carries no seller data.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { getTableColumns, is, Column, type Table } from "drizzle-orm";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

/** Field names that hold a private term, however they are cased or suffixed. Dashed keys (post slugs) are not fields. */
const PRIVATE_KEY = /cost|margin|discount|floor|threshold|capacity|prepaid_?min|min_?prepaid|contribution|economics|quote_?(ttl|valid)|rule_?ids|private|secret|^data_?key|^salt$|^rules$/i;

function privateKeys(value: unknown, path = "", allowed: (path: string) => boolean = () => false): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => privateKeys(v, `${path}[]`, allowed));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const p = path ? `${path}.${k}` : k;
    return [...(/^\w+$/.test(k) && PRIVATE_KEY.test(k) && !allowed(p) ? [p] : []), ...privateKeys(v, p, allowed)];
  });
}

/* ---------------------------------------------------------------- static files */

const PUBLIC = join(import.meta.dirname, "../../site/public");
const TEXT = new Set([".json", ".md", ".txt", ".js", ".xml", ".svg", ".html", ".css", ".csv", ".yml", ".yaml"]);
const files = readdirSync(PUBLIC, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath, e.name))
  .map((path) => ({ path, name: relative(PUBLIC, path).replaceAll("\\", "/") }));
const textFiles = files.filter((f) => TEXT.has(extname(f.name))).map((f) => ({ ...f, text: readFileSync(f.path, "utf8") }));

/** Every field of the product create body that is private, as it is written in JSON, JavaScript or YAML. */
const PRIVATE_FIELD = /(variableCost|directCost|txCost|costPerUnit|minMargin|maxDiscount|approvalThreshold|prepaidMinimum|availableCapacity|capacityUnits|quoteTtl|floorUnitPrice)\w*["'`]?\s*[:=]|["'](cost|policy)["']\s*:/g;
/** The seller API reference documents the floor call of a seller's own, authenticated API with sample values. */
const DOCUMENTS_FLOOR_CALL = new Set(["docs.md", "docs/seller-api.md", "docs/seller-api-reference.md", "docs/facts.json"]);

const LISTING_FIELDS = new Set([
  ...["name", "slug", "ownerAddress", "brand"].map((k) => `business.${k}`),
  ...["logoUrl", "markUrl", "accent", "category", "tagline", "website", "socials", "socials.x", "socials.instagram", "socials.farcaster"].map((k) => `business.brand.${k}`),
  ...["name", "slug", "summary", "category", "unitLabel", "billableUnit", "capabilities", "supportedIntegrations", "tiers", "maxUnitsPerDeal", "termDays", "refundPolicy", "request", "adapter", "upstream", "upstream.url"].map((k) => `products[].${k}`),
  ...["name", "includedUnits", "unitPriceUsd", "includes"].map((k) => `products[].tiers[].${k}`),
  ...["intro", "fields"].map((k) => `products[].request.${k}`),
  ...["key", "label", "type", "required", "placeholder", "hint"].map((k) => `products[].request.fields[].${k}`),
  "business",
  "products",
]);

const keyPaths = (v: unknown, path = ""): string[] =>
  Array.isArray(v) ? v.flatMap((x) => keyPaths(x, `${path}[]`)) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [path ? `${path}.${k}` : k, ...keyPaths(x, path ? `${path}.${k}` : k)]) : [];

describe("files the site serves", () => {
  const listings = textFiles.filter((f) => f.name.startsWith("listings/"));

  it("prepared listings carry public fields only", () => {
    expect(listings.length).toBeGreaterThan(0);
    expect(files.filter((f) => f.name.startsWith("listings/") && extname(f.name) !== ".json")).toEqual([]);
    for (const f of listings) expect([...new Set(keyPaths(JSON.parse(f.text)))].filter((p) => !LISTING_FIELDS.has(p)), f.name).toEqual([]);
  });

  it("no JSON file has a private key", () => {
    for (const f of textFiles.filter((x) => x.name.endsWith(".json"))) {
      // facts.json: the buying rules for agents, and the sample body of the documented floor call.
      const documented = (p: string) => f.name === "docs/facts.json" && /^(agents\.rules|sellerApi\.endpoints\[\]\.example\.floorUnitPrice(Inr|Usd))$/.test(p);
      expect(privateKeys(JSON.parse(f.text), "", documented), f.name).toEqual([]);
    }
  });

  it("no text file assigns a private field", () => {
    for (const f of textFiles) {
      const found = [...f.text.matchAll(PRIVATE_FIELD)].map((m) => m[0]).filter((m) => !(DOCUMENTS_FLOOR_CALL.has(f.name) && m.startsWith("floorUnitPrice")));
      expect(found, f.name).toEqual([]);
    }
  });

  it("the guards catch a private field", () => {
    expect(privateKeys({ products: [{ cost: { variableCostPerUnitUsd: "1" } }] })).toEqual(["products[].cost", "products[].cost.variableCostPerUnitUsd"]);
    expect("minMarginBps: 1".match(PRIVATE_FIELD)).not.toBeNull();
    expect('"policy": {'.match(PRIVATE_FIELD)).not.toBeNull();
    expect(LISTING_FIELDS.has("products[].policy")).toBe(false);
  });
});

/* ---------------------------------------------------------------- public responses */

/** One row store per table. Each table holds one seller's rows, so filters are not needed. */
const store = vi.hoisted(() => ({ rows: new Map<unknown, Record<string, unknown>[]>() }));

vi.mock("../src/db", async () => {
  const schema = await vi.importActual<typeof import("../src/db/schema")>("../src/db/schema");
  const rowsOf = (t: unknown) => store.rows.get(t) ?? store.rows.set(t, []).get(t)!;
  const keyOf = (t: Table, c: Column) => Object.entries(getTableColumns(t)).find(([, x]) => x === c)?.[0];
  const pick = (t: Table, fields?: Record<string, unknown>) =>
    rowsOf(t).map((r) => (fields ? Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, is(f, Column) ? r[keyOf(t, f) ?? ""] ?? null : "0"])) : { ...r }));
  const withDefaults = (t: Table, row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(getTableColumns(t)).map(([k, c]) => [k, row[k] ?? (c.notNull && c.dataType === "date" ? new Date() : c.columnType === "PgBigInt64" && c.hasDefault ? 0n : typeof c.default === "object" && c.default && !Array.isArray(c.default) ? null : c.default ?? null)]));
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["where", "orderBy", "limit", "groupBy", "leftJoin", "innerJoin", "onConflictDoNothing", "returning"]) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve().then(result).then(ok, bad);
    return q;
  };
  const db = {
    select: (fields?: Record<string, unknown>) => ({ from: (t: Table) => chain(() => pick(t, fields)) }),
    insert: (t: Table) => ({
      values: (v: Record<string, unknown>) => {
        rowsOf(t).push(withDefaults(t, v));
        return chain(() => []);
      },
    }),
    update: (t: Table) => ({
      set: (v: Record<string, unknown>) => {
        for (const r of rowsOf(t)) Object.assign(r, v);
        return chain(() => rowsOf(t));
      },
    }),
  };
  return { db, schema, sql: {} };
});
vi.mock("../src/agent", async () => {
  const real = await vi.importActual<typeof import("../src/agent")>("../src/agent");
  const { ruleBasedAdapter } = await vi.importActual<typeof import("../src/agent/rule-based")>("../src/agent/rule-based");
  return { ...real, getAgentAdapter: () => ruleBasedAdapter };
});
vi.mock("../src/services/notify", async () => ({ ...(await vi.importActual<typeof import("../src/services/notify")>("../src/services/notify")), enqueue: async () => {} }));

const { apiRoutes } = await import("../src/routes/api");
const { HttpError } = await import("../src/lib/http");
const { schema } = await import("../src/db");

/** Private values no public number can be mistaken for. Micro-USDC unless named otherwise. */
const SECRET = { cost: 1_377_013n, direct: 2_377_029n, txBps: 173, margin: 1_931, discount: 1_277, approval: 61_377_053n, prepaidMin: 3_377_071n, capacity: 48_611n, floor: 4_377_083n, floorInr: 41_707n, ttl: 86_371 };
const usd = (micro: bigint) => `${micro / 1_000_000n}.${(micro % 1_000_000n).toString().padStart(6, "0")}`;
const SECRET_TEXT = [...Object.values(SECRET).map(String), ...[SECRET.cost, SECRET.direct, SECRET.approval, SECRET.prepaidMin, SECRET.floor].map(usd), "417.07"].filter((t) => t.length > 3);

const now = new Date();
const base = { orgId: "org_1", productId: "prd_1", createdAt: now };
const tier = (id: string, units: number, price: number) => ({ id, name: id, includedUnits: String(units), unitPrice: { num: String(price * 1_000_000), den: "1" }, includes: ["Print"] });
const address = `0x${"11".repeat(20)}`;

store.rows.set(schema.orgs, [{ id: "org_1", slug: "acme", name: "Acme", label: "sandbox", brand: { tagline: "Goods" }, sellerSignerAddress: address, payeeAddress: address, ownerAddress: address, dataKeyEnc: null, agentId: null, currency: null, embedDomains: null, createdAt: now }]);
store.rows.set(schema.products, [{ id: "prd_1", orgId: "org_1", slug: "tote", public: { id: "prd_1", slug: "tote", name: "Canvas tote", billableUnit: "One printed tote delivered", unitLabel: "tote", capabilities: ["Print"], supportedIntegrations: [], tiers: [tier("starter", 10, 9), tier("bulk", 100, 8)], maxUnitsPerDeal: "500", termDays: 30, refundPolicy: "Unused balance is refunded.", summary: "Printed totes" }, starters: [], adapter: "http", upstream: { url: "https://seller.example", secretEnc: "sealed" }, payPerCallPrice: null, active: true, createdAt: now }]);
store.rows.set(schema.costModels, [{ ...base, id: "cost_1", version: 1, variableCostPerUnit: SECRET.cost, directCostPerDeal: SECRET.direct, txCostBps: SECRET.txBps, freshUntil: new Date(Date.now() + 30 * 86_400_000), floorUnitPrice: SECRET.floor, floorUnitPriceInr: null }]);
store.rows.set(schema.policies, [{ ...base, id: "pol_1", version: 1, minMarginBps: SECRET.margin, maxDiscountBps: SECRET.discount, approvalThreshold: SECRET.approval, prepaidMinimum: SECRET.prepaidMin, availableCapacityUnits: SECRET.capacity, quoteTtlSeconds: SECRET.ttl, allowNonPositiveContribution: false, salt: null, policyCommit: null, commitTx: null }]);

const api = new Hono();
api.route("/", apiRoutes());
api.onError((err, c) => c.json({ error: err.message, details: (err as { details?: unknown }).details }, (err instanceof HttpError ? err.status : 500) as 500));

const exercised = new Set<string>();
/** Requests `path`, checks the whole body, and records the route as covered. */
async function check(method: string, route: string, opts: { params?: Record<string, string>; body?: unknown; key?: string; status?: number } = {}) {
  const path = route.replace(/:(\w+)/g, (_m, p: string) => opts.params?.[p] ?? { sellerSlug: "acme", productSlug: "tote" }[p]!);
  const res = await api.request(path, { method, headers: { "content-type": "application/json", ...(opts.key ? { "x-negotiation-key": opts.key } : {}) }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  const text = await res.text();
  expect(res.status, `${method} ${route}: ${text.slice(0, 200)}`).toBe(opts.status ?? 200);
  for (const s of SECRET_TEXT) expect(text.includes(s), `${method} ${route} contains a private value`).toBe(false);
  expect(text, `${method} ${route} contains a rule id`).not.toMatch(/MARGIN_FLOOR_BPS|MAX_DISCOUNT_BPS|APPROVAL_THRESHOLD|PREPAID_MINIMUM|FLOOR_PRICE|NON_POSITIVE_CONTRIBUTION/);
  const data = res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text;
  if (typeof data !== "string") expect(privateKeys(data), `${method} ${route}`).toEqual([]);
  exercised.add(`${method} ${route}`);
  return data;
}

/** Routes that need a session, an API key or the admin token; /v1/sandbox serves fixed sample data only. */
const SIGNED_IN = /^\/(app|me|orgs|builder|auth|invites|admin)(\/|$)|^\/v1\/(seller|sandbox)\//;
const NOT_EXERCISED: Record<string, string> = {
  "GET /public/talk/:token": "a business's own customer page",
  "POST /public/talk/:token/messages": "a business's own customer page",
  "POST /quotes/:id/accept": "needs a wallet signature; returns the deal view, checked below",
  "POST /deals/:id/funding-intent": "reads the chain; returns the deal view",
  "GET /deals/:id/permit": "reads the chain; USDC permit fields",
  "POST /deals/:id/fund-gasless": "reads the chain; returns the deal view",
  "POST /deals/:id/usage-acknowledgments": "needs a wallet signature; returns the deal view",
  "GET /deals/:id/dispute": "reads the chain; dispute fields",
  "POST /deals/:id/dispute": "reads the chain; dispute fields",
  "GET /deals/:id/rating": "reads the chain; rating fields",
  "POST /deals/:id/rating": "reads the chain; rating fields",
  "POST /deals/:id/service/rotate-key": "needs a wallet signature; returns the deal view",
  "POST /deals/:id/refund-request": "reads the chain; transaction fields",
  "POST /services/:productSlug/execute": "needs the deal's service key; the seller endpoint's answer",
  "GET /services/:productSlug/connections": "needs the deal's service key",
  "PUT /services/:productSlug/profile": "needs the deal's service key",
  "POST /services/:productSlug/connections/google": "needs the deal's service key",
  "DELETE /services/:productSlug/connections/google": "needs the deal's service key",
  "GET /services/:productSlug/customer-link": "needs the deal's service key",
  "POST /services/:productSlug/customer-link": "needs the deal's service key",
  "DELETE /services/:productSlug/customer-link": "needs the deal's service key",
  "GET /services/:productSlug/inbox": "needs the deal's service key",
  "GET /integrations/google/callback": "a redirect",
  "GET /deals/:id/timeline": "only the deal's buyer",
  "POST /deals/:id/requests/:requestId/status": "only the deal's buyer",
  "GET /deals/:id/notifications": "only the deal's buyer",
  "PUT /deals/:id/notifications": "only the deal's buyer",
  "POST /pay/:sellerSlug/:productSlug/execute": "per-call payment requirements: public price and addresses",
  "POST /rpc": "chain relay",
  "POST /solana-rpc": "chain relay",
  "GET /channels/whatsapp/webhook": "Meta's webhook check",
  "POST /channels/whatsapp/webhook": "acknowledges Meta's webhook",
  "GET /w/:token": "a redirect",
};

describe("responses anyone can request", () => {
  it("carry no private key or value, on every public route", async () => {
    await check("GET", "/health");
    await check("GET", "/public/sellers/:sellerSlug");
    await check("GET", "/public/sellers/:sellerSlug/ratings");
    await check("POST", "/public/sellers/:sellerSlug/route", { body: { message: "I need totes" } });
    await check("GET", "/public/sellers/:sellerSlug/products/:productSlug");
    await check("GET", "/public/sellers/:sellerSlug/products/:productSlug/skill.md");
    await check("GET", "/public/sellers/:sellerSlug/products/:productSlug/openapi.json");
    await check("GET", "/public/sellers/:sellerSlug/agent.json");
    await check("GET", "/public/agents/skill.md");
    await check("GET", "/market");
    await check("GET", "/market/sellers");
    await check("GET", "/market/categories");

    const neg = await check("POST", "/negotiations", { body: { sellerSlug: "acme", productSlug: "tote" }, status: 201 });
    const at = { params: { id: neg.id as string }, key: neg.buyerKey as string };
    const offered = await check("POST", "/negotiations/:id/messages", { ...at, body: { content: "I need 100 totes" } });
    expect(offered.offers.length).toBeGreaterThan(0);
    await check("POST", "/negotiations/:id/consult", { ...at, body: { content: "suggest me something good" } });
    // A counter far below the floor (refused) and one within the rules.
    const bulk = offered.offers.find((o: { units: string }) => o.units === "100");
    await check("POST", "/negotiations/:id/counter", { ...at, body: { candidateId: bulk.candidateId, targetTotal: "100000000" } });
    await check("POST", "/negotiations/:id/counter", { ...at, body: { candidateId: bulk.candidateId, targetTotal: "780000000" } });
    await check("GET", "/negotiations/:id", at);

    const quote = await check("POST", "/negotiations/:id/quotes", { ...at, body: { candidateId: bulk.candidateId }, status: 201 });
    // Above the approval threshold: the buyer is told it needs approval, not the rule or the amount behind it.
    expect(quote.approval).toMatchObject({ status: "pending", reason: "An agreement of this size needs the seller's approval before it can be offered." });
    await check("GET", "/quotes/:id", { params: { id: quote.id } });
    await check("GET", "/public/sellers/:sellerSlug/policies");

    const [q] = store.rows.get(schema.quotes)!;
    const terms = { dealId: "1", buyer: address, seller: address, payee: address, usdc: address, productId: `0x${"00".repeat(32)}`, unitNum: "8000000", unitDen: "1", maxUnits: "100", prepaid: "800000000", start: "0", end: "1", grace: "1", publicTermsHash: `0x${"00".repeat(32)}`, nonce: "1", expiry: "1" };
    store.rows.set(schema.deals, [{ ...base, id: "deal_1", publicId: "PD-1", negotiationId: neg.id, quoteId: q!.id, dealIdOnchain: 1n, buyerAddress: address, sellerAddress: address, payeeAddress: address, terms, publicTerms: q!.publicTerms, termsHash: `0x${"22".repeat(32)}`, buyerSignature: "0x", sellerSignature: "0x", status: "awaiting_funding", fundingTxHash: null, fundedAt: null, deposit: 0n, settled: 0n, refunded: 0n, balancesSource: "pending", apiKeyHash: null, serviceStatus: "pending", acceptedUnits: 0n, acceptedAmount: 0n, acceptedNonce: 0n, sellerClosedAt: null, refundTxHash: null, updatedAt: now }]);
    await check("GET", "/deals/:id", { params: { id: "deal_1" } });
    await check("GET", "/deals/:id/usage", { params: { id: "deal_1" } });
    await check("GET", "/review");
    await check("GET", "/review/:publicId", { params: { publicId: "PD-1" } });

    const routes = [...new Set(apiRoutes().routes.filter((r) => r.method !== "ALL").map((r) => `${r.method} ${r.path}`))].filter((r) => !SIGNED_IN.test(r.split(" ")[1]!));
    expect(routes.filter((r) => !exercised.has(r) && !(r in NOT_EXERCISED)), "public routes with no check").toEqual([]);
  });
});
