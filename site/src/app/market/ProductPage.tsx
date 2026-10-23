import { SocialLinks } from "../ui/SocialLinks";
import { useState } from "react";
import { AgentBadge, RatingValue } from "./OnArc";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, BookOpen, Bot, CalendarDays, Check, ChevronRight, CircleDollarSign, Landmark, MessagesSquare, PenLine, Server, ShieldCheck, Undo2, Zap } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { Notice } from "../ui/misc";
import { SellerMark, categoryLabel, possessive, useLogoShape } from "../ui/SellerMark";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, qk, type PublicProduct, type PublicSeller } from "../lib/api";
import { ErrorState, fmtDate, fmtUnits, prettyIntegration } from "../buyer/common";
import { PayPerCallCard } from "./PayPerCallCard";
import { decimalsFor } from "./Market";
import d from "./product.module.css";
import { ARC_NETWORK_NAMES, defaultNetwork, pluralUnit, unitFor } from "@proteus/domain";

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

const STEPS = [
  { icon: MessagesSquare, t: "Negotiate", d: "Tell the agent your volume and budget. Every offer comes from the seller's pricing rules." },
  { icon: PenLine, t: "Sign terms", d: "You and the seller sign identical terms. The signatures are the contract." },
  { icon: Landmark, t: "Fund escrow", d: "Your USDC moves into the escrow contract on Arc, not to the seller." },
  { icon: Server, t: "Use the service", d: "Your API key meters each delivered unit with a seller-signed receipt." },
  { icon: Undo2, t: "Settle and refund", d: "You countersign usage, the seller is paid for it, the rest comes back to you." },
];

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
  const bestUnit = product.tiers.map((t) => t.unitPriceUsd).sort((a, b) => usdValue(a) - usdValue(b))[0];
  const wide = useLogoShape(seller.brand?.logoUrl) === "wide";
  const st = seller.stats;
  const unitDef = product.billableUnit.replace(/[.\s]+$/, "");

  return (
    <div className={d.page}>
      <article className={d.doc}>
        <nav className={d.crumbs} aria-label="Breadcrumb">
          <Link to="/app/market">Market</Link>
          <ChevronRight size={13} aria-hidden />
          <Link to={`/app/market/${seller.slug}`}>{seller.name}</Link>
        </nav>

        <header className={d.head}>
          <div className={d.sellerRow}>
            {wide ? <SellerMark name={seller.name} brand={seller.brand} variant="wordmark" size="sm" /> : <><SellerMark name={seller.name} brand={seller.brand} size="sm" /><span className={d.sellerName}>{seller.name}</span></>}
          {seller.brand?.verified && <span className={d.badgeOk} title="Verified by Proteus AI: identity and endpoint checked by the platform operator"><BadgeCheck size={13} strokeWidth={2.25} aria-hidden /> Verified seller</span>}
          </div>
          <h1 className={d.title}>{product.name}</h1>
          {product.summary && <p className={d.summary}>{product.summary}</p>}
          <ul className={d.meta} aria-label="Key terms">
            <li><CalendarDays size={13} aria-hidden />{product.termDays}-day term</li>
            {bestUnit && <li><CircleDollarSign size={13} aria-hidden />From <Money usd={bestUnit} digits={decimalsFor(bestUnit)} /> per {product.unitLabel}</li>}
            {product.payPerCallUsd && <li><Zap size={13} aria-hidden /><Money usd={product.payPerCallUsd} digits={decimalsFor(product.payPerCallUsd)} /> per call</li>}
            <li><ShieldCheck size={13} aria-hidden />Escrow on {ARC_NETWORK_NAMES[defaultNetwork()]}</li>
            <li><Server size={13} aria-hidden />{product.service === "seller-endpoint" ? "Seller-run endpoint" : product.service === "example" ? "Run by Proteus AI's service agent" : "Sample order store"}</li>
            {category && <li>{categoryLabel(category)}</li>}
            <li><BookOpen size={13} aria-hidden /><Link to={`/docs/${seller.slug}/${product.slug}`} className={d.chipLink}>API reference</Link></li>
          </ul>
        </header>

        <section className={d.section} aria-labelledby="h-what">
          <h2 id="h-what" className={d.h2}>What you get</h2>
          <ul className={d.capList}>
            {product.capabilities.map((c) => (
              <li key={c}><Check size={14} strokeWidth={2.5} aria-hidden />{c}</li>
            ))}
          </ul>
          {product.supportedIntegrations.length > 0 && (
            <p className={d.line}><span className={d.lineKey}>Integrations</span>{product.supportedIntegrations.map(prettyIntegration).join(", ")}</p>
          )}
          <p className={d.callout}>
            <strong>One billable {product.unitLabel}</strong> is {unitDef[0]!.toLowerCase() + unitDef.slice(1)}. Failed requests and human handoffs are never billed.
          </p>
          {product.request && product.request.fields.length > 0 && (
            <div className={d.sendBlock}>
              <span className={d.lineKey}>What to send</span>
              {product.request.intro && <p className={d.sendIntro}>{product.request.intro}</p>}
              <ul className={d.sendList}>
                {product.request.fields.map((fl) => (
                  <li key={fl.key}>
                    <span className={d.sendLabel}>{fl.label}</span>
                    <span className={d.sendMeta}>{fieldTypeLabel(fl.type)}{fl.required ? "" : ", optional"}</span>
                    {fl.hint && <span className={d.sendHint}>{fl.hint}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className={d.section} aria-labelledby="h-pricing">
          <div className={d.h2Row}>
            <h2 id="h-pricing" className={d.h2}>Pricing</h2>
            <span className={d.h2Note}>List prices. The agent fits an offer to your volume within the seller's rules.</span>
          </div>
          <table className={d.table}>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col" className={d.num}>Included</th>
                <th scope="col" className={d.num}>Unit price</th>
                <th scope="col" className={d.num}>Prepaid</th>
                <th scope="col">Includes</th>
              </tr>
            </thead>
            <tbody>
              {product.tiers.map((t) => {
                const best = t.unitPriceUsd === bestUnit && product.tiers.length > 1;
                return (
                  <tr key={t.id}>
                    <td>
                      <span className={d.tierName}>{t.name}</span>
                      {best && <span className={d.tierTag}>Best unit price</span>}
                    </td>
                    <td className={d.num}>{fmtUnits(t.includedUnits)} <span className={d.dim}>{unitFor(t.includedUnits, product.unitLabel)}</span></td>
                    <td className={d.num}><Money usd={t.unitPriceUsd} digits={decimalsFor(t.unitPriceUsd)} /></td>
                    <td className={`${d.num} ${d.strong}`}><Money usd={t.prepaidTotalUsd} digits={0} /></td>
                    <td className={d.includes}>{t.includes.join(", ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={d.fine}>{product.refundPolicy}{product.maxUnitsPerDeal ? ` Up to ${fmtUnits(product.maxUnitsPerDeal)} ${pluralUnit(product.unitLabel)} per deal.` : ""}</p>
        </section>

        <section className={d.section} aria-labelledby="h-how">
          <h2 id="h-how" className={d.h2}>How a deal works</h2>
          <ol className={d.steps}>
            {STEPS.map((x, i) => {
              const Icon = x.icon;
              return (
                <li key={x.t}>
                  <span className={d.stepIcon} aria-hidden><Icon size={15} strokeWidth={1.9} /></span>
                  <span className={d.stepBody}>
                    <span className={d.stepTitle}>{x.t}</span>
                    <span className={d.stepText}>{x.d}</span>
                  </span>
                  <span className={d.stepNum}>{String(i + 1).padStart(2, "0")}</span>
                </li>
              );
            })}
          </ol>
          <p className={d.fine}>The agreement controls the money. Nothing moves without both signatures.</p>
        </section>

        <section className={d.section} aria-labelledby="h-seller">
          <h2 id="h-seller" className={d.h2}>About {seller.name}</h2>
          <div className={d.sellerAbout}>
            <SellerMark name={seller.name} brand={seller.brand} variant="wordmark" size="lg" />
            {seller.brand?.tagline && <p className={d.tagline}>{seller.brand.tagline}</p>}
            <dl className={d.kv}>
              {category && <><dt>Category</dt><dd>{categoryLabel(category)}</dd></>}
              {seller.brand?.website && <><dt>Website</dt><dd><a href={seller.brand.website} target="_blank" rel="noreferrer" className={d.link}>{new URL(seller.brand.website).hostname} <ArrowUpRight size={12} aria-hidden /></a></dd></>}
              {seller.brand?.socials && Object.values(seller.brand.socials).some(Boolean) && <><dt>Social</dt><dd><SocialLinks socials={seller.brand.socials} /></dd></>}
              {st && (
                <>
                  <dt>Deals funded</dt><dd className="app-mono">{st.dealsFunded}</dd>
                  <dt>Settled to seller</dt><dd><Money micro={BigInt(st.settled)} digits={2} /></dd>
                  <dt>In escrow now</dt><dd><Money micro={BigInt(st.inEscrow)} digits={2} /></dd>
                  <dt>On Proteus AI since</dt><dd>{fmtDate(st.since)}</dd>
                  {seller.agent && (
                    <>
                      <dt>On Arc</dt><dd><AgentBadge agent={seller.agent} /></dd>
                      <dt>Rating</dt><dd><RatingValue ratings={st.ratings} /></dd>
                    </>
                  )}
                </>
              )}
            </dl>
            <p className={d.fine}>
              {demo
                ? `An example seller, modeled on a real customer segment, with Proteus AI's own brand. Deals on it are real transactions on ${ARC_NETWORK_NAMES[defaultNetwork()]}. Its service work is done by Proteus AI's agent on the model named in each receipt, from exactly what you send; it never counts toward live totals.`
                : "The owner signed in, published these terms and holds the payout wallet. The service answers from the seller's own endpoint."}
            </p>
          </div>
        </section>
      </article>

      <aside className={d.rail} aria-label="Buy">
        <div className={d.railBlock}>
          <span className={d.railLabel}>Negotiate</span>
          <h2 className={d.railTitle}>A prepaid deal on your terms</h2>
          <p className={d.railText}>Committed volume, a better unit price, funds held in escrow until you countersign usage.</p>
          <ActionButton size="lg" fullWidth icon loading={start.isPending && pendingStarter === null} loadingLabel="Opening the chat" onClick={() => begin(null)}>
            Talk to {possessive(seller.name)} agent
          </ActionButton>
          {product.starters.length > 0 && (
            <ul className={d.starters} aria-label="Open with">
              {product.starters.map((st) => (
                <li key={st}>
                  <button type="button" className={d.starter} disabled={start.isPending} onClick={() => begin(st)}>
                    <span>{st}</span>
                    <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {start.isError && <Notice tone="danger">{errorMessage(start.error)}</Notice>}
        </div>
        <div className={d.railBlock}>
          <PayPerCallCard sellerSlug={seller.slug} productSlug={product.slug} service={product.service} request={product.request} unitLabel={product.unitLabel} bare />
        </div>
        <div className={d.railBlock}>
          <span className={d.railLabel}>For agents</span>
          <p className={d.railText}>A skill file generated from this service's fields and rules. <a href={`/api/public/sellers/${seller.slug}/products/${product.slug}/skill.md`} target="_blank" rel="noreferrer" className={d.railLink}><Bot size={13} aria-hidden /> SKILL.md</a> · <Link to={`/docs/${seller.slug}/${product.slug}`} className={d.railLink}>Reference</Link></p>
        </div>
      </aside>
    </div>
  );
}

function fieldTypeLabel(t: string): string {
  return t === "file" ? "File" : t === "number" ? "Number" : t === "textarea" ? "Text" : "Short text";
}

/** Display amounts arrive as "$12.5" or "$1,050.00"; compare them as numbers. */
const usdValue = (v: string) => Number(v.replace(/[^0-9.]/g, ""));
