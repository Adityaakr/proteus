import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { ActionButton, Money, StatusTag, shortHex } from "../kit";
import { useDashboard } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { RULE_TEXT, pct, relTime, units } from "../format";
import s from "../seller.module.css";
import d from "../dashboard.module.css";

/** Seller overview: four numbers that matter, what needs the owner, and the latest deals. Every figure is a sum over real rows. */
export default function Overview() {
  const q = useDashboard();
  return (
    <div className={s.page}>
      <PageHeader description="Revenue, margin and funds held, plus anything your agent routed to you." actions={<ActionButton to="/app/sell/products" variant="secondary">Products &amp; pricing</ActionButton>} />
      <QueryView q={q} label="overview">
        {(o) => (
          <>
            <section className={d.stats} aria-label="Key figures">
              <div className={d.stat}>
                <span className={d.statLabel}>Revenue earned</span>
                <span className={d.statValue}><Money micro={o.revenueEarned} /></span>
                <span className={d.statHint}>Settled from {o.fulfilledDeals === 1 ? "1 fulfilled deal" : `${o.fulfilledDeals} fulfilled deals`}</span>
              </div>
              <div className={d.stat}>
                <span className={d.statLabel}>Active negotiations</span>
                <span className={d.statValue}>{o.activeNegotiations}</span>
                <span className={o.needsAttention ? d.statHintWarn : d.statHint}>{o.needsAttention ? `${o.needsAttention} require your approval` : "None waiting on you"}</span>
              </div>
              <div className={d.stat}>
                <span className={d.statLabel}>Deal margin</span>
                <span className={d.statValue}>{o.marginBps === null ? <span className={d.statEmpty}>No quotes yet</span> : pct(o.marginBps)}</span>
                <span className={d.statHint}>{o.marginBasis === "accepted" ? "Contribution on accepted offers" : o.marginBasis === "quoted" ? "Contribution on quoted offers" : "Appears once the agent quotes"}</span>
              </div>
              <div className={d.stat}>
                <span className={d.statLabel}>Customer funds held</span>
                <span className={d.statValue}><Money micro={o.fundsHeld} /></span>
                <span className={d.statHint}>Unconsumed prepaid balance in escrow</span>
              </div>
            </section>

            <section className={d.block} aria-labelledby="h-attn">
              <div className={d.blockHead}>
                <h2 id="h-attn" className={d.h2}>Needs your attention</h2>
                {o.attention.length > 0 && <Link to="/app/sell/approvals" className={d.more}>All approvals <ArrowRight size={14} aria-hidden /></Link>}
              </div>
              {o.attention.length === 0 ? (
                <p className={d.empty}>Nothing waiting on you. Quotes above your approval threshold appear here; your agent handles the rest within policy.</p>
              ) : (
                <ul className={d.attnList}>
                  {o.attention.map((a) => (
                    <li key={a.id} className={d.attn}>
                      <div className={d.attnTop}>
                        <div className={d.attnWho}>
                          <span className={d.attnBuyer}>{a.buyerAddress ? `Buyer ${shortHex(a.buyerAddress)}` : "Buyer"}</span>
                          <span className={d.attnWhat}>{a.productName}, {a.tierName}, {units(a.units)} units</span>
                        </div>
                        <StatusTag tone="warn" label="Approval needed" />
                      </div>
                      <div className={d.attnMid}>
                        <span className={d.attnKey}>Proposed value</span>
                        <span className={d.attnVal}><Money micro={a.prepaidTotal} /><span className={d.attnSub}> prepaid, {pct(a.marginBps)} margin</span></span>
                      </div>
                      <div className={d.attnFoot}>
                        <span className={d.attnReason}><AlertCircle size={14} aria-hidden />{a.ruleIds.map((r) => RULE_TEXT[r] ?? r).join("; ") || a.reason}</span>
                        <span className={d.attnActions}>
                          <span className={d.attnTime}>{relTime(a.createdAt)}</span>
                          <ActionButton size="sm" to="/app/sell/approvals">Review</ActionButton>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={d.block} aria-labelledby="h-recent">
              <div className={d.blockHead}>
                <h2 id="h-recent" className={d.h2}>Recent deals</h2>
                <Link to="/app/sell/deals" className={d.more}>All deals <ArrowRight size={14} aria-hidden /></Link>
              </div>
              {o.recentDeals.length === 0 ? (
                <p className={d.empty}>No deals yet. A deal appears here the moment a buyer signs terms.</p>
              ) : (
                <ul className={d.dealList}>
                  {o.recentDeals.map((x) => (
                    <li key={x.id}>
                      <Link to={`/app/sell/deals/${encodeURIComponent(x.id)}`} className={d.deal}>
                        <span className={d.dealWho}>
                          <span className={d.dealBuyer}>Buyer {shortHex(x.buyerAddress)}</span>
                          <span className={d.dealProduct}>{x.productName}</span>
                        </span>
                        <span className={d.dealRight}>
                          <span className={d.dealAmt}><Money micro={x.deposit} /></span>
                          <span className={d.dealState}><StatusTag state={x.status} /></span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className={d.fine}>Figures are testnet USDC from your own deals table and the chain reconciler. Nothing here is estimated.</p>
          </>
        )}
      </QueryView>
    </div>
  );
}
