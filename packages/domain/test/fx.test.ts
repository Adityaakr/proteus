import { describe, expect, it } from "vitest";
import {
  applyFx,
  candidateIdFor,
  checkoutLine,
  dualText,
  evaluate,
  evaluateCounteroffer,
  formatInr,
  formatUsdc,
  getQuoteCandidates,
  inrBudgetToUsdc,
  inrFloorHolds,
  inrToUsdc,
  reviveLocalPrice,
  localPriceJson,
  toMicro,
  toPaise,
  toPublicCandidate,
  usdcToInr,
  type CostModel,
  type EvaluationContext,
  type FxRate,
  type Policy,
  type Product,
} from "../src";

const rate = (perUsd: string, asOf = "2026-11-20"): FxRate => ({ currency: "INR", perUsd, asOf, kind: "fixed", source: "Seller's fixed rate" });
const R = rate("92.68");

/** A Shoonya-style product priced in rupees: ₹1,050 a hoodie, ₹900 each from 50. */
const product: Product = {
  id: "p_hoodie",
  slug: "hoodie",
  name: "Hoodie",
  billableUnit: "one hoodie delivered",
  unitLabel: "hoodie",
  supportedIntegrations: [],
  capabilities: ["Custom print"],
  tiers: [
    { id: "single", name: "Single", includedUnits: 1n, unitPrice: { num: toMicro("11.33"), den: 1n }, unitPriceInr: toPaise("1050"), includes: [] },
    { id: "bulk", name: "Bulk", includedUnits: 50n, unitPrice: { num: toMicro("9.72"), den: 1n }, unitPriceInr: toPaise("900"), includes: [] },
  ],
  maxUnitsPerDeal: 1000n,
  termDays: 30,
  refundPolicy: "Unused balance refunds after the term.",
};
const cost: CostModel = { version: 3, variableCostPerUnit: 0n, directCostPerDeal: 0n, txCostBps: 0n, freshUntil: Date.now() + 86_400_000, floorUnitPriceInr: toPaise("850") };
const policy: Policy = { version: 2, minMarginBps: 0n, maxDiscountBps: 9000n, approvalThreshold: toMicro("100000"), prepaidMinimum: 0n, availableCapacityUnits: 100000n, quoteTtlSeconds: 3600, allowNonPositiveContribution: false };
const ctxAt = (fx: FxRate | undefined): EvaluationContext => ({ product: applyFx(product, fx), cost, policy, now: Date.now(), fx });
const noReq = { integrations: [], notes: [], openQuestions: [] };

describe("conversion", () => {
  it("converts rupees to USDC rounded up to the cent, as the captain's examples read", () => {
    expect(inrToUsdc(toPaise("1050"), R)).toBe(toMicro("11.33"));
    expect(inrToUsdc(toPaise("45000"), R)).toBe(toMicro("485.55")); // 485.5416 -> 485.55
    expect(inrToUsdc(toPaise("92.68"), R)).toBe(toMicro("1")); // exact stays exact
    expect(inrToUsdc(toPaise("3"), R)).toBe(toMicro("0.0324")); // under 1 USDC: four decimals
  });
  it("rounds a rupee budget down so an offer within it is within the rupee budget", () => {
    expect(inrBudgetToUsdc(toPaise("45000"), R)).toBe(toMicro("485.54"));
  });
  it("converts USDC to rupees to the nearest paisa", () => {
    expect(usdcToInr(toMicro("485.55"), R)).toBe(toPaise("45000.77"));
    expect(usdcToInr(toMicro("1"), R)).toBe(toPaise("92.68"));
  });
  it("parses and formats rupees with Indian grouping", () => {
    expect(toPaise("₹1,299.5")).toBe(129950n);
    expect(() => toPaise("12.345")).toThrow();
    expect(formatInr(toPaise("45000"))).toBe("₹45,000");
    expect(formatInr(toPaise("105000"))).toBe("₹1,05,000");
    expect(formatInr(toPaise("1299.50"))).toBe("₹1,299.50");
    expect(formatInr(toPaise("45000.77"), { whole: true })).toBe("₹45,001");
    expect(formatUsdc(toMicro("485.55"))).toBe("485.55 USDC");
    expect(formatUsdc(toMicro("0.035"))).toBe("0.035 USDC");
  });
  it("shows the chosen currency first and the other in brackets, and never invents a rate", () => {
    expect(dualText({ usdc: toMicro("11.33"), inr: toPaise("1050"), stated: true }, "INR").text).toBe("₹1,050 (≈ 11.33 USDC)");
    expect(dualText({ usdc: toMicro("11.33"), inr: toPaise("1050"), stated: true }, "USD").text).toBe("$11.33 (≈ ₹1,050)");
    expect(dualText({ usdc: toMicro("11.33") }, "INR").text).toBe("$11.33");
  });
  it("states the checkout amount in USDC with the rupee amount and the fixed rate", () => {
    expect(checkoutLine(toMicro("485.55"), { total: toPaise("45000"), rate: R, stated: true })).toBe("You pay 485.55 USDC (₹45,000 at ₹92.68/$, rate fixed for this offer)");
    expect(checkoutLine(toMicro("485.55"))).toBe("You pay 485.55 USDC");
  });
});

