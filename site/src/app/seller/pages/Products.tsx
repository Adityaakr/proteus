import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { Card, EmptyState, Money, StatusTag } from "../kit";
import { useProducts } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { pct, units } from "../format";
import { SellerOnlyTag } from "../parts/SellerOnly";
import s from "../seller.module.css";

export default function Products() {
  const q = useProducts();
  return (
    <div className={s.page}>
      <PageHeader description="What buyers can negotiate for, and the private floor your agent prices against." />
      <QueryView q={q} label="products">
        {(products) =>
          products.length === 0 ? (
            <EmptyState icon={<Package size={20} />} title="No products yet" description="Products are configured on the server for this build. Start the API with the seed data to see the sandbox product." />
          ) : (
            <div className={s.stack}>
              {products.map((p) => {
                const tiers = p.tiers;
                const minPrice = tiers.reduce((m, t) => (BigInt(t.unitPrice.num) / BigInt(t.unitPrice.den) < m ? BigInt(t.unitPrice.num) / BigInt(t.unitPrice.den) : m), BigInt(tiers[0]?.unitPrice.num ?? 0));
                return (
                  <Link key={p.id} to={`/app/products/${encodeURIComponent(p.id)}`} aria-label={`Open ${p.name}`}>
                    <Card
                      title={p.name}
                      subtitle={p.billableUnit}
                      actions={
                        <span className={s.row}>
                          <StatusTag state="active" label={`${tiers.length} public tiers`} />
                          <ArrowRight size={18} aria-hidden style={{ color: "var(--c-dark-60)" }} />
                        </span>
                      }
                    >
                      <div className={s.row} style={{ gap: 16 }}>
                        <span className="body3">
                          From <Money micro={minPrice.toString()} digits={2} /> per {p.unitLabel}
                        </span>
                        <span className="body3">Up to {units(p.maxUnitsPerDeal)} units per deal</span>
                        <span className="body3">{p.termDays} day term</span>
                        <span className={s.row} style={{ gap: 6 }}>
                          <SellerOnlyTag />
                          <span className="body3">
                            Floor <span className={s.mono}>{pct(p.policy.minMarginBps)}</span>, policy v{p.policy.version}, cost v{p.cost.version}
                          </span>
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )
        }
      </QueryView>
    </div>
  );
}
