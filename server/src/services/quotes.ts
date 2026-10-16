import { and, eq } from "drizzle-orm";
import { verifyTypedData, type Address, type Hex } from "viem";
import { TERMS_TYPES, domain, hashTerms, productIdHash, publicTermsHash, type Terms } from "@proteus/domain";
import { escrowAddress, sellerSigner, usdcAddress } from "../chain/client";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError, bigintsToStrings } from "../lib/http";
import { id, publicId, randomDealId } from "../lib/ids";
import { loadProductById } from "./catalog";
import { loadNegotiation, reviveCandidate, toOffer } from "./negotiation";

/**
 * A quote freezes one candidate (with its cost/policy versions) and the buyer-visible terms.
 * The EIP-712 Terms message needs the buyer address, so it is materialized per buyer at read/accept time
 * from the same frozen fields; the server re-derives the hash at accept and refuses mismatches.
 */

export function buildPublicTerms(lp: Awaited<ReturnType<typeof loadProductById>>, c: ReturnType<typeof reviveCandidate>) {
  return {
    product: lp.product.name,
    tier: c.tierName,
    units: c.units.toString(),
    unitLabel: lp.product.unitLabel,
    billableUnit: lp.product.billableUnit,
    unitPrice: { num: c.unitPrice.num.toString(), den: c.unitPrice.den.toString() },
    prepaidTotal: c.prepaidTotal.toString(),
    includes: c.includes,
    integrations: c.supportedIntegrations,
    excludedIntegrations: c.unsupportedIntegrations,
    overage: c.overagePrice ? { num: c.overagePrice.num.toString(), den: c.overagePrice.den.toString() } : null,
    termDays: lp.product.termDays,
    graceSeconds: env.DEAL_GRACE_SECONDS,
    refundPolicy: lp.product.refundPolicy,
    network: "arc-testnet",
    labels: ["testnet", lp.org.label],
  };
}

export async function createQuote(negId: string, candidateId: string) {
  const { neg, lp } = await loadNegotiation(negId);
  const candidates = (neg.candidates as Record<string, unknown>[]).map(reviveCandidate);
  const c = candidates.find((x) => x.candidateId === candidateId);
  if (!c) throw new HttpError(404, "candidate not found");
  if (c.status === "rejected") throw new HttpError(409, "candidate was rejected by policy", { reasons: c.rules });
  // Reuse an open quote for the same candidate if present.
  const [existing] = await db.select().from(schema.quotes).where(and(eq(schema.quotes.negotiationId, negId), eq(schema.quotes.candidateId, candidateId)));
  if (existing && ["draft", "approval_required", "approved"].includes(existing.status) && existing.expiresAt.getTime() > Date.now()) return quoteView(existing.id);

  const quoteId = id("q");
  const dealIdOnchain = randomDealId();
  const expiresAt = new Date(Date.now() + lp.policy.quoteTtlSeconds * 1000);
  const publicTerms = buildPublicTerms(lp, c);
  // Terms hash placeholder until buyer address is known; stored for traceability of the frozen offer.
  await db.insert(schema.quotes).values({
    id: quoteId,
    orgId: lp.org.id,
    negotiationId: negId,
    productId: lp.row.id,
    candidateId,
    candidate: bigintsToStrings(c),
    publicTerms,
    terms: {},
    termsHash: "",
    dealIdOnchain,
    status: c.status === "approval_required" ? "approval_required" : "draft",
    costVersion: lp.cost.version,
    policyVersion: lp.policy.version,
    expiresAt,
  });
  if (c.status === "approval_required") {
    await db.insert(schema.approvals).values({
      id: id("apr"),
      orgId: lp.org.id,
      quoteId,
      reason: `Prepaid total above the approval threshold (${c.rules.join(", ")})`,
      ruleIds: c.rules,
      expiresAt,
    });
    await db.insert(schema.decisions).values({ id: id("dec"), orgId: lp.org.id, negotiationId: negId, kind: "approval", ruleIds: c.rules, candidateId, summary: "Quote requires owner approval", privateBasis: bigintsToStrings({ candidate: c }), publicExplanation: "An agreement of this size needs the seller's approval before it can be offered." });
  } else {
    await db.insert(schema.decisions).values({ id: id("dec"), orgId: lp.org.id, negotiationId: negId, kind: "quote", ruleIds: [], candidateId, summary: `Quote issued for ${c.tierName} ${c.units} units`, privateBasis: bigintsToStrings({ candidate: c, expiresAt }), publicExplanation: "Offer issued within policy." });
  }
  return quoteView(quoteId);
}

