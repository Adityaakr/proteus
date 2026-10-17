import { HttpError } from "./http";

/** Fixed-window attempt counter in memory (one instance). */
const buckets = new Map<string, { n: number; resetAt: number }>();
export function limit(key: string, max: number, windowMs = 10 * 60 * 1000): void {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt < now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return;
  }
  cur.n++;
  if (cur.n > max) throw new HttpError(429, "Too many attempts. Try again in a few minutes.", { retryAfterSeconds: Math.ceil((cur.resetAt - now) / 1000) });
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}
export function clientIp(h: (name: string) => string | undefined): string {
  return h("x-forwarded-for")?.split(",")[0]?.trim() || h("x-real-ip") || h("cf-connecting-ip") || "local";
}
