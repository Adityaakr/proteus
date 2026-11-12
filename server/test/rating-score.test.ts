import { describe, expect, it } from "vitest";
import { summarizeRatings, type RatingRow } from "../src/services/rating-score";

const row = (o: Partial<RatingRow>): RatingRow => ({
  buyerAddress: "0xaaaa000000000000000000000000000000000001",
  value: 5,
  buyerTier: "wallet",
  linkStatus: "clear",
  weight: 1_000_000n,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  ...o,
});

describe("summarizeRatings", () => {
  it("returns null with no ratings", () => {
    expect(summarizeRatings([])).toBeNull();
  });

  it("one 5-star buyer averages 5 but scores well below a perfect 5", () => {
    const s = summarizeRatings([row({})])!;
    expect(s.count).toBe(1);
    expect(s.average).toBe(5);
    // (3.5*3 + 0.5*5) / (3 + 0.5) = 13 / 3.5
    expect(s.score).toBe(3.71);
  });

  it("counts one vote per buyer: fifty deals from one wallet are one vote, the latest", () => {
    const many = Array.from({ length: 50 }, (_, i) => row({ value: 5, createdAt: new Date(2026, 9, 1 + (i % 28)) }));
    const latest = row({ value: 2, createdAt: new Date("2026-12-01T00:00:00Z") });
    const s = summarizeRatings([...many, latest])!;
    expect(s.count).toBe(1);
    expect(s.average).toBe(2);
    expect(s.settledBehind).toBe(1_000_000n);
  });

  it("buyer addresses compare case-insensitively", () => {
    const s = summarizeRatings([row({ buyerAddress: "0xABCD000000000000000000000000000000000001" }), row({ buyerAddress: "0xabcd000000000000000000000000000000000001" })])!;
    expect(s.count).toBe(1);
  });

  it("excludes ratings linked to the seller and pending ones", () => {
    const s = summarizeRatings([
      row({ buyerAddress: "0x01", value: 5, linkStatus: "linked" }),
      row({ buyerAddress: "0x02", value: 5, linkStatus: "pending" }),
      row({ buyerAddress: "0x03", value: 3, linkStatus: "clear" }),
    ])!;
    expect(s).toMatchObject({ count: 1, excluded: 1, pending: 1, average: 3 });
  });

  it("only linked ratings means no counted buyers and the neutral score", () => {
    const s = summarizeRatings([row({ linkStatus: "linked" })])!;
    expect(s).toMatchObject({ count: 0, average: 0, score: 3.5, excluded: 1 });
  });

  it("verified buyers weigh twice a wallet-only buyer", () => {
    const s = summarizeRatings([row({ buyerAddress: "0x01", value: 5, buyerTier: "verified" }), row({ buyerAddress: "0x02", value: 2, buyerTier: "wallet" })])!;
    // (1*5 + 0.5*2) / 1.5 = 4
    expect(s.average).toBe(4);
    expect(s.verifiedBuyers).toBe(1);
  });

  it("the score approaches the average as distinct verified buyers add up", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({ buyerAddress: `0x${(i + 1).toString(16).padStart(40, "0")}`, value: 5, buyerTier: "verified" }));
    const s = summarizeRatings(rows)!;
    expect(s.count).toBe(30);
    expect(s.average).toBe(5);
    expect(s.score).toBeGreaterThan(4.8);
  });
});
