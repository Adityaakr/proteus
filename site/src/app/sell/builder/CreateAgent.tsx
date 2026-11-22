/**
 * Create your deal agent: the seller gives their website, Proteus reads the catalog, and a short conversation fills in
 * only what the site cannot say (business type, currency rate, which products, how low to go, bulk and custom terms).
 * A test negotiation runs on the imported catalog before anything is live, and publishing creates the same products,
 * rules, store page, embed and endpoints as the product form. Nothing is published until the seller confirms.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Bot, Check, CheckCircle2, CircleDashed, ExternalLink, Eye, FileUp, Globe, Loader2, Lock, RotateCcw, ShieldCheck, Sparkles, Store, XCircle } from "lucide-react";
import { ActionButton, Card, Field, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { SellerMark } from "../../ui/SellerMark";
import { SocialLinks } from "../../ui/SocialLinks";
import { EmbedCard } from "../developers/EmbedCard";
import { EndpointsCard } from "../developers/EndpointsCard";
import { AgentIdentityCard } from "../developers/IdentityCards";
import { useMe } from "../hooks";
import { useAuth, v1 } from "../v1";
import { isMock } from "../../lib/api";
import { CHECK_SOURCES, type AnswersPatch, type BuilderImport, type BusinessType, type DraftItem, type ImportResult, type Question, type TestNegotiation } from "./types";
import b from "./builder.module.css";

const TYPES: { id: BusinessType; label: string }[] = [
  { id: "merch", label: "Custom merch" },
  { id: "apparel", label: "Apparel" },
  { id: "packaging", label: "Packaging" },
  { id: "food", label: "Food and drink" },
  { id: "beauty", label: "Beauty" },
  { id: "home", label: "Home" },
  { id: "electronics", label: "Electronics" },
  { id: "services", label: "Services" },
  { id: "other", label: "Something else" },
];
const typeLabel = (t?: BusinessType) => TYPES.find((x) => x.id === t)?.label.toLowerCase() ?? "store";
const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const localPrice = (amount: string, currency: string) => `${SYMBOL[currency] ?? `${currency} `}${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const usd = (v: string | null | undefined) => (v ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: Number(v) < 1 ? 4 : 2 })}` : "—");
const STEPS: { q: Question | "read" | "test" | "publish"; label: string }[] = [
  { q: "read", label: "Read your website" },
  { q: "business", label: "Confirm your business" },
  { q: "rate", label: "Prices in USDC" },
  { q: "products", label: "Products open to deals" },
  { q: "prices", label: "Prices for quote-only items" },
  { q: "floors", label: "How low the agent may go" },
  { q: "bulk", label: "Bulk and minimum orders" },
  { q: "custom", label: "Custom orders" },
  { q: "test", label: "Test negotiation" },
  { q: "publish", label: "Publish" },
];

export default function CreateAgent() {
  const { me, ready } = useMe();
  const qc = useQueryClient();
  const [fresh, setFresh] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const mock = isMock();
  const latest = useQuery({ queryKey: ["builder", "latest"], queryFn: () => v1.builder.latest(), enabled: ready && Boolean(me) && !mock, retry: false });
  const id = fresh ? importId : importId ?? latest.data?.id ?? null;
  const q = useQuery({
    queryKey: ["builder", id],
    queryFn: () => v1.builder.get(id!),
    enabled: Boolean(id),
    initialData: latest.data && latest.data.id === id ? latest.data : undefined,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1200 : false),
  });
  const view = id ? q.data : undefined;
  const setView = (v: BuilderImport) => {
    qc.setQueryData(["builder", v.id], v);
    if (v.status === "published") {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["sell"] });
    }
  };
  const start = useMutation({
    mutationFn: (url: string) => v1.builder.start(url),
    onSuccess: (v) => {
      setFresh(false);
      setImportId(v.id);
      setView(v);
    },
  });

  if (mock) return <div className={b.page}><Notice tone="info" title="Not in mock mode">Reading a website needs the real API. Run the server and turn mock mode off.</Notice></div>;
  if (!ready) return <div className={b.page}><Card title="Loading" /></div>;
  if (!me) return <div className={b.page}><Notice tone="info" title="Sign in first">Creating a deal agent needs your account: it owns the seller account and receives payouts.</Notice></div>;

  return (
    <div className={b.page}>
      <header className={b.head}>
        <span className={b.eyebrow}><Sparkles size={13} aria-hidden /> Create your deal agent</span>
        <h2 className="h3">Your website in, a deal agent out</h2>
        <p className="body3">Give me your website. I read your catalog and prices, ask only what your site cannot tell me, and set up a deal agent that quotes and negotiates inside your floors. You check everything before it goes live.</p>
        {view && !fresh && (
          <button type="button" className={b.textBtn} onClick={() => { setFresh(true); setImportId(null); }}>
            <RotateCcw size={13} aria-hidden /> Start with another website
          </button>
        )}
      </header>
      <div className={b.layout}>
        <section className={b.thread} aria-label="Conversation with your deal agent builder">
          <Agent>
            Hi{me.org ? `, ${me.org.name}` : ""}. What is your website? Any site that shows what you sell works: a Shopify or WooCommerce store, a Wix, Webflow or Framer site, an app built with JavaScript, or one page with a price list.
          </Agent>
          {!view ? (
            <UrlForm onStart={(u) => start.mutate(u)} pending={start.isPending} error={start.isError ? errorMessage(start.error) : null} />
          ) : (
            <Flow view={view} setView={setView} onRetry={(u) => start.mutate(u)} retrying={start.isPending} />
          )}
        </section>
        <aside className={b.side} aria-label="Your deal agent">
          <Summary view={view} />
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- bubbles */

function Agent({ children, wide, tone }: { children: ReactNode; wide?: boolean; tone?: "danger" }) {
  return (
    <div className={b.agentRow}>
      <span className={b.avatar} aria-hidden><Bot size={15} /></span>
      <div className={[b.agent, wide ? b.wide : "", tone === "danger" ? b.danger : ""].join(" ")}>{children}</div>
    </div>
  );
}

function Seller({ children, onEdit }: { children: ReactNode; onEdit?: () => void }) {
  return (
    <div className={b.sellerRow}>
      <div className={b.seller}>
        {children}
        {onEdit && <button type="button" className={b.edit} onClick={onEdit}>Change</button>}
      </div>
    </div>
  );
}

