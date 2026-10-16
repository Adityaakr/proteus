import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RouteFallback } from "../RouteFallback";
import { useAuth } from "./useAuth";

/** Builds /login?next=<current path>. */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Only allow same-origin relative paths as a post-login destination. */
export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** Gate for every /app route: waits for Privy, then redirects to /login with `next` when signed out. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { ready, authenticated } = useAuth();
  const loc = useLocation();
  if (!ready) return <RouteFallback />;
  if (!authenticated) return <Navigate to={loginHref(loc.pathname + loc.search)} replace />;
  return <>{children ?? <Outlet />}</>;
}

export default RequireAuth;
