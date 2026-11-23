/**
 * The sandbox must never reach the database, Arc, a signer, money or a webhook. Every module that could is replaced
 * with a tripwire that records and throws on any use; then every sandbox handler runs with valid and invalid input.
 */
import { describe, expect, it, vi } from "vitest";

const touched = vi.hoisted(() => [] as string[]);
const tripwire = vi.hoisted(() => (name: string) =>
  new Proxy({}, {
    get(_t, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "__esModule") return undefined;
      touched.push(`${name}.${prop}`);
      throw new Error(`sandbox reached ${name}.${prop}`);
    },
  }),
);

vi.mock("../src/db", () => tripwire("db"));
vi.mock("../src/chain/client", () => tripwire("chain/client"));
vi.mock("../src/chain/signer", () => tripwire("chain/signer"));
vi.mock("../src/chain/relayer", () => tripwire("chain/relayer"));
vi.mock("../src/chain/reconciler", () => tripwire("chain/reconciler"));
vi.mock("../src/services/notify", () => tripwire("services/notify"));
vi.mock("../src/services/buyer-notify", () => tripwire("services/buyer-notify"));
vi.mock("../src/services/delivery", () => tripwire("services/delivery"));
vi.mock("../src/services/orders", () => tripwire("services/orders"));

const { HttpError } = await import("../src/lib/http");
const { SANDBOX_HANDLERS, SANDBOX_IDS, SANDBOX_KEY, sandboxAuth } = await import("../src/services/sandbox");

const run = (key: string, params: Record<string, string>, body: unknown) => {
  try {
    return { ok: SANDBOX_HANDLERS[key]!({ params, body }) as Record<string, unknown> };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status };
    throw err;
  }
};

const VALID: Record<string, unknown> = {
  "PATCH /v1/seller/products/:id/tiers": { tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }] },
  "PATCH /v1/seller/products/:id/floor": { floorUnitPriceInr: "850" },
  "PATCH /v1/seller/products/:id/listing": { active: false },
  "POST /v1/seller/deals/:id/deliveries": { requestId: "order-2001-batch-2", units: 1, note: "One tee shipped" },
  "POST /v1/seller/deals/:id/order-updates": { status: "shipped", note: "On its way" },
};

describe("seller API sandbox isolation", () => {
  it("runs every handler, reads and dry-run writes, valid and invalid, without touching any real backend", () => {
    expect(() => sandboxAuth(`Bearer ${SANDBOX_KEY}`)).not.toThrow();
    expect(() => sandboxAuth("Bearer psk_live_abc")).toThrow(HttpError);

    const keys = Object.keys(SANDBOX_HANDLERS);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const idOf = key.includes("/products/") ? SANDBOX_IDS.product : SANDBOX_IDS.deal;
      const params: Record<string, string> = key.includes(":id") ? { id: idOf } : {};
      if (key.startsWith("GET ")) {
        expect(run(key, params, undefined).ok, key).toBeDefined();
        if (key.includes(":id")) expect(run(key, { id: "nope" }, undefined)).toEqual({ status: 404 });
        continue;
      }
      expect(VALID[key], `a valid body for ${key}`).toBeDefined();
      expect(run(key, params, VALID[key]).ok, key).toMatchObject({ dryRun: true, persisted: false });
      expect(run(key, params, {}).status, `${key} with an empty body`).toBe(400);
      expect(run(key, params, "not an object").status, `${key} with a bad body`).toBe(400);
      expect(run(key, { id: "nope" }, VALID[key]).status, `${key} on an unknown id`).toBe(404);
    }

    const replay = run("POST /v1/seller/deals/:id/deliveries", { id: SANDBOX_IDS.deal }, { requestId: "order-2001-batch-1", units: 2, note: "First two tees shipped" });
    expect(replay.ok).toMatchObject({ dryRun: true, status: 201 });
    const closed = run("POST /v1/seller/deals/:id/deliveries", { id: SANDBOX_IDS.closedDeal }, VALID["POST /v1/seller/deals/:id/deliveries"]);
    expect(closed.status).toBe(409);

    expect(touched).toEqual([]);
  });
});
