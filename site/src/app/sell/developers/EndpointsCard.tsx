import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Package } from "lucide-react";
import { ActionButton, Card, EmptyState, LoadingCard, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { v1 } from "../v1";
import { currentOrigin } from "./reference";
import d from "./developers.module.css";

type ProductRow = { id: string; slug: string; name: string; active?: boolean; service?: { kind: string; url?: string | null } };

/** Each product's buyer-facing service endpoint, its live docs page, and the agent files generated from it. */
export function EndpointsCard({ sellerSlug }: { sellerSlug: string }) {
  const q = useQuery({ queryKey: ["sell", "developers", "products"], queryFn: () => v1.app.products(), retry: false });
  const origin = currentOrigin();
  return (
    <Card title="Products and endpoints" subtitle="Buyers and their agents call each product at its service endpoint with a deal key. Every product has a live docs page generated from its fields and prices, plus a SKILL.md and OpenAPI file for agents.">
      {q.isPending ? (
        <LoadingCard label="Loading products" />
      ) : q.isError ? (
        <Notice tone="danger">{errorMessage(q.error)}</Notice>
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Package size={20} />} title="No products yet" description="Publish a product and its endpoint and docs page appear here." action={<ActionButton to="/app/sell/start" icon>Add a product</ActionButton>} />
      ) : (
        <ul className={d.products}>
          {(q.data as unknown as ProductRow[]).map((p) => {
            const docs = `/docs/${encodeURIComponent(sellerSlug)}/${encodeURIComponent(p.slug)}`;
            const files = `${origin}/api/public/sellers/${encodeURIComponent(sellerSlug)}/products/${encodeURIComponent(p.slug)}`;
            const endpoint = `${origin}/api/services/${p.slug}/execute`;
            return (
              <li key={p.id} className={d.product}>
                <div className={d.productName}>
                  <strong>{p.name}</strong>
                  <span className={d.linkRow}>
                    <StatusTag tone={p.active === false ? "neutral" : "success"} label={p.active === false ? "Unlisted" : "Listed"} />
                    <Link to={`/app/sell/products/${encodeURIComponent(p.id)}`} className={d.inlineLink}>Prices and rules</Link>
                  </span>
                </div>
                <div className={d.productLinks}>
                  <span className={d.endpoint}>
                    <span className={d.method}>POST</span>
                    <MonoValue value={endpoint} copy label={`${p.name} endpoint`} />
                  </span>
                  {p.service?.kind === "http" && p.service.url && (
                    <span className={d.endpoint}>
                      <span className="body3">Forwards to your service</span>
                      <MonoValue value={p.service.url} short={p.service.url.length > 48} copy label="your service URL" />
                    </span>
                  )}
                  <span className={d.linkRow}>
                    <Link to={docs} className={d.inlineLink}><BookOpen size={13} aria-hidden /> Live docs <span className="sr-only">for {p.name}</span><span aria-hidden className={d.whenSub}>{docs}</span></Link>
                    <a href={`${files}/skill.md`} target="_blank" rel="noreferrer" className={d.inlineLink}>SKILL.md <ExternalLink size={12} aria-hidden /></a>
                    <a href={`${files}/openapi.json`} target="_blank" rel="noreferrer" className={d.inlineLink}>OpenAPI <ExternalLink size={12} aria-hidden /></a>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
