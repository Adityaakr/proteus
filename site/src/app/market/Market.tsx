import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Store } from "lucide-react";
import { motion } from "framer-motion";
import { T_DEFAULT } from "../../lib/motion";
import { AppShell } from "../layouts/AppShell";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { api, qk, type MarketItem } from "../lib/api";
import { ErrorState, PageHeader } from "../buyer/common";
import m from "./market.module.css";

export default function Market() {
  const { sellerSlug } = useParams();
  const q = useQuery({ queryKey: qk.market, queryFn: api.market });
  const items = (q.data ?? []).filter((i) => !sellerSlug || i.sellerSlug === sellerSlug);
  return (
    <AppShell title="Market">
      <PageHeader title="Market" lede="AI services you can buy on negotiated, escrowed terms or pay for per call. List prices are starting points; the seller's agent can fit an offer to you." />
      {q.isLoading ? (
        <div className={m.grid}>
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="We could not load the market" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Store size={20} strokeWidth={1.75} />} title="No products listed yet" description={sellerSlug ? "This seller has no published products." : "Sellers appear here once they publish a product."} />
      ) : (
        <ul className={m.grid}>
          {items.map((it, i) => (
            <motion.li key={`${it.sellerSlug}/${it.productSlug}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...T_DEFAULT, delay: i * 0.04 }}>
              <ProductTile it={it} />
            </motion.li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function ProductTile({ it }: { it: MarketItem }) {
  return (
    <Link to={`/app/market/${it.sellerSlug}/${it.productSlug}`} className={m.tile}>
      <span className={m.tileTop}>
        <span className="body3">{it.sellerName}</span>
        {it.sellerLabel === "sandbox" && <StatusTag network="sandbox" label="Demo seller" />}
      </span>
      <span className={m.tileName}>{it.name}</span>
      <span className={m.tileFacts}>
        <span>From <strong><Money usd={it.startingTierUsd} digits={0} /></strong> prepaid</span>
        {it.perCallUsd && <span><strong><Money usd={it.perCallUsd} digits={it.perCallUsd.split(".")[1]?.length && it.perCallUsd.split(".")[1]!.length > 2 ? 4 : 2} /></strong> per call</span>}
      </span>
      <span className={m.tileCta}>View product <ArrowRight size={14} strokeWidth={2} aria-hidden /></span>
    </Link>
  );
}
