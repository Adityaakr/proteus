import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { DataTable, EmptyState, Money, MonoValue, type DataColumn } from "../kit";
import { useCustomers } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { relTime } from "../format";
import type { Customer } from "../console";
import s from "../seller.module.css";
import d from "../dashboard.module.css";

/** Every wallet that negotiated with or bought from this seller, with real totals. */
export default function Customers() {
  const q = useCustomers();
  const nav = useNavigate();
  const cols: DataColumn<Customer>[] = [
    { key: "who", header: "Customer", render: (c) => <span><span className={s.strong}><MonoValue value={c.address} short copy label="buyer address" /></span><span className={s.sub}>{c.products.length ? c.products.join(", ") : "No deal yet"}</span></span> },
    { key: "negs", header: "Negotiations", numeric: true, render: (c) => c.negotiations },
    { key: "deals", header: "Deals", numeric: true, render: (c) => c.deals },
    { key: "funded", header: "Funded", numeric: true, render: (c) => <Money micro={c.funded} /> },
    { key: "settled", header: "Settled", numeric: true, render: (c) => <Money micro={c.settled} /> },
    { key: "held", header: "In escrow", numeric: true, render: (c) => <Money micro={c.inEscrow} /> },
    { key: "last", header: "Last activity", render: (c) => <span className={s.muted}>{relTime(c.lastActivity)}</span> },
  ];
  return (
    <div className={s.page}>
      <PageHeader description="Buyers who talked to your agent or funded a deal. Totals are sums over their deals." />
      <QueryView q={q} label="customers">
        {(rows) => {
          const funded = rows.reduce((n, c) => n + BigInt(c.funded), 0n);
          const settled = rows.reduce((n, c) => n + BigInt(c.settled), 0n);
          return rows.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="No customers yet" description="A buyer appears here as soon as they open a negotiation with your agent." />
          ) : (
            <>
              <div className={d.summary}>
                <div className={d.stat}><span className={d.statLabel}>Customers</span><span className={d.statValue}>{rows.length}</span></div>
                <div className={d.stat}><span className={d.statLabel}>With a funded deal</span><span className={d.statValue}>{rows.filter((c) => c.deals > 0).length}</span></div>
                <div className={d.stat}><span className={d.statLabel}>Funded by customers</span><span className={d.statValue}><Money micro={funded} /></span></div>
                <div className={d.stat}><span className={d.statLabel}>Settled to you</span><span className={d.statValue}><Money micro={settled} /></span></div>
              </div>
              <DataTable<Customer> caption="Customers, most recent activity first" rows={rows} rowKey={(c) => c.address} columns={cols} onRowClick={(c) => nav(`/app/sell/deals?buyer=${encodeURIComponent(c.address)}`)} />
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
