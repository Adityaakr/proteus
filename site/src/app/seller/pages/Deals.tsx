import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Handshake } from "lucide-react";
import { ActionButton, DataTable, EmptyState, Money, MonoValue, StatusTag, type DataColumn } from "../kit";
import { useDeals } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { dateTime } from "../format";
import type { DealSummary } from "../types";
import s from "../seller.module.css";

export default function Deals() {
  const q = useDeals();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const buyer = params.get("buyer")?.toLowerCase() ?? null;
  const go = (d: DealSummary) => nav(`/app/sell/deals/${encodeURIComponent(d.id)}`);
  const cols: DataColumn<DealSummary>[] = [
    {
      key: "deal",
      header: "Deal",
      render: (d) => (
        <a href={`/app/sell/deals/${encodeURIComponent(d.id)}`} onClick={(e) => { e.preventDefault(); go(d); }}>
          <span className={s.strong}>{d.productName}</span>
          <span className={s.sub}>{d.publicId} · {dateTime(d.createdAt)}</span>
        </a>
      ),
    },
    { key: "buyer", header: "Buyer", render: (d) => (d.buyerAddress ? <MonoValue value={d.buyerAddress} short /> : <span className={s.muted}>Not recorded</span>) },
    { key: "status", header: "Status", render: (d) => <StatusTag state={d.status} /> },
    { key: "dep", header: "Deposit", numeric: true, render: (d) => <Money micro={d.deposit} /> },
    { key: "set", header: "Settled", numeric: true, render: (d) => <Money micro={d.settled} /> },
    { key: "rem", header: "Remaining", numeric: true, render: (d) => <Money micro={d.remaining} /> },
  ];
  return (
    <div className={s.page}>
      <PageHeader description={buyer ? <>Deals with buyer <span className={s.mono}>{buyer.slice(0, 6)}…{buyer.slice(-4)}</span>. <Link to="/app/sell/deals" className={s.link}>Show all</Link></> : "Signed agreements funded into escrow on Arc testnet."} />
      <QueryView q={q} label="deals">
        {(all) => {
          const rows = buyer ? all.filter((d) => d.buyerAddress?.toLowerCase() === buyer) : all;
          return rows.length === 0 ? (
            <EmptyState
              icon={<Handshake size={20} />}
              title="No deals yet"
              description="A deal appears once a buyer signs a quote. Approving pending quotes is the fastest way to get one."
              action={<ActionButton variant="secondary" to="/app/sell/approvals">Review approvals</ActionButton>}
            />
          ) : (
            <DataTable columns={cols} rows={rows} rowKey={(d) => d.id} onRowClick={go} caption="All deals" />
          )
        ;}}
      </QueryView>
    </div>
  );
}
