import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RouteFallback } from "../RouteFallback";
import { useAuth } from "./useAuth";
import { isMock } from "../lib/api";

/** Builds /login?next=<current path>. */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Builds /invite?next=<current path>. */
export function inviteHref(next: string): string {
  return `/invite?next=${encodeURIComponent(next)}`;
}

/** Only allow same-origin relative paths as a post-login destination. */
export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** Gate for every /app route: waits for Privy, then redirects to /login with `next` when signed out. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { ready, authenticated, me, meStatus } = useAuth();
  const loc = useLocation();
  if (!ready) return <RouteFallback />;
  if (!authenticated) return <Navigate to={loginHref(loc.pathname + loc.search)} replace />;
  // Invite gate: the account exists but no invite code has been bound to it yet.
  if (meStatus === "ready" && me && me.access === false && !isMock()) return <Navigate to={inviteHref(loc.pathname + loc.search)} replace />;
  // First run: the account has not said whether it came to buy or sell. Ask once, then route by it.
  const onWelcome = loc.pathname.startsWith("/app/welcome");
  if (!onWelcome && meStatus === "ready" && me && me.mode == null && !isMock()) return <Navigate to="/app/welcome" replace />;
  if (onWelcome && me?.mode) return <Navigate to={me.mode === "sell" ? "/app/sell" : "/app"} replace />;
  // Sellers land on their console, not the buyer home.
  if (loc.pathname === "/app" && me?.mode === "sell" && !isMock()) return <Navigate to="/app/sell" replace />;
  return <>{children ?? <Outlet />}</>;
}

export default RequireAuth;
