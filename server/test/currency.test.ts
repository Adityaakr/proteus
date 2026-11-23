/**
 * USD or INR: the seller's display currency and rate, rupee list prices and floors on the dashboard and seller API,
 * offers that fix their rate, and the agent quoting in the buyer's currency with the USDC beside it. Escrow and
 * settlement stay USDC throughout; these tests run without a database.
 */
import { describe, expect, it } from "vitest";
import { applyFx, getQuoteCandidates, inrToUsdc, toMicro, toPaise, type CostModel, type FxRate, type Policy, type Product, type PublicCandidate } from "@proteus/domain";
import { HttpError } from "../src/lib/http";
import { parseCurrencyBody, rateFor, displayOf, FIXED_SOURCE } from "../src/services/currency";
import { parseFloor, parseTiers } from "../src/services/seller-api-rules";
import { buyerCurrency, counterAskText, counterReply, toOffer, withRupeeBudget } from "../src/services/negotiation";
import { buildPublicTerms, staleReason } from "../src/services/quotes";
import { tierInr, type LoadedProduct } from "../src/services/catalog";
import { composeRuleBased, extractRuleBased } from "../src/agent/rule-based";
import { budgetOf, viewFigures, type ComposeInput } from "../src/agent/adapter";

const rate = (perUsd: string, asOf = "2026-11-20", kind: FxRate["kind"] = "fixed"): FxRate => ({ currency: "INR", perUsd, asOf, kind, source: kind === "fixed" ? FIXED_SOURCE : "European Central Bank reference rate" });
const R = rate("92.68");
const REF = rate("92.68", "2026-11-20", "reference");

const throws = (f: () => unknown, status: number, msg?: RegExp) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    if (msg) expect((e as HttpError).message).toMatch(msg);
    return;
  }
  throw new Error("expected a refusal");
};

describe("seller currency settings", () => {
  it("accepts USD or INR first, with a fixed dated rate or the daily reference rate", () => {
    expect(parseCurrencyBody({ display: "INR", rate: { mode: "fixed", perUsd: "92.68", asOf: "2026-11-20" } }, undefined, false)).toEqual({ display: "INR", rate: { mode: "fixed", perUsd: "92.68", asOf: "2026-11-20" } });
    expect(parseCurrencyBody({ display: "INR", rate: { mode: "reference" } }, REF, false)).toEqual({ display: "INR", rate: { mode: "reference" } });
    expect(parseCurrencyBody({ display: "USD" }, REF, false)).toEqual({ display: "USD" });
  });
  it("never invents a rate: rupees first needs one, a reference rate must exist, a rate needs its date", () => {
    throws(() => parseCurrencyBody({ display: "INR" }, REF, false), 400, /needs a rate/);
    throws(() => parseCurrencyBody({ display: "INR", rate: { mode: "reference" } }, undefined, false), 409, /reference rate is not available/);
    throws(() => parseCurrencyBody({ display: "INR", rate: { mode: "fixed", perUsd: "92.68" } }, undefined, false), 400, /date/);
    throws(() => parseCurrencyBody({ display: "INR", rate: { mode: "fixed", perUsd: "0", asOf: "2026-11-20" } }, undefined, false), 400, /rupees per 1 USD/);
    throws(() => parseCurrencyBody({ display: "INR", rate: { mode: "fixed", perUsd: "92.68", asOf: "2999-01-01" } }, undefined, false), 400, /future/);
    throws(() => parseCurrencyBody({ display: "EUR" }, REF, false), 400);
  });
  it("keeps a rate while prices or floors are set in rupees", () => {
    throws(() => parseCurrencyBody({ display: "USD", rate: null }, REF, true), 409, /set in rupees/);
  });
  it("uses the seller's fixed rate, else the reference rate", () => {
    expect(rateFor({ display: "INR", rate: { mode: "fixed", perUsd: "90", asOf: "2026-11-01" } }, REF)).toMatchObject({ perUsd: "90", kind: "fixed", asOf: "2026-11-01" });
    expect(rateFor({ display: "INR", rate: { mode: "reference" } }, REF)).toBe(REF);
    expect(rateFor(null, REF)).toBe(REF);
    expect(rateFor(null, undefined)).toBeUndefined();
    expect(displayOf(null)).toBe("USD");
  });
});

