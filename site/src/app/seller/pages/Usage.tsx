import { useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { filterBySearch } from "@proteus/domain";
import { FilterChips, NoMatches, SearchBar } from "../../ui/SearchBar";
import { useSearchParam, useSearchParamOf } from "../../lib/useSearchParam";
import { Activity } from "lucide-react";
import { DataTable, EmptyState, Money, MonoValue, StatusTag, type DataColumn } from "../kit";
import { useUsage } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { relTime, units } from "../format";
import type { UsageRow } from "../console";
import s from "../seller.module.css";
import d from "../dashboard.module.css";

/** Every metered request your endpoint answered, with what was billed and whether the receipt is signed. */
const OUTCOMES = ["all", "delivered", "handoff", "failed"] as const;

export default function Usage() {
  const q = useUsage();
  const [query, setQuery] = useSearchParam("q");
  const [outcome, setOutcome] = useSearchParamOf("outcome", OUTCOMES, "all");
  const typed = useDeferredValue(query);
  const nav = useNavigate();
  const cols: DataColumn<UsageRow>[] = [
    { key: "req", header: "Request", render: (r) => <span><span className={s.strong}><MonoValue value={r.requestId} short /></span><span className={s.sub}>{r.productName}{r.dealPublicId ? `, deal ${r.dealPublicId}` : ""}</span></span> },
    { key: "buyer", header: "Buyer", render: (r) => (r.buyerAddress ? <MonoValue value={r.buyerAddress} short /> : <span className={s.muted}>Unknown</span>) },
    { key: "status", header: "Outcome", render: (r) => <StatusTag state={r.status} /> },
    { key: "units", header: "Billed", numeric: true, render: (r) => (r.billable ? `${r.units}` : <span className={s.muted}>0</span>) },
    { key: "cum", header: "Charged to date", numeric: true, render: (r) => (r.billable ? <Money micro={r.cumulativeCharged} /> : <span className={s.muted}>—</span>) },
    { key: "lat", header: "Latency", numeric: true, render: (r) => `${r.latencyMs} ms` },
    { key: "signed", header: "Receipt", render: (r) => <StatusTag tone={r.signed ? "success" : "neutral"} label={r.signed ? "Signed" : "Unsigned"} /> },
    { key: "at", header: "When", render: (r) => <span className={s.muted}>{relTime(r.at)}</span> },
  ];
  return (
    <div className={s.page}>
      <PageHeader description="What your service delivered, what was metered, and the seller-signed receipt behind each billable unit." />
      <QueryView q={q} label="usage">
        {(u) => (
          <>
            <div className={d.summary}>
              <div className={d.stat}><span className={d.statLabel}>Requests</span><span className={d.statValue}>{units(u.totals.requests)}</span></div>
              <div className={d.stat}><span className={d.statLabel}>Delivered</span><span className={d.statValue}>{units(u.totals.delivered)}</span><span className={d.statHint}>{u.totals.requests ? `${Math.round((u.totals.delivered / u.totals.requests) * 100)}% of requests` : "No requests yet"}</span></div>
              <div className={d.stat}><span className={d.statLabel}>Handed off</span><span className={d.statValue}>{units(u.totals.handoff)}</span><span className={d.statHint}>Never billed</span></div>
              <div className={d.stat}><span className={d.statLabel}>Failed</span><span className={d.statValue}>{units(u.totals.failed)}</span><span className={d.statHint}>Never billed</span></div>
              <div className={d.stat}><span className={d.statLabel}>Billable units</span><span className={d.statValue}>{units(u.totals.billableUnits)}</span></div>
              <div className={d.stat}><span className={d.statLabel}>Avg latency</span><span className={d.statValue}>{u.totals.avgLatencyMs} ms</span></div>
            </div>
            {u.requests.length === 0 ? (
              <EmptyState icon={<Activity size={20} />} title="No requests yet" description="Rows appear here as buyers call your service through a funded deal." />
            ) : (
              (() => {
                const shown = filterBySearch(u.requests, typed, (r) => [r.requestId, r.productName, r.dealPublicId, r.buyerAddress, r.status]).filter((r) => outcome === "all" || r.status === outcome);
                const n = (st: UsageRow["status"]) => u.requests.filter((r) => r.status === st).length;
                return (
                  <>
                    <SearchBar
                      value={query}
                      onChange={setQuery}
                      label="Search requests"
                      placeholder="Search by request ID, product, deal or buyer"
                      shown={shown.length}
                      total={u.requests.length}
                      noun={u.requests.length >= 300 ? "latest requests" : "requests"}
                      filters={<FilterChips label="Outcome" value={outcome} onChange={setOutcome} options={[{ value: "all", label: "All" }, { value: "delivered", label: "Delivered", count: n("delivered") }, { value: "handoff", label: "Handed off", count: n("handoff") }, { value: "failed", label: "Failed", count: n("failed") }]} />}
                    />
                    {shown.length === 0 ? <NoMatches query={query} noun="requests" filtered={outcome !== "all"} onClear={() => { setQuery(""); setOutcome("all"); }} /> : <DataTable<UsageRow> caption="Requests, newest first" rows={shown} rowKey={(r) => r.id} columns={cols} onRowClick={(r) => nav(`/app/sell/deals/${encodeURIComponent(r.dealId)}`)} />}
                  </>
                );
              })()
            )}
          </>
        )}
      </QueryView>
    </div>
  );
}
