import { Hono } from "hono";
import { explorerBase } from "@proteus/domain";
import { agentAdapterName } from "../agent";
import { relayerKind } from "../chain/relayer";
import { sellerSignerAddress } from "../chain/client";
import { env, features } from "../env";
import { json } from "../lib/http";
import { appRoutes } from "./app";
import { builderRoutes } from "./builder";
import { dealRoutes } from "./deals";
import { publicRoutes } from "./public";
import { meRoutes } from "./me";
import { payRoutes } from "./pay";
import { rpcRoutes } from "./rpc";
import { channelRoutes } from "./channels";
import { inviteRoutes } from "./invites";
import { circleAuthRoutes } from "./circle-auth";
import { consoleRoutes } from "./console";
import { developerRoutes, sellerApiRoutes } from "./developers";
import { sandboxEnabled, sandboxRoutes } from "./sandbox";

/** Every /api route, mounted under /api by index.ts. */
export function apiRoutes() {
  const api = new Hono();
  api.get("/health", (c) =>
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
  api.route("/", inviteRoutes);
  api.route("/", circleAuthRoutes);
  api.route("/", publicRoutes);
  api.route("/", dealRoutes);
  api.route("/", meRoutes);
  api.route("/", builderRoutes);
  api.route("/", payRoutes);
  api.route("/", appRoutes);
  api.route("/", consoleRoutes);
  api.route("/", developerRoutes());
  api.route("/", sellerApiRoutes());
  // The sandbox serves fixed demo data only, and only on the testnet deployment.
  if (sandboxEnabled(features.network)) api.route("/", sandboxRoutes());
  api.route("/", rpcRoutes);
  api.route("/", channelRoutes);
  return api;
}
