import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, CalendarDays, Check, ChevronRight, CircleDollarSign, Landmark, MessagesSquare, PenLine, Server, ShieldCheck, Undo2, Zap } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Notice } from "../ui/misc";
import { SellerMark, categoryLabel, possessive, useLogoShape } from "../ui/SellerMark";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, qk, type PublicProduct, type PublicSeller } from "../lib/api";
import { ErrorState, fmtDate, fmtUnits, prettyIntegration } from "../buyer/common";
import { PayPerCallCard } from "./PayPerCallCard";
import { decimalsFor } from "./Market";
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
        <ProductView seller={seller.data} product={productQ.data} />
      )}
    </AppShell>
  );
}

function ProductView({ seller, product }: { seller: PublicSeller; product: PublicProduct }) {
  const navigate = useNavigate();
  const { wallet } = useAuth();
  const [pendingStarter, setPendingStarter] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => api.startNegotiation({ sellerSlug: seller.slug, productSlug: product.slug, buyerAddress: wallet?.address }),
    onSuccess: (neg) => navigate(`/app/negotiations/${neg.id}`, { state: pendingStarter ? { starter: pendingStarter } : undefined }),
  });
  const begin = (starter: string | null) => {
    setPendingStarter(starter);
    start.mutate();
  };

  const demo = seller.label !== "live";
  const category = product.category ?? seller.brand?.category ?? null;
  const bestUnit = product.tiers.map((t) => t.unitPriceUsd).sort((a, b) => Number(a) - Number(b))[0];
  const st = seller.stats;
  const wide = useLogoShape(seller.brand?.logoUrl) === "wide";

  return (
    <>
      <header className={m.hero}>
        <nav className={m.crumbs} aria-label="Breadcrumb">
          <Link to="/app/market">Market</Link>
          <ChevronRight size={14} aria-hidden />
          <Link to={`/app/market/${seller.slug}`}>{seller.name}</Link>
          <ChevronRight size={14} aria-hidden />
          <span aria-current="page">{product.name}</span>
        </nav>
        <div className={m.heroSeller}>
          {wide ? <SellerMark name={seller.name} brand={seller.brand} variant="wordmark" size="md" /> : <><SellerMark name={seller.name} brand={seller.brand} size="md" /><span className={m.heroSellerName}>{seller.name}</span></>}
          {demo ? <StatusTag network="sandbox" label="Demo seller" /> : <StatusTag network="live" label="Verified seller" icon={<BadgeCheck size={12} strokeWidth={2.25} />} />}
          {category && <span className="body3">{categoryLabel(category)}</span>}
        </div>
        <h1 className={m.heroTitle}>{product.name}</h1>
        <p className={`body1 ${m.heroLede}`}>{product.summary ?? `Prepaid ${product.termDays}-day agreements or single paid calls, settled in USDC on Arc testnet.`}</p>
        <dl className={m.facts}>
          <div className={m.fact}>
            <span className={m.factIcon} aria-hidden><CalendarDays size={16} strokeWidth={2} /></span>
            <span><dt>Term</dt><dd>{product.termDays} days</dd></span>
          </div>
          {bestUnit && (
            <div className={m.fact}>
              <span className={m.factIcon} aria-hidden><CircleDollarSign size={16} strokeWidth={2} /></span>
              <span><dt>Unit price</dt><dd>from <Money usd={bestUnit} digits={decimalsFor(bestUnit)} /> per {product.unitLabel}</dd></span>
            </div>
          )}
          {product.payPerCallUsd && (
            <div className={m.fact}>
              <span className={m.factIcon} aria-hidden><Zap size={16} strokeWidth={2} /></span>
              <span><dt>Pay per call</dt><dd><Money usd={product.payPerCallUsd} digits={decimalsFor(product.payPerCallUsd)} /> per call</dd></span>
            </div>
          )}
          <div className={m.fact}>
            <span className={m.factIcon} aria-hidden><ShieldCheck size={16} strokeWidth={2} /></span>
            <span><dt>Settlement</dt><dd>USDC escrow on Arc testnet</dd></span>
          </div>
          <div className={m.fact}>
            <span className={m.factIcon} aria-hidden><Server size={16} strokeWidth={2} /></span>
            <span><dt>Service</dt><dd>{product.service === "seller-endpoint" ? "Runs on the seller's own endpoint" : "Sample order store"}</dd></span>
          </div>
        </dl>
      </header>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card title="What you get" subtitle="Capabilities and integrations the seller supports today.">
            <ul className={m.capGrid}>
              {product.capabilities.map((c) => (
                <li key={c}>
                  <span className={m.capIcon} aria-hidden><Check size={13} strokeWidth={2.5} /></span>
                  {c}
                </li>
              ))}
            </ul>
            {product.supportedIntegrations.length > 0 && (
              <div className={s.stackTight}>
                <span className="label" style={{ color: "var(--c-dark-60)" }}>Integrations</span>
                <div className={s.chips}>
                  {product.supportedIntegrations.map((i) => (
                    <span key={i} className={s.chip}>{prettyIntegration(i)}</span>
                  ))}
                </div>
              </div>
            )}
            <div className={m.unitBox}>
              <span>What one billable {product.unitLabel} is</span>
              <p>{capitalize(product.billableUnit).replace(/[.\s]+$/, "")}. Failed requests and human handoffs are never billed.</p>
            </div>
          </Card>

          <Card title="Pricing" subtitle="Published tiers are starting points. The seller's agent fits an offer to your volume and budget within rules it cannot cross." actions={<StatusTag network="illustrative" label="List prices" />}>
            <ul className={m.tierRow}>
              {product.tiers.map((t, i) => {
                const best = t.unitPriceUsd === bestUnit && product.tiers.length > 1;
                return (
                  <li key={t.id} className={`${m.tierCard} ${best ? m.tierBest : ""}`}>
                    {best && <span className={m.tierBadge}><StatusTag tone="info" label="Best unit price" /></span>}
                    {!best && i === 0 && product.tiers.length > 1 && <span className={m.tierBadge}><StatusTag tone="neutral" label="Smallest" /></span>}
                    <span className={m.tierName}>{t.name}</span>
                    <span className={m.tierTotal}><Money usd={t.prepaidTotalUsd} digits={0} /></span>
                    <span className={m.tierUnit}><strong>{fmtUnits(t.includedUnits)}</strong> {product.unitLabel}s at <strong><Money usd={t.unitPriceUsd} digits={decimalsFor(t.unitPriceUsd)} /></strong> each</span>
                    {t.includes.length > 0 && (
                      <ul className={m.tierIncl}>
                        {t.includes.map((inc) => (
                          <li key={inc}><Check size={13} strokeWidth={2.5} aria-hidden style={{ color: "var(--c-primary)", flex: "none", marginTop: 3 }} />{inc}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="body3">{product.refundPolicy}{product.maxUnitsPerDeal ? ` Up to ${fmtUnits(product.maxUnitsPerDeal)} ${product.unitLabel}s per deal.` : ""}</p>
          </Card>

          <Card title="How a deal works" subtitle="The agreement controls the money. Nothing moves without both signatures.">
            <ol className={m.timeline}>
              {[
                { icon: <MessagesSquare size={18} strokeWidth={1.9} />, t: "Negotiate", d: "Tell the agent your volume and budget. Every offer comes from the seller's pricing rules." },
                { icon: <PenLine size={18} strokeWidth={1.9} />, t: "Sign terms", d: "You and the seller sign identical terms. The signatures are the contract." },
                { icon: <Landmark size={18} strokeWidth={1.9} />, t: "Fund escrow", d: "Your USDC moves into the escrow contract on Arc, not to the seller." },
                { icon: <Server size={18} strokeWidth={1.9} />, t: "Use the service", d: "Your API key meters each delivered unit with a seller-signed receipt." },
                { icon: <Undo2 size={18} strokeWidth={1.9} />, t: "Settle and refund", d: "You countersign usage, the seller is paid for it, the rest comes back to you." },
              ].map((x, i) => (
                <li key={x.t} className={m.tStep}>
                  <span className={m.tNode}>
                    <span className={m.tIcon} aria-hidden>{x.icon}</span>
                  </span>
                  <span className={m.tBody}>
                    <span className={m.tNum}>Step {i + 1}</span>
                    <span className={m.tTitle}>{x.t}</span>
                    <span className={m.tText}>{x.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title={`About ${seller.name}`} actions={demo ? <StatusTag network="sandbox" label="Demo seller" /> : <StatusTag network="live" label="Verified seller" icon={<BadgeCheck size={12} strokeWidth={2.25} />} />}>
            <div className={m.about}>
              <div className={m.aboutHead}>
                <SellerMark name={seller.name} brand={seller.brand} variant="wordmark" size="xl" />
              </div>
              {seller.brand?.tagline && <p className="body2" style={{ color: "var(--c-dark)" }}>{seller.brand.tagline}</p>}
              <div className={s.row}>
                {seller.brand?.website && (
                  <a href={seller.brand.website} target="_blank" rel="noreferrer" className={m.site}>{new URL(seller.brand.website).hostname} <ArrowUpRight size={13} aria-hidden style={{ verticalAlign: "-2px" }} /></a>
                )}
                {category && <span className="body3">{categoryLabel(category)}</span>}
              </div>
              {st && (
                <dl className={m.aboutStats}>
                  <div><dt>Deals funded</dt><dd>{st.dealsFunded}</dd></div>
                  <div><dt>Settled to seller</dt><dd><Money micro={BigInt(st.settled)} digits={2} /></dd></div>
                  <div><dt>In escrow now</dt><dd><Money micro={BigInt(st.inEscrow)} digits={2} /></dd></div>
                  <div><dt>On PROTEUS since</dt><dd style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>{fmtDate(st.since)}</dd></div>
                </dl>
              )}
              <p className="body3">
                {demo
                  ? "A demo seller seeded by PROTEUS with its own invented brand. Deals on it are real Arc testnet transactions; its service answers are illustrative and nothing counts toward live totals."
                  : "A verified seller. Its owner signed in, published these terms, holds the payout wallet, and its service answers from its own endpoint."}
              </p>
            </div>
          </Card>
        </div>

        <div className={`${s.stack} ${s.sticky} ${m.buyFirst}`}>
          <Card title="Negotiate a prepaid deal" subtitle="For committed volume or a better unit price.">
            <div className={m.negotiate}>
              <ActionButton size="lg" fullWidth icon={<MessagesSquare size={16} strokeWidth={2} />} loading={start.isPending && pendingStarter === null} loadingLabel="Opening the chat" onClick={() => begin(null)}>
                Talk to {possessive(seller.name)} agent
              </ActionButton>
              <ul className={m.negotiatePoints}>
                <li><Check size={14} strokeWidth={2.5} aria-hidden style={{ color: "var(--c-primary)", flex: "none", marginTop: 2 }} />Funds sit in escrow, not with the seller.</li>
                <li><Check size={14} strokeWidth={2.5} aria-hidden style={{ color: "var(--c-primary)", flex: "none", marginTop: 2 }} />Pay only for usage you countersign.</li>
                <li><Check size={14} strokeWidth={2.5} aria-hidden style={{ color: "var(--c-primary)", flex: "none", marginTop: 2 }} />Unused balance refunds after the term.</li>
              </ul>
              {product.starters.length > 0 && (
                <div className={s.stackTight}>
                  <span className="label" style={{ color: "var(--c-dark-60)" }}>Or open with</span>
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
            </div>
          </Card>
          <PayPerCallCard sellerSlug={seller.slug} productSlug={product.slug} service={product.service} unitLabel={product.unitLabel} />
        </div>
      </div>
    </>
  );
}

function capitalize(v: string) {
  return v ? v[0]!.toUpperCase() + v.slice(1) : v;
}
