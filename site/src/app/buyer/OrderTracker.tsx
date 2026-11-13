import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Truck } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import { api, errorMessage, type OrderTimeline } from "../lib/api";
import { ExplorerLink, Notice } from "../ui/misc";
import { fmtDateTime } from "./common";
import f from "./fund.module.css";

const STEP_LABEL: Record<OrderTimeline["steps"][number]["id"], string> = {
  paid: "Paid",
  accepted: "Accepted",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  settled: "Seller paid",
};

/** "Track your order" for goods and work the seller delivers: progress, tracking, and every update with proof. */
export function OrderTracker({ dealId, apiKey }: { dealId: string; apiKey: string | null }) {
  const q = useQuery({ queryKey: ["deal-timeline", dealId, Boolean(apiKey)], queryFn: () => api.dealTimeline(dealId, apiKey), refetchInterval: 20_000, retry: false });
  if (q.isLoading) return <section className={f.section}><p className={f.fine}>Loading your order…</p></section>;
  if (q.isError) return <section className={f.section}><Notice tone="warn">{errorMessage(q.error)}</Notice></section>;
  const t = q.data!;
  const doneCount = t.steps.filter((s) => s.done).length;
  return (
    <section className={f.section} aria-labelledby="h-order">
      <div className={f.sectionHead}>
        <h2 id="h-order" className={f.h2}>Your order</h2>
        <span className={f.h2Sub}>{t.product} from {t.seller}. Your money stays in escrow until you confirm delivery.</span>
      </div>

      <ol aria-label="Order progress" style={{ display: "grid", gridTemplateColumns: `repeat(${t.steps.length}, minmax(0, 1fr))`, gap: 6, listStyle: "none", padding: 0, margin: "4px 0 6px" }}>
        {t.steps.map((s, i) => (
          <li key={s.id} style={{ display: "flex", flexDirection: "column", gap: 6 }} aria-current={i === doneCount - 1 ? "step" : undefined}>
            <span style={{ height: 6, borderRadius: 3, background: s.done ? "var(--c-accent, #2b4cf5)" : "var(--c-dark-10, #e6e8ee)" }} />
            <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, color: s.done ? "inherit" : "var(--c-dark-60, #6b707a)" }}>
              {s.done && <Check size={11} strokeWidth={3} aria-hidden />}
              {STEP_LABEL[s.id]}
            </span>
          </li>
        ))}
      </ol>

      {t.tracking && (
        <a href={t.tracking} target="_blank" rel="noreferrer" className={f.textBtn} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Truck size={14} aria-hidden /> Track the shipment <ExternalLink size={12} aria-hidden />
        </a>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {t.events.map((e, i) => (
          <li key={`${e.at}-${i}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "baseline" }}>
            <span className={f.fine} style={{ margin: 0 }}>{fmtDateTime(e.at)}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span>{e.label}</span>
              {e.note && <span className={f.fine} style={{ margin: 0 }}>“{e.note}”</span>}
              {e.url && <a href={e.url} target="_blank" rel="noreferrer" className={f.textBtn}>{e.status === "shipped" || e.status === "out_for_delivery" ? "Tracking link" : "Proof"} <ExternalLink size={11} aria-hidden /></a>}
              {e.txHash && <ExplorerLink href={explorerTx(e.txHash)} hash={e.txHash} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
