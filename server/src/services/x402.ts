import { and, eq } from "drizzle-orm";
import { encodePacked, keccak256, toHex, verifyTypedData, type Address, type Hex } from "viem";
import { orgSignerAccount } from "../chain/signer";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { loadProductBySlugs } from "./catalog";
import { execute, type ServiceInput, type ServiceOutput } from "./gateway";

/**
 * x402 pay-per-call on Arc testnet through Circle's facilitator (exact scheme, x402Version 2).
 * Source: https://developers.circle.com/facilitator-service/quickstart.md (read 2026-10-16).
 *  - The buyer signs an EIP-3009 TransferWithAuthorization on USDC (domain name "USDC", version "2").
 *  - The seller proves it controls `payTo` with an EIP-712 SellerRequest over the request body.
 *  - Nonce is derived from (payer, requestId, resource, amount) so a retry reuses the same authorization
 *    and the token contract rejects a second transfer. Our (payer, requestId) row makes retries idempotent.
 */

export const USDC_DOMAIN = { name: "USDC", version: "2", chainId: env.CHAIN_ID, verifyingContract: env.USDC_ADDRESS as Address } as const;
export const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const SELLER_REQUEST_TYPES = {
  SellerRequest: [
    { name: "purpose", type: "string" },
    { name: "method", type: "string" },
    { name: "bodyHash", type: "bytes32" },
    { name: "network", type: "string" },
    { name: "payTo", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export interface Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export function paymentNonce(payer: Address, requestId: string, resource: string, amount: bigint): Hex {
  return keccak256(encodePacked(["address", "string", "string", "uint256"], [payer, requestId, resource, amount]));
}

export async function requirementsFor(sellerSlug: string, productSlug: string, payer: Address, requestId: string) {
  const lp = await loadProductBySlugs(sellerSlug, productSlug);
  const price = lp.row.payPerCallPrice;
  if (!price) throw new HttpError(404, "this product is not sold per call");
  const resource = `${env.WEB_ORIGIN}/api/pay/${sellerSlug}/${productSlug}/execute`;
  // Circle's facilitator requires the seller proof to be signed by the payTo key, so per-call receipts land in
  // the org's server-held collection signer; the owner sweeps them to the payee from settings.
  const collector = (await orgSignerAccount(lp.org.id)).address;
  const nonce = paymentNonce(payer, requestId, resource, price);
  const accepts = {
    scheme: "exact",
    network: env.X402_NETWORK,
    amount: price.toString(),
    asset: env.USDC_ADDRESS,
    payTo: collector,
    maxTimeoutSeconds: 120,
    resource,
    description: `${lp.product.name}: one ${lp.product.unitLabel}`,
    mimeType: "application/json",
    extra: { name: "USDC", version: "2" },
  };
  return { lp, price, resource, nonce, accepts };
}

async function sellerProof(orgId: string, purpose: "verify" | "settle" | "status", method: string, body: string, payTo: Address) {
  const account = await orgSignerAccount(orgId);
  // The proof must be signed by the payTo key. For sellers whose payee is their own wallet (not the server signer)
  // the facilitator requires the payee's signature; the seller signer is the payee for the sandbox seller only.
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const expiresAt = issuedAt + 300n;
  const signature = await account.signTypedData({
    domain: { name: "Circle Facilitator Seller Request", version: "1", chainId: env.CHAIN_ID },
    types: SELLER_REQUEST_TYPES,
    primaryType: "SellerRequest",
    message: { purpose, method: method.toUpperCase(), bodyHash: keccak256(toHex(body)), network: env.X402_NETWORK, payTo, nonce, issuedAt, expiresAt },
  });
  const envelope = { version: 1, signature, network: env.X402_NETWORK, payTo, nonce, issuedAt: Number(issuedAt), expiresAt: Number(expiresAt) };
  return { header: Buffer.from(JSON.stringify(envelope)).toString("base64url"), signer: account.address };
}

async function facilitator(orgId: string, path: "verify" | "settle", body: Record<string, unknown>, payTo: Address) {
  const json = JSON.stringify(body);
  const proof = await sellerProof(orgId, path, "POST", json, payTo);
  const headers: Record<string, string> = { "content-type": "application/json", "Facilitator-Seller-Proof": proof.header };
  if (env.CIRCLE_API_KEY) headers.authorization = `Bearer ${env.CIRCLE_API_KEY}`;
  const res = await fetch(`${env.X402_FACILITATOR_URL}/${path}`, { method: "POST", headers, body: json });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, signer: proof.signer };
}

export async function payAndExecute(sellerSlug: string, productSlug: string, payer: Address, requestId: string, input: ServiceInput, payment: { signature: Hex; authorization: Authorization }) {
  const { lp, price, resource, nonce, accepts } = await requirementsFor(sellerSlug, productSlug, payer, requestId);
  const a = payment.authorization;
  if (a.from.toLowerCase() !== payer.toLowerCase() || a.to.toLowerCase() !== accepts.payTo.toLowerCase() || BigInt(a.value) !== price || a.nonce.toLowerCase() !== nonce.toLowerCase()) {
    throw new HttpError(400, "authorization does not match the payment requirements", { expected: { from: payer, to: accepts.payTo, value: price.toString(), nonce } });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(a.validBefore) < now + 10 || Number(a.validBefore) > now + 600) throw new HttpError(400, "validBefore must be within the next 10 minutes");
  const ok = await verifyTypedData({ address: payer, domain: USDC_DOMAIN, types: TRANSFER_WITH_AUTH_TYPES, primaryType: "TransferWithAuthorization", message: { from: a.from, to: a.to, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce }, signature: payment.signature });
  if (!ok) throw new HttpError(400, "payment signature invalid");

  // Idempotency: one row per (payer, requestId).
  const [existing] = await db.select().from(schema.payPerCallPayments).where(and(eq(schema.payPerCallPayments.payer, payer.toLowerCase()), eq(schema.payPerCallPayments.requestId, requestId)));
  if (existing?.status === "settled" || existing?.status === "executed") return { ...(existing.response as Record<string, unknown>), payment: { paymentId: existing.paymentId, settleTxHash: existing.settleTxHash, status: existing.status, replay: true } };
  const rowId = existing?.id ?? id("ppc");
  if (!existing) await db.insert(schema.payPerCallPayments).values({ id: rowId, orgId: lp.org.id, productId: lp.row.id, payer: payer.toLowerCase(), requestId, resource, amount: price, nonce, status: "quoted" });

  const paymentPayload = { x402Version: 2, resource: { url: resource, description: accepts.description, mimeType: accepts.mimeType }, accepted: { scheme: accepts.scheme, network: accepts.network, amount: accepts.amount, asset: accepts.asset, payTo: accepts.payTo, maxTimeoutSeconds: accepts.maxTimeoutSeconds, extra: { ...accepts.extra, assetTransferMethod: "eip3009" } }, payload: { signature: payment.signature, authorization: a }, extensions: { "payment-identifier": { info: { required: true, id: `${payer.toLowerCase()}:${requestId}` } } } };
  const paymentRequirements = { scheme: accepts.scheme, network: accepts.network, amount: accepts.amount, asset: accepts.asset, payTo: accepts.payTo, maxTimeoutSeconds: accepts.maxTimeoutSeconds, extra: accepts.extra };
  const body = { x402Version: 2, paymentPayload, paymentRequirements };

  const v = await facilitator(lp.org.id, "verify", body, accepts.payTo as Address);
  if (!v.ok || v.data.isValid === false) {
    await db.update(schema.payPerCallPayments).set({ status: "failed", error: JSON.stringify(v.data).slice(0, 500), updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
    throw new HttpError(402, "payment could not be verified by the facilitator", v.data);
  }
  await db.update(schema.payPerCallPayments).set({ status: "verified", updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));

  // Execute the service against a synthetic pay-per-call deal id (metering lives in the payment row, not escrow).
  const out = await executePayPerCall(lp.org.id, input);
  if (!out.billable) {
    await db.update(schema.payPerCallPayments).set({ status: "failed", error: "not billable: " + out.status, response: out as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
    return { requestId, ...out, payment: { status: "not_charged", reason: out.status } };
  }
  const s = await facilitator(lp.org.id, "settle", body, accepts.payTo as Address);
  const txHash = (s.data.transaction as string | undefined) ?? (s.data.txHash as string | undefined) ?? null;
  const paymentId = (s.data.paymentId as string | undefined) ?? null;
  const status = s.ok && (s.data.success === true || s.data.status === "settled" || txHash) ? "settled" : s.ok ? "executed" : "failed";
  const response = { requestId, ...out };
  await db.update(schema.payPerCallPayments).set({ status, paymentId, settleTxHash: txHash, response, error: s.ok ? null : JSON.stringify(s.data).slice(0, 500), updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
  if (!s.ok) throw new HttpError(502, "service delivered but settlement failed; the authorization will expire unused", s.data);
  return { ...response, payment: { paymentId, settleTxHash: txHash, status, facilitator: env.X402_FACILITATOR_URL, network: env.X402_NETWORK } };
}

/** Runs the product adapter without a deal (no escrow metering). */
async function executePayPerCall(orgId: string, input: ServiceInput): Promise<ServiceOutput & { answer: string }> {
  const { orderSupport } = await import("./gateway");
  return orderSupport(orgId, input);
}

export { execute };
