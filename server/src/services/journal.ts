import { db, schema } from "../db";
import { id } from "../lib/ids";

export interface JournalLine {
  account: "escrow_usdc" | "customer_liability" | "earned_revenue" | "unbilled_delivery";
  debit: bigint;
  credit: bigint;
}

/** Append-only, balanced double-entry journal. Throws if debits != credits. */
export async function postJournal(e: { orgId: string; dealId?: string; kind: string; memo: string; lines: JournalLine[]; evidence: Record<string, unknown> }) {
  const d = e.lines.reduce((s, l) => s + l.debit, 0n);
  const c = e.lines.reduce((s, l) => s + l.credit, 0n);
  if (d !== c) throw new Error(`unbalanced journal entry: debit ${d} credit ${c}`);
  await db.insert(schema.journalEntries).values({
    id: id("je"),
    orgId: e.orgId,
    dealId: e.dealId,
    kind: e.kind,
    memo: e.memo,
    lines: e.lines.map((l) => ({ account: l.account, debit: l.debit.toString(), credit: l.credit.toString() })),
    evidence: e.evidence,
  });
}
