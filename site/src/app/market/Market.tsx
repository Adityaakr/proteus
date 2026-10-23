import { SocialLinks } from "../ui/SocialLinks";
import { defaultNetwork } from "@proteus/domain";
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

const CATEGORY_ORDER = ["support", "voice", "infra", "devtools", "treasury", "payables", "vendors", "operations", "compliance", "logistics", "merch", "data", "legal", "risk", "media", "finance", "health", "other"];

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

      {sellers.some((s) => s.label !== "live") && <MarketNote sellers={q.data ?? []} />}
      {q.isLoading ? (
        <div className={m.sellerList}>
          <LoadingCard lines={4} />
          <LoadingCard lines={4} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="We could not load the market" />
      ) : sellers.length === 0 ? (
        <EmptyState icon={<Store size={20} strokeWidth={1.75} />} title={deferred || cat ? "Nothing matches" : "No sellers listed yet"} description={deferred || cat ? "Try another word or clear the category." : "Sellers appear here once they publish a product."} />
      ) : (
        <div className={m.sellerList}>
          {sellers.map((s, i) => <SellerCard key={s.slug} s={s} i={i} />)}
        </div>
      )}
    </AppShell>
  );
}

/**
 * Who is real and who is an example. On mainnet a real business sells under its own name from its own wallet and is
 * registered on Arc; on testnet every seller is an example or a demo, whatever its label.
 */
function MarketNote({ sellers }: { sellers: MarketSeller[] }) {
  const real = defaultNetwork() === "mainnet" ? sellers.filter((s) => s.label === "live" && s.agent).map((s) => s.name) : [];
  const names = real.length > 1 ? `${real.slice(0, -1).join(", ")} and ${real.at(-1)}` : real[0];
  return (
    <p className={m.note}>
      {names ? (
        <>
          {names} {real.length > 1 ? "are real businesses" : "is a real business"} selling under {real.length > 1 ? "their" : "its"} own name: {real.length > 1 ? "each" : "it"} registered its agent on Arc from its own wallet and is paid directly into it. The other sellers are examples run by Proteus AI, modeled on the segments the tools in our comparison serve; their service work is done by Proteus AI's agent from exactly what you send. Every deal is a real USDC transaction on Arc mainnet.
        </>
      ) : (
        <>Most sellers here are examples run by Proteus AI, modeled on the segments the tools in our comparison serve. Their service work is done by Proteus AI's agent from exactly what you send, and a demo seller that says so records deliveries without shipping anything. Every deal on any of them is a real Arc transaction.</>
      )}
    </p>
  );
}

function SellerCard({ s, i }: { s: MarketSeller; i: number }) {
  const st = s.stats;
  const settled = st ? BigInt(st.settled) : 0n;
  const held = st ? BigInt(st.inEscrow) : 0n;
  const wide = useLogoShape(s.brand.logoUrl) === "wide";
  const hasTrack = Boolean(st && (st.dealsFunded > 0 || settled > 0n || held > 0n));
  return (
    <motion.article className={`${m.seller} ${s.products.length === 1 ? m.sellerHalf : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...T_DEFAULT, delay: Math.min(i, 8) * 0.04 }} aria-label={s.name}>
      <header className={m.sellerHead}>
        {!wide && <SellerMark name={s.name} brand={s.brand} size="sm" />}
        <div className={m.sellerId}>
          <div className={m.sellerName}>
            <Link to={`/app/market/${s.slug}`} className={m.sellerLink}>{wide ? <SellerMark name={s.name} brand={s.brand} variant="wordmark" size="md" /> : s.name}</Link>
            {s.brand.verified && <span className={m.verified} title="Verified by Proteus AI: identity and endpoint checked by the platform operator"><BadgeCheck size={14} strokeWidth={2.25} aria-hidden />Verified</span>}
            {s.agent && <AgentBadge agent={s.agent} />}
          </div>
          <div className={m.sellerMeta}>
            {s.brand.category && <span>{categoryLabel(s.brand.category)}</span>}
            {s.brand.website && <a href={s.brand.website} target="_blank" rel="noreferrer" className={m.site}>{new URL(s.brand.website).hostname}</a>}
            <SocialLinks socials={s.brand.socials} />
            {st && <span>Since {fmtDate(st.since)}</span>}
          </div>
        </div>
        {st && (
          <div className={m.track}>
            {hasTrack ? (
              <>
                <span><strong className="app-mono">{st.dealsFunded}</strong> {st.dealsFunded === 1 ? "deal" : "deals"}</span>
                <span><strong><Money micro={settled} digits={2} /></strong> settled</span>
                <span><strong><Money micro={held} digits={2} /></strong> in escrow</span>
                {s.agent && <span><RatingValue ratings={st.ratings} /></span>}
              </>
            ) : (
              <span>No deals yet</span>
            )}
          </div>
        )}
      </header>
      {s.brand.tagline && <p className={m.tagline}>{s.brand.tagline}</p>}
      <ul className={m.products}>
        {s.products.map((p) => <ProductCard key={p.slug} seller={s.slug} p={p} />)}
      </ul>
    </motion.article>
  );
}

function ProductCard({ seller, p }: { seller: string; p: MarketSellerProduct }) {
  const starting = p.startingTierUsd ? Number(p.startingTierUsd.replace(/[^0-9.]/g, "")) : 0;
  const startingDigits = Number.isInteger(starting) ? 0 : 2;
  return (
    <li>
      <Link to={`/app/market/${seller}/${p.slug}`} className={m.product}>
        <span className={m.productTop}>
          <span className={m.productName}>{p.name}</span>
          <ArrowRight size={15} strokeWidth={2} aria-hidden className={m.productArrow} />
        </span>
        {p.summary && <span className={m.productSummary}>{p.summary}</span>}
        <span className={m.productFoot}>
          {p.bestUnitPriceUsd && (
            <span className={m.productPrice}>
              <Money usd={p.bestUnitPriceUsd} digits={decimalsFor(p.bestUnitPriceUsd)} />
              <span className={m.factUnit}>/ {p.unitLabel}</span>
            </span>
          )}
          <span className={m.productTerms}>
            {p.startingTierUsd && <span>From <Money usd={p.startingTierUsd} digits={startingDigits} /> prepaid</span>}
            {p.perCallUsd && <span><Money usd={p.perCallUsd} digits={decimalsFor(p.perCallUsd)} /> per call</span>}
            {p.termDays !== 30 && <span>{p.termDays}-day term</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function decimalsFor(usd: string): number {
  const frac = usd.split(".")[1] ?? "";
  const trimmed = frac.replace(/0+$/, "");
  return trimmed.length > 2 ? Math.min(trimmed.length, 4) : 2;
}
