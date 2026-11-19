import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/http";
import { memoryKeyStore } from "../src/services/api-keys";
import { SELLER_API, sellerApiRoutes } from "../src/routes/developers";
import { sandboxCors, sandboxEnabled, sandboxRoutes } from "../src/routes/sandbox";
import { SANDBOX_IDS, SANDBOX_KEY, SANDBOX_PREFIX, SANDBOX_READ_SCOPES } from "../src/services/sandbox";
import { SANDBOX } from "../../site/src/app/sell/developers/reference";

/** The sandbox mounted like index.ts mounts it: its own CORS, the same error mapping. */
function sandbox() {
  const app = new Hono();
  app.use("/api/*", sandboxCors);
  app.route("/api", sandboxRoutes());
  app.onError((err, c) => (err instanceof HttpError ? c.json({ error: err.message, details: err.details ?? null }, err.status as 400) : c.json({ error: "unexpected" }, 500)));
  const call = (method: string, path: string, body?: unknown, key: string | null = SANDBOX_KEY) =>
    app.request(`/api${SANDBOX_PREFIX}${path}`, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "content-type": "application/json", origin: "https://docs.example" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { app, call };
}
const body = async (r: Response) => (await r.json()) as Record<string, any>;

describe("seller API sandbox", () => {
  it("answers every seller API route under its own prefix", async () => {
    const { call } = sandbox();
    for (const r of SELLER_API) {
      const path = r.path.replace("/v1/seller", "").replace(":id", r.path.includes("products/") ? SANDBOX_IDS.product : SANDBOX_IDS.deal);
      const res = await call(r.method, path, r.method === "GET" ? undefined : {});
      // Reads answer; writes with an empty body are refused by the same checks as the real API (400), never 404.
      expect([200, 400], `${r.method} ${r.path}`).toContain(res.status);
      expect(res.headers.get("x-proteus-sandbox")).toBe("1");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("takes only the published key, and refuses real keys without looking them up", async () => {
    const { call } = sandbox();
    expect((await call("GET", "/me", undefined, null)).status).toBe(401);
    expect((await call("GET", "/me", undefined, "nope")).status).toBe(401);
    const real = await call("GET", "/me", undefined, `psk_test_${"A".repeat(43)}`);
    expect(real.status).toBe(401);
    expect((await body(real)).error).toMatch(/real seller API key/);
    const me = await body(await call("GET", "/me"));
    expect(me).toMatchObject({ key: { env: "test", scopes: [...SANDBOX_READ_SCOPES] }, network: "testnet" });
  });

  it("the real seller API refuses the sandbox key", async () => {
    const app = new Hono();
    app.route("/api", sellerApiRoutes(memoryKeyStore(), () => "testnet"));
    app.onError((err, c) => c.json({ error: (err as Error).message }, (err as HttpError).status as 401));
    const res = await app.request("/api/v1/seller/me", { headers: { authorization: `Bearer ${SANDBOX_KEY}` } });
    expect(res.status).toBe(401);
    expect((await body(res)).error).toMatch(/not a seller API key/);
  });

  it("returns the real API's shapes for reads", async () => {
    const { call } = sandbox();
    const deals = (await body(await call("GET", "/deals"))).deals as Record<string, unknown>[];
    expect(Object.keys(deals[0]!).sort()).toEqual(["balancesSource", "buyerAddress", "chainStatus", "createdAt", "deposit", "fundingTxHash", "id", "publicId", "refunded", "remaining", "settled", "status"]);
    expect(deals.find((d) => d.id === SANDBOX_IDS.settledDeal)).toMatchObject({ status: "settled", chainStatus: "active", remaining: "0" });
    const products = (await body(await call("GET", "/products"))).products as { tiers: { unitPriceUsd: string }[] }[];
    expect(products[0]!.tiers.map((t) => t.unitPriceUsd)).toEqual(["$6.60", "$6.50"]);
    const pay = await body(await call("GET", "/payments"));
    expect(pay).toMatchObject({ funded: "372600000", settled: "169800000", refunded: "150000000", liability: "52800000" });
    expect((await call("GET", "/deals/deal_nope")).status).toBe(404);
  });

  it("writes are dry runs: same checks as the real API, nothing changes", async () => {
    const { call } = sandbox();
    const before = await (await call("GET", "/deals")).text();
    const ok = await body(await call("POST", `/deals/${SANDBOX_IDS.deal}/deliveries`, { requestId: "order-2001-batch-2", units: 3, note: "Three tees shipped", proofUrl: "https://track.example/2001" }));
    expect(ok).toMatchObject({ dryRun: true, persisted: false, status: 201, wouldReturn: { units: 3, deal: { cumulativeUnits: "5", cumulativeCharged: "33000000" } } });
    expect(ok.wouldReturn.receipt).toMatchObject({ digest: null, sellerSignature: null });
    // Doing it again is still a dry run on the same data: totals do not move.
    const again = await body(await call("POST", `/deals/${SANDBOX_IDS.deal}/deliveries`, { requestId: "order-2001-batch-2", units: 3, note: "Three tees shipped" }));
    expect(again.wouldReturn.deal.cumulativeUnits).toBe("5");
    expect(await (await call("GET", "/deals")).text()).toBe(before);

    // The real API's refusals, word for word.
    const err = async (method: string, path: string, b: unknown) => { const r = await call(method, path, b); return [r.status, (await body(r)).error]; };
    expect(await err("POST", `/deals/${SANDBOX_IDS.deal}/deliveries`, { requestId: "x", units: 1, note: "abc" })).toEqual([400, "requestId: 4 to 80 letters, digits, . _ : -"]);
    expect(await err("POST", `/deals/${SANDBOX_IDS.deal}/deliveries`, { requestId: "big-1", units: 9, note: "too many" })).toEqual([409, "This would deliver 11 units; the agreement covers 10."]);
    expect(await err("POST", `/deals/${SANDBOX_IDS.closedDeal}/deliveries`, { requestId: "late-1", units: 1, note: "late" })).toEqual([409, "deal is closed; deliveries can be recorded only on a funded deal"]);
    expect(await err("POST", `/deals/${SANDBOX_IDS.deal}/order-updates`, { status: "delayed" })).toEqual([400, "tell the buyer why and the new expected date"]);
    expect(await err("PATCH", `/products/${SANDBOX_IDS.product}/tiers`, { tiers: [{ name: "A", includedUnits: "1", unitPriceUsd: "0" }] })).toEqual([400, "tier 1: enter a unit price in dollars, more than 0"]);
    expect(await err("PATCH", `/products/${SANDBOX_IDS.product}/listing`, { active: "no" })).toEqual([400, "active must be true or false"]);

    const tiers = await body(await call("PATCH", `/products/${SANDBOX_IDS.product}/tiers`, { tiers: [{ name: "Bulk", includedUnits: "100", unitPriceUsd: "6.40" }, { name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }] }));
    expect(tiers.wouldReturn.tiers.map((t: { name: string; unitPriceUsd: string }) => `${t.name} ${t.unitPriceUsd}`)).toEqual(["Starter $6.60", "Bulk $6.40"]);
    const products = (await body(await call("GET", "/products"))).products as { tiers: { unitPriceUsd: string }[] }[];
    expect(products[0]!.tiers.map((t) => t.unitPriceUsd)).toEqual(["$6.60", "$6.50"]);
  });

  it("is reachable from any origin without cookies", async () => {
    const { app } = sandbox();
    const pre = await app.request(`/api${SANDBOX_PREFIX}/me`, { method: "OPTIONS", headers: { origin: "https://app.proteus.co.in", "access-control-request-method": "GET", "access-control-request-headers": "authorization" } });
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-credentials")).toBeNull();
    const err = await sandbox().call("GET", "/me", undefined, null);
    expect(err.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("is mounted on testnet only", () => {
    expect(sandboxEnabled("testnet")).toBe(true);
    expect(sandboxEnabled("mainnet")).toBe(false);
  });

  it("cannot reach the database, the chain, money or webhooks: its modules import only pure code", () => {
    const imports = (file: string) => [...readFileSync(resolve(__dirname, "../src", file), "utf8").matchAll(/^import[^;]*?from\s+"([^"]+)"/gms)].map((m) => m[1]);
    expect(imports("services/sandbox.ts").sort()).toEqual(["../lib/http", "./seller-api-rules", "@proteus/domain"].sort());
    expect(imports("services/seller-api-rules.ts").sort()).toEqual(["../lib/http", "@proteus/domain"].sort());
    expect(imports("lib/http.ts")).toEqual(["hono"]);
  });

  it("the docs and the Developers page use the same key, prefix and ids", () => {
    expect(SANDBOX).toEqual({ key: SANDBOX_KEY, path: `/api${SANDBOX_PREFIX}`, ids: SANDBOX_IDS, readScopes: [...SANDBOX_READ_SCOPES], baseUrl: `https://ai.proteus.co.in/api${SANDBOX_PREFIX}` });
  });
});

describe("the docs' example requests", () => {
  it("every documented example body passes the API's own checks (run as sandbox dry runs)", async () => {
    const { endpointExamples } = await import("../../site/src/app/sell/developers/reference");
    const { call } = sandbox();
    for (const ex of endpointExamples("https://app.example/api/v1/seller").filter((e) => e.example)) {
      const path = ex.path.replace("/v1/seller", "").replace(":id", ex.path.includes("products/") ? SANDBOX_IDS.product : SANDBOX_IDS.deal);
      const res = await call(ex.method, path, ex.example);
      const out = await body(res);
      expect(res.status, `${ex.method} ${ex.path}: ${out.error ?? ""}`).toBe(200);
      expect(out).toMatchObject({ dryRun: true, status: ex.status });
    }
  });
});
