import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { agentAdapterName } from "./agent";
import { startReconciler } from "./chain/reconciler";
import { relayerKind } from "./chain/relayer";
import { sellerSignerAddress } from "./chain/client";
import { env, features } from "./env";
import { explorerBase } from "@proteus/domain";
import { HttpError, json } from "./lib/http";
import { appRoutes } from "./routes/app";
import { dealRoutes } from "./routes/deals";
import { publicRoutes } from "./routes/public";
import { meRoutes } from "./routes/me";
import { payRoutes } from "./routes/pay";
import { rpcRoutes } from "./routes/rpc";
import { inviteRoutes } from "./routes/invites";
import { circleAuthRoutes } from "./routes/circle-auth";
import { consoleRoutes } from "./routes/console";
import { embedAncestors } from "./services/embed";

const app = new Hono();
app.use("*", logger((s) => console.log(s)));
app.use("/api/*", cors({ origin: env.WEB_ORIGIN, credentials: true }));

// Framing policy. /embed/<seller> is the deal agent sellers put on their own websites, so other sites may frame it
// (restricted to the seller's own domains when it lists them). Every other page, including offer signing, funding and
// the app, refuses to be framed by other sites: a buyer only ever signs in a top-level Proteus window (clickjacking).
app.use("*", async (c, next) => {
  await next();
  if (c.req.path.startsWith("/api/")) return;
  if (c.req.path.startsWith("/embed/")) {
    c.header("Content-Security-Policy", `frame-ancestors ${await embedAncestors(c.req.path.split("/")[2] ?? "")}`);
    c.header("X-Frame-Options", undefined);
  } else {
    c.header("Content-Security-Policy", "frame-ancestors 'self'");
    c.header("X-Frame-Options", "SAMEORIGIN");
  }
});

app.get("/api/health", (c) =>
  json(c, {
    ok: true,
    network: features.network,
    chainId: env.CHAIN_ID,
    explorer: explorerBase(env.CHAIN_ID),
    peer: env.PEER_NETWORK_URL ? { network: features.network === "testnet" ? "mainnet" : "testnet", url: env.PEER_NETWORK_URL } : null,
    escrowAddress: env.ESCROW_ADDRESS ?? null,
    usdcAddress: env.USDC_ADDRESS,
    agentAdapter: agentAdapterName(),
    relayer: relayerKind(),
    sellerSigner: sellerSignerAddress() ?? null,
    auth: { provider: features.authProvider, privyAppId: env.PRIVY_APP_ID, circleAppId: features.circleAuth ? env.CIRCLE_APP_ID : null, circleEmail: features.circleEmail, circleChain: env.CHAIN_ID === 5042002 ? "ARC-TESTNET" : "ARC", devBypass: features.privyDevBypass },
    features,
    time: new Date().toISOString(),
  }),
);

app.route("/api", inviteRoutes);
app.route("/api", circleAuthRoutes);
app.route("/api", publicRoutes);
app.route("/api", dealRoutes);
app.route("/api", meRoutes);
app.route("/api", payRoutes);
app.route("/api", appRoutes);
app.route("/api", consoleRoutes);
app.route("/api", rpcRoutes);

// Hosted mode: the built site lives next to the API, so one service serves both from one origin.
// Anything that is not /api and not a file in site/dist answers the SPA shell (client-side routing).
const siteDist = resolve(process.cwd(), "../site/dist");
if (existsSync(join(siteDist, "index.html"))) {
  const shell = readFileSync(join(siteDist, "index.html"), "utf8");
  // Markdown for agents (/docs.md, /docs/<page>.md, skill files): Hono's static mime table has no .md entry.
  app.get("/*", async (c, next) => {
    const p = c.req.path;
    if (!p.endsWith(".md") || p.startsWith("/api/")) return next();
    const file = resolve(siteDist, "." + p);
    if (!file.startsWith(siteDist + "/") || !existsSync(file)) return next();
    return c.body(readFileSync(file, "utf8"), 200, { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300" });
  });
  // HTML must revalidate so a deploy shows on first load; hashed /assets/ files never change.
  app.use("/*", serveStatic({
    root: relative(process.cwd(), siteDist),
    onFound: (path, c) => {
      if (path.endsWith(".html")) c.header("cache-control", "no-cache");
      else if (path.includes("/assets/")) c.header("cache-control", "public, max-age=31536000, immutable");
    },
  }));
  const docsShell = docsPreviewShell(shell, siteDist);
  app.get("/*", (c) => {
    const p = c.req.path;
    if (p.startsWith("/api/")) return c.notFound();
    c.header("cache-control", "no-cache");
    return c.html((p === "/docs" || p.startsWith("/docs/")) ? docsShell(p, env.WEB_ORIGIN.replace(/\/$/, "")) : shell);
  });
  console.log(`serving site from ${siteDist}`);
}

app.onError((err, c) => {
  if (err instanceof HttpError) return json(c, { error: err.message, details: err.details ?? null }, err.status);
  if (err instanceof ZodError) return json(c, { error: "invalid request", details: err.issues }, 400);
  const msg = (err as Error).message ?? String(err);
  console.error("[error]", msg);
  // viem revert reasons are useful to surface in the demo UI.
  const status = /revert|insufficient|allowance|not configured/i.test(msg) ? 409 : 500;
  return json(c, { error: msg.slice(0, 400) }, status);
});

serve({ fetch: app.fetch, port: env.PORT, hostname: "::" }, (info) => {
  console.log(`Proteus AI api on http://localhost:${info.port} | agent=${agentAdapterName()} relayer=${relayerKind()} escrow=${env.ESCROW_ADDRESS ?? "unset"}`);
  startReconciler();
  setInterval(() => import("./services/x402").then((m) => m.checkPendingPayments()).catch(() => {}), 15_000);
});

/**
 * Link previews for /docs pages. Crawlers (X, Telegram, Slack) do not run the SPA, so the shell itself carries
 * the page's title, summary and the docs card image. Titles come from the generated docs/facts.json.
 */
function docsPreviewShell(shell: string, dist: string) {
  const pages = new Map<string, { title: string; summary: string }>();
  try {
    const facts = JSON.parse(readFileSync(join(dist, "docs", "facts.json"), "utf8")) as { docs?: { pages?: { id: string; title: string; summary?: string }[] } };
    for (const pg of facts.docs?.pages ?? []) pages.set(pg.id, { title: pg.title, summary: pg.summary ?? "" });
  } catch { /* no generated docs: fall back to the default card text */ }
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return (path: string, origin: string) => {
    const page = pages.get(path.replace(/^\/docs\/?/, "").split("/")[0] ?? "");
    const title = page ? `${page.title} · Proteus AI docs` : "Proteus AI docs: the deal desk for internet businesses";
    const desc = page?.summary || "How a seller's agent negotiates, both sides sign, and USDC settles on Arc for what is delivered. Built for people and AI agents.";
    const image = `${origin}/og/docs.jpg`;
    const meta = [
      `<meta property="og:type" content="article" />`,
      `<meta property="og:site_name" content="Proteus AI" />`,
      `<meta property="og:url" content="${esc(origin + path)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:image:width" content="2400" />`,
      `<meta property="og:image:height" content="1260" />`,
      `<meta property="og:image:alt" content="Proteus AI docs: the deal desk for internet businesses" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(desc)}" />`,
      `<meta name="twitter:image" content="${image}" />`,
    ].join("\n    ");
    return shell
      .replace(/<meta property="og:(title|description)"[^>]*>\s*/g, "")
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
      .replace("</head>", `    ${meta}\n  </head>`);
  };
}
