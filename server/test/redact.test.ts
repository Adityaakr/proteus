import { describe, expect, it } from "vitest";
import { redactPersonalData as r } from "../src/agent/adapter";

describe("redactPersonalData", () => {
  it("removes emails and phone numbers", () => {
    expect(r("mail me at riya.k+tees@gmail.com")).toBe("mail me at [email removed]");
    expect(r("call +91 98765 43210 today")).toBe("call [number removed] today");
    expect(r("whatsapp 9876543210")).toBe("whatsapp [number removed]");
    expect(r("ph (022) 2345-6789")).toBe("ph [number removed]");
    expect(r("card 4111 1111 1111 1111")).toBe("card [number removed]");
    for (const x of ["Mob no.9876543210", "tel.9876543210", "wa.me/919876543210", "+91 98765–43210"]) expect(r(x)).not.toMatch(/9876543210|98765.43210/);
  });
  it("keeps quantities, prices, dates and ranges", () => {
    for (const s of ["2000 tees for $1,500", "budget 1500000", "between 2000 - 3000 units", "by 2026-12-01", "pincode 560001", "$1234567890", "100000 - 200000 calls", "order A1001", "qty 2000 3000 4000 tees", "2025 2026 2027"]) expect(r(s)).toBe(s);
  });
});