describe("rupee prices on the dashboard and the seller API", () => {
  const pub = { tiers: [{ id: "single" }], maxUnitsPerDeal: "1000" };
  it("takes unitPriceInr, keeps the rupee price and converts at the seller's rate (rounded up to the cent)", () => {
    const [t] = parseTiers(pub, { tiers: [{ name: "Single", includedUnits: "1", unitPriceInr: "1050" }] }, R);
    expect(t).toMatchObject({ unitPriceInr: "1050.00", unitPrice: { num: toMicro("11.33").toString(), den: "1" } });
    // USD tiers are unchanged.
    expect(parseTiers(pub, { tiers: [{ name: "Single", includedUnits: "1", unitPriceUsd: "6.60" }] })[0]).not.toHaveProperty("unitPriceInr");
  });
  it("refuses rupee prices without a rate, and a tier priced in both", () => {
    throws(() => parseTiers(pub, { tiers: [{ name: "Single", includedUnits: "1", unitPriceInr: "1050" }] }), 409, /exchange rate/);
    throws(() => parseTiers(pub, { tiers: [{ name: "Single", includedUnits: "1", unitPriceInr: "1050", unitPriceUsd: "11" }] }, R), 400, /not both/);
    throws(() => parseTiers(pub, { tiers: [{ name: "Single", includedUnits: "1", unitPriceInr: "10.505" }] }, R), 400, /rupees/);
  });
  it("sets floors in USD and/or INR; null removes one; a rupee floor needs a rate", () => {
    expect(parseFloor({ floorUnitPriceInr: "850" }, R)).toEqual({ inr: toPaise("850") });
    expect(parseFloor({ floorUnitPriceUsd: "9.20", floorUnitPriceInr: null })).toEqual({ usd: toMicro("9.20"), inr: null });
    throws(() => parseFloor({ floorUnitPriceInr: "850" }), 409, /exchange rate/);
    throws(() => parseFloor({}), 400);
  });
  it("lists a tier's rupee price: stated when the seller set it, converted for display otherwise", () => {
    const usdTier = { id: "t", name: "T", includedUnits: 10n, unitPrice: { num: toMicro("11.33"), den: 1n }, includes: [] };
    expect(tierInr({ ...usdTier, unitPriceInr: toPaise("1050") }, R)).toEqual({ unitPrice: "1050.00", prepaidTotal: "10500.00", stated: true });
    expect(tierInr(usdTier, R)).toEqual({ unitPrice: "1050.06", prepaidTotal: "10500.64", stated: false });
    expect(tierInr(usdTier, undefined)).toBeNull();
  });
});

/** Shoonya's hoodie, priced in rupees with a rupee floor. */
const product: Product = {
  id: "p_hoodie", slug: "hoodie", name: "Hoodie", billableUnit: "one hoodie delivered", unitLabel: "hoodie", supportedIntegrations: [], capabilities: [],
  tiers: [{ id: "bulk", name: "Bulk", includedUnits: 50n, unitPrice: { num: toMicro("9.72"), den: 1n }, unitPriceInr: toPaise("900"), includes: [] }],
  maxUnitsPerDeal: 1000n, termDays: 30, refundPolicy: "Unused balance refunds after the term.",
};
const cost: CostModel = { version: 4, variableCostPerUnit: 0n, directCostPerDeal: 0n, txCostBps: 0n, freshUntil: Date.now() + 86_400_000, floorUnitPriceInr: toPaise("850") };
const policy: Policy = { version: 2, minMarginBps: 0n, maxDiscountBps: 9000n, approvalThreshold: toMicro("100000"), prepaidMinimum: 0n, availableCapacityUnits: 100000n, quoteTtlSeconds: 3600, allowNonPositiveContribution: false };
const loaded = (fx: FxRate | undefined, currency: LoadedProduct["org"]["currency"] = { display: "INR", rate: { mode: "fixed", perUsd: fx?.perUsd ?? "92.68", asOf: fx?.asOf ?? "2026-11-20" } }) =>
  ({ org: { id: "org_shoonya", slug: "shoonya-store", name: "Shoonya Store", label: "live", currency }, row: { id: "p_hoodie" }, product: applyFx(product, fx), cost, policy, ...(fx ? { fx } : {}) }) as unknown as LoadedProduct;
const noReq = { integrations: [], notes: [], openQuestions: [] };
const offerAt = (fx: FxRate) => getQuoteCandidates({ product: applyFx(product, fx), cost, policy, now: Date.now(), fx }, noReq)[0]!;

