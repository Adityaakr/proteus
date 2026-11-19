import { describe, expect, it } from "vitest";
import { dealTotals, effectiveDealStatus, isFulfilled } from "../src/services/seller-reports";

const usd = (v: number) => BigInt(Math.round(v * 1_000_000));

/**
 * Regression for the seller Overview showing "Revenue earned $6.60, settled from 0 fulfilled deals" with $0.00 held.
 * Reproduced read-only from Arc mainnet: the deal's escrow balances were deposit 6.60, settled 6.60, refunded 0, and the
 * contract still reported it Funded (status 1), which the reconciler maps to "active". The contract never closes a
 * fully settled deal, so counting only "closed" deals as fulfilled reported 0.
 */
describe("seller overview totals", () => {
  const fullySettledButOpen = { status: "active", deposit: usd(6.6), settled: usd(6.6), refunded: 0n };
  const fundedUnsettled = { status: "active", deposit: usd(6.6), settled: 0n, refunded: 0n };
  const partlySettled = { status: "active", deposit: usd(10), settled: usd(4), refunded: 0n };
  const closedAfterRefund = { status: "closed", deposit: usd(5), settled: usd(3), refunded: usd(2) };
  const disputed = { status: "disputed", deposit: usd(8), settled: usd(1), refunded: 0n };
  const awaiting = { status: "awaiting_funding", deposit: 0n, settled: 0n, refunded: 0n };

  it("counts the reproduced deal (all of the deposit settled, contract still Funded) as fulfilled, with nothing held", () => {
    const t = dealTotals([fullySettledButOpen]);
    expect(t.revenueEarned).toBe(usd(6.6));
    expect(t.fulfilledDeals).toBe(1);
    expect(t.settledDeals).toBe(1);
    expect(t.fundsHeld).toBe(0n);
    expect(effectiveDealStatus(fullySettledButOpen)).toBe("settled");
  });

  it("never counts unsettled escrow as revenue: it is customer funds held", () => {
    const t = dealTotals([fundedUnsettled]);
    expect(t.revenueEarned).toBe(0n);
    expect(t.fulfilledDeals).toBe(0);
    expect(t.fundsHeld).toBe(usd(6.6));
    expect(effectiveDealStatus(fundedUnsettled)).toBe("active");
  });

  it("splits a partly settled deal between revenue and funds held, and does not call it fulfilled", () => {
    const t = dealTotals([partlySettled]);
    expect(t.revenueEarned).toBe(usd(4));
    expect(t.fundsHeld).toBe(usd(6));
    expect(t.fulfilledDeals).toBe(0);
    expect(t.settledDeals).toBe(1);
    expect(isFulfilled(partlySettled)).toBe(false);
  });

  it("matches a correctly closed deal and keeps a disputed deal's balance as held", () => {
    const t = dealTotals([fullySettledButOpen, fundedUnsettled, partlySettled, closedAfterRefund, disputed, awaiting]);
    expect(t.revenueEarned).toBe(usd(6.6 + 4 + 3 + 1));
    expect(t.fulfilledDeals).toBe(2); // the reproduced deal and the closed one
    expect(t.fundsHeld).toBe(usd(6.6 + 6 + 7)); // unsettled + partly settled remainder + frozen in dispute
    expect(t.refunded).toBe(usd(2));
    expect(t.dealsFunded).toBe(5);
    // Every funded dollar is exactly one of: revenue, held, refunded.
    expect(t.revenueEarned + t.fundsHeld + t.refunded).toBe(t.fundedValue);
    expect(effectiveDealStatus(closedAfterRefund)).toBe("closed");
    expect(effectiveDealStatus(disputed)).toBe("disputed");
  });

  it("a fully refunded closed deal is not fulfilled", () => {
    expect(isFulfilled({ status: "closed", deposit: usd(5), settled: 0n, refunded: usd(5) })).toBe(false);
  });
});
