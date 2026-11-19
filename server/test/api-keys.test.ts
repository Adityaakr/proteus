import { createHash } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/http";
import { authenticateKey, createKey, DEFAULT_OVERLAP_HOURS, envForNetwork, generateKey, hashKey, keyEnvOf, listKeys, MAX_OVERLAP_HOURS, memoryKeyStore, regenerateKey, revokeKey, SCOPE_INFO, SCOPES, type Network } from "../src/services/api-keys";
import { SELLER_API, sellerApiRoutes } from "../src/routes/developers";
import { WEBHOOK_EVENTS } from "../src/services/notify";
import { endpointExamples, KEY_RULES, SCOPES_REFERENCE, SELLER_API_REFERENCE, WEBHOOK_EVENTS_REFERENCE } from "../../site/src/app/sell/developers/reference";

const ORG = "org_shop";
const t0 = new Date("2026-11-20T10:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 3600_000);

/** The seller API mounted like index.ts mounts it, with the same error mapping and an in-memory key store. */
function api(network: Network, store = memoryKeyStore()) {
  const app = new Hono();
  app.route("/api", sellerApiRoutes(store, () => network));
  app.onError((err, c) => (err instanceof HttpError ? c.json({ error: err.message, details: err.details ?? null }, err.status as 401) : c.json({ error: "unexpected" }, 500)));
  return { app, store, get: (path: string, key?: string) => app.request(`/api${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} }) };
}

const expectStatus = async (p: Promise<unknown>, status: number) => {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e: HttpError) => expect(e.status).toBe(status));
};

describe("key generation and hashing", () => {
  it("makes high-entropy keys with a visible environment prefix and stores only a SHA-256", () => {
    const live = generateKey("live");
    const test = generateKey("test");
    expect(live.key).toMatch(/^psk_live_[A-Za-z0-9_-]{43}$/);
    expect(test.key).toMatch(/^psk_test_[A-Za-z0-9_-]{43}$/);
    expect(live.hash).toBe(createHash("sha256").update(live.key).digest("hex"));
    expect(live.hash).toBe(hashKey(live.key));
    expect(live.hash).not.toContain(live.key.slice(9));
    expect(live.prefix).toBe(live.key.slice(0, 13));
    expect(live.last4).toBe(live.key.slice(-4));
    expect(new Set(Array.from({ length: 200 }, () => generateKey("live").key)).size).toBe(200);
  });

  it("reads the environment from a key and rejects anything else", () => {
    expect(keyEnvOf(generateKey("live").key)).toBe("live");
    expect(keyEnvOf(generateKey("test").key)).toBe("test");
    expect(keyEnvOf("pk_live_abc")).toBeNull();
    expect(keyEnvOf("psk_live_short")).toBeNull();
    expect(envForNetwork("mainnet")).toBe("live");
    expect(envForNetwork("testnet")).toBe("test");
  });
});

describe("one-time reveal", () => {
  it("returns the full key only from create; storage and listings hold the hash and a mask", async () => {
    const store = memoryKeyStore();
    const { key, secret } = await createKey(store, { orgId: ORG, name: "Order sync", scopes: ["deals:read"], env: "live" }, t0);
    expect(secret).toMatch(/^psk_live_/);
    const row = store.rows[0]!;
    expect(row.keyHash).toBe(hashKey(secret));
    expect(JSON.stringify(row)).not.toContain(secret);
    expect(JSON.stringify(row)).not.toContain(secret.slice(13, -4));
    expect(key.masked.startsWith(secret.slice(0, 13))).toBe(true);
    expect(key.masked.endsWith(secret.slice(-4))).toBe(true);
    const listed = await listKeys(store, ORG, t0);
    expect(JSON.stringify(listed)).not.toContain(secret);
    expect(listed[0]).not.toHaveProperty("keyHash");
    expect(listed[0]).not.toHaveProperty("secret");
    expect(listed[0]).toMatchObject({ name: "Order sync", env: "live", scopes: ["deals:read"], state: "active", lastUsedAt: null });
  });

  it("validates the name and permissions", async () => {
    const store = memoryKeyStore();
    await expectStatus(createKey(store, { orgId: ORG, name: "  ", scopes: ["deals:read"], env: "live" }), 400);
    await expectStatus(createKey(store, { orgId: ORG, name: "x", scopes: [], env: "live" }), 400);
    await expectStatus(createKey(store, { orgId: ORG, name: "x", scopes: ["admin"], env: "live" }), 400);
  });
});

describe("authentication, last used and revoke", () => {
  it("records last-used time on each authenticated call", async () => {
    const store = memoryKeyStore();
    const { secret } = await createKey(store, { orgId: ORG, name: "a", scopes: ["deals:read"], env: "live" }, t0);
    const p = await authenticateKey(store, `Bearer ${secret}`, "mainnet", at(1));
    expect(p).toMatchObject({ orgId: ORG, env: "live", scopes: ["deals:read"] });
    expect(store.rows[0]!.lastUsedAt).toEqual(at(1));
  });

  it("refuses missing, malformed and unknown keys", async () => {
    const store = memoryKeyStore();
    await expectStatus(authenticateKey(store, undefined, "mainnet"), 401);
    await expectStatus(authenticateKey(store, "Bearer nope", "mainnet"), 401);
    await expectStatus(authenticateKey(store, `Bearer ${generateKey("live").key}`, "mainnet"), 401);
  });

  it("revoke takes effect immediately", async () => {
    const store = memoryKeyStore();
    const { key, secret } = await createKey(store, { orgId: ORG, name: "a", scopes: ["deals:read"], env: "live" }, t0);
    await authenticateKey(store, `Bearer ${secret}`, "mainnet", at(1));
    const revoked = await revokeKey(store, ORG, key.id, at(2));
    expect(revoked.state).toBe("revoked");
    await expectStatus(authenticateKey(store, `Bearer ${secret}`, "mainnet", at(2)), 401);
    await expectStatus(revokeKey(store, "org_other", key.id, at(2)), 404);
  });
});

describe("regenerate", () => {
  it("with an overlap, the old key works until the window ends and the new key works at once", async () => {
    const store = memoryKeyStore();
    const first = await createKey(store, { orgId: ORG, name: "Shop backend", scopes: ["deals:read", "deliveries:write"], env: "live" }, t0);
    const r = await regenerateKey(store, ORG, first.key.id, { overlapHours: 24 }, at(1));
    expect(r.secret).not.toBe(first.secret);
    expect(r.key).toMatchObject({ name: "Shop backend", env: "live", scopes: ["deals:read", "deliveries:write"], state: "active" });
    expect(r.previous).toMatchObject({ state: "expiring", replacedBy: r.key.id });
    expect(new Date(r.previous!.expiresAt!)).toEqual(at(25));
    await authenticateKey(store, `Bearer ${first.secret}`, "mainnet", at(24.9));
    await authenticateKey(store, `Bearer ${r.secret}`, "mainnet", at(2));
    await expectStatus(authenticateKey(store, `Bearer ${first.secret}`, "mainnet", at(25)), 401);
    await authenticateKey(store, `Bearer ${r.secret}`, "mainnet", at(25));
    // The replaced key cannot be regenerated again; its replacement can.
    await expectStatus(regenerateKey(store, ORG, first.key.id, { overlapHours: 24 }, at(2)), 409);
  });

  it("with no overlap, the old key stops immediately", async () => {
    const store = memoryKeyStore();
    const first = await createKey(store, { orgId: ORG, name: "leaked", scopes: ["payments:read"], env: "live" }, t0);
    const r = await regenerateKey(store, ORG, first.key.id, { overlapHours: 0 }, at(1));
    expect(r.previous).toMatchObject({ state: "revoked" });
    await expectStatus(authenticateKey(store, `Bearer ${first.secret}`, "mainnet", at(1)), 401);
    await authenticateKey(store, `Bearer ${r.secret}`, "mainnet", at(1));
  });

  it("an old key inside its overlap can still be revoked at once", async () => {
    const store = memoryKeyStore();
    const first = await createKey(store, { orgId: ORG, name: "a", scopes: ["deals:read"], env: "live" }, t0);
    await regenerateKey(store, ORG, first.key.id, { overlapHours: 24 }, at(1));
    await revokeKey(store, ORG, first.key.id, at(2));
    await expectStatus(authenticateKey(store, `Bearer ${first.secret}`, "mainnet", at(3)), 401);
  });

  it("rejects an out-of-range overlap and a key that no longer works", async () => {
    const store = memoryKeyStore();
    const k = await createKey(store, { orgId: ORG, name: "a", scopes: ["deals:read"], env: "live" }, t0);
    await expectStatus(regenerateKey(store, ORG, k.key.id, { overlapHours: 1000 }, at(1)), 400);
    await revokeKey(store, ORG, k.key.id, at(1));
    await expectStatus(regenerateKey(store, ORG, k.key.id, { overlapHours: 1 }, at(2)), 409);
  });
});

describe("test and live separation", () => {
  it("a test key never works on the mainnet API and a live key never works on testnet", async () => {
    const store = memoryKeyStore();
    const test = await createKey(store, { orgId: ORG, name: "t", scopes: ["deals:read"], env: "test" }, t0);
    const live = await createKey(store, { orgId: ORG, name: "l", scopes: ["deals:read"], env: "live" }, t0);
    await expectStatus(authenticateKey(store, `Bearer ${test.secret}`, "mainnet", at(1)), 401);
    await expectStatus(authenticateKey(store, `Bearer ${live.secret}`, "testnet", at(1)), 401);
    await authenticateKey(store, `Bearer ${test.secret}`, "testnet", at(1));
    await authenticateKey(store, `Bearer ${live.secret}`, "mainnet", at(1));
  });

  it("a stored row whose environment does not match the key prefix is refused", async () => {
    const store = memoryKeyStore();
    const { secret } = await createKey(store, { orgId: ORG, name: "l", scopes: ["deals:read"], env: "live" }, t0);
    store.rows[0]!.env = "test";
    await expectStatus(authenticateKey(store, `Bearer ${secret}`, "mainnet", at(1)), 401);
  });

  it("the seller API answers 401 for the wrong environment through the real router", async () => {
    const main = api("mainnet");
    const test = await createKey(main.store, { orgId: ORG, name: "t", scopes: ["deals:read"], env: "test" }, t0);
    const res = await main.get("/v1/seller/me", test.secret);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toMatch(/test key/i);
  });
});

describe("scope enforcement on the seller API", () => {
  it("every route needs a key and the permission listed for it", async () => {
    const { store, get, app } = api("mainnet");
    const none = await createKey(store, { orgId: ORG, name: "products only", scopes: ["products:write"], env: "live" }, t0);
    // No key at all: 401 on every route, before any handler runs.
    for (const r of SELLER_API) {
      const res = await app.request(`/api${r.path.replace(":id", "x")}`, { method: r.method });
      expect(res.status, `${r.method} ${r.path}`).toBe(401);
    }
    // A key without the scope: 403 naming the missing permission, before the handler (which would need the database) runs.
    for (const r of SELLER_API.filter((x) => x.scope && x.scope !== "products:write")) {
      const res = await app.request(`/api${r.path.replace(":id", "x")}`, { method: r.method, headers: { authorization: `Bearer ${none.secret}`, "content-type": "application/json" }, body: r.method === "GET" ? undefined : "{}" });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
      expect(((await res.json()) as { details: { required: string } }).details.required).toBe(r.scope);
    }
    const me = await get("/v1/seller/me", none.secret);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ orgId: ORG, key: { name: "products only", env: "live", scopes: ["products:write"] }, network: "mainnet" });
    expect(store.rows[0]!.lastUsedAt).not.toBeNull();
  });

  it("maps each permission to the routes the captain listed", () => {
    const scopeOf = (m: string, p: string) => SELLER_API.find((r) => r.method === m && r.path === p)?.scope;
    expect(scopeOf("GET", "/v1/seller/deals")).toBe("deals:read");
    expect(scopeOf("GET", "/v1/seller/deals/:id")).toBe("deals:read");
    expect(scopeOf("GET", "/v1/seller/usage")).toBe("usage:read");
    expect(scopeOf("GET", "/v1/seller/payments")).toBe("payments:read");
    expect(scopeOf("PATCH", "/v1/seller/products/:id/tiers")).toBe("products:write");
    expect(scopeOf("PATCH", "/v1/seller/products/:id/listing")).toBe("products:write");
    expect(scopeOf("POST", "/v1/seller/deals/:id/deliveries")).toBe("deliveries:write");
    expect(scopeOf("POST", "/v1/seller/deals/:id/order-updates")).toBe("deliveries:write");
  });

  it("the dashboard's API reference matches the routes", () => {
    expect(SELLER_API_REFERENCE.map((r) => [r.method, r.path, r.scope])).toEqual(SELLER_API.map((r) => [r.method, r.path, r.scope]));
  });

  it("the public docs match the code: every route has an example, and scopes, overlap hours and webhook events agree", () => {
    const examples = endpointExamples("https://app.example/api/v1/seller");
    expect(examples.map((e) => [e.method, e.path])).toEqual(SELLER_API.map((r) => [r.method, r.path]));
    for (const e of examples) {
      expect(e.bash, `${e.method} ${e.path}`).toMatch(e.method === "GET" ? /^curl https:\/\/app\.example\/api\/v1\/seller\// : new RegExp(`^curl -X ${e.method} https://app\\.example/api/v1/seller/`));
      expect(e.ts).toContain("fetch(");
      expect(e.bash + e.ts).not.toMatch(/psk_(test|live)_[A-Za-z0-9_-]{43}/);
    }
    expect(SCOPES_REFERENCE.map((x) => x.id)).toEqual([...SCOPES]);
    for (const x of SCOPES_REFERENCE) expect({ label: x.label, description: x.description }).toEqual(SCOPE_INFO[x.id]);
    expect([KEY_RULES.overlapDefaultHours, KEY_RULES.overlapMaxHours]).toEqual([DEFAULT_OVERLAP_HOURS, MAX_OVERLAP_HOURS]);
    expect(WEBHOOK_EVENTS_REFERENCE.map((e) => ({ event: e.event, title: e.title }))).toEqual(WEBHOOK_EVENTS);
  });
});
