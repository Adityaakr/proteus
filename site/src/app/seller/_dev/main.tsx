/**
 * Dev-only harness for the seller console (not part of the app bundle).
 * Open /src/app/seller/_dev/index.html?path=/app/products with VITE_MOCK=1.
 *   &seed=1   create a sandbox session plus sample negotiations, an approval and a funded deal
 *             through the shared mock's buyer API before rendering.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../styles/base.css";
import { api } from "../../lib/api";
import SellerRoutes from "../SellerRoutes";

const params = new URLSearchParams(location.search);
const path = params.get("path") ?? "/app";
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

async function main() {
  if (params.get("seed") === "1" && !sessionStorage.getItem("seller-harness-seeded")) {
    await seed();
    sessionStorage.setItem("seller-harness-seeded", "1");
  }
  let initial = path;
  if (params.get("first")) {
    // Resolve "first" placeholders for detail routes: ?path=/app/deals/first
    const kind = params.get("first");
    if (kind === "deal") initial = `/app/deals/${(await api.app.deals())[0]?.id ?? "none"}`;
    if (kind === "negotiation") initial = `/app/negotiations/${(await api.app.negotiations())[params.get("i") ? Number(params.get("i")) : 0]?.id ?? "none"}`;
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/app/*" element={<SellerRoutes />} />
          <Route path="*" element={<p style={{ padding: 40 }}>Left the seller console (harness).</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  (window as unknown as { __ready: boolean }).__ready = true;
}
void main();
