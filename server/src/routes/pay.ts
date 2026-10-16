import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { json } from "../lib/http";
import { payAndExecute, requirementsFor, type Authorization } from "../services/x402";

export const payRoutes = new Hono();

const Body = z.object({
  requestId: z.string().min(8).max(128),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  input: z.object({ orderId: z.string().optional(), email: z.string().optional(), question: z.string().min(1).max(2000) }),
  payment: z
    .object({
      signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
      authorization: z.object({ from: z.string(), to: z.string(), value: z.string().regex(/^\d+$/), validAfter: z.string().regex(/^\d+$/), validBefore: z.string().regex(/^\d+$/), nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
    })
    .optional(),
});

/**
 * x402-style pay per call. Without `payment`, responds 402 with the requirements (also mirrored in the
 * PAYMENT-REQUIRED header, x402 v2 style). With `payment`, verifies, executes, settles through Circle's facilitator.
 */
payRoutes.post("/pay/:sellerSlug/:productSlug/execute", async (c) => {
  const b = Body.parse(await c.req.json());
  const sellerSlug = c.req.param("sellerSlug");
  const productSlug = c.req.param("productSlug");
  if (!b.payment) {
    const r = await requirementsFor(sellerSlug, productSlug, b.payer as Address, b.requestId);
    const body = { x402Version: 2, accepts: [r.accepts], requestId: b.requestId, nonce: r.nonce, payer: b.payer, signing: { domain: { name: "USDC", version: "2", chainId: r.accepts.network.split(":")[1], verifyingContract: r.accepts.asset }, primaryType: "TransferWithAuthorization" }, labels: { network: "testnet" } };
    c.header("PAYMENT-REQUIRED", Buffer.from(JSON.stringify({ x402Version: 2, accepts: [r.accepts] })).toString("base64"));
    return json(c, body, 402);
  }
  const out = await payAndExecute(sellerSlug, productSlug, b.payer as Address, b.requestId, b.input, { signature: b.payment.signature as Hex, authorization: b.payment.authorization as Authorization });
  return json(c, out);
});
