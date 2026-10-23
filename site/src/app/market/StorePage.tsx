/**
 * A seller's store: every listed product on one page and one way in to its deal desk. The desk opens the full
 * negotiation page in store mode (lib/storeChat): each message is routed to the product it is about and that product's
 * agent negotiates within its rules, so one conversation covers everything the seller makes.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { ARC_NETWORK_NAMES, defaultNetwork, unitFor } from "@proteus/domain";
import { AppShell } from "../layouts/AppShell";
import { LoadingCard } from "../ui/Skeleton";
import { ActionButton } from "../ui/ActionButton";
import { Notice } from "../ui/misc";
import { Money } from "../ui/Money";
import { SellerMark, categoryLabel, possessive, useLogoShape } from "../ui/SellerMark";
import { SocialLinks } from "../ui/SocialLinks";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, qk, type PublicProduct, type PublicSeller } from "../lib/api";
import { startStoreChat } from "../lib/storeChat";
import { ErrorState, fmtDate, fmtUnits } from "../buyer/common";
import { AgentBadge } from "./OnArc";
import { decimalsFor } from "./Market";
import d from "./product.module.css";
import s from "./store.module.css";

export default function StorePage() {
  const { sellerSlug = "" } = useParams();
  const seller = useQuery({ queryKey: qk.seller(sellerSlug), queryFn: () => api.seller(sellerSlug) });
  return (
    <AppShell title="Market">
      {seller.isLoading ? (
        <>
          <LoadingCard label="Loading the store" lines={3} />
          <LoadingCard lines={6} />
        </>
      ) : seller.error || !seller.data ? (
        <ErrorState error={seller.error ?? new Error("This store is not available.")} onRetry={() => seller.refetch()} />
      ) : (
        <StoreView seller={seller.data} />
      )}
    </AppShell>
  );
}

const usdValue = (v: string) => Number(v.replace(/[^0-9.]/g, ""));
const lowestUnit = (p: PublicProduct) => p.tiers.map((t) => t.unitPriceUsd).sort((a, b) => usdValue(a) - usdValue(b))[0];

function StoreView({ seller }: { seller: PublicSeller }) {
  const navigate = useNavigate();
  const { wallet } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Opens the full negotiation page in store mode, on the product asked about; it follows the buyer to others.
  const open = async (productSlug: string, starter: string | null) => {
    setError(null);
    try {
      const n = await startStoreChat(seller.slug, productSlug, wallet?.address);
      navigate(`/app/negotiations/${n.id}`, { state: starter ? { starter } : undefined });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const wide = useLogoShape(seller.brand?.logoUrl) === "wide";
  const st = seller.stats;
  const products = seller.products;
  const category = seller.brand?.category;

  return (
    <div className={d.page}>
      <article className={d.doc}>
        <nav className={d.crumbs} aria-label="Breadcrumb">
          <Link to="/app/market">Market</Link>
          <ChevronRight size={13} aria-hidden />
          <span>{seller.name}</span>
        </nav>

        <header className={d.head}>
          <div className={d.sellerRow}>
            {wide ? <SellerMark name={seller.name} brand={seller.brand} variant="wordmark" size="md" /> : <SellerMark name={seller.name} brand={seller.brand} size="md" />}
            {seller.agent && <AgentBadge agent={seller.agent} />}
          </div>
          <h1 className={d.title}>{seller.name}</h1>
          {seller.brand?.tagline && <p className={d.summary}>{seller.brand.tagline}</p>}
          <div className={s.metaLine}>
            {category && <span>{categoryLabel(category)}</span>}
            {seller.brand?.website && (
              <>
                <span className={s.dot}>·</span>
                <a href={seller.brand.website} target="_blank" rel="noreferrer">{new URL(seller.brand.website).hostname}</a>
              </>
            )}
            {seller.brand?.socials && Object.values(seller.brand.socials).some(Boolean) && (
              <>
                <span className={s.dot}>·</span>
                <SocialLinks socials={seller.brand.socials} />
              </>
            )}
            {st && (
              <>
                <span className={s.dot}>·</span>
                <span>On Proteus AI since {fmtDate(st.since)}</span>
              </>
            )}
          </div>
          {st && (
            <div className={s.track}>
              <span><strong className="app-mono">{st.dealsFunded}</strong> {st.dealsFunded === 1 ? "deal" : "deals"} funded</span>
              <span><strong><Money micro={BigInt(st.settled)} digits={2} /></strong> settled to the seller</span>
              <span>Escrow on {ARC_NETWORK_NAMES[defaultNetwork()]}</span>
            </div>
          )}
        </header>

        <section className={d.section} aria-labelledby="h-items">
          <div className={d.h2Row}>
            <h2 id="h-items" className={d.h2}>What {seller.name} makes</h2>
            <span className={d.h2Note}>List prices. The deal desk fits an offer to your quantity within the seller's rules.</span>
          </div>
          <div className={s.items}>
            {products.map((p) => {
              const from = lowestUnit(p);
              return (
                <div key={p.slug} className={s.item}>
                  <div className={s.itemTop}>
                    <h3 className={s.itemName}>{p.name}</h3>
                    {from && <span className={s.itemFrom}><Money usd={from} digits={decimalsFor(from)} /> <span>/ {p.unitLabel}</span></span>}
                  </div>
                  {p.summary && <p className={s.itemSummary}>{p.summary}</p>}
                  {p.capabilities.length > 0 && (
                    <ul className={s.caps}>
                      {p.capabilities.slice(0, 6).map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  )}
                  <table className={s.tiers}>
                    <tbody>
                      {p.tiers.map((t) => (
                        <tr key={t.id}>
                          <td className={s.tierName}>{t.name}</td>
                          <td className={d.num}>{fmtUnits(t.includedUnits)} {unitFor(t.includedUnits, p.unitLabel)}</td>
                          <td className={d.num}><Money usd={t.unitPriceUsd} digits={decimalsFor(t.unitPriceUsd)} /> each</td>
                          <td className={d.num}>{t.prepaidTotalUsd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={s.itemActions}>
                    <button type="button" className={s.ask} onClick={() => open(p.slug, `I'm interested in ${p.name.toLowerCase()}. What can you offer?`)}>Ask the deal desk</button>
                    <Link to={`/app/market/${seller.slug}/${p.slug}`} className={s.details}>Full details</Link>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={d.fine}>Every deal is prepaid in USDC into the escrow contract on {ARC_NETWORK_NAMES[defaultNetwork()]}, not to the seller. The seller is paid for what is delivered, and anything not delivered within the term is refunded to you.</p>
        </section>
      </article>

      <aside className={d.rail} aria-label="Deal desk">
        <StoreRail seller={seller} open={open} />
        {error && <Notice tone="danger">{error}</Notice>}
      </aside>
    </div>
  );
}

/** Same rail as a product page: one way in to the whole store's deal desk. */
function StoreRail({ seller, open }: { seller: PublicSeller; open: (productSlug: string, starter: string | null) => void; }) {
  const products = seller.products;
  const first = products[0];
  const starters = products.slice(0, 3).map((p) => ({ slug: p.slug, text: p.starters?.[0] ?? `What can you offer for ${p.name.toLowerCase()}?` }));
  return (
    <>
      <div className={d.railBlock}>
        <span className={d.railLabel}>Negotiate</span>
        <h2 className={d.railTitle}>A prepaid deal on your terms</h2>
        <p className={d.railText}>One agent for everything {seller.name} makes. Ask about any product, quantity or date; funds are held in escrow until you confirm delivery.</p>
        {first && (
          <ActionButton size="lg" fullWidth icon onClick={() => open(first.slug, null)}>
            Talk to {possessive(seller.name)} agent
          </ActionButton>
        )}
        <ul className={d.starters} aria-label="Open with">
          {starters.map((st) => (
            <li key={st.slug}>
              <button type="button" className={d.starter} onClick={() => open(st.slug, st.text)}>
                <span>{st.text}</span>
                <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={d.railBlock}>
        <span className={d.railLabel}>For agents</span>
        <p className={d.railText}>
          A skill file per product, generated from its fields and rules.{" "}
          {products.map((p, i) => (
            <span key={p.slug}>
              {i > 0 && " · "}
              <a href={`/api/public/sellers/${seller.slug}/products/${p.slug}/skill.md`} target="_blank" rel="noreferrer" className={d.railLink}>{p.name}</a>
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
