import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { serviceOpenApi, serviceSkill } from "../src/services/agentdocs";
import { publicProduct, unitPriceUsd } from "../src/services/catalog";
import { sampleWebhookEvent, signWebhook } from "../src/services/notify";

/** A product shaped like the live custom-tees listing: its unit sentence ends with a period, tiers at $6.60 and $6.50. */
function teesProduct() {
  const tier = (id: string, units: bigint, price: number) => ({ id, name: id, includedUnits: units, unitPrice: { num: BigInt(Math.round(price * 1_000_000)), den: 1n }, includes: [] });
  return {
    org: { id: "org_1", slug: "shoonya-store-t4e", name: "Shoonya Store", label: "live" },
    row: { id: "prd_1", adapter: "order-support", payPerCallPrice: null, starters: [], active: true },
    product: {
      id: "prd_1",
      slug: "custom-tees",
      name: "Custom oversized tees",
      billableUnit: "One custom tee printed or embroidered with the buyer's design, delivered and confirmed by Shoonya Store with proof.",
      unitLabel: "tee",
      capabilities: ["Oversized and Terry Luxe fits", "Sizes S to XXL"],
      supportedIntegrations: [],
      tiers: [tier("starter", 1n, 6.6), tier("bulk", 100n, 6.5)],
      maxUnitsPerDeal: 500n,
      termDays: 30,
      refundPolicy: "Unused balance is refunded after the term.",
    },
    cost: {},
    policy: {},
  } as unknown as Parameters<typeof serviceSkill>[0];
}

describe("docs formatting", () => {
  it("prices always show two decimals, more only for sub-cent prices", () => {
    expect(unitPriceUsd(6_600_000n, 1n)).toBe("$6.60");
    expect(unitPriceUsd(6_500_000n, 1n)).toBe("$6.50");
    expect(unitPriceUsd(6_000_000n, 1n)).toBe("$6.00");
    expect(unitPriceUsd(35_000n, 1n)).toBe("$0.035");
    expect(unitPriceUsd(1_000_000n, 3n)).toBe("$0.3333");
    expect(publicProduct(teesProduct()).tiers.map((t) => t.unitPriceUsd)).toEqual(["$6.60", "$6.50"]);
  });

  it("the generated SKILL.md never doubles a period and shows $6.50, not $6.5", () => {
    const md = serviceSkill(teesProduct(), "https://app.example");
    expect(md).not.toMatch(/[^.]\.\.[^.]/);
    expect(md).toContain("with proof. Capabilities: Oversized and Terry Luxe fits; Sizes S to XXL.");
    expect(md).toContain("from $6.50 per tee");
    expect(md).not.toMatch(/\$\d+\.\d(?!\d)/);
  });

  it("the OpenAPI description does not double the period either", () => {
    const doc = JSON.stringify(serviceOpenApi(teesProduct(), "https://app.example"));
    expect(doc).not.toMatch(/proof\.\./);
  });
});

describe("webhook signing", () => {
  it("signs t.body with HMAC-SHA256 in the documented header format", () => {
    const body = JSON.stringify(sampleWebhookEvent(new Date("2026-11-20T10:00:00Z")));
    const header = signWebhook("whsec_test", 1795122246, body);
    expect(header).toBe(`t=1795122246,v1=${createHmac("sha256", "whsec_test").update(`1795122246.${body}`).digest("hex")}`);
  });

  it("the sample event uses the real envelope and is marked as a test", () => {
    const e = sampleWebhookEvent(new Date("2026-11-20T10:00:00Z"));
    expect(e).toMatchObject({ event: "test", test: true, createdAt: "2026-11-20T10:00:00.000Z" });
    expect(e.id).toMatch(/^evt_test_/);
    expect(e.data).toHaveProperty("amountUsdc");
  });
});
