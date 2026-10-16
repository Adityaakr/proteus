/**
 * Single import point for the shared v1 pieces the sell side uses:
 * useAuth (auth/useAuth.ts), AppShell (layouts/AppShell.tsx) and the v1 routes on the shared client (lib/api.ts).
 */
export { useAuth } from "../auth/useAuth";
export { AppShell } from "../layouts/AppShell";
export { api as v1 } from "../lib/api";
