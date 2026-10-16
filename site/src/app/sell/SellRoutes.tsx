/**
 * Sell side of the dashboard. Mount at /app/sell/* :
 *   <Route path="/app/sell/*" element={<SellRoutes />} />
 * Every page is wrapped in the shared AppShell (title per page). Without a seller org the index
 * shows the one-screen "Start selling" onboarding and the console pages point back to it.
 */
import { lazy, Suspense, useContext, useState, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientContext, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { ActionButton, EmptyState, LoadingCard } from "../seller/kit";
import { api, isMock } from "../lib/api";
import { SELL } from "../seller/paths";
import { AppShell } from "./v1";
import { useMe } from "./hooks";
import s from "./sell.module.css";

const Overview = lazy(() => import("../seller/pages/Overview"));
const Products = lazy(() => import("../seller/pages/Products"));
const ProductDetail = lazy(() => import("../seller/pages/ProductDetail"));
const Negotiations = lazy(() => import("../seller/pages/Negotiations"));
const NegotiationDetail = lazy(() => import("../seller/pages/NegotiationDetail"));
const Approvals = lazy(() => import("../seller/pages/Approvals"));
const Deals = lazy(() => import("../seller/pages/Deals"));
const DealDetail = lazy(() => import("../seller/pages/DealDetail"));
const Finance = lazy(() => import("../seller/pages/Finance"));
const StartSelling = lazy(() => import("./onboarding/StartSelling"));
const Settings = lazy(() => import("./pages/Settings"));

/** Use the app's QueryClient when one is provided above us; otherwise bring our own. */
function EnsureQueryClient({ children }: { children: ReactNode }) {
  const existing = useContext(QueryClientContext);
  const [own] = useState(() => (existing ? null : new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } } })));
  if (existing || !own) return <>{children}</>;
  return <QueryClientProvider client={own}>{children}</QueryClientProvider>;
}

const Loading = ({ label = "Loading page" }: { label?: string }) => (
  <div className={s.page}>
    <LoadingCard label={label} />
  </div>
);

/** Mock mode only: the shared mock serves /app/* behind its sandbox session, so open it once. */
function MockSession({ children }: { children: ReactNode }) {
  const mock = isMock();
  const q = useQuery({ queryKey: ["sell", "mock-session"], queryFn: () => api.app.sandboxSession(), enabled: mock, staleTime: Infinity, retry: false });
  if (mock && q.isPending) return <Loading label="Opening the mock seller" />;
  return <>{children}</>;
}

function Page({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <AppShell title={title}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </AppShell>
  );
}

function NoOrg() {
  return (
    <div className={s.page}>
      <EmptyState
        icon={<Store size={20} />}
        title="You are not selling yet"
        description="Publish a product first. It takes one screen: your public tiers and the private floor your agent prices against."
        action={<ActionButton to={SELL} icon>Start selling</ActionButton>}
      />
    </div>
  );
}

/** Console pages need a seller org; without one they point to onboarding. */
function RequireOrg({ children }: { children: ReactNode }) {
  const { me, ready } = useMe();
  if (!ready) return <Loading />;
  if (!me?.org) return <NoOrg />;
  return <MockSession>{children}</MockSession>;
}

function SellIndex() {
  const { me, ready } = useMe();
  if (!ready) return <Loading />;
  if (!me?.org) return <StartSelling />;
  return (
    <MockSession>
      <Overview />
    </MockSession>
  );
}

function AddProduct() {
  const { me, ready } = useMe();
  if (!ready) return <Loading />;
  return <StartSelling org={me?.org} />;
}

function NotFound() {
  return (
    <div className={s.page}>
      <EmptyState title="This page is not part of the sell side" description="It may have moved, or it is not in this build yet." action={<ActionButton to={SELL} variant="secondary">Back to selling</ActionButton>} />
    </div>
  );
}

const guarded = (el: ReactNode) => <RequireOrg>{el}</RequireOrg>;

function SellIndexPage() {
  const { me } = useMe();
  return (
    <Page title={me && !me.org ? "Start selling" : "Overview"}>
      <SellIndex />
    </Page>
  );
}

export default function SellRoutes() {
  return (
    <EnsureQueryClient>
      <Routes>
        <Route index element={<SellIndexPage />} />
        <Route path="start" element={<Page title="New product"><AddProduct /></Page>} />
        <Route path="products" element={<Page title="Products">{guarded(<Products />)}</Page>} />
        <Route path="products/:id" element={<Page title="Products">{guarded(<ProductDetail />)}</Page>} />
        <Route path="negotiations" element={<Page title="Negotiations">{guarded(<Negotiations />)}</Page>} />
        <Route path="negotiations/:id" element={<Page title="Negotiations">{guarded(<NegotiationDetail />)}</Page>} />
        <Route path="approvals" element={<Page title="Approvals">{guarded(<Approvals />)}</Page>} />
        <Route path="deals" element={<Page title="Deals">{guarded(<Deals />)}</Page>} />
        <Route path="deals/:id" element={<Page title="Deals">{guarded(<DealDetail />)}</Page>} />
        <Route path="finance" element={<Page title="Finance">{guarded(<Finance />)}</Page>} />
        <Route path="settings" element={<Page title="Settings"><Settings /></Page>} />
        <Route path="*" element={<Page><NotFound /></Page>} />
      </Routes>
    </EnsureQueryClient>
  );
}

export { SellRoutes };
