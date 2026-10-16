import { describe, expect, it } from "vitest";
import { cumulativeCharge, evaluate, evaluateCounteroffer, formatUsd, fromMicro, getQuoteCandidates, incrementalCharge, toMicro, toPublicCandidate, type CostModel, type EvaluationContext, type Policy, type Product } from "../src";

/** Sample seller: AI order-support service. Illustrative numbers. */
const product: Product = {
  id: "p_support",
  slug: "order-support",
  name: "AI order support",
  billableUnit: "a supported order-status answer acknowledged by the buyer",
  unitLabel: "resolution",
  supportedIntegrations: ["rest-api", "webhook"],
  capabilities: ["Order status lookup", "Delivery questions", "Human handoff"],
  tiers: [
    { id: "starter", name: "Starter", includedUnits: 1500n, unitPrice: { num: 960_000n, den: 1n }, includes: ["Order status", "Delivery questions", "Human handoff"] },
    { id: "growth", name: "Growth", includedUnits: 2000n, unitPrice: { num: 850_000n, den: 1n }, includes: ["Order status", "Delivery questions", "Human handoff", "Priority support"] },
  ],
  maxUnitsPerDeal: 10_000n,
  termDays: 30,
  refundPolicy: "Unused prepaid balance is refundable after the term ends plus a 3-day grace window.",
};

const cost: CostModel = { version: 1, variableCostPerUnit: 520_000n, directCostPerDeal: 20_000_000n, txCostBps: 50n, freshUntil: Date.now() + 86_400_000 };
const policy: Policy = { version: 1, minMarginBps: 3500n, maxDiscountBps: 1500n, approvalThreshold: toMicro("2500"), prepaidMinimum: toMicro("200"), availableCapacityUnits: 6000n, quoteTtlSeconds: 3600, allowNonPositiveContribution: false };
const ctx: EvaluationContext = { product, cost, policy, now: Date.now() };

describe("money", () => {
  it("round-trips decimals as micro", () => {
    expect(toMicro("1440")).toBe(1_440_000_000n);
    expect(toMicro("0.96")).toBe(960_000n);
    expect(fromMicro(1_440_000_000n, { trim: true })).toBe("1440");
    expect(formatUsd(1_440_000_000n)).toBe("$1,440.00");
  });
  it("cumulative metering never leaks rounding", () => {
    const price = { num: 1n, den: 3n }; // one third of a micro per unit
    let charged = 0n;
    for (let u = 1n; u <= 10_000n; u++) charged += incrementalCharge(u, price, charged);
    expect(charged).toBe(cumulativeCharge(10_000n, price));
    expect(charged).toBe(3333n);
  });
});

describe("candidates", () => {
  it("rejects the $1,500 for 2,000 units ask below the floor and offers a budget fit", () => {
    const req = { desiredUnits: 2000n, budget: toMicro("1500"), integrations: ["zendesk"], notes: [], openQuestions: [] };
    const cands = getQuoteCandidates(ctx, req);
    const requested = cands.find((c) => c.units === 2000n)!;
    // 2000 units at $0.85 list = $1,700 revenue; cost 2000*0.52 = 1040 + tx 8.5 + direct 20 => contribution 631.5 => 37% ok at list
    expect(requested.status).toBe("eligible");
    const fit = cands.find((c) => c.origins.includes("budget_fit"))!;
    expect(fit.status).toBe("eligible");
    expect(fit.units).toBe(1500n); // $1500 / $0.96 = 1562 -> 1500
    expect(fit.prepaidTotal).toBe(toMicro("1440"));
    expect(fit.unsupportedIntegrations).toEqual(["zendesk"]);
    expect(fit.rules).toContain("UNSUPPORTED_INTEGRATION");
  });

  it("counter to $1,500 for 2,000 units is rejected by MARGIN_FLOOR_BPS with an alternative", () => {
    const req = { desiredUnits: 2000n, budget: toMicro("1500"), integrations: [], notes: [], openQuestions: [] };
    const base = getQuoteCandidates(ctx, req).find((c) => c.units === 2000n)!;
    const d = evaluateCounteroffer(ctx, base, { targetTotal: toMicro("1500") }, req);
    expect(d.decision).toBe("rejected");
    if (d.decision === "rejected") {
      expect(d.candidate.rules).toContain("MARGIN_FLOOR_BPS");
      expect(d.alternative?.units).toBe(1500n);
      expect(d.alternative?.prepaidTotal).toBe(toMicro("1440"));
    }
  });

  it("requires approval above the threshold", () => {
    const req = { desiredUnits: 4000n, integrations: [], notes: [], openQuestions: [] };
    const c = getQuoteCandidates(ctx, req).find((x) => x.origin === "requested_units")!;
    expect(c.status).toBe("approval_required");
    expect(c.rules).toContain("APPROVAL_THRESHOLD");
  });

  it("caps by capacity", () => {
    const req = { desiredUnits: 8000n, integrations: [], notes: [], openQuestions: [] };
    const c = getQuoteCandidates(ctx, req).find((x) => x.origin === "requested_units")!;
    expect(c.status).toBe("rejected");
    expect(c.rules).toContain("CAPACITY");
  });

  it("cost shock changes future quotes only (pure function of ctx)", () => {
    const req = { desiredUnits: 2000n, integrations: [], notes: [], openQuestions: [] };
    const before = getQuoteCandidates(ctx, req).find((x) => x.units === 2000n)!;
    const shocked: EvaluationContext = { ...ctx, cost: { ...cost, version: 2, variableCostPerUnit: 600_000n } };
    const after = getQuoteCandidates(shocked, req).find((x) => x.units === 2000n)!;
    expect(before.status).toBe("eligible");
    expect(after.status).toBe("rejected");
    expect(after.candidateId).not.toBe(before.candidateId);
  });

  it("public projection never carries economics or rule ids", () => {
    const req = { desiredUnits: 2000n, budget: toMicro("1500"), integrations: [], notes: [], openQuestions: [] };
    const c = getQuoteCandidates(ctx, req)[0]!;
    const pub = toPublicCandidate(c) as unknown as Record<string, unknown>;
    expect(pub.economics).toBeUndefined();
    expect(pub.rules).toBeUndefined();
    expect(JSON.stringify(pub, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/variableCost|marginBps|contribution/);
  });

  it("evaluate is deterministic for the same inputs", () => {
    const tier = product.tiers[0]!;
    const req = { integrations: [], notes: [], openQuestions: [] };
    const a = evaluate(ctx, { tier, units: 1500n, unitPrice: tier.unitPrice, origin: "tier", requested: req });
    const b = evaluate(ctx, { tier, units: 1500n, unitPrice: tier.unitPrice, origin: "tier", requested: req });
    expect(a.candidateId).toBe(b.candidateId);
  });
});