function UrlForm({ onStart, pending, error, initial = "" }: { onStart: (u: string) => void; pending: boolean; error: string | null; initial?: string }) {
  const [url, setUrl] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) onStart(url.trim());
  };
  return (
    <form className={b.urlForm} onSubmit={submit}>
      <Field id="site-url" label="Your website" hideLabel placeholder="yourshop.com" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="url" />
      <ActionButton type="submit" loading={pending} loadingLabel="Starting" iconLeft={<Globe size={15} />}>Read my website</ActionButton>
      {error && <Notice tone="danger">{error}</Notice>}
      <p className={b.fine}>Read-only: I follow your robots.txt, open your pages in a browser when they need JavaScript, and never log in, buy or submit forms.</p>
    </form>
  );
}

/* ---------------------------------------------------------------- the flow */

function Flow({ view, setView, onRetry, retrying }: { view: BuilderImport; setView: (v: BuilderImport) => void; onRetry: (u: string) => void; retrying: boolean }) {
  const [open, setOpen] = useState<Question | null>(null);
  const [test, setTest] = useState<TestNegotiation | null>(null);
  const save = useMutation({ mutationFn: (patch: AnswersPatch) => v1.builder.answers(view.id, patch), onSuccess: (v) => { setView(v); setOpen(null); } });
  const more = useMutation({ mutationFn: () => v1.builder.continue(view.id), onSuccess: setView });
  const endRef = useRef<HTMLDivElement>(null);
  const r = view.result;
  const a = view.answers;
  const d = view.draft;
  const next = d?.next ?? [];
  const current: Question | undefined = open ?? next[0];
  const answered = (qq: Question) => !next.includes(qq) && qq !== open;
  const needsRate = Boolean(r?.products.some((p) => p.price && p.currency && p.currency !== "USD"));
  const needsPrices = Boolean(d?.items.some((i) => i.included && !i.source && !i.listUsd)) || Boolean(a?.products && Object.values(a.products).some((x) => x.priceUsd));
  const count = view.transcript.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current, count, test, view.status]);

  const partlyLive = view.status !== "published" && Boolean(view.published?.products.length);
  const frozen = view.status === "published" || partlyLive;
  const ask = (qq: Question, node: ReactNode, summary: ReactNode) => {
    if (!d) return null;
    if (current === qq && !frozen) return <Agent wide>{node}</Agent>;
    if (answered(qq) || frozen) return <Seller onEdit={frozen ? undefined : () => setOpen(qq)}>{summary}</Seller>;
    return null;
  };
  const allAnswered = d && next.filter((x) => x !== open).length === 0 && !open;
  const busy = save.isPending;
  const err = save.isError ? <Notice tone="danger">{errorMessage(save.error)}</Notice> : null;

  return (
    <>
      <Seller>{view.url.replace(/^https:\/\//, "").replace(/\/$/, "")}</Seller>
      <Agent wide><ProgressList view={view} /></Agent>
      {view.status === "failed" && (
        <Agent tone="danger">
          <p>I could not read that website: {view.error}</p>
          <UrlForm onStart={onRetry} pending={retrying} error={null} initial={view.url} />
        </Agent>
      )}
      {r && a && d && (
        <>
          <Agent wide>
            <p>{view.transcript[0]?.text}</p>
            <CatalogCard result={r} reading={view.status === "running"} onMore={frozen ? undefined : () => more.mutate()} moreError={more.isError ? errorMessage(more.error) : null} />
            {r.products.length === 0 && (
              <>
                <p>Try the address of the page that lists your products (your shop or catalogue page), or <Link to="/app/sell/start">add products by hand</Link>.</p>
                <UrlForm onStart={onRetry} pending={retrying} error={null} initial={view.url} />
              </>
            )}
          </Agent>
          {r.products.length > 0 && (
            <>
              {ask("business", <BusinessQ r={r} a={a} busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>Business: <strong>{a.businessName}</strong>, {typeLabel(a.businessType)}</>)}
              {needsRate && ask("rate", <RateQ r={r} a={a} busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>Convert at <strong>{a.usdRate} {r.fx?.currency ?? ""}</strong> per USD</>)}
              {ask("products", <ProductsQ r={r} d={d.items} busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>Open to deals: <strong>{d.included}</strong> of {r.products.length} products</>)}
              {needsPrices && ask("prices", <PricesQ r={r} d={d.items} busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>Prices added for quote-only items</>)}
              {ask("floors", <FloorsQ view={view} busy={busy} err={err} onSave={(p) => save.mutate(p)} setView={setView} />, <>Floors set: {floorSummary(d.items)}</>)}
              {ask("bulk", <BulkQ a={a} r={r} busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>{bulkSummary(a)}</>)}
              {ask("custom", <CustomQ busy={busy} err={err} onSave={(p) => save.mutate(p)} />, <>{a.customOrders?.accepted ? `Custom orders welcome${a.customOrders.note ? `: ${a.customOrders.note}` : ""}` : "No custom work"}</>)}
              {view.transcript.slice(1).filter((t) => !t.text.startsWith("Published ")).map((t, i) => (t.role === "seller" ? <Seller key={i}>{t.text}</Seller> : <Agent key={i}>{t.text}</Agent>))}
              {partlyLive && <Agent wide><RetryPublishCard view={view} setView={setView} /></Agent>}
              {allAnswered && !frozen && (
                <>
                  <Agent wide><Review view={view} setView={setView} /></Agent>
                  <Agent wide><TestCard view={view} result={test} onResult={setTest} /></Agent>
                  <Agent wide><PublishCard view={view} setView={setView} tested={Boolean(test)} /></Agent>
                </>
              )}
              {view.status === "published" && view.published && <Agent wide><Done view={view} /></Agent>}
              {!frozen && <Composer view={view} setView={setView} />}
            </>
          )}
        </>
      )}
      <div ref={endRef} />
    </>
  );
}

function floorSummary(items: DraftItem[]) {
  const inc = items.filter((i) => i.included && i.floorUsd);
  const bases = [...new Set(inc.map((i) => i.floorBasis))];
  return bases.length === 1 ? `${bases[0]} on every product` : `${inc.length} products, ${bases.length} different rules`;
}
function bulkSummary(a: NonNullable<BuilderImport["answers"]>) {
  const d = a.defaults;
  const parts = [d.moq && d.moq !== "1" ? `minimum order ${d.moq}` : "", d.bulkMinUnits && d.bulkDiscountPct ? `${d.bulkMinUnits}+ at ${d.bulkDiscountPct}% off` : "no bulk tier"].filter(Boolean);
  return parts.join(", ");
}

function ProgressList({ view }: { view: BuilderImport }) {
  const running = view.status === "running";
  return (
    <div className={b.progress}>
      <p className={b.progressHead}>{running ? "Reading your website" : view.status === "failed" ? "Stopped" : `Read ${view.result?.pagesFetched ?? 0} pages`}</p>
      <ol className={b.steps}>
        {view.progress.map((p, i) => (
          <li key={i} className={b.step}>
            {p.state === "working" && running ? <Loader2 size={14} className={b.spin} aria-hidden /> : p.state === "blocked" ? <XCircle size={14} className={b.bad} aria-hidden /> : <Check size={14} className={b.ok} aria-hidden />}
            <span>{p.label}{p.detail ? <span className={b.dim}> · {p.detail}</span> : null}</span>
          </li>
        ))}
        {running && !view.progress.length && <li className={b.step}><Loader2 size={14} className={b.spin} aria-hidden /> Starting</li>}
      </ol>
    </div>
  );
}

function CatalogCard({ result, reading, onMore, moreError }: { result: ImportResult; reading?: boolean; onMore?: () => void; moreError?: string | null }) {
  const [all, setAll] = useState(false);
  const groups = useMemo(() => {
    const m = new Map<string, ImportResult["products"]>();
    for (const p of result.products) m.set(p.category?.trim() || "Other", [...(m.get(p.category?.trim() || "Other") ?? []), p]);
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
  }, [result.products]);
  const shown = all ? result.products : result.products.slice(0, 8);
  const brand = result.brand;
  const checked = result.products.filter((p) => CHECK_SOURCES.has(p.source)).length;
  return (
    <div className={b.catalog}>
      <div className={b.brand}>
        <SellerMark name={brand.name ?? result.site.host} brand={{ logoUrl: brand.logoUrl, website: brand.website }} size="sm" />
        <div className={b.brandText}>
          <strong>{brand.name ?? result.site.host}</strong>
          {brand.tagline && <span className={b.dim}>{brand.tagline}</span>}
          <span className={b.row}>
            <a href={brand.website} target="_blank" rel="noreferrer noopener">{result.site.host} <ExternalLink size={11} aria-hidden /></a>
            <SocialLinks socials={brand.socials} />
          </span>
        </div>
      </div>
      <ul className={b.sources} aria-label="What I tried">
        {result.sources.filter((s) => s.source !== "robots").map((s, i) => (
          <li key={i} className={b[`src_${s.status}`] ?? ""} title={s.detail}>
            {s.status === "used" ? <Check size={12} aria-hidden /> : s.status === "blocked" ? <ShieldCheck size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
            <span><strong>{SOURCE_LABEL[s.source] ?? s.source}</strong> {s.detail}</span>
          </li>
        ))}
      </ul>
      {checked > 0 && (
        <Notice tone="warn" title="Read from page text, please check">
          {checked === result.products.length ? "These products" : `${checked} of these products`} came from what your pages show, not from catalog data. Check each name and price before you publish, and leave out anything that is not a product you sell. I never fill in a price your site does not show.
        </Notice>
      )}
      {result.elsewhere && result.elsewhere.length > 0 && (
        <Notice tone="info" title="Your catalogue is somewhere I do not open">
          <span>
            Your site links to {result.elsewhere.map((e, i) => <span key={e.url}>{i ? " and " : ""}<a href={e.url} target="_blank" rel="noreferrer noopener">{e.label}</a> on {e.host}</span>)}. I only read your own website, so give me those prices in the questions below or in the chat.
          </span>
        </Notice>
      )}
      {result.hints.length > 0 && (
        <div className={b.facts}>
          <strong>What your site says about orders</strong>
          <ul>{result.hints.slice(0, 5).map((h) => <li key={h}>{h}</li>)}</ul>
          <span className={b.fine}>Your agent answers buyers from these.</span>
        </div>
      )}
      <div className={b.cats}>
        {groups.map(([c, ps]) => <span key={c} className={b.cat}>{c} <span className={b.dim}>{ps.length}</span></span>)}
      </div>
      <div className={b.tableWrap}>
        <table className={b.table}>
          <thead><tr><th>Product</th><th>Category</th><th>On your site</th><th>Options</th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.key}>
                <td>
                  <span className={b.prod}>
                    {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={b.thumb} /> : <span className={b.thumb} aria-hidden />}
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer noopener">{p.name}</a> : p.name}
                    {CHECK_SOURCES.has(p.source) && <CheckTag />}
                  </span>
                </td>
                <td>{p.category ?? "—"}</td>
                <td>{p.price && p.currency ? localPrice(p.price, p.currency) : p.price ? <>{p.price} <span className={b.dim}>(currency not shown)</span></> : <span className={b.dim}>{CHECK_SOURCES.has(p.source) ? "No price shown" : "Quote only"}</span>}</td>
                <td className={b.dim}>{p.options.map((o) => `${o.values.length} ${o.name.toLowerCase()}${o.values.length > 1 ? "s" : ""}`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.products.length > 8 && <button type="button" className={b.textBtn} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${result.products.length}`}</button>}
      {result.unread && result.unread.urls.length > 0 ? (
        <div className={b.facts}>
          <span>I read {result.unread.total - result.unread.urls.length} of your {result.unread.total} product pages{result.unread.stoppedBy ? ` before ${result.unread.stoppedBy} stopped me` : ""}. {result.unread.urls.length} {result.unread.urls.length === 1 ? "page is" : "pages are"} not read yet.</span>
          {onMore && (
            <div>
              <ActionButton variant="secondary" loading={reading} loadingLabel="Reading" onClick={onMore}>Read the other {result.unread.urls.length} pages</ActionButton>
            </div>
          )}
          {moreError && <Notice tone="danger">{moreError}</Notice>}
        </div>
      ) : result.limited ? <p className={b.fine}>I {result.limited}. You can add more products later with the product form.</p> : null}
      {result.policies.length > 0 && <p className={b.fine}>Policies read: {result.policies.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer noopener">{p.kind}</a>).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}. Your agent answers buyers from them.</p>}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", sitemap: "Sitemap", "json-ld": "Product data", browser: "Browser", "page-layout": "Page layout", firecrawl: "Firecrawl", "page-text": "Page text", policies: "Policies" };

function CheckTag() {
  return (
    <span className={b.checkTag} title="Read from page text, please check">
      <Eye size={11} aria-hidden /> Check
    </span>
  );
}

type QProps = { busy: boolean; err: ReactNode; onSave: (p: AnswersPatch) => void };

function BusinessQ({ r, a, busy, err, onSave }: QProps & { r: ImportResult; a: NonNullable<BuilderImport["answers"]> }) {
  const [name, setName] = useState(a.businessName ?? r.brand.name ?? "");
  const [type, setType] = useState<BusinessType>(a.businessType ?? r.businessType.guess);
  return (
    <div className={b.q}>
      <p>{r.brand.name ?? "Your store"} looks like a <strong>{typeLabel(r.businessType.guess)}</strong> business ({r.businessType.reason}). Is that right?</p>
      <Field id="biz-name" label="Business name buyers see" value={name} onChange={(e) => setName(e.target.value)} />
      <div className={b.chips} role="radiogroup" aria-label="Business type">
        {TYPES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className={type === t.id ? b.chipOn : b.chip} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>
      {err}
      <div><ActionButton size="sm" loading={busy} disabled={name.trim().length < 2} onClick={() => onSave({ businessName: name.trim(), businessType: type })}>That is right</ActionButton></div>
    </div>
  );
}

function RateQ({ r, a, busy, err, onSave }: QProps & { r: ImportResult; a: NonNullable<BuilderImport["answers"]> }) {
  const cur = r.fx?.currency ?? r.products.find((p) => p.currency)?.currency ?? "";
  const [rate, setRate] = useState(a.usdRate ?? r.fx?.rate ?? "");
  const sample = r.products.find((p) => p.price && p.currency === cur);
  const ok = /^\d+(\.\d{1,6})?$/.test(rate.trim()) && Number(rate) > 0;
  return (
    <div className={b.q}>
      <p>Your prices are in <strong>{cur}</strong>. Deals on Proteus AI are paid in USDC, so I convert your list prices to dollars. {r.fx ? <>The {r.fx.source} on {r.fx.asOf} is 1 USD = {r.fx.rate} {cur}; use it or set your own.</> : "Tell me the rate you use."}</p>
      <div className={b.inline}>
        <span className="body3">1 USD =</span>
        <Field id="usd-rate" label={`${cur} per USD`} hideLabel value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={b.small} />
        <span className="body3">{cur}</span>
      </div>
      {ok && sample && <p className={b.fine}>{sample.name}: {localPrice(sample.price!, cur)} becomes {usd(String(Math.round((Number(sample.price) / Number(rate)) * 100) / 100))}.</p>}
      {err}
      <div><ActionButton size="sm" loading={busy} disabled={!ok} onClick={() => onSave({ usdRate: rate.trim() })}>Use this rate</ActionButton></div>
    </div>
  );
}

function ProductsQ(props: QProps & { r: ImportResult; d: DraftItem[] }) {
  return props.r.products.some((p) => p.price) ? <ProductsByCategory {...props} /> : <ProductsOneByOne {...props} />;
}

/** A site with no prices: the seller picks the products one by one and prices them in the next question. */
function ProductsOneByOne({ r, d, busy, err, onSave }: QProps & { r: ImportResult; d: DraftItem[] }) {
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(r.products.map((p) => [p.key, Boolean(d.find((i) => i.key === p.key)?.included)])));
  const count = Object.values(picked).filter(Boolean).length;
  return (
    <div className={b.q}>
      <p>Your site shows no prices, so pick the products your deal agent should sell. You give each one a price next; the rest stay off.</p>
      <ul className={b.pickList}>
        {r.products.map((p) => (
          <li key={p.key}>
            <label className={b.checkLine}><input type="checkbox" checked={Boolean(picked[p.key])} onChange={(e) => setPicked({ ...picked, [p.key]: e.target.checked })} /> {p.name}</label>
          </li>
        ))}
      </ul>
      {err}
      <div><ActionButton size="sm" loading={busy} disabled={count === 0} onClick={() => onSave({ include: Object.fromEntries(r.products.map((p) => [p.key, Boolean(picked[p.key])])) })}>Continue with {count} product{count === 1 ? "" : "s"}</ActionButton></div>
    </div>
  );
}

function ProductsByCategory({ r, d, busy, err, onSave }: QProps & { r: ImportResult; d: DraftItem[] }) {
  const cats = useMemo(() => {
    const m = new Map<string, { priced: string[]; quote: string[] }>();
    for (const p of r.products) {
      const c = p.category?.trim() || "Other";
      const e = m.get(c) ?? { priced: [], quote: [] };
      (p.price ? e.priced : e.quote).push(p.key);
      m.set(c, e);
    }
    return [...m.entries()].sort((x, y) => y[1].priced.length - x[1].priced.length);
  }, [r.products]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(cats.map(([c, e]) => [c, e.priced.some((k) => d.find((i) => i.key === k)?.included)])));
  const [quotes, setQuotes] = useState(false);
  const quoteCount = cats.reduce((n, [c, e]) => n + (on[c] ? e.quote.length : 0), 0);
  const total = cats.reduce((n, [c, e]) => n + (on[c] ? e.priced.length + (quotes ? e.quote.length : 0) : 0), 0);
  const save = () => {
    const include: Record<string, boolean> = {};
    for (const [c, e] of cats) {
      for (const k of e.priced) include[k] = Boolean(on[c]);
      for (const k of e.quote) include[k] = Boolean(on[c]) && quotes;
    }
    onSave({ include });
  };
  return (
    <div className={b.q}>
      <p>Which products should your deal agent sell? Products that show a price on your site are on. Quote-only items need a price from you first.</p>
      <ul className={b.checks}>
        {cats.map(([c, e]) => (
          <li key={c}>
            <label><input type="checkbox" checked={Boolean(on[c])} onChange={(ev) => setOn({ ...on, [c]: ev.target.checked })} /> {c}</label>
            <span className={b.dim}>{e.priced.length} priced{e.quote.length ? `, ${e.quote.length} quote-only` : ""}</span>
          </li>
        ))}
      </ul>
      {quoteCount > 0 && <label className={b.checkLine}><input type="checkbox" checked={quotes} onChange={(e) => setQuotes(e.target.checked)} /> Also sell the {quoteCount} quote-only items in these categories (you give their prices next)</label>}
      {err}
      <div><ActionButton size="sm" loading={busy} disabled={total === 0} onClick={save}>Continue with {total} product{total === 1 ? "" : "s"}</ActionButton></div>
    </div>
  );
}

function PricesQ({ r, d, busy, err, onSave }: QProps & { r: ImportResult; d: DraftItem[] }) {
  const missing = d.filter((i) => i.included && !i.source);
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(missing.map((i) => [i.key, i.listUsd ?? ""])));
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const valid = missing.every((i) => skip[i.key] || /^\d+(\.\d{1,4})?$/.test((prices[i.key] ?? "").trim()));
  return (
    <div className={b.q}>
      <p>These show no price, or no currency, on your site. Give each a list price in USD, or leave it out. Your agent never quotes a product without a price.</p>
      <ul className={b.priceList}>
        {missing.map((i) => {
          const p = r.products.find((x) => x.key === i.key);
          return (
            <li key={i.key}>
              <span className={b.grow}>{p?.url ? <a href={p.url} target="_blank" rel="noreferrer noopener">{i.name}</a> : i.name}</span>
              <Field id={`price-${i.key}`} label={`${i.name} price in USD`} hideLabel placeholder="USD" value={prices[i.key] ?? ""} onChange={(e) => setPrices({ ...prices, [i.key]: e.target.value })} disabled={skip[i.key]} inputMode="decimal" className={b.small} />
              <label className={b.dim}><input type="checkbox" checked={Boolean(skip[i.key])} onChange={(e) => setSkip({ ...skip, [i.key]: e.target.checked })} /> Leave out</label>
            </li>
          );
        })}
      </ul>
      {err}
      <div>
        <ActionButton size="sm" loading={busy} disabled={!valid} onClick={() => onSave({ products: Object.fromEntries(missing.filter((i) => !skip[i.key]).map((i) => [i.key, { priceUsd: prices[i.key]!.trim() }])), include: Object.fromEntries(missing.filter((i) => skip[i.key]).map((i) => [i.key, false])) })}>Save prices</ActionButton>
      </div>
    </div>
  );
}

function FloorsQ({ view, busy, err, onSave, setView }: QProps & { view: BuilderImport; setView: (v: BuilderImport) => void }) {
  const items = view.draft!.items.filter((i) => i.included);
  const a = view.answers!;
  const cats = [...new Set(items.map((i) => i.category))];
  const [pct, setPct] = useState<Record<string, string>>(() => Object.fromEntries(cats.map((c) => [c, a.categories[c]?.maxDiscountPct ?? a.defaults.maxDiscountPct ?? "10"])));
  const [exact, setExact] = useState(false);
  const saved = (key: string) => a.products[key]?.floorUsd ?? "";
  const [floors, setFloors] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.key, saved(i.key)])));
  const csv = useMutation({
    mutationFn: (text: string) => v1.builder.floorsCsv(view.id, text),
    onSuccess: (r) => {
      setView(r.view);
      // Show what the spreadsheet set in the exact-floor table.
      setFloors(Object.fromEntries(items.map((i) => [i.key, r.view.answers?.products[i.key]?.floorUsd ?? ""])));
      if (r.applied) setExact(true);
    },
  });
  const pctOk = cats.every((c) => /^\d{1,2}(\.\d{1,2})?$/.test((pct[c] ?? "").trim()) && Number(pct[c]) <= 90);
  const floorOk = items.every((i) => !floors[i.key]?.trim() || /^\d+(\.\d{1,4})?$/.test(floors[i.key]!.trim()));
  const example = (c: string) => {
    const i = items.find((x) => x.category === c && x.listUsd);
    if (!i || !/^\d+(\.\d+)?$/.test(pct[c] ?? "")) return null;
    const f = Math.ceil(Number(i.listUsd) * (100 - Number(pct[c])) * 100) / 10_000;
    return `${i.name}: list ${usd(i.listUsd)}, lowest ${usd(String(f))}`;
  };
  const template = () => {
    const rows = [["product", "list_price_usd", "floor", "max_discount", "moq", "bulk_min", "bulk_discount"], ...items.map((i) => [`"${i.name.replace(/"/g, '""')}"`, i.listUsd ?? "", "", "", "", "", ""])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "floors.csv" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className={b.q}>
      <p>How low can I go? Give me the most I may take off your list price for each category. I never offer below it, whatever the buyer says, and buyers never see it.</p>
      <ul className={b.floorList}>
        {cats.map((c) => (
          <li key={c}>
            <span className={b.grow}><strong>{c}</strong>{example(c) && <span className={b.fine}>{example(c)}</span>}</span>
            <span className={b.chipsTight}>
              {["0", "5", "10", "15", "20"].map((v) => <button key={v} type="button" className={pct[c] === v ? b.chipOn : b.chip} onClick={() => setPct({ ...pct, [c]: v })}>{v === "0" ? "No discount" : `${v}%`}</button>)}
            </span>
            <Field id={`pct-${c}`} label={`${c} max % off`} hideLabel value={pct[c] ?? ""} onChange={(e) => setPct({ ...pct, [c]: e.target.value })} inputMode="decimal" className={b.tiny} />
            <span className={b.dim}>% off</span>
          </li>
        ))}
      </ul>
      <button type="button" className={b.textBtn} onClick={() => setExact(!exact)}>{exact ? "Hide exact floors" : "Set an exact floor price per product instead"}</button>
      {exact && (
        <div className={b.tableWrap}>
          <table className={b.table}>
            <thead><tr><th>Product</th><th>List</th><th><Lock size={11} aria-hidden /> Floor per unit (USD)</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key}>
                  <td>{i.name}</td>
                  <td>{usd(i.listUsd)}</td>
                  <td><Field id={`floor-${i.key}`} label={`${i.name} floor`} hideLabel placeholder="from % above" value={floors[i.key] ?? ""} onChange={(e) => setFloors({ ...floors, [i.key]: e.target.value })} inputMode="decimal" className={b.small} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={b.csv}>
        <label className={b.fileBtn}>
          <FileUp size={14} aria-hidden /> Upload floors as CSV
          <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) csv.mutate(await f.text()); e.target.value = ""; }} />
        </label>
        <button type="button" className={b.textBtn} onClick={template}>Download a template</button>
        <span className={b.fine}>Columns: product, floor (USD), max_discount (%), moq, bulk_min, bulk_discount (%).</span>
      </div>
      {csv.isSuccess && <Notice tone={csv.data.applied ? "success" : "warn"}>Read rules for {csv.data.applied} product{csv.data.applied === 1 ? "" : "s"}.{csv.data.unmatched.length ? ` Not matched: ${csv.data.unmatched.join(", ")}.` : ""}{csv.data.errors.length ? ` ${csv.data.errors.join("; ")}.` : ""}</Notice>}
      {csv.isError && <Notice tone="danger">{errorMessage(csv.error)}</Notice>}
      {err}
      <div>
        <ActionButton size="sm" loading={busy} disabled={!pctOk || !floorOk} onClick={() => onSave({ floorsSet: true, categories: Object.fromEntries(cats.map((c) => [c, { maxDiscountPct: pct[c]!.trim() }])), products: Object.fromEntries(items.filter((i) => (floors[i.key] ?? "").trim() !== saved(i.key)).map((i) => [i.key, { floorUsd: (floors[i.key] ?? "").trim() }])) })}>Save floors</ActionButton>
      </div>
      <p className={b.fine}>You can change a product's floor at any time later on its <strong>Prices and rules</strong> page.</p>
    </div>
  );
}

