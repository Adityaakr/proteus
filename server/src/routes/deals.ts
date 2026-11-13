import { Hono } from "hono";
import { ServiceExecuteBody, UsageAckBody } from "@proteus/domain";
import type { Hex } from "viem";
import { reconcileOnce } from "../chain/reconciler";
import { HttpError, json, toBig } from "../lib/http";
import { env } from "../env";
import { confirmRating, ratingInputs } from "../services/ratings";
import { disputeView, recordDispute } from "../services/disputes";
import { fundGasless, permitRequest } from "../services/gasless";
import { dealView, fundingIntent, provisionIfFunded, requestRefund, rotateServiceKey } from "../services/deals";
import { authenticateDeal, execute } from "../services/gateway";
import { acknowledgeUsage, pendingAcceptance } from "../services/usage";
import { completeGoogle, connectionsView, disconnectGoogle, getProfile, googleAuthUrl, isScheduling, setProfile } from "../services/calendar";

export const dealRoutes = new Hono();

dealRoutes.get("/deals/:id", async (c) => {
  // Provision lazily once the reconciler has confirmed funding; the key is returned exactly once.
  const key = await provisionIfFunded(c.req.param("id"));
  return json(c, await dealView(c.req.param("id"), { apiKeyOnce: key }));
});

dealRoutes.post("/deals/:id/funding-intent", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { txHash?: string };
  const view = await fundingIntent(c.req.param("id"), body.txHash as Hex | undefined);
  // Kick the reconciler so the UI sees confirmation quickly (Arc finalizes on inclusion).
  setTimeout(() => reconcileOnce().catch(() => {}), 1500);
  return json(c, view);
});

/* Gasless funding: the buyer signs a USDC permit (no transaction); the relayer submits permit + createAndFundDeal at once. */
dealRoutes.get("/deals/:id/permit", async (c) => json(c, await permitRequest(c.req.param("id"))));
dealRoutes.post("/deals/:id/fund-gasless", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { deadline?: string; signature?: string };
  if (!b.deadline || !/^\d{1,12}$/.test(b.deadline) || !b.signature || !/^0x[0-9a-fA-F]{130,4000}$/.test(b.signature)) throw new HttpError(400, "deadline (unix seconds) and signature (hex) are required");
  const view = await fundGasless(c.req.param("id"), { deadline: b.deadline, signature: b.signature as Hex });
  setTimeout(() => reconcileOnce().catch(() => {}), 1500);
  return json(c, view);
});

dealRoutes.get("/deals/:id/usage", async (c) => json(c, await pendingAcceptance(c.req.param("id"))));

dealRoutes.post("/deals/:id/usage-acknowledgments", async (c) => {
  const body = UsageAckBody.parse(await c.req.json());
  const settlement = await acknowledgeUsage(c.req.param("id"), { buyerSignature: body.buyerSignature as Hex, cumulativeUnits: toBig(body.cumulativeUnits), cumulativeAmount: toBig(body.cumulativeAmount), receiptsRoot: body.receiptsRoot as Hex, nonce: toBig(body.nonce), expiry: toBig(body.expiry) });
  setTimeout(() => reconcileOnce().catch(() => {}), 1500);
  return json(c, { settlement, deal: await dealView(c.req.param("id")) });
});

/* Disputes: a party opens one on the escrow from its own wallet; the server verifies the event and keeps the reason. */
dealRoutes.get("/deals/:id/dispute", async (c) => json(c, await disputeView(c.req.param("id"))));
dealRoutes.post("/deals/:id/dispute", async (c) => {
  const { txHash, reason } = (await c.req.json()) as { txHash?: string; reason?: string };
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(400, "txHash: the openDispute transaction hash");
  return json(c, await recordDispute(c.req.param("id"), txHash as Hex, String(reason ?? "")));
});

/* Ratings: the buyer's wallet posts giveFeedback on Arc's ERC-8004 ReputationRegistry; the server verifies it on chain. */
dealRoutes.get("/deals/:id/rating", async (c) => json(c, await ratingInputs(c.req.param("id"), env.WEB_ORIGIN || new URL(c.req.url).origin)));
dealRoutes.post("/deals/:id/rating", async (c) => {
  const { txHash } = (await c.req.json()) as { txHash?: string };
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(400, "txHash: the giveFeedback transaction hash");
  return json(c, await confirmRating(c.req.param("id"), txHash as Hex));
});

dealRoutes.post("/deals/:id/service/rotate-key", async (c) => {
  const b = (await c.req.json()) as { address: string; ts: number; signature: string };
  const key = await rotateServiceKey(c.req.param("id"), b.address as Hex, Number(b.ts), b.signature as Hex);
  return json(c, await dealView(c.req.param("id"), { apiKeyOnce: key }));
});

dealRoutes.post("/deals/:id/refund-request", async (c) => {
  const r = await requestRefund(c.req.param("id"));
  setTimeout(() => reconcileOnce().catch(() => {}), 1500);
  return json(c, r);
});

/** Metered service endpoint. */
dealRoutes.post("/services/:productSlug/execute", async (c) => {
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const { deal } = await authenticateDeal(bearer, c.req.param("productSlug"));
  const body = ServiceExecuteBody.parse(await c.req.json());
  return json(c, await execute(deal.id, body.requestId, body.input));
});

/* ---------------------------------------------------------------- scheduling services: profile and calendar */

/** The deal's service key authorises setup, the same key that calls the service. Only scheduling products have it. */
async function schedulingDeal(c: { req: { header(n: string): string | undefined; param(n: string): string } }) {
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const { deal, lp } = await authenticateDeal(bearer, c.req.param("productSlug"));
  if (!isScheduling(lp)) throw new HttpError(404, "This service has no calendar or business profile settings.");
  return deal;
}

dealRoutes.get("/services/:productSlug/connections", async (c) => {
  const deal = await schedulingDeal(c);
  return json(c, { ...(await connectionsView(deal.id)), profile: await getProfile(deal.id, deal.orgId) });
});

dealRoutes.put("/services/:productSlug/profile", async (c) => {
  const deal = await schedulingDeal(c);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return json(c, { profile: await setProfile(deal.id, deal.orgId, body) });
});

/** Starts Google OAuth for this deal; the browser follows the returned URL. */
dealRoutes.post("/services/:productSlug/connections/google", async (c) => {
  const deal = await schedulingDeal(c);
  return json(c, { url: googleAuthUrl(deal.id) });
});

dealRoutes.delete("/services/:productSlug/connections/google", async (c) => {
  const deal = await schedulingDeal(c);
  await disconnectGoogle(deal.id, deal.orgId);
  return json(c, await connectionsView(deal.id));
});

/** Google sends the buyer back here; we store the tokens and return the buyer to the deal page. */
dealRoutes.get("/integrations/google/callback", async (c) => {
  const origin = env.WEB_ORIGIN.replace(/\/$/, "");
  const state = c.req.query("state") ?? "";
  const dealGuess = state.split(".")[0] ?? "";
  const back = (dealId: string, q: string) => c.redirect(`${origin}/app/deals/${encodeURIComponent(dealId)}?${q}`);
  if (c.req.query("error")) return back(dealGuess, "calendar=denied");
  try {
    const dealId = await completeGoogle(c.req.query("code") ?? "", state);
    return back(dealId, "calendar=connected");
  } catch (e) {
    console.error(`[calendar] connect failed: ${String((e as Error).message).slice(0, 160)}`);
    return back(dealGuess, "calendar=failed");
  }
});