describe("rupee list prices", () => {
  it("re-converts at the current rate, so the rupee price holds when the rate moves", () => {
    expect(applyFx(product, R).tiers[0]!.unitPrice.num).toBe(toMicro("11.33"));
    expect(applyFx(product, rate("88")).tiers[0]!.unitPrice.num).toBe(toMicro("11.94")); // 1050/88 = 11.9318 -> 11.94
    expect(applyFx(product, undefined)).toBe(product);
  });
  it("offers carry the seller's exact rupee amounts and the rate they are fixed at", () => {
    const [single] = getQuoteCandidates(ctxAt(R), { ...noReq, desiredUnits: 40n });
    expect(single!.units).toBe(40n);
    expect(single!.prepaidTotal).toBe(toMicro("453.18")); // ₹42,000 / 92.68 = 453.1722, converted once
    expect(single!.local).toMatchObject({ unitPrice: toPaise("1050"), total: toPaise("42000"), stated: true });
    expect(single!.local!.rate.perUsd).toBe("92.68");
    // Buyer-safe: the projection keeps the rupee price.
    expect(toPublicCandidate(single!).local?.total).toBe(toPaise("42000"));
  });
  it("converts a tier's rupee total once, so 50 × ₹900 is 485.55 USDC and the checkout line adds up", () => {
    const bulk = getQuoteCandidates(ctxAt(R), noReq).find((c) => c.tierId === "bulk")!;
    expect(bulk.prepaidTotal).toBe(toMicro("485.55")); // ₹45,000 / 92.68 = 485.5416; not 50 × 9.72 = 486.00
    expect(bulk.local).toMatchObject({ total: toPaise("45000"), unitPrice: toPaise("900"), stated: true });
    expect(checkoutLine(bulk.prepaidTotal, bulk.local)).toBe("You pay 485.55 USDC (₹45,000 at ₹92.68/$, rate fixed for this offer)");
  });
  it("converts 1,000 × ₹100 once: 1,078.99 USDC, not 1,000 × 1.08", () => {
    const big: Product = { ...product, tiers: [{ id: "k", name: "Thousand", includedUnits: 1000n, unitPrice: { num: toMicro("1.08"), den: 1n }, unitPriceInr: toPaise("100"), includes: [] }] };
    const c: EvaluationContext = { product: applyFx(big, R), cost: { ...cost, floorUnitPriceInr: undefined }, policy, now: Date.now(), fx: R };
    const [k] = getQuoteCandidates(c, noReq);
    expect(k!.prepaidTotal).toBe(toMicro("1078.99")); // 100000 / 92.68 = 1078.981
    expect(k!.local?.total).toBe(toPaise("100000"));
  });
  it("fits a rupee budget in rupees: ₹45,000 buys the 50 × ₹900 Bulk offer", () => {
    const cands = getQuoteCandidates(ctxAt(R), { ...noReq, budgetInr: toPaise("45000"), budget: inrBudgetToUsdc(toPaise("45000"), R) });
    const fit = cands.find((c) => c.origins.includes("budget_fit"))!;
    expect(fit).toMatchObject({ tierId: "bulk", units: 50n, prepaidTotal: toMicro("485.55"), status: "eligible" });
    expect(fit.local?.total).toBe(toPaise("45000"));
  });
  it("puts the rate into the candidate id, so an offer from before a rate change cannot be quoted", () => {
    const a = ctxAt(R), b = ctxAt(rate("92.68", "2026-11-21"));
    const t = a.product.tiers[0]!;
    expect(candidateIdFor(a, t, 1n, t.unitPrice)).not.toBe(candidateIdFor(b, t, 1n, t.unitPrice));
    // A USD-only product's ids do not move with the rate.
    const usd: EvaluationContext = { product: { ...product, tiers: product.tiers.map(({ unitPriceInr: _i, ...x }) => x) }, cost: { ...cost, floorUnitPriceInr: undefined }, policy, now: Date.now(), fx: R };
    const u = usd.product.tiers[0]!;
    expect(candidateIdFor(usd, u, 1n, u.unitPrice)).toBe(candidateIdFor({ ...usd, fx: rate("80") }, u, 1n, u.unitPrice));
  });
  it("revives a stored rupee price from either shape", () => {
    const [c] = getQuoteCandidates(ctxAt(R), noReq);
    expect(reviveLocalPrice(localPriceJson(c!.local!))).toEqual(c!.local);
    expect(reviveLocalPrice({ ...c!.local!, unitPrice: c!.local!.unitPrice.toString(), total: c!.local!.total.toString() })).toEqual(c!.local);
  });
});

