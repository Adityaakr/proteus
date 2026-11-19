/**
 * Seller-confirmed delivery, for physical goods and work done outside an API (custom merch, a batch of labelled data,
 * a design). The seller records N delivered units with proof; this becomes a receipt exactly like a metered API call
 * (service_requests row, evidence digest signed by the seller's signer), so the buyer countersigns cumulative usage and
 * the escrow settles through the unchanged settleAcceptedUsage path.
 *
 * Trust, stated plainly: delivery here is confirmed by the seller, not verified by Proteus. Nothing is paid until the
 * buyer countersigns the cumulative total; a buyer who disagrees does not sign and can open a dispute instead.
 */
import { and, desc, eq } from "drizzle-orm";
import { keccak256, toHex, type Hex } from "viem";
import { orgSignerAccount } from "../chain/signer";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { id, sha256 } from "../lib/ids";
import { loadDeal, reviveTerms } from "./deals";
import { receiptView } from "./gateway";
import { checkDealOpen, checkDeliveryInput, planDelivery, type DeliveryInput } from "./seller-api-rules";

export type { DeliveryInput } from "./seller-api-rules";

export async function confirmDelivery(orgId: string, dealId: string, input: DeliveryInput, confirmedBy: string) {
  const note = checkDeliveryInput(input);

  const deal = await loadDeal(dealId);
  if (deal.orgId !== orgId) throw new HttpError(404, "deal not found");
  checkDealOpen(deal.status, "deliveries can be recorded");
  const terms = reviveTerms(deal.terms as Record<string, unknown>);

  const [existing] = await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.requestId, input.requestId)));
  if (existing) return receiptView(existing, terms.prepaid);

  const output = {
    status: "delivered" as const,
    billable: true,
    answer: note,
    source: { store: "seller-confirmed", fields: input.proofUrl ? ["proofUrl"] : [], proofUrl: input.proofUrl ?? null, confirmedBy },
  };

  const row = await db.transaction(async (tx) => {
    await tx.execute(`SELECT id FROM deals WHERE id = '${dealId.replace(/'/g, "")}' FOR UPDATE`);
    const [last] = await tx.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.billable, true))).orderBy(desc(schema.serviceRequests.cumulativeUnits)).limit(1);
    const prevUnits = last?.cumulativeUnits ?? 0n;
    const { cumulativeUnits, cumulativeCharged } = planDelivery(prevUnits, BigInt(input.units), terms);
    // The proof link and who confirmed it are inside the signed evidence, so they cannot be swapped later.
    const evidence = {
      dealId: deal.dealIdOnchain.toString(),
      requestId: input.requestId,
      status: "delivered",
      units: input.units,
      cumulativeUnits: cumulativeUnits.toString(),
      outputHash: sha256(JSON.stringify(output)),
      kind: "seller-confirmed",
      proofUrl: input.proofUrl ?? null,
      confirmedBy,
      at: new Date().toISOString(),
    };
    const evidenceDigest = keccak256(toHex(JSON.stringify(evidence)));
    const sellerSignature = await (await orgSignerAccount(deal.orgId)).signMessage({ message: { raw: evidenceDigest as Hex } });
    const [inserted] = await tx
      .insert(schema.serviceRequests)
      .values({ id: id("sr"), orgId: deal.orgId, dealId, requestId: input.requestId, status: "delivered", billable: true, units: input.units, cumulativeUnits, cumulativeCharged, input: { kind: "seller-confirmed", units: input.units }, output, evidenceDigest, sellerSignature, latencyMs: 0 })
      .onConflictDoNothing({ target: [schema.serviceRequests.dealId, schema.serviceRequests.requestId] })
      .returning();
    return inserted ?? null;
  });
  const stored = row ?? (await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.dealId, dealId), eq(schema.serviceRequests.requestId, input.requestId))))[0];
  if (!stored) throw new HttpError(500, "delivery was not recorded");
  return receiptView(stored, terms.prepaid);
}