describe("offers fix their rate", () => {
  it("an offer carries the rupee price and the dated rate, and its public terms sign them", () => {
    const c = offerAt(R);
    const o = toOffer(c);
    expect(o.local).toEqual({ currency: "INR", unitPrice: "900.00", total: "45000.00", stated: true, rate: R });
    expect(o.prepaidTotalUsd).toBe("$485.55");
    const terms = buildPublicTerms(loaded(R) as never, c, { version: 2, commitment: "0x00", registry: "eip155:5042002:0x0", sellerAgent: null });
    expect(terms.localPrice).toEqual(o.local);
    expect(terms.prepaidTotal).toBe(toMicro("485.55").toString()); // escrow takes USDC
  });
  it("an offer made before the rate moved cannot be quoted, and says why", () => {
    const c = offerAt(R);
    expect(staleReason(loaded(R), c)).toBeNull();
    expect(staleReason(loaded(rate("91.10", "2026-11-23")), c)).toMatch(/exchange rate was updated/);
    expect(staleReason({ ...loaded(R), cost: { ...cost, version: 5 } } as LoadedProduct, c)).toMatch(/pricing rules/);
  });
  it("a seller that never chose a rate signs no rupee price, even when buyers read rupees at the reference rate", () => {
    const usd = { ...product, tiers: product.tiers.map(({ unitPriceInr: _x, ...t }) => t) };
    const c = getQuoteCandidates({ product: usd, cost: { ...cost, floorUnitPriceInr: undefined }, policy, now: Date.now(), fx: REF }, noReq)[0]!;
    expect(c.local?.stated).toBe(false);
    expect(buildPublicTerms({ ...loaded(REF, null), product: usd } as never, c, { version: 2, commitment: "0x00", registry: "x", sellerAgent: null })).not.toHaveProperty("localPrice");
  });
  it("public terms of a USD-only seller carry no rupee price", () => {
    const usd = { ...product, tiers: product.tiers.map(({ unitPriceInr: _x, ...t }) => t) };
    const c = getQuoteCandidates({ product: usd, cost: { ...cost, floorUnitPriceInr: undefined }, policy, now: Date.now() }, noReq)[0]!;
    expect(buildPublicTerms({ ...loaded(undefined, null), product: usd } as never, c, { version: 2, commitment: "0x00", registry: "x", sellerAgent: null })).not.toHaveProperty("localPrice");
  });
});

describe("the buyer's choice", () => {
  it("defaults to the seller's display currency and follows the buyer's switch; rupees need a rate", () => {
    expect(buyerCurrency({ currency: null }, loaded(R))).toBe("INR");
    expect(buyerCurrency({ currency: "USD" }, loaded(R))).toBe("USD");
    expect(buyerCurrency({ currency: "INR" }, loaded(undefined, null))).toBe("USD");
    expect(buyerCurrency({ currency: null }, loaded(REF, null))).toBe("USD");
    expect(buyerCurrency({ currency: "INR" }, loaded(REF, null))).toBe("INR");
  });
});

