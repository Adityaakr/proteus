import { pluralUnit, sellerGreeting, switchNegotiation, unitFor, type GreetingProduct } from "@proteus/domain";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronDown, LayoutGrid, Send, X } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { Negotiation, Offer, PublicProduct, Turn } from "../lib/types";
import { SellerMark } from "../ui/SellerMark";
import { ArcMark } from "../ui/Marks";
import e from "./embed.module.css";

const asGreeting = (p: PublicProduct): GreetingProduct => ({ name: p.name, notes: p.knowledge?.notes ?? [] });
/** "$15.20", the lowest unit price across the product's tiers. */
const fromPrice = (p: PublicProduct) => {
  const prices = p.tiers.map((t) => Number(t.unitPriceUsd.replace(/[^0-9.]/g, ""))).filter(Number.isFinite);
  return prices.length ? `$${Math.min(...prices).toFixed(2)}` : null;
};
/** What the visitor sees of a negotiation: everything from their first message on (the client shows its own greeting). */
const visibleTurns = (n: Negotiation | null) => {
  const turns = (n?.turns ?? []).filter((t) => t.role !== "system" && t.content);
  const first = turns.findIndex((t) => t.role === "buyer");
  return first === -1 ? [] : turns.slice(first);
};

/**
 * The seller's deal agent, embedded on the seller's own website (iframe from /embed.js) or opened as a link page. A
 * visitor is greeted with the seller's key facts, asks questions, and gets offers that come from the seller's rules
 * in code; the model only writes the words. Until the visitor picks a product, each message goes to the product it is
 * about. "Get this offer" creates a quote and opens Proteus AI in a new top-level tab to sign and fund: nothing is
 * ever signed inside the embedding page.
 */