export function termsFor(q: typeof schema.quotes.$inferSelect, lp: Awaited<ReturnType<typeof loadProductById>>, buyer: Address): Terms {
  const c = reviveCandidate(q.candidate as Record<string, unknown>);
  const start = BigInt(Math.floor(q.createdAt.getTime() / 1000));
  const end = start + BigInt(lp.product.termDays * 86400);
  return {
    dealId: q.dealIdOnchain,
    buyer,
    seller: lp.org.sellerSignerAddress as Address,
    payee: lp.org.payeeAddress as Address,
    usdc: usdcAddress,
    productId: productIdHash(lp.product.slug),
    unitNum: c.unitPrice.num,
    unitDen: c.unitPrice.den,
    maxUnits: c.units,
    prepaid: c.prepaidTotal,
    start,
    end,
    grace: BigInt(env.DEAL_GRACE_SECONDS),
    publicTermsHash: publicTermsHash(q.publicTerms as Record<string, unknown>),
    nonce: q.dealIdOnchain,
    expiry: BigInt(Math.floor(q.expiresAt.getTime() / 1000)),
  };
}

export async function quoteView(quoteId: string, buyer?: Address) {
  const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId));
  if (!q) throw new HttpError(404, "quote not found");
  const lp = await loadProductById(q.productId);
  const c = reviveCandidate(q.candidate as Record<string, unknown>);
  const [approval] = await db.select().from(schema.approvals).where(eq(schema.approvals.quoteId, quoteId));
  const expired = q.expiresAt.getTime() < Date.now() && !["accepted"].includes(q.status);
  const escrow = env.ESCROW_ADDRESS as Address | undefined;
  const terms = buyer && escrow ? termsFor(q, lp, buyer) : undefined;
  return {
    id: q.id,
    negotiationId: q.negotiationId,
    status: expired ? "expired" : q.status,
    offer: toOffer(c),
    expiresAt: q.expiresAt,
    chainId: env.CHAIN_ID,
    escrowAddress: escrow ?? null,
    usdcAddress,
    sellerSigner: lp.org.sellerSignerAddress,
    payee: lp.org.payeeAddress,
    terms: terms ? bigintsToStrings(terms) : null,
    typedData: terms && escrow ? bigintsToStrings({ domain: domain(env.CHAIN_ID, escrow), types: TERMS_TYPES, primaryType: "Terms", message: terms }) : null,
    publicTerms: q.publicTerms,
    approval: approval ? { id: approval.id, status: approval.status, reason: approval.reason, decidedAt: approval.decidedAt, decisionReason: approval.decisionReason } : undefined,
    labels: { seller: lp.org.label, network: "testnet" },
  };
}

