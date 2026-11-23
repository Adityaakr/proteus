import { useDeferredValue, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { filterBySearch } from "@proteus/domain";
import { ActionButton, Card, EmptyState, Money, StatusTag } from "../kit";
import { Plus, Sparkles } from "lucide-react";
import { FilterChips, NoMatches, SearchBar } from "../../ui/SearchBar";
import { categoryLabel } from "../../ui/SellerMark";
import { useSearchParam, useSearchParamOf } from "../../lib/useSearchParam";
import type { ProductWithPrivate } from "../types";
import { SELL } from "../paths";
import { useProducts } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { pct, units } from "../format";
import { SellerOnlyTag } from "../parts/SellerOnly";
import s from "../seller.module.css";

const LISTING = ["all", "listed", "hidden"] as const;
type Listing = (typeof LISTING)[number];

/** What the search reads on a product: its name, slug, category, summary and unit. */
export const productSearchFields = (p: ProductWithPrivate) => [p.name, p.slug, p.category, categoryLabel(p.category), p.summary, p.billableUnit, p.unitLabel, p.capabilities];

/** The products shown for a search, a listing filter and a category ("" for all), in catalogue order. */
export function filterProducts(products: ProductWithPrivate[], q: string, listing: Listing, category: string): ProductWithPrivate[] {
  const listed = (p: ProductWithPrivate) => p.active !== false;
  return filterBySearch(products, q, productSearchFields).filter((p) => (listing === "all" || (listing === "listed") === listed(p)) && (!category || p.category === category));
}

export default function Products() {
  const q = useProducts();
  return (
    <div className={s.page}>
      <PageHeader description="What buyers can negotiate for, and the private floor your agent prices against." actions={<><ActionButton variant="secondary" size="sm" to={`${SELL}/create`} iconLeft={<Sparkles size={14} />}>Import from my website</ActionButton><ActionButton variant="secondary" size="sm" to={`${SELL}/start`} iconLeft={<Plus size={14} />}>New product</ActionButton></>} />
      <QueryView q={q} label="products">
        {(products) =>
          products.length === 0 ? (
            <EmptyState icon={<Package size={20} />} title="No products yet" description="Publish a product to start negotiating. One screen: public tiers for buyers and the private floor your agent prices against." action={<ActionButton to={`${SELL}/start`} icon>Start selling</ActionButton>} />
          ) : (
            <ProductList products={products} />
          )
        }
      </QueryView>
    </div>
  );
}

function ProductList({ products }: { products: ProductWithPrivate[] }) {
  const [query, setQuery] = useSearchParam("q");
  const [listing, setListing] = useSearchParamOf("listing", LISTING, "all");
  const [category, setCategory] = useSearchParam("category");
  const deferred = useDeferredValue(query);
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))), [products]);
  const hidden = products.filter((p) => p.active === false).length;
  const shown = useMemo(() => filterProducts(products, deferred, listing, category), [products, deferred, listing, category]);
  const filtered = listing !== "all" || Boolean(category);
  const clear = () => { setQuery(""); setListing("all"); setCategory(""); };
  // A short catalogue reads at a glance; the bar appears once there is something to look for.
  const searchable = products.length > 5 || filtered || Boolean(query);
  return (
    <div className={s.stack}>
      {searchable && (
        <SearchBar
          value={query}
          onChange={setQuery}
          label="Search products"
          placeholder={`Search ${products.length} products by name, category or description`}
          shown={shown.length}
          total={products.length}
          noun="products"
          filters={
            (hidden > 0 || categories.length > 1) && (
              <div className={s.row} style={{ gap: 8 }}>
                {hidden > 0 && <FilterChips label="Listing" value={listing} onChange={setListing} options={[{ value: "all", label: "All" }, { value: "listed", label: "Listed", count: products.length - hidden }, { value: "hidden", label: "Hidden from market", count: hidden }]} />}
                {categories.length > 1 && <FilterChips label="Category" value={category} onChange={setCategory} options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: categoryLabel(c), count: products.filter((p) => p.category === c).length }))]} />}
              </div>
            )
          }
        />
      )}
      {shown.length === 0 ? <NoMatches query={query} noun="products" filtered={filtered} onClear={clear} /> : shown.map((p) => <ProductRow key={p.id} p={p} />)}
    </div>
  );
}

function ProductRow({ p }: { p: ProductWithPrivate }) {
  const tiers = p.tiers;
  const minPrice = tiers.reduce((m, t) => (BigInt(t.unitPrice.num) / BigInt(t.unitPrice.den) < m ? BigInt(t.unitPrice.num) / BigInt(t.unitPrice.den) : m), BigInt(tiers[0]?.unitPrice.num ?? 0));
  return (
    <Link to={`/app/sell/products/${encodeURIComponent(p.id)}`} aria-label={`Open ${p.name}`}>
      <Card
        title={p.name}
        subtitle={p.billableUnit}
        actions={
          <span className={s.row}>
            {p.active === false ? <StatusTag tone="neutral" label="Hidden from market" /> : <StatusTag tone="success" label="Listed" />}
            <span className="body3">{tiers.length} public tiers</span>
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
}
