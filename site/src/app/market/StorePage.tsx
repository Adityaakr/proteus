/**
 * A seller's store: every listed product on one page and one deal desk for all of them. Each message goes to the
 * product it is about (POST /public/sellers/:slug/route), and that product's agent negotiates within that product's
 * rules; it also knows the rest of the catalog, so it can point the buyer elsewhere. Offers open the full negotiation.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { ARC_NETWORK_NAMES, defaultNetwork, unitFor } from "@proteus/domain";
import { AppShell } from "../layouts/AppShell";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { SellerMark, categoryLabel, possessive, useLogoShape } from "../ui/SellerMark";
import { SocialLinks } from "../ui/SocialLinks";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, qk, type Offer, type PublicProduct, type PublicSeller } from "../lib/api";
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
  const [ask, setAsk] = useState<{ text: string; n: number } | null>(null);
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
                    <button type="button" className={s.ask} onClick={() => setAsk({ text: `I'm interested in ${p.name.toLowerCase()}. What can you offer?`, n: Date.now() })}>Ask the deal desk</button>
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
        <StoreDesk seller={seller} ask={ask} />
      </aside>
    </div>
  );
}

type Entry = { role: "buyer" | "agent" | "topic"; text: string };

function StoreDesk({ seller, ask }: { seller: PublicSeller; ask: { text: string; n: number } | null }) {
  const navigate = useNavigate();
  const { wallet } = useAuth();
  const [log, setLog] = useState<Entry[]>([]);
  const [neg, setNeg] = useState<{ id: string; productSlug: string; productName: string } | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const products = seller.products;
  const unitOf = (slug?: string) => products.find((p) => p.slug === slug)?.unitLabel ?? "unit";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log.length, busy]);

  useEffect(() => {
    if (ask) void send(ask.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.n]);

  const overview = () =>
    `${seller.name} makes ${products.map((p) => {
      const from = lowestUnit(p);
      return `${p.name.toLowerCase()}${from ? ` (from ${from} per ${p.unitLabel})` : ""}`;
    }).join(", ")}. Tell me what you need, how many and by when, and I will put together an offer.`;

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    setBusy(true);
    setLog((l) => [...l, { role: "buyer", text: t }]);
    setDraft("");
    try {
      const r = await api.routeSeller(seller.slug, t, neg?.productSlug);
      if (!r.matched && !neg) {
        setLog((l) => [...l, { role: "agent", text: overview() }]);
        return;
      }
      let n = neg;
      if (!n || n.productSlug !== r.productSlug) {
        const started = await api.startNegotiation({ sellerSlug: seller.slug, productSlug: r.productSlug, buyerAddress: wallet?.address });
        n = { id: started.id, productSlug: r.productSlug, productName: r.productName };
        setNeg(n);
        setOffers([]);
        setLog((l) => [...l, { role: "topic", text: `${neg ? "Now on" : "On"} ${r.productName}` }]);
      }
      const v = await api.sendMessage(n.id, t);
      const reply = [...v.turns].reverse().find((x) => x.role === "agent")?.content;
      if (reply) setLog((l) => [...l, { role: "agent", text: reply }]);
      setOffers(v.offers.filter((o) => o.status !== "rejected"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const starters = products.slice(0, 3).map((p) => `How much for ${p.name.toLowerCase()}?`);

  return (
    <div className={d.railBlock}>
      <span className={d.railLabel}>Deal desk</span>
      <h2 className={d.railTitle}>Talk to {possessive(seller.name)} agent</h2>
      <p className={d.railText}>One conversation for everything {seller.name} makes. Ask about any product, quantity or date; offers come from the seller's own pricing rules.</p>
      <div className={s.desk}>
        {log.length > 0 && (
          <div className={s.log} ref={scroller} aria-live="polite">
            {log.map((m, i) =>
              m.role === "topic" ? (
                <span key={i} className={s.topic}>{m.text}</span>
              ) : (
                <p key={i} className={`${s.msg} ${m.role === "buyer" ? s.buyer : s.agent}`}>{m.text}</p>
              ),
            )}
            {busy && <p className={`${s.msg} ${s.agent}`}>…</p>}
          </div>
        )}
        {log.length === 0 && (
          <ul className={d.starters} aria-label="Open with">
            {starters.map((q) => (
              <li key={q}>
                <button type="button" className={d.starter} disabled={busy} onClick={() => send(q)}>{q}</button>
              </li>
            ))}
          </ul>
        )}
        {offers.length > 0 && neg && (
          <div className={s.offers} aria-label="Offers">
            {offers.slice(0, 3).map((o) => (
              <div key={o.candidateId} className={s.offer}>
                <span>
                  <strong>{fmtUnits(o.units)} {unitFor(o.units, unitOf(neg.productSlug))}</strong> <span className={s.offerMeta}>· {o.prepaidTotalUsd}{o.status === "approval_required" ? " · needs seller approval" : ""}</span>
                </span>
                <button type="button" className={s.ask} onClick={() => navigate(`/app/negotiations/${neg.id}`)}>Review</button>
              </div>
            ))}
          </div>
        )}
        {error && <p className={s.error}>{error}</p>}
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
          <input className={s.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What do you need, how many, by when?" aria-label={`Message ${possessive(seller.name)} agent`} maxLength={4000} />
          <button type="submit" className={s.send} disabled={!draft.trim() || busy}>Send</button>
        </form>
      </div>
    </div>
  );
}
