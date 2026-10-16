import { Hono } from "hono";
import { ServiceExecuteBody, UsageAckBody } from "@proteus/domain";
import type { Hex } from "viem";
import { reconcileOnce } from "../chain/reconciler";
import { json, toBig } from "../lib/http";
import { dealView, fundingIntent, provisionIfFunded, requestRefund } from "../services/deals";
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

dealRoutes.get("/deals/:id/usage", async (c) => json(c, await pendingAcceptance(c.req.param("id"))));

dealRoutes.post("/deals/:id/usage-acknowledgments", async (c) => {
  const body = UsageAckBody.parse(await c.req.json());
  const settlement = await acknowledgeUsage(c.req.param("id"), { buyerSignature: body.buyerSignature as Hex, cumulativeUnits: toBig(body.cumulativeUnits), cumulativeAmount: toBig(body.cumulativeAmount), receiptsRoot: body.receiptsRoot as Hex, nonce: toBig(body.nonce), expiry: toBig(body.expiry) });
  setTimeout(() => reconcileOnce().catch(() => {}), 1500);
  return json(c, { settlement, deal: await dealView(c.req.param("id")) });
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
