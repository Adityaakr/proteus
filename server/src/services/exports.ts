/**
 * Accounting exports for a seller: CSV files an accountant can open or import, where every money movement carries the
 * Arc transaction that proves it. Amounts are USDC with 6 decimals (1 USDC = 1 USD for USDC-denominated books).
 *
 *   deals     one row per deal: buyer, product, deposit, settled, refunded, remaining, status, funding/refund tx
 *   receipts  one row per delivered unit batch or service call: units, cumulative charged, signed evidence digest
 *   journal   double-entry lines (Date, Journal No, Account, Debit, Credit, Description, Reference), the column shape
 *             QuickBooks Online and Xero accept for journal imports; Reference is the Arc transaction hash
 */
import { and, asc, eq } from "drizzle-orm";
import { explorerTx } from "@proteus/domain";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";

export type ExportKind = "deals" | "receipts" | "journal";

const usdc = (micro: bigint | string | number) => {
  const n = BigInt(micro);
  const neg = n < 0n ? "-" : "";
  const a = n < 0n ? -n : n;
  return `${neg}${a / 1_000_000n}.${(a % 1_000_000n).toString().padStart(6, "0")}`;
};
/** RFC 4180 field: quote when needed; neutralise spreadsheet formula injection from user-controlled text. */
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const tx = (h: string | null | undefined) => (h ? explorerTx(h, env.CHAIN_ID) : "");
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function exportCsv(orgId: string, kind: ExportKind): Promise<{ filename: string; body: string }> {
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "deals") {
    const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId)).orderBy(asc(schema.deals.createdAt));
    const products = new Map((await db.select().from(schema.products).where(eq(schema.products.orgId, orgId))).map((p) => [p.id, p.slug]));
    const rows = deals.map((d) => [
      d.publicId, day(d.createdAt), products.get(d.productId) ?? d.productId, d.buyerAddress, d.status,
      usdc(d.deposit), usdc(d.settled), usdc(d.refunded), usdc(d.deposit - d.settled - d.refunded),
      d.dealIdOnchain.toString(), d.fundingTxHash ?? "", tx(d.fundingTxHash), d.refundTxHash ?? "", tx(d.refundTxHash),
    ]);
    return { filename: `proteus-deals-${stamp}.csv`, body: csv(["Deal", "Date", "Product", "Buyer wallet", "Status", "Deposit USDC", "Settled USDC", "Refunded USDC", "Remaining USDC", "On-chain deal id", "Funding tx", "Funding explorer", "Refund tx", "Refund explorer"], rows) };
  }
  if (kind === "receipts") {
    const reqs = await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.orgId, orgId), eq(schema.serviceRequests.billable, true))).orderBy(asc(schema.serviceRequests.createdAt));
    const deals = new Map((await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId))).map((d) => [d.id, d.publicId]));
    const rows = reqs.map((r) => {
      const src = ((r.output as { source?: { store?: string; proofUrl?: string | null } }).source ?? {}) as { store?: string; proofUrl?: string | null };
      return [day(r.createdAt), deals.get(r.dealId ?? "") ?? r.dealId ?? "pay-per-call", r.requestId, r.status, r.units, r.cumulativeUnits.toString(), usdc(r.cumulativeCharged), src.store === "seller-confirmed" ? "seller-confirmed" : "metered", src.proofUrl ?? "", r.evidenceDigest, r.sellerSignature ?? ""];
    });
    return { filename: `proteus-receipts-${stamp}.csv`, body: csv(["Date", "Deal", "Request", "Status", "Units", "Cumulative units", "Cumulative charged USDC", "Kind", "Proof", "Evidence digest", "Seller signature"], rows) };
  }
  if (kind === "journal") {
    const entries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.orgId, orgId)).orderBy(asc(schema.journalEntries.createdAt));
    const deals = new Map((await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId))).map((d) => [d.id, d.publicId]));
    const rows: unknown[][] = [];
    for (const e of entries) {
      const lines = e.lines as { account: string; debit: string; credit: string }[];
      const ref = (e.evidence as { txHash?: string }).txHash ?? "";
      for (const l of lines) rows.push([day(e.createdAt), e.id, l.account, BigInt(l.debit) ? usdc(l.debit) : "", BigInt(l.credit) ? usdc(l.credit) : "", `${e.memo} (${deals.get(e.dealId ?? "") ?? "no deal"})`, ref, tx(ref)]);
    }
    return { filename: `proteus-journal-${stamp}.csv`, body: csv(["Date", "Journal No", "Account", "Debit", "Credit", "Description", "Reference", "Explorer"], rows) };
  }
  throw new HttpError(400, "kind must be deals, receipts or journal");
}