/** A minimum order in units that the site states ("MOQ ... starts at 50 pieces"); a money minimum ("$250") is not one. */
function moqFromSite(hints: string[]): { units: string; line: string } | undefined {
  for (const line of hints) {
    const m = /\b(?:moq|minimum order(?: quantity)?|min\.? order|order minimum|starts? at)\b[^0-9$₹€£]{0,40}([$₹€£])?\s?(\d{1,6})\s*(pieces|pcs|units|items|pairs|sets|nos)?/i.exec(line);
    if (m && !m[1] && Number(m[2]) > 1) return { units: m[2]!, line };
  }
  return undefined;
}

function BulkQ({ a, r, busy, err, onSave }: QProps & { a: NonNullable<BuilderImport["answers"]>; r: ImportResult }) {
  const site = moqFromSite(r.hints);
  const [moq, setMoq] = useState(a.defaults.moq ?? site?.units ?? "1");
  const [min, setMin] = useState(a.defaults.bulkMinUnits ?? "");
  const [off, setOff] = useState(a.defaults.bulkDiscountPct ?? "");
  const int = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0;
  const bulkOk = (!min.trim() && !off.trim()) || (int(min) && /^\d{1,2}(\.\d{1,2})?$/.test(off.trim()) && Number(min) > Number(moq || "1"));
  return (
    <div className={b.q}>
      <p>Do you have a minimum order, or a better price for bulk? I add the bulk price as its own tier, and it can never go below your floor.</p>
      {site && !a.defaults.moq && <p className={b.fine}>From your site: “{site.line}” I filled in {site.units}.</p>}
      <div className={b.inline}>
        <span className="body3">Minimum order</span>
        <Field id="moq" label="Minimum order units" hideLabel value={moq} onChange={(e) => setMoq(e.target.value)} inputMode="numeric" className={b.tiny} />
        <span className="body3">units</span>
      </div>
      <div className={b.inline}>
        <span className="body3">Orders of</span>
        <Field id="bulk-min" label="Bulk from units" hideLabel placeholder="100" value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" className={b.tiny} />
        <span className="body3">or more get</span>
        <Field id="bulk-off" label="Bulk discount percent" hideLabel placeholder="10" value={off} onChange={(e) => setOff(e.target.value)} inputMode="decimal" className={b.tiny} />
        <span className="body3">% off</span>
      </div>
      {err}
      <div className={b.row}>
        <ActionButton size="sm" loading={busy} disabled={!int(moq) || !bulkOk || !min.trim()} onClick={() => onSave({ bulkAnswered: true, defaults: { moq: moq.trim(), bulkMinUnits: min.trim(), bulkDiscountPct: off.trim() } })}>Save bulk pricing</ActionButton>
        <ActionButton size="sm" variant="secondary" loading={busy} disabled={!int(moq)} onClick={() => onSave({ bulkAnswered: true, defaults: { moq: moq.trim(), bulkMinUnits: "", bulkDiscountPct: "" } })}>No bulk pricing</ActionButton>
      </div>
    </div>
  );
}

