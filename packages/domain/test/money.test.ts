import { describe, expect, it } from "vitest";
import { formatUnitPrice, usdPrice } from "../src";

describe("price display", () => {
  it("formats unit prices with two decimals, more only for sub-cent prices", () => {
    expect(formatUnitPrice(6_600_000n, 1n)).toBe("$6.60");
    expect(formatUnitPrice(6_500_000n, 1n)).toBe("$6.50");
    expect(formatUnitPrice(12_000_000n, 1n)).toBe("$12.00");
    expect(formatUnitPrice(350_000n, 1n)).toBe("$0.35");
    expect(formatUnitPrice(35_000n, 1n)).toBe("$0.035");
    expect(formatUnitPrice(125n, 1n)).toBe("$0.0001");
    expect(formatUnitPrice(1_000_000n, 3n)).toBe("$0.3333");
  });

  it("normalizes price strings without losing sub-cent digits", () => {
    expect(usdPrice("$6.5")).toBe("$6.50");
    expect(usdPrice("$6")).toBe("$6.00");
    expect(usdPrice("$0.3500")).toBe("$0.35");
    expect(usdPrice("$0.0350")).toBe("$0.035");
    expect(usdPrice("$1,250.5")).toBe("$1,250.50");
    expect(usdPrice("6.5")).toBe("$6.50");
    expect(usdPrice("see product page")).toBe("see product page");
  });
});