describe("rupee floors", () => {
  it("is exact: the offer's USDC must be worth units × the rupee floor at the current rate", () => {
    expect(inrFloorHolds(toMicro("9.17"), 1n, toPaise("850"), R)).toBe(false); // ₹849.88
    expect(inrFloorHolds(toMicro("9.18"), 1n, toPaise("850"), R)).toBe(true); // ₹850.80
    expect(inrFloorHolds(toMicro("917.15"), 100n, toPaise("850"), R)).toBe(true); // ₹85,001.46 for 100
  });
  it("holds when the rate moves: the same USDC counter passes at one rate and is refused at a weaker one", () => {
    const at = (fx: FxRate) => {
      const c = ctxAt(fx);
      const base = getQuoteCandidates(c, { ...noReq, desiredUnits: 50n }).find((x) => x.units === 50n)!;
      // 50 hoodies for 460 USDC: ₹42,632.80 at 92.68 (above the ₹42,500 floor), ₹40,480 at 88 (below it).
      return evaluateCounteroffer(c, base, { targetTotal: toMicro("460") }, noReq);
    };
    expect(at(R).decision).toBe("approved");
    const weak = at(rate("88"));
    expect(weak.decision).toBe("rejected");
    expect(weak.candidate.rules).toContain("FLOOR_PRICE");
  });
  it("refuses every offer when a rupee floor has no rate to check against", () => {
    const c: EvaluationContext = { product, cost, policy, now: Date.now() };
    const t = product.tiers[0]!;
    expect(evaluate(c, { tier: t, units: 1n, unitPrice: t.unitPrice, origin: "tier", requested: noReq }).rules).toContain("FLOOR_PRICE");
  });
});

describe("rupee counters", () => {
  it("converts the buyer's rupee total at the rate and keeps it as the offer's rupee total", () => {
    const c = ctxAt(R);
    const base = getQuoteCandidates(c, { ...noReq, desiredUnits: 50n }).find((x) => x.units === 50n)!;
    const d = evaluateCounteroffer(c, base, { targetTotalInr: toPaise("43000") }, noReq);
    expect(d.decision).toBe("approved");
    expect(d.candidate.prepaidTotal).toBe(inrToUsdc(toPaise("43000"), R));
    expect(d.candidate.local).toMatchObject({ total: toPaise("43000"), unitPrice: toPaise("860"), stated: true });
  });
  it("refuses a rupee counter below the floor", () => {
    const c = ctxAt(R);
    const base = getQuoteCandidates(c, { ...noReq, desiredUnits: 50n }).find((x) => x.units === 50n)!;
    expect(evaluateCounteroffer(c, base, { targetTotalInr: toPaise("42000") }, noReq).decision).toBe("rejected");
  });
  it("needs a rate", () => {
    const c: EvaluationContext = { product, cost, policy, now: Date.now() };
    const base = getQuoteCandidates(ctxAt(R), { ...noReq, desiredUnits: 50n })[0]!;
    expect(() => evaluateCounteroffer(c, base, { targetTotalInr: toPaise("43000") }, noReq)).toThrow(/rate/);
  });
});
