import { describe, expect, it } from "vitest";
import { SEARCH_MAX_LENGTH, filterBySearch, matchesSearch, normalizeSearchText, searchTerms } from "../src";

const products = [
  { name: "Vintage Zip Polo", slug: "vintage-zip-polo", category: "Apparel", summary: "Pique cotton polo" },
  { name: "The Backpack by Mokobara", slug: "the-backpack", category: "Bags", summary: "Laptop backpack" },
  { name: "Metal Keychain - Oval", slug: "metal-keychain-oval", category: "Accessories", summary: undefined },
  { name: "A5 Strap Diary", slug: "a5-strap-diary", category: "Stationery", summary: "Café notebook" },
];
const fields = (p: (typeof products)[number]) => [p.name, p.slug, p.category, p.summary];

describe("list search", () => {
  it("matches every word in any order and any field, ignoring case", () => {
    expect(filterBySearch(products, "polo VINTAGE", fields).map((p) => p.slug)).toEqual(["vintage-zip-polo"]);
    expect(filterBySearch(products, "bags laptop", fields).map((p) => p.slug)).toEqual(["the-backpack"]);
    expect(filterBySearch(products, "keychain-oval", fields).map((p) => p.slug)).toEqual(["metal-keychain-oval"]);
    expect(filterBySearch(products, "polo bags", fields)).toEqual([]);
  });

  it("ignores accents both ways", () => {
    expect(filterBySearch(products, "cafe", fields).map((p) => p.slug)).toEqual(["a5-strap-diary"]);
    expect(normalizeSearchText("  Crème   Brûlée ")).toBe("creme brulee");
  });

  it("returns every row, in order, for a blank query", () => {
    expect(filterBySearch(products, "   ", fields)).toEqual(products);
    expect(filterBySearch(products, null, fields)).toEqual(products);
    expect(searchTerms("")).toEqual([]);
  });

  it("does not match across the boundary between two fields", () => {
    expect(matchesSearch(["Zip", "Polo"], searchTerms("zip polo"))).toBe(true);
    expect(matchesSearch(["Zi", "p"], searchTerms("zip"))).toBe(false);
  });

  it("reads nested lists and skips empty fields", () => {
    expect(matchesSearch([null, undefined, false, ["rest-api", "zendesk"]], searchTerms("zendesk"))).toBe(true);
    expect(matchesSearch([0x10], searchTerms("16"))).toBe(true);
  });

  it("caps very long queries instead of rejecting them", () => {
    const long = "polo ".repeat(100);
    expect(searchTerms(long).join(" ").length).toBeLessThanOrEqual(SEARCH_MAX_LENGTH);
  });
});