describe("the agent quotes in the buyer's currency", () => {
  const inr = { currency: "INR" as const, fx: R };
  it("writes counters in rupees with the USDC beside them", () => {
    const base = offerAt(R);
    const ask = { targetTotalInr: toPaise("43000") };
    expect(counterAskText(base, ask, "hoodie", inr)).toBe("50 hoodies for ₹43,000 (≈ 463.97 USDC)");
    const approved = { decision: "approved" as const, candidate: { ...base, prepaidTotal: inrToUsdc(toPaise("43000"), R), local: { ...base.local!, total: toPaise("43000") } } };
    expect(counterReply(approved, "", "hoodie", inr)).toBe("Yes, I can do 50 hoodies for ₹43,000 (≈ 463.97 USDC). That is within what the seller allows, so you can accept it now.");
    // In USD, exactly the words it always used.
    expect(counterReply(approved, "", "hoodie", { currency: "USD", fx: R })).toBe("Yes, I can do 50 hoodies for $463.97. That is within what the seller allows, so you can accept it now.");
  });
  it("reads a rupee budget and converts it at the seller's rate, rounded down", () => {
    const req = extractRuleBased({ productName: "Hoodie", unitLabel: "hoodie", capabilities: [], supportedIntegrations: [], starters: [], prior: noReq, turns: [{ role: "buyer", content: "50 hoodies, my budget is ₹45,000" }] });
    expect(req.budgetInr).toBe(toPaise("45000"));
    expect(req.budget).toBeUndefined();
    expect(withRupeeBudget(req, { fx: R }).budget).toBe(toMicro("485.54"));
    expect(withRupeeBudget(req, {})).not.toHaveProperty("budgetInr");
    // A later dollar budget replaces it.
    const usd = extractRuleBased({ productName: "Hoodie", unitLabel: "hoodie", capabilities: [], supportedIntegrations: [], starters: [], prior: withRupeeBudget(req, { fx: R }), turns: [{ role: "buyer", content: "actually $400" }] });
    expect(usd).toMatchObject({ budget: toMicro("400") });
    expect(usd.budgetInr).toBeUndefined();
  });
  it("never takes a rupee figure for dollars from a model", () => {
    const baseline = { ...noReq, budgetInr: toPaise("45000") };
    expect(budgetOf({ budgetUsd: 45000 }, baseline)).toEqual({ budget: undefined, budgetInr: toPaise("45000") });
    expect(budgetOf({ budgetInr: 40000 }, noReq)).toEqual({ budget: undefined, budgetInr: toPaise("40000") });
    expect(budgetOf({ budgetUsd: 500 }, noReq)).toEqual({ budget: toMicro("500") });
  });
  it("keeps a fresh dollar budget over a rupee budget the model recalls from earlier turns", () => {
    const prior = withRupeeBudget(extractRuleBased({ productName: "Hoodie", unitLabel: "hoodie", capabilities: [], supportedIntegrations: [], starters: [], prior: noReq, turns: [{ role: "buyer", content: "budget ₹40,000" }] }), { fx: R });
    const baseline = extractRuleBased({ productName: "Hoodie", unitLabel: "hoodie", capabilities: [], supportedIntegrations: [], starters: [], prior, turns: [{ role: "buyer", content: "budget ₹40,000" }, { role: "buyer", content: "actually my budget is $600" }] });
    expect(budgetOf({ budgetUsd: 600, budgetInr: 40000 }, baseline)).toEqual({ budget: toMicro("600") });
  });
  it("keeps the exact-rupee offer for a rupee budget and points nowhere else", () => {
    const fx = { product: applyFx(product, R), cost, policy, now: Date.now(), fx: R };
    const requirements = { ...noReq, desiredUnits: 50n, budgetInr: toPaise("45000"), budget: toMicro("485.54") };
    const offers = getQuoteCandidates(fx, requirements).map(({ economics: _e, rules: _r, ...pub }): PublicCandidate => ({ ...pub, publicReasons: [] }));
    expect(offers[0]).toMatchObject({ tierId: "bulk", units: 50n, prepaidTotal: toMicro("485.55") });
    const catalog = { sellerName: "Shoonya Store", products: [{ name: "Tote", unitLabel: "tote", detail: "Tote bags", smallestPack: "10 totes" }] };
    const reply = composeRuleBased({ productName: "Hoodie", unitLabel: "hoodie", requirements, offers, rejected: [], injectionDetected: false, turns: [{ role: "buyer", content: "50 hoodies, budget ₹45,000" }], view: inr, catalog } as ComposeInput);
    expect(reply).toContain("Bulk: 50 hoodies for ₹45,000 (≈ 485.55 USDC)");
    expect(reply).not.toContain("also offers");
  });
  it("writes offers in rupees first in the deterministic reply, and lets a model quote the same figures", () => {
    const c = offerAt(R);
    const { economics: _e, rules: _r, ...pub } = c;
    const o: PublicCandidate = { ...pub, publicReasons: [] };
    const input: ComposeInput = { productName: "Hoodie", unitLabel: "hoodie", requirements: { ...noReq, desiredUnits: 50n }, offers: [o], rejected: [], injectionDetected: false, turns: [{ role: "buyer", content: "50 hoodies" }], view: inr };
    const reply = composeRuleBased(input);
    expect(reply).toContain("Bulk: 50 hoodies for ₹45,000 (≈ 485.55 USDC) prepaid for the term (₹900 (≈ 9.711 USDC) per hoodie)");
    expect(composeRuleBased({ ...input, view: { currency: "USD", fx: R } })).toContain("Bulk: 50 hoodies for $485.55 prepaid for the term ($9.711 per hoodie)");
    expect(viewFigures(input)).toEqual(expect.arrayContaining(["₹45,000", "45,000", "485.55"]));
    expect(viewFigures({ ...input, view: { currency: "USD", fx: R } })).toEqual([]);
  });
});
