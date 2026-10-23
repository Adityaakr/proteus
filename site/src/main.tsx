import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import "./styles/base.css";
import App from "./App";
import { RouteFallback, NotFound } from "./app/RouteFallback";
import { RequireAuth } from "./app/auth/RequireAuth";

import { NetworkBoot } from "./app/NetworkBoot";
const AuthRoot = lazy(() => import("./app/auth/AuthRoot"));
const LoginPage = lazy(() => import("./app/auth/LoginPage"));
const InvitePage = lazy(() => import("./app/auth/InvitePage"));
const Home = lazy(() => import("./app/home/Home"));
const Settings = lazy(() => import("./app/home/Settings"));
const WalletPage = lazy(() => import("./app/wallet/WalletPage"));
const ApiDocs = lazy(() => import("./app/docs/ApiDocs"));
const ProductDocs = lazy(() => import("./app/docs/ProductDocs"));
const ServiceDocs = lazy(() => import("./app/docs/ServiceDocs"));
const Welcome = lazy(() => import("./app/auth/Welcome"));
const Market = lazy(() => import("./app/market/Market"));
const StorePage = lazy(() => import("./app/market/StorePage"));
const ProductPage = lazy(() => import("./app/market/ProductPage"));
const Negotiations = lazy(() => import("./app/buyer/Negotiations"));
const Negotiate = lazy(() => import("./app/buyer/Negotiate"));
const OfferFund = lazy(() => import("./app/buyer/OfferFund"));
const Deals = lazy(() => import("./app/buyer/Deals"));
const PortalDeal = lazy(() => import("./app/buyer/PortalDeal"));
const ReviewList = lazy(() => import("./app/review/ReviewList"));
const EmbedAgent = lazy(() => import("./app/embed/EmbedAgent"));
const ReviewRecord = lazy(() => import("./app/review/ReviewRecord"));

// The sell side (/app/sell/*) is owned by a sibling module. Resolve it with a glob so the build never
// breaks while site/src/app/sell/SellRoutes.tsx does not exist yet.
const sellModules = import.meta.glob<Record<string, unknown>>("./app/sell/SellRoutes.tsx");
const sellLoader = sellModules["./app/sell/SellRoutes.tsx"];
const SellRoutes = lazy(async (): Promise<{ default: ComponentType }> => {
  if (!sellLoader) return import("./app/home/SellPlaceholder");
  const m = await sellLoader();
  const C = (m.default ?? m.SellRoutes) as ComponentType | undefined;
  return C ? { default: C } : import("./app/home/SellPlaceholder");
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

/** Redirect an old public URL to its /app equivalent (RequireAuth sends signed out people to /login first). */
function Legacy({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <NetworkBoot>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/review" element={<ReviewList />} />
              <Route path="/docs" element={<ProductDocs />} />
              <Route path="/docs/api" element={<ApiDocs />} />
              <Route path="/docs/:sellerSlug/:productSlug" element={<ServiceDocs />} />
              <Route path="/records/:publicId" element={<ReviewRecord />} />
              <Route path="/embed/:sellerSlug" element={<EmbedAgent />} />
              <Route element={<AuthRoot />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/invite" element={<InvitePage />} />
                <Route path="/app" element={<RequireAuth />}>
                  <Route path="welcome" element={<Welcome />} />
                  <Route index element={<Home />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="market" element={<Market />} />
                  <Route path="market/:sellerSlug" element={<StorePage />} />
                  <Route path="market/:sellerSlug/:productSlug" element={<ProductPage />} />
                  <Route path="negotiations" element={<Negotiations />} />
                  <Route path="negotiations/:id" element={<Negotiate />} />
                  <Route path="offers/:quoteId" element={<OfferFund />} />
                  <Route path="deals" element={<Deals />} />
                  <Route path="deals/:dealId" element={<PortalDeal />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="sell/*" element={<SellRoutes />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                {/* Legacy public routes */}
                <Route path="/s/:sellerSlug" element={<Legacy to={(p) => `/app/market/${p.sellerSlug}`} />} />
                <Route path="/s/:sellerSlug/:productSlug" element={<Legacy to={(p) => `/app/market/${p.sellerSlug}/${p.productSlug}`} />} />
                <Route path="/negotiate/:id" element={<Legacy to={(p) => `/app/negotiations/${p.id}`} />} />
                <Route path="/offer/:quoteId" element={<Legacy to={(p) => `/app/offers/${p.quoteId}`} />} />
                <Route path="/checkout/:dealId" element={<Legacy to={(p) => `/app/deals/${p.dealId}`} />} />
                <Route path="/portal/deals/:dealId" element={<Legacy to={(p) => `/app/deals/${p.dealId}`} />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </NetworkBoot>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
