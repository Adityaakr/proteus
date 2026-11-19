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

describe("generated docs", async () => {
  const { SECTIONS, docsMarkdown, endpointAnchor } = await import("../../site/src/app/docs/docsContent");
  const { SELLER_API_REFERENCE, endpointExamples, quickstartSnippets } = await import("../../site/src/app/sell/developers/reference");
  const md = docsMarkdown("https://app.example");

  it("never doubles a period and shows prices with two decimals", () => {
    expect(md).not.toMatch(/[^.]\.\.[^.]/);
    expect(md).not.toMatch(/\$\d+\.\d(?![\dBMKT])/);
  });

  it("the Developers group reads Overview, API reference, Webhooks in the sidebar", () => {
    expect(SECTIONS.filter((s) => s.group === "Developers").map((s) => s.nav ?? s.title)).toEqual(["Overview", "API reference", "Webhooks"]);
  });

  it("the reference documents every seller API route, with its parameters and errors", () => {
    const ref = SECTIONS.find((s) => s.id === "seller-api-reference")!;
    const documented = ref.blocks.filter((b) => b.kind === "endpoint").map((b) => (b as { method: string; path: string }).method + " " + (b as { path: string }).path);
    expect(documented).toEqual(SELLER_API_REFERENCE.map((r) => `${r.method} ${r.path}`));
    for (const r of SELLER_API_REFERENCE) expect(ref.blocks.some((b) => b.kind === "h3" && b.id === endpointAnchor(r.method, r.path))).toBe(true);
    for (const ex of endpointExamples("https://app.example/api/v1/seller")) {
      const route = SELLER_API_REFERENCE.find((r) => r.method === ex.method && r.path === ex.path)!;
      expect(ex.params.some((p) => p.in === "path"), `${ex.method} ${ex.path}`).toBe(ex.path.includes(":id"));
      const bodyParams = ex.params.filter((p) => p.in === "body" && !p.name.includes("[]")).map((p) => p.name);
      expect(Object.keys(ex.example ?? {}).every((k) => bodyParams.includes(k)), `${ex.method} ${ex.path}`).toBe(true);
      expect(ex.example === null, `${ex.method} ${ex.path}`).toBe(ex.method === "GET");
      expect(ex.errors.map((e) => e.status)).toContain("401");
      if (route.scope) expect(ex.errors.find((e) => e.status === "403")?.when).toContain(route.scope);
      expect(ex.bash.split("\n").every((l) => l.length <= 100), `${ex.method} ${ex.path}: no curl line runs off the block`).toBe(true);
    }
  });

  it("quickstart steps name real routes", () => {
    for (const st of quickstartSnippets("https://app.example/api/v1/seller", "test")) expect(SELLER_API_REFERENCE.map((r) => `${r.method} ${r.path}`)).toContain(st.route);
  });

  it("every diagram on a page also has a plain-text description for /docs.md", () => {
    const diagrams = SECTIONS.flatMap((s) => s.blocks.filter((b) => b.kind === "diagram")) as { caption: string; describe: string }[];
    expect(diagrams.length).toBeGreaterThanOrEqual(6);
    for (const d of diagrams) {
      expect(d.describe.length).toBeGreaterThan(80);
      expect(md).toContain(d.describe);
    }
  });
});
