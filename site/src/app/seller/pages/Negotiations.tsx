import { useNavigate } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { DataTable, EmptyState, Money, StatusTag, type DataColumn } from "../kit";
import { useNegotiations } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { relTime } from "../format";
import type { NegotiationSummary } from "../types";
import s from "../seller.module.css";

export default function Negotiations() {
  const q = useNegotiations();
  const nav = useNavigate();
  const cols: DataColumn<NegotiationSummary>[] = [
    {
      key: "buyer",
      header: "Buyer",
      render: (n) => (
        <a href={`/app/negotiations/${encodeURIComponent(n.id)}`} onClick={(e) => { e.preventDefault(); nav(`/app/negotiations/${encodeURIComponent(n.id)}`); }}>
          <span className={s.strong}>{n.buyerLabel}</span>
          <span className={s.sub}>{n.productName}</span>
        </a>
      ),
    },
    { key: "status", header: "Status", render: (n) => <span className={s.row} style={{ gap: 4 }}><StatusTag state={n.status} />{n.needsApproval && <StatusTag state="approval_required" />}</span> },
    { key: "turns", header: "Turns", numeric: true, render: (n) => n.turns },
    { key: "best", header: "Current offer", numeric: true, render: (n) => (n.bestOfferTotal ? <Money micro={n.bestOfferTotal} /> : <span className={s.muted}>None yet</span>) },
    { key: "upd", header: "Updated", render: (n) => <span className={s.muted}>{relTime(n.updatedAt)}</span> },
  ];
  return (
    <div className={s.page}>
      <PageHeader description="Every conversation your agent is having with buyers, newest first." />
      <QueryView q={q} label="negotiations">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare size={20} />}
              title="No negotiations yet"
              description="When a buyer or their agent opens your product page and starts a conversation, it shows up here with the private economics behind every offer."
            />
          ) : (
            <DataTable columns={cols} rows={[...rows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))} rowKey={(n) => n.id} onRowClick={(n) => nav(`/app/negotiations/${encodeURIComponent(n.id)}`)} caption="Inbox" />
          )
        }
      </QueryView>
    </div>
  );
}
