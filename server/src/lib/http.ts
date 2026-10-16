import type { Context } from "hono";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** JSON with bigint support: bigints serialize as decimal strings. */
export function json(c: Context, data: unknown, status = 200) {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return c.body(body, status as 200, { "content-type": "application/json; charset=utf-8" });
}

/** Deep-convert bigints to strings for storing in jsonb. */
export function bigintsToStrings<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}

export function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
  throw new HttpError(400, `expected integer string, got ${String(v)}`);
}
