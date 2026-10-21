import { useDeferredValue, useMemo, useState } from "react";
import { AgentBadge, RatingValue } from "./OnArc";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Search, Store } from "lucide-react";
import { motion } from "framer-motion";
import { T_DEFAULT } from "../../lib/motion";
import { AppShell } from "../layouts/AppShell";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { SellerMark, categoryLabel, useLogoShape } from "../ui/SellerMark";
import { api, qk, type MarketSeller, type MarketSellerProduct } from "../lib/api";
import { ErrorState, PageHeader, fmtDate } from "../buyer/common";
import m from "./market.module.css";

const CATEGORY_ORDER = ["support", "voice", "infra", "devtools", "treasury", "payables", "vendors", "operations", "compliance", "logistics", "data", "legal", "risk", "media", "finance", "health", "other"];

export default function Market() {
  const { sellerSlug } = useParams();
  const q = useQuery({ queryKey: qk.marketSellers, queryFn: api.marketSellers });
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const sellers = useMemo(() => {
    const all = (q.data ?? []).filter((s) => !sellerSlug || s.slug === sellerSlug);
    return all
      .map((s) => ({
        ...s,
        products: s.products.filter((p) => {
          const c = p.category ?? s.brand.category ?? "other";
          if (cat && c !== cat) return false;
          if (!deferred) return true;
          const hay = [s.name, s.brand.tagline, p.name, p.summary, ...p.capabilities].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(deferred);
        }),
      }))
      .filter((s) => s.products.length > 0);
  }, [q.data, sellerSlug, cat, deferred]);

  const categories = useMemo(() => {
    const present = new Set<string>();
    for (const s of q.data ?? []) for (const p of s.products) present.add(p.category ?? s.brand.category ?? "other");
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [q.data]);

  const productCount = (q.data ?? []).reduce((n, s) => n + s.products.length, 0);

  return (
    <AppShell title="Market">
      <PageHeader
        title="Market"
        lede="AI services from businesses that publish their terms. Negotiate an escrowed deal with the seller's agent, or pay per call. Every seller runs its own service and is paid only for delivered, countersigned usage."
      />

      <div className={m.toolbar} role="search">
        <label className={m.search}>
          <Search size={16} strokeWidth={2} aria-hidden />
          <input type="search" placeholder={productCount ? `Search ${productCount} services` : "Search services"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the market" />
        </label>
        <div className={m.cats} role="group" aria-label="Category">
          <button type="button" className={`${m.cat} ${cat === null ? m.catOn : ""}`} onClick={() => setCat(null)} aria-pressed={cat === null}>All</button>
          {categories.map((c) => (
            <button key={c} type="button" className={`${m.cat} ${cat === c ? m.catOn : ""}`} onClick={() => setCat(cat === c ? null : c)} aria-pressed={cat === c}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {sellers.some((s) => s.label !== "live") && (
        <p className={m.note}>
          Lumen Voice runs on its own endpoint. The other sellers are examples modeled on the segments the tools in our comparison serve; they carry Proteus AI's own marks, and their service work is done by Proteus AI's agent from exactly what you send. Every deal on any of them is a real Arc testnet transaction.
        </p>
      )}
      {q.isLoading ? (
        <div className={m.sellerGrid}>
          <LoadingCard lines={4} />
          <LoadingCard lines={4} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="We could not load the market" />
      ) : sellers.length === 0 ? (
        <EmptyState icon={<Store size={20} strokeWidth={1.75} />} title={deferred || cat ? "Nothing matches" : "No sellers listed yet"} description={deferred || cat ? "Try another word or clear the category." : "Sellers appear here once they publish a product."} />
      ) : (
        <div className={m.sellerGrid}>
          {sellers.map((s, i) => <SellerCard key={s.slug} s={s} i={i} />)}
        </div>
      )}
    </AppShell>
  );
}

function SellerCard({ s, i }: { s: MarketSeller; i: number }) {
  const st = s.stats;
  const settled = st ? BigInt(st.settled) : 0n;
  const held = st ? BigInt(st.inEscrow) : 0n;
  const wide = useLogoShape(s.brand.logoUrl) === "wide";
  return (
    <motion.article className={m.seller} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...T_DEFAULT, delay: Math.min(i, 8) * 0.04 }} aria-label={s.name}>
      <header className={m.sellerHead}>
        {!wide && <SellerMark name={s.name} brand={s.brand} size="md" />}
        <div className={m.sellerId}>
          <div className={m.sellerName}>
            <Link to={`/app/market/${s.slug}`} className={m.sellerLink}>{wide ? <SellerMark name={s.name} brand={s.brand} variant="wordmark" size="md" /> : s.name}</Link>
            {s.agent && <AgentBadge agent={s.agent} />}
            {s.brand.verified && <span className={m.badgeOk} title="Verified by Proteus AI: identity and endpoint checked by the platform operator"><BadgeCheck size={13} strokeWidth={2.25} aria-hidden /> Verified seller</span>}
          </div>
          <div className={m.sellerMeta}>
            {s.brand.category && <span>{categoryLabel(s.brand.category)}</span>}
            {s.brand.website && (
              <a href={s.brand.website} target="_blank" rel="noreferrer" className={m.site}>{new URL(s.brand.website).hostname}</a>
            )}
            {st && <span>Since {fmtDate(st.since)}</span>}
          </div>
        </div>
      </header>
      {s.brand.tagline && <p className={m.tagline}>{s.brand.tagline}</p>}
      {st && (
        <dl className={m.stats}>
          <div><dt>Deals funded</dt><dd className="app-mono">{st.dealsFunded}</dd></div>
          <div><dt>Settled</dt><dd><Money micro={settled} digits={2} /></dd></div>
          <div><dt>In escrow</dt><dd><Money micro={held} digits={2} /></dd></div>
          {s.agent && <div><dt>Rating</dt><dd><RatingValue ratings={st.ratings} /></dd></div>}
        </dl>
      )}
      <ul className={m.products}>
        {s.products.map((p) => <ProductRow key={p.slug} seller={s.slug} p={p} />)}
      </ul>
    </motion.article>
  );
}

function ProductRow({ seller, p }: { seller: string; p: MarketSellerProduct }) {
  return (
    <li>
      <Link to={`/app/market/${seller}/${p.slug}`} className={m.product}>
        <span className={m.productMain}>
          <span className={m.productName}>{p.name}</span>
          {p.summary && <span className={m.productSummary}>{p.summary}</span>}
          <dl className={m.productFacts}>
            {p.bestUnitPriceUsd && <div><dt>Unit price</dt><dd><Money usd={p.bestUnitPriceUsd} digits={decimalsFor(p.bestUnitPriceUsd)} /><span className={m.factUnit}> / {p.unitLabel}</span></dd></div>}
            {p.startingTierUsd && <div><dt>Prepaid from</dt><dd><Money usd={p.startingTierUsd} digits={Number(p.startingTierUsd.replace(/[^0-9.]/g, "")) < 1 ? 2 : 0} /></dd></div>}
            {p.perCallUsd && <div><dt>Per call</dt><dd><Money usd={p.perCallUsd} digits={decimalsFor(p.perCallUsd)} /></dd></div>}
            <div><dt>Term</dt><dd>{p.termDays} days</dd></div>
          </dl>
        </span>
        <ArrowRight size={16} strokeWidth={2} aria-hidden className={m.productArrow} />
      </Link>
    </li>
  );
}

export function decimalsFor(usd: string): number {
  const frac = usd.split(".")[1] ?? "";
  const trimmed = frac.replace(/0+$/, "");
  return trimmed.length > 2 ? Math.min(trimmed.length, 4) : 2;
}
