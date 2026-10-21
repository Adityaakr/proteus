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