/** Buyer accepts: verify buyer signature over the exact server-derived Terms; seller signer countersigns; deal is created. */
export async function acceptQuote(quoteId: string, buyer: Address, buyerSignature: Hex) {
  const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId));
  if (!q) throw new HttpError(404, "quote not found");
  if (q.expiresAt.getTime() < Date.now()) throw new HttpError(409, "quote expired");
  if (q.status === "approval_required") throw new HttpError(409, "quote is waiting for seller approval");
  if (q.status === "declined") throw new HttpError(409, "quote was declined by the seller");
  if (q.status === "accepted") {
    const [existing] = await db.select().from(schema.deals).where(eq(schema.deals.quoteId, quoteId));
    if (existing) return existing.id;
  }
  const escrow = escrowAddress();
  const lp = await loadProductById(q.productId);
  const terms = termsFor(q, lp, buyer);
  const ok = await verifyTypedData({ address: buyer, domain: domain(env.CHAIN_ID, escrow), types: TERMS_TYPES, primaryType: "Terms", message: terms, signature: buyerSignature });
  if (!ok) throw new HttpError(400, "buyer signature does not match the quoted terms");
  const termsHash = hashTerms(env.CHAIN_ID, escrow, terms);

  // Seller-side delegated signer countersigns identical terms (policy already enforced deterministically).
  const signer = sellerSigner();
  if (signer.address.toLowerCase() !== lp.org.sellerSignerAddress.toLowerCase()) throw new HttpError(500, "seller signer mismatch");
  const sellerSignature = await signer.signTypedData({ domain: domain(env.CHAIN_ID, escrow), types: TERMS_TYPES, primaryType: "Terms", message: terms });

  const dealId = id("deal");
  await db.transaction(async (tx) => {
    await tx.update(schema.quotes).set({ status: "accepted", terms: bigintsToStrings(terms), termsHash }).where(eq(schema.quotes.id, quoteId));
    await tx.insert(schema.deals).values({
      id: dealId,
      publicId: publicId("d"),
      orgId: q.orgId,
      productId: q.productId,
      negotiationId: q.negotiationId,
      quoteId,
      dealIdOnchain: q.dealIdOnchain,
      buyerAddress: buyer,
      sellerAddress: terms.seller,
      payeeAddress: terms.payee,
      terms: bigintsToStrings(terms),
      publicTerms: q.publicTerms,
      termsHash,
      buyerSignature,
      sellerSignature,
      status: "awaiting_funding",
    });
    await tx.update(schema.negotiations).set({ status: "accepted", buyerAddress: buyer, updatedAt: new Date() }).where(eq(schema.negotiations.id, q.negotiationId));
  });
  return dealId;
}

/** Owner decision on an approval request. */
export async function decideApproval(orgId: string, approvalId: string, decision: "approve" | "decline", reason: string | undefined, decidedBy: string, ownerSignature?: string) {
  const [a] = await db.select().from(schema.approvals).where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.orgId, orgId)));
  if (!a) throw new HttpError(404, "approval not found");
  if (a.status !== "pending") throw new HttpError(409, `approval already ${a.status}`);
  const status = decision === "approve" ? "approved" : "declined";
  await db.transaction(async (tx) => {
    await tx.update(schema.approvals).set({ status, decisionReason: reason, decidedBy, ownerSignature, decidedAt: new Date() }).where(eq(schema.approvals.id, approvalId));
    await tx.update(schema.quotes).set({ status: decision === "approve" ? "approved" : "declined" }).where(eq(schema.quotes.id, a.quoteId));
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, a.quoteId));
    if (q) {
      await tx.insert(schema.decisions).values({ id: id("dec"), orgId, negotiationId: q.negotiationId, kind: "approval", ruleIds: a.ruleIds as string[], candidateId: q.candidateId, summary: `Owner ${status} the quote${reason ? `: ${reason}` : ""}`, privateBasis: { approvalId, decidedBy }, publicExplanation: decision === "approve" ? "The seller approved this agreement." : "The seller declined this agreement." });
      const turnsCount = await tx.select().from(schema.turns).where(eq(schema.turns.negotiationId, q.negotiationId));
      await tx.insert(schema.turns).values({ id: id("turn"), negotiationId: q.negotiationId, seq: turnsCount.length + 1, role: "agent", kind: "message", content: decision === "approve" ? "The seller approved the larger package. You can accept it now." : "The seller declined the larger package. The standing options are still available." });
    }
  });
  const [updated] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, approvalId));
  return updated!;
}
