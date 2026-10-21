import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { json } from "../lib/http";
import { payAndExecute, requirementsFor, type Authorization } from "../services/x402";
import { assertInputSize } from "../services/gateway";
import { env } from "../env";

export const payRoutes = new Hono();

const Body = z.object({
  requestId: z.string().min(8).max(128),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  input: z.object({ orderId: z.string().optional(), email: z.string().optional(), question: z.string().max(4000).optional() }).catchall(z.unknown()),
  payment: z
    .object({
      /** "exact" (default): Circle facilitator, USDC transfer per call. "gateway": Circle Gateway batched, from the payer's Gateway balance. */
      scheme: z.enum(["exact", "gateway"]).default("exact"),
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
  // Refuse oversize input before the buyer is asked to sign a payment for it.
  assertInputSize(b.input);
  if (!b.payment) {
    const r = await requirementsFor(sellerSlug, productSlug, b.payer as Address, b.requestId);
    const accepts = r.gatewayAccepts ? [r.accepts, r.gatewayAccepts] : [r.accepts];
    const chainId = r.accepts.network.split(":")[1];
    const body = {
      x402Version: 2,
      accepts,
      requestId: b.requestId,
      nonce: r.nonce,
      payer: b.payer,
      signing: { domain: { name: "USDC", version: "2", chainId, verifyingContract: r.accepts.asset }, primaryType: "TransferWithAuthorization" },
      ...(r.gatewayAccepts && r.gatewayKind
        ? { gateway: { scheme: "gateway", signing: { domain: { name: r.gatewayKind.name, version: r.gatewayKind.version, chainId, verifyingContract: r.gatewayKind.verifyingContract }, primaryType: "TransferWithAuthorization" }, minValiditySeconds: r.gatewayKind.minValiditySeconds, payTo: r.gatewayAccepts.payTo, note: "Deposit USDC into the GatewayWallet once, then pay each call with no gas; send payment.scheme = \"gateway\"." } }
        : {}),
      labels: { network: env.CHAIN_ID === 5042 ? "mainnet" : "testnet" },
    };
    c.header("PAYMENT-REQUIRED", Buffer.from(JSON.stringify({ x402Version: 2, accepts })).toString("base64"));
    return json(c, body, 402);
  }
  const out = await payAndExecute(sellerSlug, productSlug, b.payer as Address, b.requestId, b.input, { scheme: b.payment.scheme, signature: b.payment.signature as Hex, authorization: b.payment.authorization as Authorization });
  return json(c, out);
});
