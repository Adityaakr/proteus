import { and, desc, eq } from "drizzle-orm";
import { verifyTypedData, type Address, type Hex } from "viem";
import { ACCEPTANCE_TYPES, DELIVERY_TYPES, domain, receiptsRoot, type Acceptance, type Delivery } from "@proteus/domain";
import { escrowAddress, sellerSigner } from "../chain/client";
import { getRelayer } from "../chain/relayer";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError, bigintsToStrings } from "../lib/http";
import { id } from "../lib/ids";
import { loadDeal, reviveTerms } from "./deals";
import { receiptView } from "./gateway";

/** What the buyer is asked to sign: the server-computed cumulative accepted usage. */
export async function pendingAcceptance(dealId: string) {
  const deal = await loadDeal(dealId);
  const terms = reviveTerms(deal.terms as Record<string, unknown>);
  const reqs = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.dealId, dealId)).orderBy(desc(schema.serviceRequests.createdAt));
  const billable = reqs.filter((r) => r.billable);
  const cumulativeUnits = billable.reduce((m, r) => (r.cumulativeUnits > m ? r.cumulativeUnits : m), 0n);
  const cumulativeAmount = billable.reduce((m, r) => (r.cumulativeCharged > m ? r.cumulativeCharged : m), 0n);
  const root = receiptsRoot(billable.map((r) => r.evidenceDigest as Hex));
  const pending = cumulativeUnits > deal.acceptedUnits && env.ESCROW_ADDRESS;
  const acceptance: Acceptance | undefined = pending
    ? { dealId: deal.dealIdOnchain, termsHash: deal.termsHash as Hex, cumulativeAmount, cumulativeUnits, receiptsRoot: root, nonce: deal.acceptedNonce + 1n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600) }
    : undefined;
  const acks = await db.select().from(schema.usageAcceptances).where(eq(schema.usageAcceptances.dealId, dealId)).orderBy(desc(schema.usageAcceptances.nonce));
  return {
    receipts: reqs.map((r) => receiptView(r, terms.prepaid)),
    cumulativeUnits,
    cumulativeCharged: cumulativeAmount,
    acceptedUnits: deal.acceptedUnits,
    acceptedAmount: deal.acceptedAmount,
    settledOnchain: deal.settled,
    pendingAcceptance: acceptance
      ? bigintsToStrings({ acceptance, typedData: { domain: domain(env.CHAIN_ID, escrowAddress()), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: acceptance }, incrementalAmount: cumulativeAmount - deal.acceptedAmount })
      : null,
    acknowledgments: acks.map((a) => ({ id: a.id, nonce: a.nonce, cumulativeUnits: a.cumulativeUnits, cumulativeAmount: a.cumulativeAmount, settlementTxHash: a.settlementTxHash, status: a.status, createdAt: a.createdAt })),
  };
}

/**
 * Buyer-signed acceptance: the server recomputes the acceptance from its own receipts, requires the
 * buyer's payload to match exactly, verifies the signature, countersigns Delivery with the seller signer,
 * and relays settleAcceptedUsage. The contract then pays only the increment.
 */
export async function acknowledgeUsage(dealId: string, body: { buyerSignature: Hex; cumulativeUnits: bigint; cumulativeAmount: bigint; receiptsRoot: Hex; nonce: bigint; expiry: bigint }) {
  const deal = await loadDeal(dealId);
  const p = await pendingAcceptance(dealId);
  if (!p.pendingAcceptance) throw new HttpError(409, "nothing to accept");
  const expected = p.pendingAcceptance.acceptance as unknown as Record<string, string>;
  if (body.cumulativeUnits.toString() !== expected.cumulativeUnits || body.cumulativeAmount.toString() !== expected.cumulativeAmount || body.receiptsRoot.toLowerCase() !== String(expected.receiptsRoot).toLowerCase() || body.nonce.toString() !== expected.nonce) {
    throw new HttpError(400, "acceptance payload does not match the server's receipts", { expected });
  }
  const escrow = escrowAddress();
  const acceptance: Acceptance = { dealId: deal.dealIdOnchain, termsHash: deal.termsHash as Hex, cumulativeAmount: body.cumulativeAmount, cumulativeUnits: body.cumulativeUnits, receiptsRoot: body.receiptsRoot, nonce: body.nonce, expiry: body.expiry };
  const ok = await verifyTypedData({ address: deal.buyerAddress as Address, domain: domain(env.CHAIN_ID, escrow), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: acceptance, signature: body.buyerSignature });
  if (!ok) throw new HttpError(400, "buyer signature invalid");

  const delivery: Delivery = { dealId: deal.dealIdOnchain, receiptsRoot: body.receiptsRoot, cumulativeUnits: body.cumulativeUnits };
  const sellerDeliverySignature = await sellerSigner().signTypedData({ domain: domain(env.CHAIN_ID, escrow), types: DELIVERY_TYPES, primaryType: "Delivery", message: delivery });

  const relayer = getRelayer();
  const { txHash } = await relayer.submit("settleAcceptedUsage", [deal.dealIdOnchain, acceptance, body.buyerSignature, delivery, sellerDeliverySignature]);

  const ackId = id("ack");
  await db.transaction(async (tx) => {
    await tx.insert(schema.usageAcceptances).values({ id: ackId, orgId: deal.orgId, dealId, nonce: body.nonce, cumulativeUnits: body.cumulativeUnits, cumulativeAmount: body.cumulativeAmount, receiptsRoot: body.receiptsRoot, expiry: body.expiry, buyerSignature: body.buyerSignature, sellerDeliverySignature, settlementTxHash: txHash, status: "submitted" });
    await tx.insert(schema.chainTxs).values({ id: id("tx"), orgId: deal.orgId, dealId, kind: "settle", txHash, submittedVia: relayer.kind }).onConflictDoNothing();
    await tx.update(schema.deals).set({ acceptedUnits: body.cumulativeUnits, acceptedAmount: body.cumulativeAmount, acceptedNonce: body.nonce, updatedAt: new Date() }).where(and(eq(schema.deals.id, dealId), eq(schema.deals.acceptedNonce, deal.acceptedNonce)));
  });
  return { id: ackId, txHash, status: "submitted" as const, via: relayer.kind };
}
