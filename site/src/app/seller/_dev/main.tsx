/**
 * Dev-only harness for the sell side (not part of the app bundle).
 * Open /src/app/seller/_dev/index.html?path=/app/sell/products with VITE_MOCK=1.
 *   &mockOrg=none  start without a seller org (Start selling onboarding)
 *   &seed=1   create a sandbox session plus sample negotiations, an approval and a funded deal
 *             through the shared mock's buyer API before rendering.
 *   &catalog=96  list that many products (copies of the mock product with store-like names) to check long lists.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyAppProvider } from "../../auth/PrivyAppProvider";
import "../../../styles/base.css";
import { api } from "../../lib/api";
import SellRoutes from "../../sell/SellRoutes";

const params = new URLSearchParams(location.search);
const path = params.get("path") ?? "/app/sell";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function seed() {
  await api.app.sandboxSession();
  const S = { sellerSlug: "northwind", productSlug: "order-support" };
  // 2. A counter below the margin floor.
  const n2 = await api.startNegotiation(S);
  const r2 = await api.sendMessage(n2.id, "Can you do 2,000 resolutions? We use Intercom. Budget is $1,500.");
  const growth = r2.offers.find((o) => o.tierId === "growth") ?? r2.offers[0];
  if (growth) await api.counter(n2.id, { candidateId: growth.candidateId, targetTotal: "1100000000" });
  // 2b. An accepted, funded deal.
  const n3 = await api.startNegotiation(S);
  const r3 = await api.sendMessage(n3.id, "1,500 resolutions over your REST API please.");
  const ok = r3.offers.find((o) => o.status === "eligible");
  if (ok) {
    const q = await api.createQuote(n3.id, ok.candidateId);
    const d = await api.acceptQuote(q.id, { buyerAddress: "0x7a3B5c1E9d2F4a6B8c0D1e2F3a4B5c6D7e8F9a0B", buyerSignature: "0x" + "11".repeat(65) });
    await api.fundingIntent(d.id, {});
    await sleep(3700);
    await api.deal(d.id);
  }
  // 3. Large request (last, so the mock has not auto-approved it yet) that needs owner approval.
  const n1 = await api.startNegotiation(S);
  const r1 = await api.sendMessage(n1.id, "We need about 4,000 order questions a month through Zendesk and your API. Budget is $3,600.");
  const big = r1.offers.find((o) => o.status === "approval_required");
  if (big) await api.createQuote(n1.id, big.candidateId);
}

const NAMES = ["Vintage Zip Polo", "The Backpack by Mokobara", "Flow Tee", "Metal Keychain - Oval", "A5 Strap Diary", "Canvas Tote", "Enamel Pin", "Ceramic Mug", "Linen Shirt", "Desk Calendar", "Wool Beanie", "Steel Bottle"];
const KINDS = [["Apparel", "Classic", "Relaxed", "Heavyweight"], ["Bags", "Daypack", "Weekender", "Sling"], ["Accessories", "Brass", "Matte", "Mini"], ["Stationery", "Dotted", "Ruled", "Plain"]] as const;

/** Copies of the mock product so a page shows a long catalogue; categories rotate and every seventh is hidden. */
function longCatalogue(n: number) {
  const original = api.app.products;
  api.app.products = async () => {
    const [base] = await original();
    if (!base) return [];
    return Array.from({ length: n }, (_, i) => {
      const name = NAMES[i % NAMES.length]!;
      const [category, ...styles] = KINDS[NAMES.indexOf(name) % KINDS.length]!;
      const full = i < NAMES.length ? name : `${name} - ${styles[i % styles.length]} ${Math.floor(i / NAMES.length) + 1}`;
      const slug = full.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return { ...base, id: `${base.id}_${i}`, slug, name: full, category, summary: `${category} from the Shoonya Store catalogue`, active: i % 7 !== 3 };
    });
  };
}

async function main() {
  if (params.get("catalog")) longCatalogue(Number(params.get("catalog")));
  if (params.get("seed") === "1" && !sessionStorage.getItem("seller-harness-seeded")) {
    await seed();
    sessionStorage.setItem("seller-harness-seeded", "1");
  }
  let initial = path;
  if (params.get("first")) {
    // Resolve "first" placeholders for detail routes: ?first=deal
    const kind = params.get("first");
    if (kind === "deal") initial = `/app/sell/deals/${(await api.app.deals())[0]?.id ?? "none"}`;
    if (kind === "negotiation") initial = `/app/sell/negotiations/${(await api.app.negotiations())[params.get("i") ? Number(params.get("i")) : 0]?.id ?? "none"}`;
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 } } })}>
        <PrivyAppProvider>
          <MemoryRouter initialEntries={[initial]}>
            <Routes>
              <Route path="/app/sell/*" element={<SellRoutes />} />
              <Route path="*" element={<p style={{ padding: 40 }}>Left the sell side (harness).</p>} />
            </Routes>
          </MemoryRouter>
        </PrivyAppProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  (window as unknown as { __ready: boolean }).__ready = true;
}
void main();
