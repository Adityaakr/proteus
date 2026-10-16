import { assertInputSize } from "./gateway";
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

/** Facilitator payment identifier: 16 to 128 chars of [A-Za-z0-9_-], stable per (payer, requestId). */
export function paymentIdentifier(payer: Address, requestId: string): string {
  return "pay_" + keccak256(encodePacked(["address", "string"], [payer, requestId])).slice(2, 42);
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

async function facilitator(orgId: string, path: "verify" | "settle" | `status/${string}`, body: Record<string, unknown> | null, payTo: Address) {
  const method = body ? "POST" : "GET";
  const json = body ? JSON.stringify(body) : "";
  const purpose = path.startsWith("status") ? "status" : (path as "verify" | "settle");
  const proof = await sellerProof(orgId, purpose, method, json, payTo);
  const headers: Record<string, string> = { "Facilitator-Seller-Proof": proof.header };
  if (body) headers["content-type"] = "application/json";
  if (env.CIRCLE_API_KEY) headers.authorization = `Bearer ${env.CIRCLE_API_KEY}`;
  const res = await fetch(`${env.X402_FACILITATOR_URL}/${path}`, { method, headers, body: body ? json : undefined });
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
  if (existing?.status === "settled" || existing?.status === "executed" || existing?.status === "pending") return { ...(existing.response as Record<string, unknown>), payment: { paymentId: existing.paymentId, settleTxHash: existing.settleTxHash, status: existing.status, replay: true, statusNote: existing.status === "pending" ? "The facilitator is still settling this payment; the transaction hash appears once it lands." : undefined } };
  // A row still quoted or verified is an attempt in flight (or one that crashed). Refuse a parallel run for two minutes rather than executing twice.
  if (existing && (existing.status === "quoted" || existing.status === "verified") && Date.now() - new Date(existing.updatedAt ?? existing.createdAt).getTime() < 120_000) throw new HttpError(409, "this request id is already being processed; retry in a moment with the same request id");
  const rowId = existing?.id ?? id("ppc");
  if (!existing) await db.insert(schema.payPerCallPayments).values({ id: rowId, orgId: lp.org.id, productId: lp.row.id, payer: payer.toLowerCase(), requestId, resource, amount: price, nonce, status: "quoted" });

  const paymentPayload = { x402Version: 2, resource: { url: resource, description: accepts.description, mimeType: accepts.mimeType }, accepted: { scheme: accepts.scheme, network: accepts.network, amount: accepts.amount, asset: accepts.asset, payTo: accepts.payTo, maxTimeoutSeconds: accepts.maxTimeoutSeconds, extra: { ...accepts.extra, assetTransferMethod: "eip3009" } }, payload: { signature: payment.signature, authorization: a }, extensions: { "payment-identifier": { info: { required: true, id: paymentIdentifier(payer, requestId) } } } };
  const paymentRequirements = { scheme: accepts.scheme, network: accepts.network, amount: accepts.amount, asset: accepts.asset, payTo: accepts.payTo, maxTimeoutSeconds: accepts.maxTimeoutSeconds, extra: accepts.extra };
  const body = { x402Version: 2, paymentPayload, paymentRequirements };

  const v = await facilitator(lp.org.id, "verify", body, accepts.payTo as Address);
  console.log("[x402 verify]", v.status, JSON.stringify(v.data).slice(0, 400));
  if (!v.ok || v.data.isValid === false || v.data.success === false) {
    await db.update(schema.payPerCallPayments).set({ status: "failed", error: JSON.stringify(v.data).slice(0, 500), updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
    throw new HttpError(402, "payment could not be verified by the facilitator", v.data);
  }
  await db.update(schema.payPerCallPayments).set({ status: "verified", updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));

  // Execute the service against a synthetic pay-per-call deal id (metering lives in the payment row, not escrow).
  assertInputSize(input);
  const out = await executePayPerCall(lp, requestId, input);
  if (!out.billable) {
    await db.update(schema.payPerCallPayments).set({ status: "failed", error: "not billable: " + out.status, response: out as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
    return { requestId, ...out, payment: { status: "not_charged", reason: out.status } };
  }
  const s = await facilitator(lp.org.id, "settle", body, accepts.payTo as Address);
  console.log("[x402 settle]", s.status, JSON.stringify(s.data).slice(0, 400));
  // Circle facilitator (exact scheme): { success: true, transaction: "0x…" } or
  // { success: false, errorReason: "settlement_pending", transaction: "", extensions: { "settlement-status": { status, paymentId, statusUrl } } }.
  const tx = String(s.data.transaction ?? "");
  const ext = (s.data.extensions as { "settlement-status"?: { status?: string; paymentId?: string } } | undefined)?.["settlement-status"];
  const paymentId = ext?.paymentId ?? (s.data.paymentId as string | undefined) ?? null;
  const pending = s.ok && s.data.success !== true && (s.data.errorReason === "settlement_pending" || ext?.status === "pending");
  const settleOk = s.ok && s.data.success === true && Boolean(tx);
  const status = settleOk ? "settled" : pending ? "pending" : "failed";
  const response = { requestId, ...out };
  await db.update(schema.payPerCallPayments).set({ status, paymentId, settleTxHash: tx || null, response, error: status === "failed" ? JSON.stringify(s.data).slice(0, 500) : null, updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, rowId));
  if (status === "failed") throw new HttpError(502, `service delivered but the facilitator did not settle (${String(s.data.errorReason ?? s.status)}); the authorization expires unused and nothing was charged`, s.data);
  return { ...response, payment: { paymentId, settleTxHash: tx || null, status, facilitator: env.X402_FACILITATOR_URL, network: env.X402_NETWORK, statusNote: pending ? "The facilitator accepted the payment and is settling it on Arc; the transaction hash appears once it lands." : undefined } };
}

/** Poll the facilitator for pending pay-per-call settlements and record the transaction once it lands. */
export async function checkPendingPayments(): Promise<number> {
  const rows = await db.select().from(schema.payPerCallPayments).where(eq(schema.payPerCallPayments.status, "pending"));
  let n = 0;
  for (const r of rows) {
    if (!r.paymentId) continue;
    try {
      const collector = (await orgSignerAccount(r.orgId)).address;
      const st = await facilitator(r.orgId, `status/${r.paymentId}`, null, collector);
      const status = String(st.data.status ?? "");
      const tx = String(st.data.transaction ?? "");
      if (status === "completed" && tx) {
        await db.update(schema.payPerCallPayments).set({ status: "settled", settleTxHash: tx, updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, r.id));
        n++;
      } else if (status === "failed") {
        await db.update(schema.payPerCallPayments).set({ status: "failed", error: String(st.data.reason ?? "facilitator reported failure"), updatedAt: new Date() }).where(eq(schema.payPerCallPayments.id, r.id));
        n++;
      }
    } catch (e) {
      console.warn("[x402 status]", r.id, String((e as Error).message).slice(0, 160));
    }
  }
  return n;
}

/** Runs the product adapter without a deal (no escrow metering). */
async function executePayPerCall(lp: Parameters<typeof import("./gateway").runAdapter>[0], requestId: string, input: ServiceInput): Promise<ServiceOutput & { answer: string }> {
  const { runAdapter } = await import("./gateway");
  return runAdapter(lp, { requestId }, input);
}

export { execute };
