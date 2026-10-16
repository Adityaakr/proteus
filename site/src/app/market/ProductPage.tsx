import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, MessageSquareText } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, qk, type PublicProduct } from "../lib/api";
import { ErrorState, PageHeader, fmtUnits, prettyIntegration } from "../buyer/common";
import { PayPerCallCard } from "./PayPerCallCard";
import s from "../buyer/buyer.module.css";
import m from "./market.module.css";

export default function ProductPage() {
  const { sellerSlug = "", productSlug = "" } = useParams();
  const seller = useQuery({ queryKey: qk.seller(sellerSlug), queryFn: () => api.seller(sellerSlug) });
  const productQ = useQuery({ queryKey: qk.product(sellerSlug, productSlug), queryFn: () => api.product(sellerSlug, productSlug) });
  const loading = seller.isLoading || productQ.isLoading;
  const error = seller.error ?? productQ.error;

  return (
    <AppShell title="Market">
      {loading ? (
        <>
          <LoadingCard label="Loading the product" lines={3} />
          <LoadingCard lines={5} />
        </>
      ) : error || !productQ.data || !seller.data ? (
        <ErrorState error={error ?? new Error("This product is not available.")} onRetry={() => { seller.refetch(); productQ.refetch(); }} />
      ) : (
        <ProductView sellerSlug={sellerSlug} sellerName={seller.data.name} sellerLabel={seller.data.label} product={productQ.data} />
      )}
    </AppShell>
  );
}

function ProductView({ sellerSlug, sellerName, sellerLabel, product }: { sellerSlug: string; sellerName: string; sellerLabel: "sandbox" | "live"; product: PublicProduct }) {
  const navigate = useNavigate();
  const { wallet } = useAuth();
  const [pendingStarter, setPendingStarter] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => api.startNegotiation({ sellerSlug, productSlug: product.slug, buyerAddress: wallet?.address }),
    onSuccess: (neg) => navigate(`/app/negotiations/${neg.id}`, { state: pendingStarter ? { starter: pendingStarter } : undefined }),
  });
  const begin = (starter: string | null) => {
    setPendingStarter(starter);
    start.mutate();
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="body3">{sellerName}</span>
            {sellerLabel === "sandbox" && <StatusTag network="sandbox" label="Sandbox seller" />}
          </>
        }
        title={product.name}
        lede={`Prepaid ${product.termDays}-day agreements or single paid calls, settled in testnet USDC on Arc. You only pay for ${product.billableUnit}.`}
      />

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card title="What you get" subtitle="Capabilities and integrations the seller supports today.">
            <ul className={s.checkList}>
              {product.capabilities.map((c) => (
                <li key={c}>
                  <span className={s.checkIcon} aria-hidden><Check size={16} strokeWidth={2.25} /></span>
                  {c}
                </li>
              ))}
            </ul>
            <div className={s.stackTight}>
              <span className="label" style={{ color: "var(--c-dark-60)" }}>Integrations</span>
              <div className={s.chips}>
                {product.supportedIntegrations.map((i) => (
                  <span key={i} className={s.chip}>{prettyIntegration(i)}</span>
                ))}
              </div>
            </div>
            <hr className={s.divider} />
            <div className={s.stackTight}>
              <span className="label" style={{ color: "var(--c-dark-60)" }}>What counts as one billable {product.unitLabel}</span>
              <p className="body2" style={{ color: "var(--c-dark)" }}>One {product.unitLabel} is {product.billableUnit}. Failed lookups and handoffs are not billed.</p>
            </div>
          </Card>

          <Card title="Published tiers" subtitle="Starting points only. The agent can fit an offer to your volume and budget within the seller's rules." actions={<StatusTag network="illustrative" label="Illustrative list prices" />}>
            <ul className={s.tiers}>
              {product.tiers.map((t) => (
                <li key={t.id} className={s.tier}>
                  <span className="h6">{t.name}</span>
                  <span className={s.tierPrice}>
                    <Money usd={t.prepaidTotalUsd} digits={0} />
                  </span>
                  <span className={s.tierMeta}>
                    {fmtUnits(t.includedUnits)} {product.unitLabel}s at <Money usd={t.unitPriceUsd} /> each
                  </span>
                  <ul className={s.checkList}>
                    {t.includes.map((inc) => (
                      <li key={inc} style={{ fontSize: 13 }}>
                        <span className={s.checkIcon} aria-hidden><Check size={14} strokeWidth={2.25} /></span>
                        {inc}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="body3">{product.refundPolicy}</p>
          </Card>
        </div>

        <div className={`${s.stack} ${s.sticky} ${m.buyFirst}`}>
          <Card title="Negotiate a prepaid deal" subtitle="For committed volume or a better price. Funds sit in escrow, the seller is paid only for usage you sign, and unused balance is refundable.">
            <ActionButton size="lg" fullWidth icon={<MessageSquareText size={16} strokeWidth={2} />} loading={start.isPending && pendingStarter === null} loadingLabel="Opening the chat" onClick={() => begin(null)}>
              Negotiate a prepaid deal
            </ActionButton>
            {product.starters.length > 0 && (
              <div className={s.stackTight}>
                <span className="label" style={{ color: "var(--c-dark-60)" }}>Or start with</span>
                <ul className={s.starters}>
                  {product.starters.map((st) => (
                    <li key={st}>
                      <button type="button" className={s.starter} disabled={start.isPending} onClick={() => begin(st)}>
                        <span>{st}</span>
                        <ArrowUpRight size={16} strokeWidth={2} aria-hidden style={{ flex: "none" }} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {start.isError && <Notice tone="danger">{errorMessage(start.error)}</Notice>}
          </Card>
          <PayPerCallCard sellerSlug={sellerSlug} productSlug={product.slug} />
        </div>
      </div>
    </>
  );
}
