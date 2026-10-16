import { Link } from "react-router-dom";
import { DataTable, ExplorerLink, Money, type DataColumn } from "../kit";
import { dateTime } from "../format";
import type { JournalEntry } from "../types";

export function JournalTable({ rows, showDeal, caption }: { rows: JournalEntry[]; showDeal?: boolean; caption?: string }) {
  const cols: DataColumn<JournalEntry>[] = [
    { key: "at", header: "Date", render: (j) => dateTime(j.at) },
    ...(showDeal
      ? [{ key: "deal", header: "Record", render: (j: JournalEntry) => (j.dealPublicId ? <Link to={`/records/${encodeURIComponent(j.dealPublicId)}`} style={{ color: "var(--c-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{j.dealPublicId}</Link> : "") }]
      : []),
    { key: "acct", header: "Account", render: (j) => <span style={{ color: "var(--c-dark)" }}>{j.account}</span> },
    { key: "memo", header: "Memo", render: (j) => j.memo },
    { key: "dr", header: "Debit", numeric: true, render: (j) => (BigInt(j.debit) > 0n ? <Money micro={j.debit} /> : "") },
    { key: "cr", header: "Credit", numeric: true, render: (j) => (BigInt(j.credit) > 0n ? <Money micro={j.credit} /> : "") },
    { key: "tx", header: "Transaction", render: (j) => (j.explorerUrl && j.txHash ? <ExplorerLink href={j.explorerUrl} hash={j.txHash} /> : <span style={{ color: "var(--c-dark-40)" }}>No transaction</span>) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(j) => j.id} caption={caption} />;
}