function CustomQ({ busy, err, onSave }: QProps) {
  const [note, setNote] = useState("");
  return (
    <div className={b.q}>
      <p>Do you take custom orders, such as printing a buyer's logo? If yes, buyers can attach artwork with their order.</p>
      <Field id="custom-note" label="What you customise (optional)" placeholder="Logo printing, embroidery" value={note} onChange={(e) => setNote(e.target.value)} />
      {err}
      <div className={b.row}>
        <ActionButton size="sm" loading={busy} onClick={() => onSave({ customOrders: { accepted: true, ...(note.trim() ? { note: note.trim() } : {}) } })}>Yes, we do custom orders</ActionButton>
        <ActionButton size="sm" variant="secondary" loading={busy} onClick={() => onSave({ customOrders: { accepted: false } })}>No, sold as listed</ActionButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- review, test, publish */

function Review({ view, setView }: { view: BuilderImport; setView: (v: BuilderImport) => void }) {
  const d = view.draft!;
  const items = d.items.filter((i) => i.included);
  const toggle = useMutation({ mutationFn: (p: AnswersPatch) => v1.builder.answers(view.id, p), onSuccess: setView });
  return (
    <div className={b.q}>
      <p>Here is what your deal agent will sell. List prices are public; floors are <strong>seller only</strong>: buyers never see them, and the engine refuses any offer below them.</p>
      <div className={b.tableWrap}>
        <table className={b.table}>
          <thead><tr><th>Product</th><th>On your site</th><th>List (USDC)</th><th>Bulk tier</th><th><Lock size={11} aria-hidden /> Floor</th><th /></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className={i.issues.length ? b.issueRow : ""}>
                <td>{i.name}{i.check && <CheckTag />}<span className={b.fine}>{i.moq !== "1" ? `min ${i.moq} ${i.unitLabel}s` : `per ${i.unitLabel}`}</span></td>
                <td>{i.source ? localPrice(i.source.amount, i.source.currency) : "—"}</td>
                <td>{usd(i.listUsd)}</td>
                <td>{i.bulk ? `${i.bulk.minUnits}+ at ${usd(i.bulk.priceUsd)}` : "—"}</td>
                <td>{usd(i.floorUsd)}{i.floorBasis && <span className={b.fine}>{i.floorBasis}</span>}{i.issues.map((x) => <span key={x} className={b.issue}>{x}</span>)}</td>
                <td><button type="button" className={b.textBtn} onClick={() => toggle.mutate({ include: { [i.key]: false } })}>Leave out</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={b.fine}>{d.ready} of {d.included} ready to publish.{d.included > d.maxPublish ? ` Publish at most ${d.maxPublish} at a time.` : ""} Type a change below, for example "Drinkware 5% off".</p>
    </div>
  );
}

function TestCard({ view, result, onResult }: { view: BuilderImport; result: TestNegotiation | null; onResult: (r: TestNegotiation) => void }) {
  const ready = view.draft!.items.filter((i) => i.included && !i.issues.length);
  const [key, setKey] = useState<string>(ready.find((i) => i.bulk)?.key ?? ready[0]?.key ?? "");
  const [msg, setMsg] = useState("");
  const run = useMutation({ mutationFn: () => v1.builder.test(view.id, { productKey: key || undefined, message: msg.trim() || undefined }), onSuccess: onResult });
  return (
    <div className={b.q}>
      <p>Before you go live, watch your agent negotiate one product with a test buyer. I also try a counteroffer below your floor and one at it.</p>
      <div className={b.inline}>
        <label className="body3" htmlFor="test-product">Product</label>
        <select id="test-product" className={b.select} value={key} onChange={(e) => setKey(e.target.value)}>
          {ready.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
        </select>
      </div>
      <Field id="test-msg" label="What the buyer says (optional)" placeholder="We need 100 tees for an offsite, budget around $900" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <div><ActionButton size="sm" variant={result ? "secondary" : "primary"} loading={run.isPending} loadingLabel="Negotiating" disabled={!ready.length} onClick={() => run.mutate()}>{result ? "Run it again" : "Run a test negotiation"}</ActionButton></div>
      {run.isError && <Notice tone="danger">{errorMessage(run.error)}</Notice>}
      {result && (
        <div className={b.test}>
          <div className={b.testHead}><strong>{result.product.name}</strong><StatusTag tone="neutral" label={`Test · ${result.adapter}`} /></div>
          {result.lines.map((l, i) => (
            <div key={i} className={l.role === "buyer" ? b.tBuyer : b.tAgent}>
              <span className={b.tWho}>{l.role === "buyer" ? "Test buyer" : "Your agent"}</span>
              <p>{l.text}</p>
              {l.offers?.length ? <ul className={b.offers}>{l.offers.map((o, j) => <li key={j}><strong>{o.tier}</strong> {o.units} for {o.totalUsd}{o.status === "approval_required" ? " (needs your approval)" : ""}</li>)}</ul> : null}
              {l.decision && <StatusTag tone={l.decision === "rejected" ? "danger" : l.decision === "approved" ? "success" : "warn"} label={l.decision === "rejected" ? "Refused" : l.decision === "approved" ? "Accepted" : "Sent to you for approval"} />}
            </div>
          ))}
          <ul className={b.checksResult}>
            {result.check.belowFloorRefused !== undefined && <li>{result.check.belowFloorRefused ? <CheckCircle2 size={14} className={b.ok} aria-hidden /> : <XCircle size={14} className={b.bad} aria-hidden />} Below your floor ({usd(result.check.floorUsd)} × {result.check.units}): {result.check.belowFloorRefused ? "refused" : "not refused"}</li>}
            {result.check.atFloorAccepted !== undefined && <li>{result.check.atFloorAccepted ? <CheckCircle2 size={14} className={b.ok} aria-hidden /> : <XCircle size={14} className={b.bad} aria-hidden />} At your floor ({result.check.lowestTotalUsd}): {result.check.atFloorAccepted ? "accepted" : "refused"}</li>}
          </ul>
          <p className={b.fine}>{result.note}</p>
        </div>
      )}
    </div>
  );
}

function RetryPublishCard({ view, setView }: { view: BuilderImport; setView: (v: BuilderImport) => void }) {
  const { refetchMe } = useAuth();
  const pub = useMutation({ mutationFn: () => v1.builder.publish(view.id), onSuccess: (v) => { setView(v); refetchMe(); } });
  const live = view.published!.products;
  return (
    <div className={b.q}>
      <Notice tone="warn" title="Publishing stopped partway">
        {live.length} product{live.length === 1 ? " is" : "s are"} already live ({live.map((p) => p.name).join(", ")}). Some products are already live; finish publishing, then change prices or floors on each product page.
      </Notice>
      {pub.isError && <Notice tone="danger" title="Could not publish">{errorMessage(pub.error)}</Notice>}
      <div><ActionButton icon loading={pub.isPending} loadingLabel="Publishing" disabled={view.status === "publishing"} onClick={() => pub.mutate()}>Retry publish</ActionButton></div>
    </div>
  );
}

function PublishCard({ view, setView, tested }: { view: BuilderImport; setView: (v: BuilderImport) => void; tested: boolean }) {
  const { me } = useMe();
  const { refetchMe } = useAuth();
  const [ok, setOk] = useState(false);
  const d = view.draft!;
  const pub = useMutation({ mutationFn: () => v1.builder.publish(view.id), onSuccess: (v) => { setView(v); refetchMe(); } });
  const wallet = me?.wallets?.find((w) => w.primary)?.address;
  const blocked = d.items.filter((i) => i.included && i.issues.length).length;
  const toCheck = d.items.filter((i) => i.included && i.check).length;
  return (
    <div className={b.q}>
      <p>
        Ready to publish <strong>{d.included} product{d.included === 1 ? "" : "s"}</strong>{view.org ? <> to <strong>{view.org.name}</strong></> : <> as <strong>{view.answers?.businessName}</strong></>} on Proteus AI <StatusTag network={view.network} />.
        {view.org ? "" : " This creates your seller account on the wallet you are signed in with: you own it, and payouts go to it."}
      </p>
      {!view.org && wallet && <p className={b.fine}>Owner and payout wallet: <MonoValue value={wallet} short /></p>}
      {!view.org && !wallet && <Notice tone="warn" title="Link a wallet first">Payouts need a wallet. Add one from your account, then come back: your answers are saved.</Notice>}
      {!tested && <Notice tone="info">Tip: run the test negotiation above first.</Notice>}
      <label className={b.checkLine}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        {toCheck ? `I checked these prices and floors, and the ${toCheck} product${toCheck === 1 ? "" : "s"} read from page text. Publish them.` : "I checked these prices and floors. Publish them."}
      </label>
      {pub.isError && <Notice tone="danger" title="Could not publish">{errorMessage(pub.error)}</Notice>}
      <div><ActionButton icon loading={pub.isPending} loadingLabel="Publishing" disabled={!ok || blocked > 0 || (!view.org && !wallet) || d.included > d.maxPublish} onClick={() => pub.mutate()}>Publish my deal agent</ActionButton></div>
    </div>
  );
}

function Done({ view }: { view: BuilderImport }) {
  const p = view.published!;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const mcp = JSON.stringify({ mcpServers: { proteus: { command: "pnpm", args: ["--dir", "/path/to/proteus/packages/mcp", "exec", "tsx", "src/index.ts"], env: { PROTEUS_API_URL: origin, PROTEUS_MAX_PREPAID_USDC: "50" } } } }, null, 2);
  return (
    <div className={b.q}>
      <p><CheckCircle2 size={15} className={b.ok} aria-hidden /> Your deal agent is live for <strong>{p.products.length} product{p.products.length === 1 ? "" : "s"}</strong>. It quotes from your list prices, negotiates down to your floors and no further, and every deal is paid into USDC escrow on Arc.</p>
      <div className={b.outputs}>
        <Card title="Your store page" subtitle="One deal agent for every product. Share it anywhere." actions={<StatusTag network={view.network} />}>
          <MonoValue value={`${origin}/app/market/${p.orgSlug}`} copy label="store link" />
          <div className={b.row}><ActionButton size="sm" to={`/app/market/${p.orgSlug}`} iconLeft={<Store size={14} />}>Open the store page</ActionButton><ActionButton size="sm" variant="secondary" to="/app/sell/products">Prices and rules</ActionButton></div>
        </Card>
        <EmbedCard />
        <EndpointsCard sellerSlug={p.orgSlug} />
        <Card title="Buyers' AI agents (MCP)" subtitle="Claude and other MCP clients can find your products and negotiate with your agent through the Proteus MCP server. It runs on the buyer's machine with a spending limit the buyer sets." actions={<StatusTag tone="info" label="Testnet" />}>
          <pre className={b.code}>{mcp}</pre>
          <p className={b.fine}>Buyers paste this into their MCP client. See the <Link to="/docs/quickstart-agent">agent quickstart</Link>.</p>
        </Card>
        <AgentIdentityCard />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- composer and summary */

function Composer({ view, setView }: { view: BuilderImport; setView: (v: BuilderImport) => void }) {
  const [text, setText] = useState("");
  const send = useMutation({ mutationFn: (t: string) => v1.builder.message(view.id, t), onSuccess: (r) => { setView(r.view); setText(""); } });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) send.mutate(text.trim());
  };
  const examples = ["Apparel up to 15% off", "Stickers no discount", "100+ at 10% off", "Minimum order 25"];
  return (
    <form className={b.composer} onSubmit={submit}>
      <div className={b.examples}>{examples.map((x) => <button key={x} type="button" className={b.chip} onClick={() => setText(text ? `${text}, ${x.toLowerCase()}` : x)}>{x}</button>)}</div>
      <div className={b.composeRow}>
        <textarea aria-label="Tell me your rules in your own words" placeholder="Or tell me in your own words: “tees can go 15% lower, nothing below ₹900 on the polo, 50+ at 10% off”" value={text} onChange={(e) => setText(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }} />
        <button type="submit" className={b.send} aria-label="Send" disabled={!text.trim() || send.isPending}>{send.isPending ? <Loader2 size={16} className={b.spin} /> : <ArrowUp size={16} />}</button>
      </div>
      {send.isError && <Notice tone="danger">{errorMessage(send.error)}</Notice>}
    </form>
  );
}

function Summary({ view }: { view: BuilderImport | undefined }) {
  const r = view?.result;
  const next = view?.draft?.next ?? [];
  const needsRate = Boolean(r?.products.some((p) => p.price && p.currency && p.currency !== "USD"));
  const state = (q: (typeof STEPS)[number]["q"]): "done" | "todo" | "skip" => {
    if (!view) return "todo";
    if (q === "read") return view.status === "running" || view.status === "failed" ? "todo" : "done";
    if (q === "publish") return view.status === "published" ? "done" : "todo";
    if (q === "test") return view.status === "published" ? "done" : "todo";
    if (!view.draft) return "todo";
    if (q === "rate" && !needsRate) return "skip";
    if (q === "prices" && !view.draft.items.some((i) => i.included && !i.source)) return "skip";
    return next.includes(q) ? "todo" : "done";
  };
  return (
    <Card title="Your deal agent" subtitle={r ? r.brand.name ?? r.site.host : "Not started"} actions={view ? <StatusTag network={view.network} /> : undefined}>
      <ol className={b.checklist}>
        {STEPS.map((s) => {
          const st = state(s.q);
          if (st === "skip") return null;
          return <li key={s.q} className={st === "done" ? b.done : ""}>{st === "done" ? <CheckCircle2 size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />} {s.label}</li>;
        })}
      </ol>
      {view?.draft && <p className={b.fine}>{view.draft.included} products open to deals, {view.draft.ready} ready.</p>}
      {view && (
        <p className={b.fine}>
          Browser for JavaScript sites: {view.helpers.browser === "cloud" ? "cloud browser" : view.helpers.browser === "off" ? "off" : "on this server"}. Reading page text with a model: {view.helpers.model ?? "off on this server"}. Firecrawl rendering: {view.helpers.firecrawl ? "on" : "off (optional)"}.
        </p>
      )}
      <p className={b.fine}>Prefer forms? <Link to="/app/sell/start">Add a product by hand</Link>.</p>
    </Card>
  );
}
