/**
 * Developers: everything a seller's own systems and website need. API keys, the webhook, each product's endpoint and
 * docs, catalog sync, the website embed, and the signer and on-chain identity, plus a seller API quickstart.
 */
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { LoadingCard, Notice, StatusTag } from "../../seller/kit";
import { PageHeader } from "../../seller/parts/PageHeader";
import { CatalogSyncCard } from "../../seller/parts/CatalogSyncCard";
import { errorMessage } from "../../seller/transport";
import { useMe } from "../hooks";
import { v1 } from "../v1";
import { ApiKeysCard, DEVELOPERS_KEY } from "../developers/ApiKeysCard";
import { WebhooksCard } from "../developers/WebhooksCard";
import { EndpointsCard } from "../developers/EndpointsCard";
import { EmbedCard } from "../developers/EmbedCard";
import { AgentIdentityCard, SignerCard } from "../developers/IdentityCards";
import { Quickstart } from "../developers/Quickstart";
import { DEVELOPERS_SECTIONS, currentOrigin } from "../developers/reference";
import s from "../sell.module.css";
import d from "../developers/developers.module.css";

type SectionId = (typeof DEVELOPERS_SECTIONS)[number]["id"];

const LEDES: Record<SectionId, string> = {
  keys: "Authenticate your own backend against the seller API. Test keys work with testnet data, live keys with mainnet data.",
  webhooks: "Get deal events pushed to your server as they happen, signed so you can trust them.",
  endpoints: "Where buyers and agents call each product, and the docs page they read first.",
  "catalog-sync": "Let your own endpoint keep stock, cost and order rules current.",
  embed: "Put your deal agent on your own website.",
  signer: "The key that signs terms and deliveries for you, and your agent's identity on Arc.",
  quickstart: "Call the seller API with curl or TypeScript, or press Send to try it right here. The sandbox key is already loaded: demo data, and writes are dry runs.",
};

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const label = DEVELOPERS_SECTIONS.find((x) => x.id === id)!.label;
  return (
    <section id={id} className={d.section} aria-labelledby={`h-${id}`}>
      <div className={d.sectionHead}>
        <h2 id={`h-${id}`} className={d.sectionTitle}>{label}</h2>
        <p className={d.sectionLede}>{LEDES[id]}</p>
      </div>
      {children}
    </section>
  );
}

export default function Developers() {
  const { me } = useMe();
  const { hash } = useLocation();
  const sandbox = me?.org?.label === "sandbox";
  const q = useQuery({ queryKey: DEVELOPERS_KEY, queryFn: () => v1.app.developers(), retry: false, enabled: Boolean(me?.org) && !sandbox });

  // Deep links such as /app/sell/developers#webhooks (from the "Moved to Developers" pointer) land on their section.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
  }, [hash, q.isSuccess]);

  const apiBase = q.data?.apiBase ?? `${currentOrigin()}/api/v1/seller`;
  const env = q.data?.env ?? "live";

  const sections: Record<SectionId, ReactNode> = {
    keys: sandbox ? (
      <Notice tone="info">API keys belong to your own seller account, not the shared example seller.</Notice>
    ) : q.isPending ? (
      <LoadingCard label="Loading API keys" />
    ) : q.isError ? (
      <Notice tone="danger">{errorMessage(q.error)}</Notice>
    ) : (
      <ApiKeysCard data={q.data} />
    ),
    webhooks: sandbox ? <Notice tone="info">Webhooks belong to your own seller account, not the shared example seller.</Notice> : <WebhooksCard />,
    endpoints: me?.org ? <EndpointsCard sellerSlug={me.org.slug} /> : null,
    "catalog-sync": <CatalogSyncCard />,
    embed: sandbox ? <Notice tone="info">The website embed is for your own seller account.</Notice> : <EmbedCard />,
    signer: (
      <>
        <SignerCard />
        {!sandbox && <AgentIdentityCard />}
      </>
    ),
    quickstart: <Quickstart apiBase={apiBase} env={env} ownKeys={!sandbox && q.isSuccess} />,
  };

  return (
    <div className={s.page}>
      <PageHeader
        description="API keys, webhooks and the technical pieces behind your products: endpoints, docs, embed code, signer and on-chain identity."
        status={q.data ? <StatusTag network={q.data.network} label={q.data.env === "live" ? "Live keys · Arc mainnet" : "Test keys · Arc testnet"} /> : undefined}
      />
      {sandbox && (
        <Notice tone="info" title="Example seller">
          <span className={s.row}>
            <StatusTag network="sandbox" label="Example seller" icon={<FlaskConical size={12} />} />
            Browse the endpoints and the quickstart. Keys, webhooks and the embed are available on your own seller account.
          </span>
        </Notice>
      )}
      <nav className={d.sectionNav} aria-label="Developers sections">
        {DEVELOPERS_SECTIONS.map((x) => (
          <a key={x.id} href={`#${x.id}`}>{x.label}</a>
        ))}
      </nav>
      {DEVELOPERS_SECTIONS.map((x) => (sections[x.id] ? <Section key={x.id} id={x.id}>{sections[x.id]}</Section> : null))}
    </div>
  );
}
