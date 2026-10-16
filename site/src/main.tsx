import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import "./styles/base.css";
import App from "./App";
import { RouteFallback, NotFound } from "./app/RouteFallback";

const Storefront = lazy(() => import("./app/buyer/Storefront"));
const Negotiate = lazy(() => import("./app/buyer/Negotiate"));
const Offer = lazy(() => import("./app/buyer/Offer"));
const Checkout = lazy(() => import("./app/buyer/Checkout"));
const PortalDeal = lazy(() => import("./app/buyer/PortalDeal"));
const ReviewList = lazy(() => import("./app/review/ReviewList"));
const ReviewRecord = lazy(() => import("./app/review/ReviewRecord"));

// The seller console is owned by a sibling module. Resolve it with a glob so the build never
// breaks while site/src/app/seller/SellerRoutes.tsx does not exist yet.
const sellerModules = import.meta.glob<Record<string, unknown>>("./app/seller/SellerRoutes.tsx");
const sellerLoader = sellerModules["./app/seller/SellerRoutes.tsx"];
const SellerRoutes = lazy(async (): Promise<{ default: ComponentType }> => {
  if (!sellerLoader) return import("./app/SellerPlaceholder");
  const m = await sellerLoader();
  const C = (m.default ?? m.SellerRoutes) as ComponentType | undefined;
  return C ? { default: C } : import("./app/SellerPlaceholder");
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/s/:sellerSlug" element={<Storefront />} />
              <Route path="/s/:sellerSlug/:productSlug" element={<Storefront />} />
              <Route path="/negotiate/:id" element={<Negotiate />} />
              <Route path="/offer/:quoteId" element={<Offer />} />
              <Route path="/checkout/:dealId" element={<Checkout />} />
              <Route path="/portal/deals/:dealId" element={<PortalDeal />} />
              <Route path="/review" element={<ReviewList />} />
              <Route path="/records/:publicId" element={<ReviewRecord />} />
              <Route path="/app/*" element={<SellerRoutes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
