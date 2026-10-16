import { ShieldCheck } from "lucide-react";
import { ActionButton, EmptyState } from "../kit";
import { useApprovals, useProducts } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { ApprovalCard } from "../parts/ApprovalCard";
import s from "../seller.module.css";

export default function Approvals() {
  const q = useApprovals();
  const products = useProducts();
  const floor = products.data?.length === 1 ? products.data[0]!.policy.minMarginBps : undefined;
  return (
    <div className={s.page}>
      <PageHeader description="Quotes your policy routed to you. The buyer cannot sign until you approve." />
      <QueryView q={q} label="approvals">
        {(rows) => {
          const pending = rows.filter((a) => a.status === "pending");
          const decided = rows.filter((a) => a.status !== "pending");
          return (
            <>
              {pending.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck size={20} />}
                  title="Nothing waiting on you"
                  description="Quotes above your approval threshold land here. You can raise or lower the threshold in the product policy."
                  action={<ActionButton variant="secondary" to="/app/sell/products">Open pricing policy</ActionButton>}
                />
              ) : (
                <div className={s.approvals}>
                  {pending.map((a) => (
                    <ApprovalCard key={a.id} a={a} floorBps={floor} />
                  ))}
                </div>
              )}
              {decided.length > 0 && (
                <section className={s.stack}>
                  <h2 className="h5">Decided</h2>
                  <div className={s.approvals}>
                    {decided.map((a) => (
                      <ApprovalCard key={a.id} a={a} floorBps={floor} />
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
