import { asc, desc, eq } from "drizzle-orm";
import { explorerAddress, explorerTx, formatUsd, pluralUnit } from "@proteus/domain";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError } from "../lib/http";
import { loadProductById } from "./catalog";

/** Public, redacted records: no buyer address, no seller economics, no transcripts. */
export async function listRecords() {
  const rows = await db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt)).limit(100);
  const out = [];
  for (const d of rows) {
    const lp = await loadProductById(d.productId);
    out.push({ publicId: d.publicId, sellerLabel: lp.org.label, productName: lp.product.name, status: d.status, fundedUsd: formatUsd(d.deposit), settledUsd: formatUsd(d.settled), refundedUsd: formatUsd(d.refunded), network: features.network, createdAt: d.createdAt });
  }
  return out;
}

export async function recordView(publicIdValue: string) {
  const [d] = await db.select().from(schema.deals).where(eq(schema.deals.publicId, publicIdValue));
  if (!d) throw new HttpError(404, "record not found");
  const lp = await loadProductById(d.productId);
  const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, d.quoteId));
  const txs = await db.select().from(schema.chainTxs).where(eq(schema.chainTxs.dealId, d.id)).orderBy(asc(schema.chainTxs.createdAt));
  const reqs = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.dealId, d.id)).orderBy(asc(schema.serviceRequests.createdAt));
  const acks = await db.select().from(schema.usageAcceptances).where(eq(schema.usageAcceptances.dealId, d.id)).orderBy(asc(schema.usageAcceptances.nonce));
  const decisions = await db.select().from(schema.decisions).where(eq(schema.decisions.negotiationId, d.negotiationId)).orderBy(asc(schema.decisions.createdAt));

  const timeline: { at: Date; kind: string; summary: string; txHash?: string; explorerUrl?: string }[] = [];
  for (const dec of decisions) {
    if (dec.kind === "quote") continue; // the quote row below carries the offer
    timeline.push({ at: dec.createdAt, kind: dec.kind === "candidates" ? "options" : dec.kind, summary: dec.publicExplanation });
  }
  if (q) timeline.push({ at: q.createdAt, kind: "quote", summary: `Offer issued: ${(q.publicTerms as { units: string }).units} ${pluralUnit(lp.product.unitLabel)}, ${formatUsd(BigInt((q.publicTerms as { prepaidTotal: string }).prepaidTotal))} prepaid` });
  timeline.push({ at: d.createdAt, kind: "accept", summary: `Identical terms signed by buyer and seller. Terms hash ${d.termsHash.slice(0, 10)}…` });
  for (const t of txs) timeline.push({ at: t.createdAt, kind: t.kind === "fund" ? "fund" : t.kind === "settle" ? "settle" : t.kind === "refund" ? "refund" : t.kind, summary: `${t.kind} transaction (${t.status}, via ${t.submittedVia})`, txHash: t.txHash, explorerUrl: explorerTx(t.txHash) });
  const delivered = reqs.filter((r) => r.billable).length;
  if (reqs.length) timeline.push({ at: reqs.at(-1)!.createdAt, kind: "service", summary: `${reqs.length} service request(s), ${delivered} billable, ${reqs.length - delivered} not billable (failed or handoff)` });
  for (const a of acks) timeline.push({ at: a.createdAt, kind: "usage_accept", summary: `Buyer accepted cumulative usage: ${a.cumulativeUnits} ${pluralUnit(lp.product.unitLabel)}, ${formatUsd(a.cumulativeAmount)}`, txHash: a.settlementTxHash ?? undefined, explorerUrl: a.settlementTxHash ? explorerTx(a.settlementTxHash) : undefined });
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    publicId: d.publicId,
    status: d.status,
    productName: lp.product.name,
    sellerLabel: lp.org.label,
    termsHash: d.termsHash,
    dealIdOnchain: d.dealIdOnchain.toString(),
    publicTerms: d.publicTerms,
    balances: { deposit: d.deposit, settled: d.settled, refunded: d.refunded, remaining: d.deposit - d.settled - d.refunded, source: d.balancesSource },
    timeline,
    explorer: { escrow: env.ESCROW_ADDRESS ? explorerAddress(env.ESCROW_ADDRESS) : null },
    labels: { network: features.network, seller: lp.org.label, data: "redacted public record" },
  };
}
