import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CheckCircle2, FileText, Gauge, Hourglass, Receipt, RotateCcw, Wallet } from "lucide-react";
import { ActionButton, Card, Money, StatCard, StatusTag } from "../kit";
import { useOverview } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { units } from "../format";
import s from "../seller.module.css";

export default function Overview() {
  const q = useOverview();
  const pending = q.data?.approvalsPending ?? 0;
  return (
    <div className={s.page}>
      <PageHeader
        description="What your negotiation agent has quoted, what buyers funded, and what is waiting on you."
        labels
        sellerLabel={q.data?.labels.seller ?? "sandbox"}
        actions={
          q.data && (
            <ActionButton to="/app/sell/approvals" icon>
              Review approvals{pending ? ` (${pending})` : ""}
            </ActionButton>
          )
        }
      />
      <QueryView q={q} label="overview">
        {(o) => {
          const testnet = <StatusTag network="testnet" label="Testnet" noDot />;
          return (
            <>
              <div className={s.stats}>
                <StatCard label="Quotes issued" icon={<FileText size={14} />} value={<span className={s.mono}>{o.quotes}</span>} hint="Created by the agent from eligible candidates" />
                <StatCard label="Approvals pending" icon={<Hourglass size={14} />} value={<span className={s.mono}>{o.approvalsPending}</span>} hint={o.approvalsPending ? "Quotes above your threshold wait for you" : "Nothing waiting on you"} />
                <StatCard label="Deals funded" icon={<CheckCircle2 size={14} />} value={<span className={s.mono}>{o.dealsFunded}</span>} hint="USDC deposited into escrow" tag={testnet} />
                <StatCard label="Usage units" icon={<Gauge size={14} />} value={<span className={s.mono}>{units(o.usageUnits)}</span>} hint="Billable units delivered across deals" />
                <StatCard label="Funded value" icon={<Wallet size={14} />} value={<span className={s.statMoney}><Money micro={o.fundedValue} /></span>} hint="Total deposited by buyers" tag={testnet} />
                <StatCard label="Earned (settled)" icon={<Banknote size={14} />} value={<span className={s.statMoney}><Money micro={o.earnedSettled} /></span>} hint="Paid out after buyer-accepted usage" tag={testnet} />
                <StatCard label="Pending liability" icon={<Receipt size={14} />} value={<span className={s.statMoney}><Money micro={o.pendingLiability} /></span>} hint="Prepaid but not yet earned" tag={testnet} />
                <StatCard label="Refunded" icon={<RotateCcw size={14} />} value={<span className={s.statMoney}><Money micro={o.refunded} /></span>} hint="Unused balance returned to buyers" tag={testnet} />
              </div>
              <div className={s.grid2}>
                <Card title="Waiting on you" subtitle={o.approvalsPending ? "Quotes your policy routed to the owner." : "Your agent is handling negotiations within policy."}>
                  <p className="body3">
                    {o.approvalsPending
                      ? `${o.approvalsPending} quote${o.approvalsPending === 1 ? " is" : "s are"} above your approval threshold. Buyers cannot sign until you decide.`
                      : "No approvals pending. Large quotes will appear here when they exceed your approval threshold."}
                  </p>
                </Card>
                <Card title="Where things are">
                  <ul className={s.stack} style={{ gap: 10 }}>
                    {[
                      { to: "/app/sell/products", t: "Pricing policy and cost model", d: "Set the margin floor the agent can never cross" },
                      { to: "/app/sell/negotiations", t: "Negotiations", d: "Transcripts with the private economics behind each offer" },
                      { to: "/app/sell/deals", t: "Deals", d: "Signed terms, escrow balances and settlements" },
                      { to: "/app/sell/finance", t: "Finance", d: "Journal and reconciliation against the chain" },
                    ].map((l) => (
                      <li key={l.to}>
                        <Link to={l.to} className={s.between} style={{ flexWrap: "nowrap" }}>
                          <span>
                            <span className={`body3 ${s.strong}`}>{l.t}</span>
                            <span className={s.sub}>{l.d}</span>
                          </span>
                          <ArrowRight size={16} aria-hidden style={{ flex: "none", color: "var(--c-dark-60)" }} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
