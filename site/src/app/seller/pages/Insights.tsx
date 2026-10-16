import { Money } from "../kit";
import { useInsights } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { units } from "../format";
import type { InsightPoint } from "../console";
import s from "../seller.module.css";
import d from "../dashboard.module.css";

const fmtDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Bars({ title, series, pick, total, money }: { title: string; series: InsightPoint[]; pick: (p: InsightPoint) => number; total: React.ReactNode; money?: boolean }) {
  const vals = series.map(pick);
  const max = Math.max(1, ...vals);
  return (
    <div className={d.chartCard}>
      <div className={d.chartHead}><span className={d.chartTitle}>{title}</span><span className={d.chartTotal}>{total}</span></div>
      <div className={d.bars} role="img" aria-label={`${title} per day over the last ${series.length} days`}>
        {series.map((p, i) => {
          const v = vals[i]!;
          return <span key={p.day} className={`${d.bar} ${v === 0 ? d.barEmpty : ""}`} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} title={`${fmtDay(p.day)}: ${money ? `$${(v / 1_000_000).toFixed(2)}` : v}`} />;
        })}
      </div>
      <div className={d.axis}><span>{fmtDay(series[0]!.day)}</span><span>{fmtDay(series[series.length - 1]!.day)}</span></div>
    </div>
  );
}

/** Thirty days of real activity: negotiations, funded deals, settlements, requests. Bars are counts and sums, never projections. */
export default function Insights() {
  const q = useInsights();
  return (
    <div className={s.page}>
      <PageHeader description="The last 30 days from your own rows. Counts and sums only; no projections." />
      <QueryView q={q} label="insights">
        {(x) => {
          const sum = (f: (p: InsightPoint) => bigint | number) => x.series.reduce<bigint>((a, p) => a + BigInt(f(p)), 0n);
          const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
          return (
            <>
              <section className={d.block} aria-labelledby="h-funnel">
                <h2 id="h-funnel" className={d.h2}>From conversation to settled deal</h2>
                <div className={d.funnel}>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Negotiations</span><span className={d.funnelValue}>{units(x.conversion.negotiations)}</span><span className={d.funnelRate}>All time</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Quoted</span><span className={d.funnelValue}>{units(x.conversion.quoted)}</span><span className={d.funnelRate}>{rate(x.conversion.quoted, x.conversion.negotiations)} of negotiations</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Funded</span><span className={d.funnelValue}>{units(x.conversion.funded)}</span><span className={d.funnelRate}>{rate(x.conversion.funded, x.conversion.quoted)} of quoted</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Closed</span><span className={d.funnelValue}>{units(x.conversion.closed)}</span><span className={d.funnelRate}>{rate(x.conversion.closed, x.conversion.funded)} of funded</span></div>
                </div>
              </section>
              <div className={s.grid2}>
                <Bars title="Negotiations started" series={x.series} pick={(p) => p.negotiations} total={units(Number(sum((p) => p.negotiations)))} />
                <Bars title="Deals funded" series={x.series} pick={(p) => p.dealsFunded} total={units(Number(sum((p) => p.dealsFunded)))} />
                <Bars title="USDC funded into escrow" series={x.series} pick={(p) => Number(p.funded)} total={<Money micro={sum((p) => BigInt(p.funded))} />} money />
                <Bars title="USDC settled to you" series={x.series} pick={(p) => Number(p.settled)} total={<Money micro={sum((p) => BigInt(p.settled))} />} money />
                <Bars title="Service requests" series={x.series} pick={(p) => p.requests} total={units(Number(sum((p) => p.requests)))} />
                <Bars title="Billable units delivered" series={x.series} pick={(p) => p.billableUnits} total={units(Number(sum((p) => p.billableUnits)))} />
              </div>
              <section className={d.block} aria-labelledby="h-delivery">
                <h2 id="h-delivery" className={d.h2}>Delivery quality</h2>
                <div className={d.funnel}>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Requests</span><span className={d.funnelValue}>{units(x.delivery.requests)}</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Delivered</span><span className={d.funnelValue}>{units(x.delivery.delivered)}</span><span className={d.funnelRate}>{rate(x.delivery.delivered, x.delivery.requests)}</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Handed off</span><span className={d.funnelValue}>{units(x.delivery.handoff)}</span><span className={d.funnelRate}>Not billed</span></div>
                  <div className={d.funnelStep}><span className={d.funnelLabel}>Failed</span><span className={d.funnelValue}>{units(x.delivery.failed)}</span><span className={d.funnelRate}>Not billed</span></div>
                </div>
              </section>
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
