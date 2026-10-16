/**
 * Fallback for a service that has the built site but no database: serve the site, and forward /api to
 * API_ORIGIN (the API service's URL) when it is set, otherwise answer /api with a clear 503.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const port = Number(process.env.PORT ?? 8787);
const apiOrigin = (process.env.API_ORIGIN ?? "").replace(/\/$/, "");
const dist = resolve(process.cwd(), "../site/dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error(`[static] no site build at ${dist}; run pnpm --filter proteus-site build`);
  process.exit(1);
}
const shell = readFileSync(join(dist, "index.html"), "utf8");
const app = new Hono();
// Health must answer 200 here too, or Railway never routes traffic to a site-only service.
app.get("/api/health", async (c) => {
  if (!apiOrigin) return c.json({ ok: false, mode: "site-only", reason: "no DATABASE_URL and no API_ORIGIN on this service" });
  try {
    const r = await fetch(apiOrigin + "/api/health");
    return new Response(r.body, { status: r.status, headers: r.headers });
  } catch {
    return c.json({ ok: false, mode: "site-only", apiOrigin, reason: "API_ORIGIN unreachable" });
  }
});
app.all("/api/*", async (c) => {
  if (!apiOrigin) return c.json({ error: "This service has no database and no API_ORIGIN. Set DATABASE_URL to run the API here, or API_ORIGIN to forward /api to the API service." }, 503);
  const url = new URL(c.req.url);
  const target = apiOrigin + url.pathname + url.search;
  const headers = new Headers(c.req.raw.headers);
  headers.delete("host");
  const res = await fetch(target, { method: c.req.method, headers, body: c.req.method === "GET" || c.req.method === "HEAD" ? undefined : await c.req.raw.arrayBuffer(), redirect: "manual" });
  return new Response(res.body, { status: res.status, headers: res.headers });
});
app.use("/*", serveStatic({ root: relative(process.cwd(), dist) }));
app.get("/*", (c) => c.html(shell));
serve({ fetch: app.fetch, port, hostname: "::" }, () => console.log(`[static] site on :${port}${apiOrigin ? `, /api forwarded to ${apiOrigin}` : ", /api answers 503 until DATABASE_URL or API_ORIGIN is set"}`));
