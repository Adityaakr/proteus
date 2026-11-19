/**
 * The seller's deal page for the reproduced deal: the escrow paid out the whole $6.60 deposit, and the contract still
 * reports it Funded (the reconciler's "active"). The page must say Settled, like the Deals list and the Overview, while
 * the actions that follow the contract (order updates, record delivery, close term) stay exactly as for an active deal.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { withEffectiveStatus } from "../src/services/seller-reports";

const usd = (v: number) => BigInt(Math.round(v * 1_000_000));

let current: unknown;
vi.mock("../../site/src/app/seller/api", () => ({
  useDeal: () => ({ isPending: false, isError: false, data: current }),
  useCloseTerm: () => ({ isPending: false, isSuccess: false, isError: false, mutate: () => {} }),
  useRecordDelivery: () => ({ isPending: false, isSuccess: false, isError: false, mutate: () => {} }),
  useStartSandbox: () => ({ isPending: false, mutate: () => {} }),
  isUnauthorized: () => false,
}));

const { deal: normalizeDeal } = await import("../../site/src/app/seller/normalize");
const { default: DealDetail } = await import("../../site/src/app/seller/pages/DealDetail");

const view = (status: string, deposit: number, settled: number) => ({
  id: "deal_1",
  publicId: "PD-1",
  status,
  terms: { unitNum: "1", unitDen: "1", maxUnits: "1", start: "0", end: "0" },
  balances: { deposit: usd(deposit), settled: usd(settled), refunded: 0n, remaining: usd(deposit - settled), source: "chain" },
});

/** The seller routes send JSON, so bigints arrive as strings. */
const wire = (v: object) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));

function render(sellerView: object) {
  current = normalizeDeal(wire(sellerView));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/app/sell/deals/deal_1"]}>
        <DealDetail />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("seller deal view status", () => {
  it("reports the fully paid-out deal as settled and keeps the contract's status alongside", () => {
    const v = withEffectiveStatus(view("active", 6.6, 6.6));
    expect(v.status).toBe("settled");
    expect(v.chainStatus).toBe("active");
  });

  it("leaves a deal with money still in escrow as it is on chain", () => {
    expect(withEffectiveStatus(view("active", 6.6, 2))).toMatchObject({ status: "active", chainStatus: "active" });
    expect(withEffectiveStatus(view("disputed", 6.6, 6.6))).toMatchObject({ status: "disputed", chainStatus: "disputed" });
  });
});

describe("seller deal page", () => {
  it("shows Settled for the reproduced deal while its actions still follow the contract's Active status", () => {
    const html = render(withEffectiveStatus(view("active", 6.6, 6.6)));
    expect(html).toContain(">Settled<");
    expect(html).not.toContain(">Active<");
    expect(html).toContain("Update the buyer");
    expect(html).toContain("Record a delivery");
    expect(html).toContain("Close term early");
  });

  it("offers no order updates or deliveries once the contract has closed the deal", () => {
    const html = render(withEffectiveStatus(view("closed", 6.6, 6.6)));
    expect(html).toContain(">Closed<");
    expect(html).not.toContain("Update the buyer");
    expect(html).not.toContain("Record a delivery");
  });
});
