import { Suspense, lazy, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { RouteFallback } from "../RouteFallback";
import { api, isMock } from "../lib/api";

const PrivyAppProvider = lazy(() => import("./PrivyAppProvider"));
const CircleAuthProvider = lazy(() => import("./CircleAuthProvider"));

type Pick = { provider: "privy" } | { provider: "circle"; appId: string; chain: string };

/**
 * Layout route for /login, /app/* and the legacy redirects. Asks the API which sign-in it runs (Circle or
 * Privy) so the hosted site needs no build-time switch, then loads only that provider's code.
 */
export default function AuthRoot() {
  const [pick, setPick] = useState<Pick | null>(() => (isMock() ? { provider: "privy" } : null));
  useEffect(() => {
    if (pick) return;
    let alive = true;
    api
      .health()
      .then((h) => {
        if (!alive) return;
        const a = h.auth;
        setPick(a?.provider === "circle" && a.circleAppId ? { provider: "circle", appId: a.circleAppId, chain: a.circleChain } : { provider: "privy" });
      })
      .catch(() => alive && setPick({ provider: "privy" }));
    return () => {
      alive = false;
    };
  }, [pick]);
  if (!pick) return <RouteFallback />;
  return (
    <Suspense fallback={<RouteFallback />}>
      {pick.provider === "circle" ? (
        <CircleAuthProvider appId={pick.appId}>
          <Outlet />
        </CircleAuthProvider>
      ) : (
        <PrivyAppProvider>
          <Outlet />
        </PrivyAppProvider>
      )}
    </Suspense>
  );
}
