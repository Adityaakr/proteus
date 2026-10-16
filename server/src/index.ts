import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { agentAdapterName } from "./agent";
import { startReconciler } from "./chain/reconciler";
import { relayerKind } from "./chain/relayer";
import { sellerSignerAddress } from "./chain/client";
import { env, features } from "./env";
import { HttpError, json } from "./lib/http";
import { appRoutes } from "./routes/app";
import { dealRoutes } from "./routes/deals";
import { publicRoutes } from "./routes/public";
import { meRoutes } from "./routes/me";
import { payRoutes } from "./routes/pay";

const app = new Hono();
app.use("*", logger((s) => console.log(s)));
app.use("/api/*", cors({ origin: env.WEB_ORIGIN, credentials: true }));

app.get("/api/health", (c) =>
  json(c, {
    ok: true,
    network: "testnet",
    chainId: env.CHAIN_ID,
    escrowAddress: env.ESCROW_ADDRESS ?? null,
    usdcAddress: env.USDC_ADDRESS,
    agentAdapter: agentAdapterName(),
    relayer: relayerKind(),
    sellerSigner: sellerSignerAddress() ?? null,
    auth: { privyAppId: env.PRIVY_APP_ID, devBypass: features.privyDevBypass },
    features,
    time: new Date().toISOString(),
  }),
);

app.route("/api", publicRoutes);
app.route("/api", dealRoutes);
app.route("/api", meRoutes);
app.route("/api", payRoutes);
app.route("/api", appRoutes);

app.onError((err, c) => {
  if (err instanceof HttpError) return json(c, { error: err.message, details: err.details ?? null }, err.status);
  if (err instanceof ZodError) return json(c, { error: "invalid request", details: err.issues }, 400);
  const msg = (err as Error).message ?? String(err);
  console.error("[error]", msg);
  // viem revert reasons are useful to surface in the demo UI.
  const status = /revert|insufficient|allowance|not configured/i.test(msg) ? 409 : 500;
  return json(c, { error: msg.slice(0, 400) }, status);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`PROTEUS api on http://localhost:${info.port} | agent=${agentAdapterName()} relayer=${relayerKind()} escrow=${env.ESCROW_ADDRESS ?? "unset"}`);
  startReconciler();
});
