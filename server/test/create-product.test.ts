/**
 * createProduct writes a product, its cost model and its policy. A failure partway must leave nothing behind, so a
 * retried publish creates the product exactly once. The database here keeps a transaction's writes only when the whole
 * transaction succeeds, as Postgres does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ committed: [] as { table: unknown; row: unknown }[], failCostModel: 0 }));

vi.mock("../src/db", async () => {
  const schema = await vi.importActual<typeof import("../src/db/schema")>("../src/db/schema");
  const writer = (sink: { table: unknown; row: unknown }[]) => ({
    insert: (table: unknown) => ({
      values: async (row: unknown) => {
        if (table === schema.costModels && store.failCostModel > 0) {
          store.failCostModel--;
          throw new Error("database unavailable");
        }
        sink.push({ table, row });
      },
    }),
  });
  const db = {
    ...writer(store.committed),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending: { table: unknown; row: unknown }[] = [];
      const out = await fn(writer(pending));
      store.committed.push(...pending);
      return out;
    },
  };
  return { db, schema, sql: {} };
});

const { createProduct } = await import("../src/services/accounts");
const { schema } = await import("../src/db");

const input = {
  name: "Heavy Tee",
  slug: "heavy-tee",
  unitLabel: "tee",
  billableUnit: "one tee",
  capabilities: [],
  supportedIntegrations: [],
  tiers: [{ name: "Single", includedUnits: "1", unitPriceUsd: "12", includes: ["Delivery"] }],
  maxUnitsPerDeal: "100",
  termDays: 30,
  refundPolicy: "Refund before dispatch.",
  cost: { variableCostPerUnitUsd: "0", directCostPerDealUsd: "0", txCostBps: 0, floorUnitPriceUsd: "10" },
  policy: { minMarginBps: 0, maxDiscountBps: 1700, approvalThresholdUsd: "2000", prepaidMinimumUsd: "0", availableCapacityUnits: "1000", quoteTtlSeconds: 86400 },
  sellerDelivered: true,
};

const rowsIn = (table: unknown) => store.committed.filter((w) => w.table === table);

describe("createProduct", () => {
  beforeEach(() => {
    store.committed.length = 0;
    store.failCostModel = 0;
  });

  it("leaves no product behind when the cost model cannot be written, and a retry creates it once", async () => {
    store.failCostModel = 1;
    await expect(createProduct("org_1", input)).rejects.toThrow("database unavailable");
    expect(rowsIn(schema.products)).toHaveLength(0);
    expect(store.committed).toHaveLength(0);

    const id = await createProduct("org_1", input);
    expect(rowsIn(schema.products).map((w) => (w.row as { id: string; slug: string }).slug)).toEqual(["heavy-tee"]);
    expect((rowsIn(schema.products)[0]!.row as { id: string }).id).toBe(id);
    expect(rowsIn(schema.costModels)).toHaveLength(1);
    expect(rowsIn(schema.policies)).toHaveLength(1);
  });
});
