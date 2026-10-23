import { pluralUnit } from "@proteus/domain";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { ActionButton, EmptyState, Money, StatusTag } from "../kit";
import { useProducts } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { duration, pct, units } from "../format";
import s from "../seller.module.css";
import d from "../dashboard.module.css";

/** The rules every product's agent must obey. The model proposes; these decide. */
export default function AgentPolicies() {
  const q = useProducts();
  return (
    <div className={s.page}>
      <PageHeader description="What your negotiation agent can and cannot do, per product. It can present and explain offers; it cannot set a price, cross the floor, sign or move money." actions={<ActionButton to="/app/sell/approvals" variant="secondary">Approvals</ActionButton>} />
      <div className={d.guard}>
        <ShieldCheck size={16} aria-hidden />
        <span>Every offer the agent shows a buyer is generated from the numbers below by a deterministic pricing engine. Prices under the margin floor are refused, discounts past the cap are refused, and anything above the approval threshold waits for you.</span>
      </div>
      <QueryView q={q} label="policies">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={20} />} title="No products yet" description="Policies live on products. Publish one to set the floor your agent prices against." action={<ActionButton to="/app/sell/start">Publish a product</ActionButton>} />
          ) : (
            <div className={d.policyGrid}>
              {rows.map((p) => (
                <div key={p.id} className={d.policy}>
                  <div className={d.policyHead}>
                    <span>
                      <span className={d.policyName}>{p.name}</span>
                      <span className={s.sub}>Policy v{p.policy.version}, cost model v{p.cost.version}</span>
                    </span>
                    <StatusTag tone="info" label="Enforced" />
                  </div>
                  <dl className={d.policyRules}>
                    <dt>Margin floor</dt><dd>{pct(p.policy.minMarginBps)}</dd>
                    <dt>Max discount from list</dt><dd>{pct(p.policy.maxDiscountBps)}</dd>
                    <dt>Approval threshold</dt><dd><Money micro={p.policy.approvalThreshold} /></dd>
                    <dt>Prepaid minimum</dt><dd><Money micro={p.policy.prepaidMinimum} /></dd>
                    <dt>Capacity left to commit</dt><dd>{units(p.policy.availableCapacityUnits)} {pluralUnit(p.unitLabel)}</dd>
                    <dt>Offer validity</dt><dd>{duration(p.policy.quoteTtlSeconds)}</dd>
                    <dt>Variable cost per {p.unitLabel}</dt><dd><Money micro={p.cost.variableCostPerUnit} digits={4} /></dd>
                  </dl>
                  <div className={s.row}>
                    <Link to={`/app/sell/products/${encodeURIComponent(p.id)}`} className={s.link}>Edit policy and cost</Link>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </QueryView>
    </div>
  );
}
