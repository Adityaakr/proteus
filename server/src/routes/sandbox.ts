/**
 * The public seller API sandbox at /api/v1/sandbox/seller/*: the same routes as /api/v1/seller/*, answered from the
 * fixed demo seller in services/sandbox.ts with its published key. Mounted on the Arc testnet deployment only.
 */
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { json } from "../lib/http";
import { SANDBOX_HANDLERS, SANDBOX_PREFIX, sandboxAuth } from "../services/sandbox";
import { SELLER_API } from "./developers";

/** The sandbox exists on the Arc testnet deployment only; mainnet never serves it. */
export const sandboxEnabled = (network: "testnet" | "mainnet") => network === "testnet";

/** CORS for the sandbox: any origin, no cookies, so the docs on either deployment can call it. */
export const sandboxCors = cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "OPTIONS"], allowHeaders: ["Authorization", "Content-Type"], maxAge: 600 });

export function sandboxRoutes() {
  const r = new Hono();
  for (const route of SELLER_API) {
    const handler = SANDBOX_HANDLERS[`${route.method} ${route.path}`];
    if (!handler) throw new Error(`no sandbox handler for ${route.method} ${route.path}`);
    const path = route.path.replace("/v1/seller", SANDBOX_PREFIX);
    const run = async (c: Context) => {
      c.header("cache-control", "no-store");
      c.header("x-proteus-sandbox", "1");
      sandboxAuth(c.req.header("authorization"));
      const body = route.method === "GET" ? undefined : await c.req.json().catch(() => ({}));
      // Writes answer 200 with dryRun: true and the status the real endpoint would have used.
      return json(c, handler({ params: c.req.param() as Record<string, string>, body }));
    };
    if (route.method === "GET") r.get(path, run);
    else if (route.method === "POST") r.post(path, run);
    else r.patch(path, run);
  }
  return r;
}
