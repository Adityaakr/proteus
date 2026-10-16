/**
 * Transport for the seller console: the shared typed client in site/src/app/lib/api.ts
 * (cookie session against the API, or its in-browser mock when VITE_MOCK=1).
 */
export { api, ApiError, errorMessage } from "../lib/api";

export function isUnauthorized(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("status" in e)) return false;
  const st = (e as { status: unknown }).status;
  return st === 401 || st === 403;
}
