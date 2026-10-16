/**
 * Seller console route tree. Mount at /app/* :
 *   <Route path="/app/*" element={<SellerRoutes />} />
 */
import { lazy, Suspense, useContext, useState, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { ActionButton, EmptyState, LoadingCard, SellerShell } from "./kit";
import { SELLER_NAV } from "./nav";
import s from "./seller.module.css";

const Overview = lazy(() => import("./pages/Overview"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Negotiations = lazy(() => import("./pages/Negotiations"));
const NegotiationDetail = lazy(() => import("./pages/NegotiationDetail"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Deals = lazy(() => import("./pages/Deals"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const Finance = lazy(() => import("./pages/Finance"));

/** Use the app's QueryClient when one is provided above us; otherwise bring our own. */
function EnsureQueryClient({ children }: { children: ReactNode }) {
  const existing = useContext(QueryClientContext);
  const [own] = useState(() => (existing ? null : new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } })));
  if (existing || !own) return <>{children}</>;
  return <QueryClientProvider client={own}>{children}</QueryClientProvider>;
}

function NotFound() {
  return (
    <div className={s.page}>
      <EmptyState title="This page is not part of the seller console" description="It may have moved, or it is not in this build yet." action={<ActionButton to="/app" variant="secondary">Back to overview</ActionButton>} />
    </div>
  );
}

export default function SellerRoutes() {
  return (
    <EnsureQueryClient>
      <SellerShell nav={SELLER_NAV}>
        <Suspense fallback={<div className={s.page}><LoadingCard label="Loading page" /></div>}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="negotiations" element={<Negotiations />} />
            <Route path="negotiations/:id" element={<NegotiationDetail />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="deals" element={<Deals />} />
            <Route path="deals/:id" element={<DealDetail />} />
            <Route path="finance" element={<Finance />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </SellerShell>
    </EnsureQueryClient>
  );
}

export { SellerRoutes, SELLER_NAV };
