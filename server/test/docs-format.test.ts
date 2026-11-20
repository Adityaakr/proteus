import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { DELIVERY_TYPES } from "@proteus/domain";
import type { HttpError } from "../src/lib/http";
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

  it("every page says who it is for and what it covers, in the page and in its Markdown", () => {
    for (const sec of SECTIONS) {
      expect(sec.intro.length, sec.id).toBeGreaterThan(60);
      expect(docsMarkdown("https://app.example", sec.id), sec.id).toContain(sec.intro.replace(/\]\(\//g, "](https://app.example/"));
    }
  });

  it("headings have unique anchors, and every internal docs link points at a real page and heading", () => {
    const anchors = SECTIONS.flatMap((s) => s.blocks.filter((b) => b.kind === "h3").map((b) => (b as { id: string }).id));
    expect(new Set(anchors).size).toBe(anchors.length);
    const channelIds = SECTIONS.flatMap((s) => s.blocks.flatMap((b) => (b.kind === "channels" ? b.items.map((c) => c.id) : [])));
    const pageIds = new Set(SECTIONS.map((s) => s.id));
    const known = new Set([...anchors, ...channelIds, ...pageIds]);
    for (const [, page, hash] of md.matchAll(/https:\/\/app\.example\/docs\/([a-z0-9-]+)(?:#([a-z0-9-]+))?\)/g)) {
      if (page === "api") continue; // the buyer HTTP API page (ApiDocs.tsx)
      expect(pageIds.has(page!) || page!.endsWith(".md"), `/docs/${page}`).toBe(true);
      if (hash) expect(known.has(hash), `/docs/${page}#${hash}`).toBe(true);
    }
  });

  it("ways to use: every channel has an honest status, and only proven channels are Live", async () => {
    const { CHANNEL_STATUS, CLAIMS } = await import("../../site/src/app/docs/docsContent");
    const ways = SECTIONS.find((s) => s.id === "ways-to-use")!;
    expect(ways.group).toBe("Start");
    const channels = ways.blocks.flatMap((b) => (b.kind === "channels" ? b.items : []));
    const status = Object.fromEntries(channels.map((c) => [c.id, c.status]));
    for (const id of ["ways-web", "ways-embed", "ways-whatsapp", "ways-phone", "ways-mcp", "ways-own-agent", "ways-seller-api", "ways-front-desk"]) expect(status, id).toHaveProperty(id);
    expect(status["ways-phone"]).toBe("Coming soon");
    expect(channels.filter((c) => c.status === "Live").map((c) => c.id).sort()).toEqual(["ways-agent-docs", "ways-web"]);
    // Agents buying through MCP on mainnet and the WhatsApp channel are not proven: they must not be marked Live.
    expect(CLAIMS.find((c) => c.claim.startsWith("An AI agent buying through MCP on Arc mainnet"))?.status).toBe("not-yet");
    expect(status["ways-mcp"]).not.toBe("Live");
    expect(status["ways-whatsapp"]).not.toBe("Live");
    for (const c of channels) {
      expect(Object.keys(CHANNEL_STATUS)).toContain(c.status);
      expect(md).toContain(`#### ${c.title} · ${c.status}`);
    }
    // The docs home points to it.
    expect(JSON.stringify(SECTIONS.find((s) => s.id === "overview"))).toContain("/docs/ways-to-use");
  });
});

describe("docs match the code", async () => {
  const { API, MCP_TOOLS, docsMarkdown } = await import("../../site/src/app/docs/docsContent");
  const md = docsMarkdown("https://app.example");

  it("every public HTTP endpoint in the docs is a route the server mounts under /api", async () => {
    const { apiRoutes } = await import("../src/routes/api");
    const app = new Hono().route("/api", apiRoutes());
    const param = (p: string) => p.replace(/\{[A-Za-z]+\}|:[A-Za-z]+(\{[^}]*\})?/g, ":p");
    const mounted = new Set(app.routes.filter((r) => r.method !== "ALL").map((r) => `${r.method} ${param(r.path)}`));
    for (const [method, path] of API.endpoints) expect(mounted, `${method} ${path}`).toContain(`${method} ${param(`/api${path.split("?")[0]}`)}`);
  });

  it("the MCP tool table lists exactly the tools the MCP server registers", async () => {
    const { toolNames } = await import("../../packages/mcp/src/server");
    expect(MCP_TOOLS.map(([name]) => name)).toEqual(toolNames);
  });

  it("the Delivery signature carries units and the receipts root, not the amount", () => {
    expect(DELIVERY_TYPES.Delivery).toEqual([
      { name: "dealId", type: "uint256" },
      { name: "receiptsRoot", type: "bytes32" },
      { name: "cumulativeUnits", type: "uint256" },
    ]);
    expect(md).toContain("Delivery (EIP-712): cumulative units and receipts root, no amount");
  });

  it("front desk limits in the docs match what the chat endpoint enforces", async () => {
    const { customerChat } = await import("../src/services/customer-link");
    const status = (token: string, ip: string, body: Record<string, unknown> = {}) =>
      customerChat(token, ip, body).then(() => 200, (e: HttpError) => e.status);
    for (let i = 0; i < 40; i++) expect(await status("tok-ip", "10.0.0.1")).toBe(400);
    expect(await status("tok-ip", "10.0.0.1")).toBe(429);
    for (let i = 0; i < 400; i++) expect(await status("tok-link", `10.1.${i >> 8}.${i & 255}`)).toBe(400);
    expect(await status("tok-link", "10.2.0.1")).toBe(429);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 11 * 60_000);
      expect(await status("tok-ip", "10.0.0.1")).toBe(400);
      expect(await status("tok-link", "10.2.0.2")).toBe(429);
      vi.setSystemTime(Date.now() + 24 * 3600_000);
      expect(await status("tok-link", "10.2.0.3")).toBe(400);
    } finally {
      vi.useRealTimers();
    }
    const customer = (n: number) => Array.from({ length: n }, () => ({ role: "user", text: "hi" }));
    expect(await status("tok-turns", "10.3.0.1", { sessionId: "session-abcdef", messages: customer(14) })).toBe(404);
    expect(await status("tok-turns", "10.3.0.1", { sessionId: "session-abcdef", messages: customer(15) })).toBe(429);
    expect(API.rateLimits).toContain("40 messages per IP per 10 minutes and 400 per customer link per day");
  });
});
