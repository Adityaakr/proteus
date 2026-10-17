import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { setDefaultChainId } from "@proteus/domain";
import { api, qk } from "./lib/api";
import { RouteFallback } from "./RouteFallback";

const GATED = ["/app", "/login", "/invite", "/docs", "/review", "/records"];

/**
 * Tells the domain helpers which Arc network this deployment runs (testnet or mainnet) from /api/health, so
 * explorer links, wallet clients and labels match the API. App routes wait for it; the marketing page does not.
 */
export function NetworkBoot({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const gated = GATED.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  const q = useQuery({ queryKey: qk.health, queryFn: api.health, staleTime: 60_000, retry: 1, enabled: gated });
  if (q.data?.chainId) setDefaultChainId(q.data.chainId);
  if (gated && q.isPending) return <RouteFallback />;
  return <>{children}</>;
}
