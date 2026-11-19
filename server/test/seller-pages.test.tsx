/**
 * Seller dashboard pages, rendered from the site's own components: the Developers item in the sell menu, the cards that
 * moved from Seller settings to Developers, the "Moved to Developers" pointer, and the Overview revenue line.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const me = { org: { id: "org_1", slug: "shoonya-store-t4e", name: "Shoonya Store", label: "live" as const, brand: {} }, wallets: [{ address: "0x995385cB1D15fcC4521442D488d2CB757cb641Da", primary: true }] };

// The real modules pull in the wallet SDKs and the app shell; the pages only need these hooks and the API client.
vi.mock("../../site/src/app/sell/hooks", () => ({
  useMe: () => ({ me, ready: true }),
  useSigner: () => ({ isPending: true }),
  useRevokeSigner: () => ({ isPending: false, isError: false, mutate: () => {} }),
}));
vi.mock("../../site/src/app/sell/v1", () => ({
  useAuth: () => ({ wallet: null, refetchMe: () => {}, getWalletClient: async () => ({}) }),
  v1: { app: new Proxy({}, { get: () => () => new Promise(() => {}) }) },
}));

const { SELL_NAV_ORG } = await import("../../site/src/app/layouts/navItems");
const { default: Settings } = await import("../../site/src/app/sell/pages/Settings");
const { default: Developers } = await import("../../site/src/app/sell/pages/Developers");
const { revenueHint } = await import("../../site/src/app/seller/pages/Overview");
const { DEVELOPERS_SECTIONS, MOVED_TO_DEVELOPERS, SETTINGS_SECTIONS } = await import("../../site/src/app/sell/developers/reference");

function render(el: React.ReactElement, path = "/app/sell/settings") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("sell menu", () => {
  it("adds Developers right below Agent policies and keeps every existing item in order", () => {
    expect(SELL_NAV_ORG.map((i) => i.label)).toEqual(["Overview", "Negotiations", "Deals", "Customers", "Products & pricing", "Payments", "Usage & delivery", "Insights", "Agent policies", "Developers", "Seller settings"]);
    expect(SELL_NAV_ORG.find((i) => i.label === "Developers")!.to).toBe("/app/sell/developers");
  });
});

describe("Seller settings", () => {
  const html = render(<Settings />);

  it("keeps brand and payout, and leaves a Moved to Developers pointer", () => {
    expect(html).toContain("Payout address");
    expect(html).toContain("Brand");
    expect(html).toContain("Moved to Developers");
    expect(html).toContain('href="/app/sell/developers"');
    for (const m of MOVED_TO_DEVELOPERS) expect(html).toContain(`href="/app/sell/developers#${m.anchor}"`);
  });

  it("no longer shows the embed code, webhook, signer or agent identity cards", () => {
    expect(html).not.toContain("Deal agent on your website");
    expect(html).not.toContain("Webhook URL");
    expect(html).not.toContain("Seller signer");
    expect(html).not.toContain("Agent identity on Arc");
    expect(SETTINGS_SECTIONS).toEqual(expect.arrayContaining(["brand", "payout", "alerts", "moved-to-developers"]));
    for (const moved of ["embed", "webhooks", "signer"]) expect(SETTINGS_SECTIONS as readonly string[]).not.toContain(moved);
  });
});

describe("Developers", () => {
  const html = render(<Developers />, "/app/sell/developers");

  it("has every section, including the cards moved from Seller settings", () => {
    for (const s of DEVELOPERS_SECTIONS) expect(html).toContain(`id="${s.id}"`);
    expect(html).toContain("Seller signer");
    expect(html).toContain("Agent identity on Arc");
    expect(html).toContain("Products and endpoints");
    expect(html).toContain("Quickstart");
    expect(html).toContain("/v1/seller");
  });
});

describe("Overview revenue line", () => {
  it("describes the reproduced deal as one fulfilled deal, and partial settlements honestly", () => {
    expect(revenueHint(1, 1)).toBe("Settled on chain from 1 fulfilled deal");
    expect(revenueHint(0, 0)).toMatch(/Nothing settled yet/);
    expect(revenueHint(3, 1)).toBe("Settled on chain from 3 deals, 1 fully delivered");
  });
});
