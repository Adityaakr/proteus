/**
 * Search on the dashboard's long lists: the Products & pricing search and filters read from and write to the URL,
 * the page renders only what matches, and the API's `?q=` on capped lists keeps the same matching rule as the page.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { filterBySearch, searchTerms } from "@proteus/domain";
import type { ProductWithPrivate } from "../../site/src/app/seller/types";

const product = (name: string, extra: Partial<ProductWithPrivate> = {}): ProductWithPrivate => ({
  id: `prd_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  active: true,
  billableUnit: "one item, shipped",
  unitLabel: "unit",
  supportedIntegrations: [],
  capabilities: [],
  tiers: [{ id: "t1", name: "Single", includedUnits: "1", unitPrice: { num: "12000000", den: "1" }, includes: [] }],
  maxUnitsPerDeal: "500",
  termDays: 30,
  refundPolicy: "",
  cost: { version: 1, variableCostPerUnit: "0", directCostPerDeal: "0", txCostBps: "0", freshUntil: 0 },
  policy: { version: 1, minMarginBps: "1500", maxDiscountBps: "0" } as ProductWithPrivate["policy"],
  ...extra,
});

const CATALOGUE = [
  product("Vintage Zip Polo", { category: "Apparel", summary: "Pique cotton polo with a zip placket" }),
  product("Flow Tee", { category: "Apparel", summary: "Soft everyday tee" }),
  product("The Backpack by Mokobara", { category: "Bags", summary: "Laptop backpack" }),
  product("Metal Keychain - Oval", { category: "Accessories", active: false }),
  product("A5 Strap Diary", { category: "Stationery", summary: "Café-ruled notebook" }),
  product("Canvas Tote", { category: "Bags", active: false }),
  product("Enamel Pin", { category: "Accessories" }),
];

let rows: ProductWithPrivate[] = CATALOGUE;
vi.mock("../../site/src/app/seller/api", () => ({
  useProducts: () => ({ isPending: false, isError: false, data: rows }),
  isUnauthorized: () => false,
  useStartSandbox: () => ({ isPending: false, isError: false, mutate: () => {} }),
}));
vi.mock("../../site/src/app/sell/hooks", () => ({ useMe: () => ({ me: null, ready: true }) }));
vi.mock("../../site/src/app/sell/v1", () => ({ useAuth: () => ({ wallet: null }), v1: { app: {} } }));

const { default: Products, filterProducts } = await import("../../site/src/app/seller/pages/Products");
const { withParam, writeParam } = await import("../../site/src/app/lib/useSearchParam");
const { countText } = await import("../../site/src/app/ui/SearchBar");
const { negotiationSearchFields } = await import("../../site/src/app/seller/pages/Negotiations");
const { dealSearchFields } = await import("../../site/src/app/seller/pages/Deals");
const { listQuery, searchRows, scanLimit, SEARCH_SCAN_LIMIT } = await import("../src/services/list-search");

function render(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Products />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const names = (html: string) => CATALOGUE.filter((p) => html.includes(`aria-label="Open ${p.name}"`)).map((p) => p.name);

describe("Products & pricing search", () => {
  it("shows every product, a search bar and the count with no query", () => {
    const html = render("/app/sell/products");
    expect(names(html)).toHaveLength(CATALOGUE.length);
    expect(html).toContain('role="search"');
    expect(html).toContain("Search 7 products by name, category or description");
    expect(html).toContain("7 products");
  });

  it("reads the query from ?q= and renders only the matches", () => {
    const html = render("/app/sell/products?q=polo");
    expect(names(html)).toEqual(["Vintage Zip Polo"]);
    expect(html).toContain('value="polo"');
    expect(html).toContain("1 of 7 products");
  });

  it("matches slug, category and description, not just the name", () => {
    expect(names(render("/app/sell/products?q=metal-keychain"))).toEqual(["Metal Keychain - Oval"]);
    expect(names(render("/app/sell/products?q=bags"))).toEqual(["The Backpack by Mokobara", "Canvas Tote"]);
    expect(names(render("/app/sell/products?q=laptop"))).toEqual(["The Backpack by Mokobara"]);
    expect(names(render("/app/sell/products?q=cafe%20notebook"))).toEqual(["A5 Strap Diary"]);
  });

  it("filters by listing and category from the URL, together with the search", () => {
    expect(names(render("/app/sell/products?listing=hidden"))).toEqual(["Metal Keychain - Oval", "Canvas Tote"]);
    expect(names(render("/app/sell/products?listing=listed&category=Bags"))).toEqual(["The Backpack by Mokobara"]);
    expect(names(render("/app/sell/products?category=Accessories&q=pin"))).toEqual(["Enamel Pin"]);
    // An unknown listing value reads as "all" instead of hiding everything.
    expect(names(render("/app/sell/products?listing=bogus"))).toHaveLength(CATALOGUE.length);
  });

  it("offers listing and category chips that fit the catalogue, with counts", () => {
    const html = render("/app/sell/products?listing=hidden");
    expect(html).toContain('aria-label="Listing"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hidden from market<span[^>]*>2<\/span>/);
    expect(html).toContain('aria-label="Category"');
    for (const c of ["Apparel", "Bags", "Accessories", "Stationery"]) expect(html).toContain(`>${c}<`);
  });

  it("explains an empty result and offers a way back", () => {
    const html = render("/app/sell/products?q=zzz");
    expect(names(html)).toEqual([]);
    expect(html).toContain("No products match “zzz”");
    expect(html).toContain("Clear search");
    expect(render("/app/sell/products?q=zzz&listing=hidden")).toContain("Clear search and filters");
  });

  it("leaves a short catalogue without a search bar", () => {
    rows = CATALOGUE.slice(0, 3);
    try {
      expect(render("/app/sell/products")).not.toContain('role="search"');
      // A shared link with a query still gets the bar, so the search can be cleared.
      expect(render("/app/sell/products?q=tee")).toContain('role="search"');
    } finally {
      rows = CATALOGUE;
    }
  });

  it("filterProducts keeps catalogue order", () => {
    expect(filterProducts(CATALOGUE, "", "listed", "").map((p) => p.name)).toEqual(["Vintage Zip Polo", "Flow Tee", "The Backpack by Mokobara", "A5 Strap Diary", "Enamel Pin"]);
  });
});

describe("URL sync", () => {
  it("sets a param, drops it when empty or the default, and keeps the others", () => {
    const p = new URLSearchParams("buyer=0xabc&q=old");
    expect(withParam(p, "q", "polo").toString()).toBe("buyer=0xabc&q=polo");
    expect(withParam(p, "q", "").toString()).toBe("buyer=0xabc");
    expect(withParam(p, "listing", "all", "all").toString()).toBe("buyer=0xabc&q=old");
    expect(withParam(p, "listing", "hidden", "all").toString()).toBe("buyer=0xabc&q=old&listing=hidden");
    expect(withParam(p, "q", "café & tea").get("q")).toBe("café & tea");
    expect(p.toString()).toBe("buyer=0xabc&q=old"); // the input is not changed
  });

  const at = (search: string) => ({ pathname: "/app/sell/products", search, hash: "", state: null, key: Math.random().toString(36) });

  it("lands every setter fired in one click, so clearing search and filters leaves none in the URL", () => {
    const loc = at("?q=zzz&listing=hidden&category=Bags&buyer=0xabc");
    writeParam(loc, "q", "");
    writeParam(loc, "listing", "all", "all");
    const { search } = writeParam(loc, "category", "");
    expect(search).toBe("buyer=0xabc");
  });

  it("starts from the URL again once the router renders the new location", () => {
    writeParam(at("?q=polo"), "q", "");
    expect(writeParam(at("?q=polo"), "listing", "hidden", "all").search).toBe("q=polo&listing=hidden");
  });

  it("reports no change when the URL already holds the value, so no echo is awaited", () => {
    const loc = at("?listing=hidden");
    expect(writeParam(loc, "q", "").changed).toBe(false);
    expect(writeParam(loc, "listing", "all", "all").changed).toBe(true);
    expect(writeParam(loc, "listing", "all", "all").changed).toBe(false);
    expect(writeParam(loc, "listing", "listed", "all").changed).toBe(true);
  });

  it("writes the count as shown, or shown of total", () => {
    expect(countText(96, 96, "products")).toBe("96 products");
    expect(countText(1200, 4000, "products")).toBe("1,200 of 4,000 products");
    expect(countText(3, undefined, "matches")).toBe("3 matches");
    expect(countText(1, undefined, "matches")).toBe("1 match");
    expect(countText(1, 1, "services")).toBe("1 service");
    expect(countText(1, 96, "products")).toBe("1 of 96 products");
    expect(countText(undefined, 4, "products")).toBeNull();
  });
});

describe("API ?q= on capped lists", () => {
  const negs = Array.from({ length: 250 }, (_, i) => ({ publicId: `NEG-${String(i).padStart(4, "0")}`, buyerAddress: i === 240 ? "0x995385cB1D15fcC4521442D488d2CB757cb641Da" : `0x${String(i).padStart(40, "0")}`, status: i % 2 ? "open" : "accepted", productName: i % 3 ? "Flow Tee" : "Vintage Zip Polo" }));
  const fields = (n: (typeof negs)[number]) => [n.publicId, n.buyerAddress, n.status, n.productName];

  it("returns the newest rows as before without a query", () => {
    expect(listQuery(undefined)).toBeUndefined();
    expect(listQuery("   ")).toBeUndefined();
    expect(scanLimit(undefined, 100)).toBe(100);
    expect(searchRows(negs, undefined, 100, fields)).toEqual(negs.slice(0, 100));
  });

  it("searches past the cap and returns the newest matches up to it", () => {
    const q = listQuery("995385cb");
    expect(scanLimit(q, 100)).toBe(SEARCH_SCAN_LIMIT);
    expect(searchRows(negs, q, 100, fields).map((n) => n.publicId)).toEqual(["NEG-0240"]);
    const polos = searchRows(negs, listQuery(" zip polo accepted "), 10, fields);
    expect(polos).toHaveLength(10);
    expect(polos.every((n) => n.productName === "Vintage Zip Polo" && n.status === "accepted")).toBe(true);
    expect(polos[0]!.publicId).toBe("NEG-0000");
  });

  it("caps a long query instead of rejecting it", () => {
    expect(listQuery("x".repeat(500))!.length).toBe(100);
  });

  it("the pages read at least what the API reads, so the list never hides a server match", () => {
    const n = { id: "n1", publicId: "NEG-0240", productName: "Flow Tee", buyerLabel: "Buyer 0x9953…41Da", buyerAddress: "0x995385cB1D15fcC4521442D488d2CB757cb641Da", status: "open" as const, updatedAt: "", turns: 1, needsApproval: false };
    const d = { id: "d1", publicId: "DL-77", productName: "Flow Tee", buyerAddress: "0x995385cB1D15fcC4521442D488d2CB757cb641Da", status: "funded" as const, deposit: "0", settled: "0", remaining: "0", createdAt: "" };
    for (const q of ["5385cb1d", "NEG-0240", "open", "flow tee"]) expect(filterBySearch([n], q, negotiationSearchFields)).toHaveLength(1);
    for (const q of ["5385cb1d", "DL-77", "funded", "flow"]) expect(filterBySearch([d], q, dealSearchFields)).toHaveLength(1);
    expect(searchTerms("Flow  TEE")).toEqual(["flow", "tee"]);
  });
});
