/**
 * Publishing a prepared listing. The listing file carries public fields only, so the owner's own wallet enters the
 * private costs and limits on the page; nobody else is asked for them, and nothing is prefilled.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

let me: unknown;
vi.mock("../../site/src/app/sell/hooks", () => ({ useMe: () => ({ me, ready: true }) }));
vi.mock("../../site/src/app/sell/v1", () => ({ useAuth: () => ({ refetchMe: () => {} }), v1: { app: {} } }));
vi.mock("../../site/src/app/sell/developers/IdentityCards", () => ({ AgentIdentityCard: () => null }));
// One import point for shared blocks; only Field is needed here, without the app shell it also re-exports.
vi.mock("../../site/src/app/seller/kit", () => vi.importActual("../../site/src/app/ui/Field"));

const { default: ImportListing } = await import("../../site/src/app/sell/pages/ImportListing");
const { EMPTY_PRIVATE_TERMS, PRIVATE_TERM_FIELDS, privateTermsBody, validatePrivateTerms } = await import("../../site/src/app/sell/onboarding/privateTerms");

const listing = JSON.parse(readFileSync(join(import.meta.dirname, "../../site/public/listings/shoonya.json"), "utf8")) as { business: { slug: string; name: string; ownerAddress: string }; products: { slug: string }[] };

function render(wallet: string | undefined, saved: string[] = []) {
  me = wallet ? { org: saved.length ? { slug: listing.business.slug, name: listing.business.name } : null, wallets: [{ primary: true, address: wallet }] } : undefined;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["sell", "listing", "acme"], listing);
  qc.setQueryData(["sell", "import-products", listing.business.slug], saved.map((slug) => ({ slug })));
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/app/sell/import/acme"]}>
        <Routes>
          <Route path="/app/sell/import/:name" element={<ImportListing />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const inputs = (html: string) => [...html.matchAll(/<input[^>]*id="private-[^"]*"[^>]*>/g)].map((m) => m[0]);

describe("publishing a prepared listing", () => {
  it("asks the owner's wallet for every private term of every product, prefilling none", () => {
    const found = inputs(render(listing.business.ownerAddress));
    expect(found).toHaveLength(listing.products.length * PRIVATE_TERM_FIELDS.length);
    // Only the quote validity has a default (48 hours), the same as the New product form.
    for (const i of found) expect(i).toContain(i.includes("quoteValidityHours") ? 'value="48"' : 'value=""');
  });

  it("asks nobody else", () => {
    for (const wallet of [undefined, `0x${"22".repeat(20)}`]) {
      const html = render(wallet);
      expect(inputs(html)).toEqual([]);
      expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Publish/);
    }
  });

  it("leaves products already in the account as they are stored", () => {
    const [first] = listing.products;
    const html = render(listing.business.ownerAddress, [first!.slug]);
    expect(inputs(html)).toHaveLength((listing.products.length - 1) * PRIVATE_TERM_FIELDS.length);
    expect(html).toContain("Its saved prices and limits stay as they are.");
  });

  it("builds the product body from what the owner typed, and refuses to publish without it", () => {
    expect(Object.keys(validatePrivateTerms(EMPTY_PRIVATE_TERMS)).sort()).toEqual(PRIVATE_TERM_FIELDS.map((f) => f.key).filter((k) => k !== "quoteValidityHours").sort());
    const typed = { variableCostUsd: "$1.25", directCostUsd: "0", txCostBps: "40", minMarginPct: "22.5", maxDiscountPct: "3", approvalThresholdUsd: "1,200", prepaidMinimumUsd: "7", capacityUnits: "900", quoteValidityHours: "24" };
    expect(validatePrivateTerms(typed)).toEqual({});
    expect(privateTermsBody(typed)).toEqual({
      cost: { variableCostPerUnitUsd: "1.25", directCostPerDealUsd: "0", txCostBps: 40 },
      policy: { minMarginBps: 2250, maxDiscountBps: 300, approvalThresholdUsd: "1200", prepaidMinimumUsd: "7", availableCapacityUnits: 900, quoteTtlSeconds: 86400 },
    });
  });
});