export default function EmbedAgent() {
  const { sellerSlug = "" } = useParams();
  const [params] = useSearchParams();
  const sellerQ = useQuery({ queryKey: ["embed-seller", sellerSlug], queryFn: () => api.seller(sellerSlug), retry: false });
  const seller = sellerQ.data;
  const products = useMemo(() => seller?.products ?? [], [seller]);
  /** The product the visitor chose (or the embed's data-product); empty: the agent follows what they ask about. */
  const [picked, setPicked] = useState<string>(params.get("product") ?? "");
  const pickedProduct = products.find((p) => p.slug === picked);
  const [neg, setNeg] = useState<Negotiation | null>(null);
  /** Earlier negotiations of this conversation, when a message moved it to another product. */
  const [earlier, setEarlier] = useState<{ product: string; turns: Turn[] }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ url: string } | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [filter, setFilter] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const accent = seller?.brand?.accent && /^#[0-9a-f]{6}$/i.test(seller.brand.accent) ? seller.brand.accent : "#1b4dff";
  // Close only means something in the pop-up: the link page has no parent and an inline card has nothing to close.
  const closable = typeof window !== "undefined" && window.parent !== window && params.get("inline") !== "1";
  const current = products.find((p) => p.slug === neg?.productSlug) ?? pickedProduct;

  // The whole store until the visitor picks a product (or the embed names one); then that product's own facts.
  const focus = pickedProduct ?? (products.length === 1 ? products[0] : undefined);
  const greeting = useMemo(() => (seller ? sellerGreeting(seller.name, products.map(asGreeting), focus && asGreeting(focus)) : null), [seller, products, focus]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [neg?.turns.length, busy, picked, earlier.length]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!products.length || !clean || busy) return;
    setError(null);
    setBusy(true);
    setPending(clean);
    setDraft("");
    try {
      let slug = pickedProduct?.slug ?? neg?.productSlug ?? "";
      if (!pickedProduct && products.length > 1) {
        // No product chosen: the message goes to the product it is about, as on the store's deal desk.
        const r = await api.routeSeller(sellerSlug, clean, neg?.productSlug).catch(() => null);
        if (r?.matched) slug = r.productSlug;
      }
      slug ||= products[0]!.slug;
      let n = neg;
      if (!n || n.productSlug !== slug) {
        const store = !pickedProduct && products.length > 1 ? (n ? "continue" : "open") : undefined;
        const moved = await switchNegotiation(
          n,
          earlier,
          () => api.startNegotiation({ sellerSlug, productSlug: slug, ...(store ? { store } : {}) }, { embed: sellerSlug }),
          (x) => ({ product: x.productName ?? x.productSlug, turns: visibleTurns(x) }),
        );
        n = moved.next;
        setEarlier(moved.history);
        setNeg(n);
      }
      setNeg(await api.sendMessage(n.id, clean));
    } catch (err) {
      setError(errorMessage(err));
      setDraft((d) => (d.trim() ? d : clean));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const take = async (o: Offer) => {
    if (!neg) return;
    setError(null);
    try {
      const q = await api.createQuote(neg.id, o.candidateId);
      const url = `${window.location.origin}/app/offers/${q.id}`;
      window.open(url, "_blank", "noopener");
      setOpened({ url });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const choose = (slug: string) => {
    if (slug !== picked) {
      setPicked(slug);
      setOpened(null);
    }
    setBrowsing(false);
    setFilter("");
  };

  const latestOffers = useMemo(() => {
    const withOffers = [...(neg?.turns ?? [])].reverse().find((t) => t.offers?.length);
    return (withOffers?.offers ?? neg?.offers ?? []).filter((o) => o.status !== "rejected").slice(0, 3);
  }, [neg]);

  const close = () => window.parent?.postMessage({ type: "proteus:close" }, "*");
  const shown = visibleTurns(neg);
  const started = shown.length > 0 || earlier.length > 0 || pending !== null;
  const matches = products.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const agentName = seller ? `${seller.name}'s agent` : "Deal agent";
  const mark = seller ? <SellerMark name={seller.name} brand={seller.brand} size="sm" /> : null;

  if (sellerQ.isError)
    return (
      <div className={e.page} data-app>
        <div className={e.root}><p className={e.empty}>This deal agent is not available.</p></div>
      </div>
    );

  return (
    <div className={e.page} data-app style={{ ["--accent" as string]: accent }}>
      <div className={e.root} role="region" aria-label={seller ? `${seller.name} deal agent` : "Deal agent"}>
        <header className={e.head}>
          {seller && <SellerMark name={seller.name} brand={seller.brand} size="md" />}
          <div className={e.headText}>
            <strong>{seller?.name ?? "…"}</strong>
            <span><i className={e.live} aria-hidden /> Deal agent · replies in seconds</span>
          </div>
          {closable && (
            <button type="button" className={e.close} onClick={close} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </header>

        <div className={e.body} ref={scroller} role="log" aria-live="polite">
          {greeting && (
            <div className={e.agentRow}>
              {mark}
              <div className={e.agentCol}>
                <div className={e.agentMeta}><b>{agentName}</b></div>
                <div className={e.greet}>
                  <p>{greeting.opening}{greeting.catalog && ` ${greeting.catalog}`}</p>
                  {greeting.facts.length > 0 && (
                    <ul className={e.facts} aria-label="Before you order">
                      {greeting.facts.map((f) => (
                        <li key={f.kind}><Check size={14} strokeWidth={2.5} aria-hidden /><span><b>{f.label}:</b> {f.text}</span></li>
                      ))}
                    </ul>
                  )}
                  <p>{greeting.closing}</p>
                </div>
              </div>
            </div>
          )}

          {greeting && !started && (
            <div className={e.chips}>
              {greeting.chips.slice(0, 3).map((c) => (
                <button key={c.label} type="button" className={e.chip} onClick={() => void send(c.message)} disabled={busy}>{c.label}</button>
              ))}
              {products.length > 1 && (
                <button type="button" className={e.chip} onClick={() => setBrowsing(true)}><LayoutGrid size={13} aria-hidden /> Browse products</button>
              )}
            </div>
          )}

          {pickedProduct && !started && (
            <section className={e.card} aria-label={`${pickedProduct.name} pricing`}>
              <div className={e.cardTop}>
                <p className={e.cardTitle}>{pickedProduct.name}</p>
                {products.length > 1 && <button type="button" className={e.change} onClick={() => setBrowsing(true)}>Change</button>}
              </div>
              <ul className={e.tiers}>
                {pickedProduct.tiers.map((t) => (
                  <li key={t.id}>
                    <span>{t.name}</span>
                    <span className={e.mono}>{Number(t.includedUnits).toLocaleString()} {unitFor(t.includedUnits, pickedProduct.unitLabel)} · {t.prepaidTotalUsd}</span>
                  </li>
                ))}
              </ul>
              <p className={e.muted}>Paid in USDC into escrow; you pay only for delivered {pluralUnit(pickedProduct.unitLabel)}.</p>
            </section>
          )}

          {earlier.map((x, k) => (
            <div key={`earlier-${k}`} style={{ display: "contents" }}>
              {x.turns.map((t) => <div key={t.id} className={t.role === "buyer" ? e.msgMe : e.msgAgent}>{t.content}</div>)}
              <p className={e.topic}>Now on {k + 1 < earlier.length ? earlier[k + 1]!.product : (neg?.productName ?? current?.name ?? "")}</p>
            </div>
          ))}
          {shown.map((t) => (
            <div key={t.id} className={t.role === "buyer" ? e.msgMe : e.msgAgent}>{t.content}</div>
          ))}
          {pending && <div className={e.msgMe}>{pending}</div>}
          {busy && <div className={e.msgAgent} aria-label="The agent is typing"><span className={e.typing}><i /><i /><i /></span></div>}

          {latestOffers.length > 0 && (
            <div className={e.offers}>
              {latestOffers.map((o) => (
                <div key={o.candidateId} className={e.offer}>
                  <div>
                    <p className={e.offerTitle}>{o.tierName}</p>
                    <p className={e.mono}>{Number(o.units).toLocaleString()} {unitFor(o.units, current?.unitLabel ?? neg?.unitLabel ?? "unit")} · {o.prepaidTotalUsd}</p>
                    {o.status === "approval_required" && <p className={e.muted}>Needs the seller's approval</p>}
                  </div>
                  <button type="button" className={e.take} onClick={() => take(o)}>Get this offer <ArrowUpRight size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {opened && (
            <p className={e.muted}>
              Opened in a new tab to review, sign and fund. <a href={opened.url} target="_blank" rel="noopener noreferrer">Open again</a>
            </p>
          )}
          {error && <p className={e.error} role="alert">{error}</p>}
        </div>

        <div className={e.composerWrap}>
          {products.length > 1 && (
            <div className={e.context}>
              Asking about
              <button type="button" onClick={() => setBrowsing(true)} aria-label="Choose a product">
                <span>{pickedProduct?.name ?? (current && started ? current.name : "All products")}</span>
                <ChevronDown size={13} aria-hidden />
              </button>
            </div>
          )}
          <form className={e.composer} onSubmit={(ev: FormEvent) => { ev.preventDefault(); void send(draft); }}>
            <input value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder={`Message ${agentName}`} aria-label="Message the deal agent" maxLength={4000} disabled={!products.length} enterKeyHint="send" />
            <button type="submit" disabled={!draft.trim() || busy || !products.length} aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
        <footer className={e.foot}>
          <span>Prices from {seller?.name ?? "the seller"}'s own rules · paid into escrow</span>
          <span aria-hidden>·</span>
          <a href="/" target="_blank" rel="noopener"><ArcMark size={10} /> Proteus AI</a>
        </footer>

        {browsing && (
          <div className={e.sheet} onClick={(ev) => ev.target === ev.currentTarget && setBrowsing(false)}>
            <div className={e.sheetPanel} role="dialog" aria-modal="true" aria-label="Products">
              <div className={e.sheetHead}>
                <strong>{products.length} products</strong>
                <button type="button" className={e.close} onClick={() => setBrowsing(false)} aria-label="Close products"><X size={16} /></button>
              </div>
              {products.length > 6 && <input className={e.search} value={filter} onChange={(ev) => setFilter(ev.target.value)} placeholder="Search products" aria-label="Search products" autoFocus={window.innerWidth >= 560} />}
              <ul className={e.grid}>
                {picked && <li><button type="button" className={e.pick} onClick={() => choose("")}><strong>All products</strong><span>The agent follows what you ask about</span></button></li>}
                {matches.map((p) => {
                  const from = fromPrice(p);
                  return (
                    <li key={p.slug}>
                      <button type="button" className={e.pick} aria-pressed={p.slug === picked} onClick={() => choose(p.slug)}>
                        <strong>{p.name}</strong>
                        {from && <span>from {from} a {p.unitLabel}</span>}
                      </button>
                    </li>
                  );
                })}
                {matches.length === 0 && <li className={e.noMatch}>No product matches “{filter}”.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
