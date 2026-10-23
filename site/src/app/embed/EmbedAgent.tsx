import { pluralUnit, unitFor } from "@proteus/domain";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Send, X } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { Negotiation, Offer } from "../lib/types";
import { SellerMark } from "../ui/SellerMark";
import { ArcMark } from "../ui/Marks";
import e from "./embed.module.css";

/**
 * The seller's deal agent, embedded on the seller's own website (iframe from /embed.js). A visitor sees the seller's
 * products and public prices, asks questions, and gets offers that come from the seller's rules in code; the model
 * only writes the words. "Get this offer" creates a quote and opens Proteus AI in a new top-level tab to sign and fund:
 * nothing is ever signed inside the embedding page.
 */
export default function EmbedAgent() {
  const { sellerSlug = "" } = useParams();
  const [params] = useSearchParams();
  const sellerQ = useQuery({ queryKey: ["embed-seller", sellerSlug], queryFn: () => api.seller(sellerSlug), retry: false });
  const seller = sellerQ.data;
  const products = seller?.products ?? [];
  const [productSlug, setProductSlug] = useState<string>(params.get("product") ?? "");
  const product = products.find((p) => p.slug === productSlug) ?? products[0];
  const [neg, setNeg] = useState<Negotiation | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ url: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const accent = seller?.brand?.accent && /^#[0-9a-f]{6}$/i.test(seller.brand.accent) ? seller.brand.accent : "#1b4dff";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [neg?.turns.length, busy]);

  const send = async (text: string) => {
    if (!product || !text.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      let n = neg;
      if (!n || n.productSlug !== product.slug) {
        n = await api.startNegotiation({ sellerSlug, productSlug: product.slug }, { embed: sellerSlug });
      }
      setNeg(await api.sendMessage(n.id, text.trim()));
      setDraft("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
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

  const latestOffers = useMemo(() => {
    const withOffers = [...(neg?.turns ?? [])].reverse().find((t) => t.offers?.length);
    return (withOffers?.offers ?? neg?.offers ?? []).filter((o) => o.status !== "rejected").slice(0, 3);
  }, [neg]);

  const close = () => window.parent?.postMessage({ type: "proteus:close" }, "*");

  if (sellerQ.isError) return <div className={e.root} data-app><p className={e.empty}>This deal agent is not available.</p></div>;

  return (
    <div className={e.root} data-app style={{ ["--accent" as string]: accent }}>
      <header className={e.head}>
        {seller && <SellerMark name={seller.name} brand={seller.brand} size="sm" />}
        <div className={e.headText}>
          <strong>{seller?.name ?? "…"}</strong>
          <span>Deal agent · replies in seconds</span>
        </div>
        <button type="button" className={e.close} onClick={close} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      {products.length > 1 && (
        <div className={e.products} role="tablist" aria-label="Products">
          {products.map((p) => (
            <button key={p.slug} type="button" role="tab" aria-selected={p.slug === product?.slug} className={e.productTab} onClick={() => { setProductSlug(p.slug); setNeg(null); setOpened(null); }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className={e.body} ref={scroller}>
        {product && (
          <section className={e.card} aria-label="Pricing">
            <p className={e.cardTitle}>{product.name}</p>
            {product.summary && <p className={e.muted}>{product.summary}</p>}
            <ul className={e.tiers}>
              {product.tiers.map((t) => (
                <li key={t.id}>
                  <span>{t.name}</span>
                  <span className={e.mono}>{Number(t.includedUnits).toLocaleString()} {unitFor(t.includedUnits, product.unitLabel)} · {t.prepaidTotalUsd}</span>
                </li>
              ))}
            </ul>
            <p className={e.muted}>Prepaid in USDC into escrow on Arc; you pay only for delivered {pluralUnit(product.unitLabel)} and get the rest back.</p>
          </section>
        )}

        {!neg && product && (
          <div className={e.starters}>
            {(product.starters.length ? product.starters : [`What does the ${product.tiers[0]?.name ?? "starter"} package include?`, "Can you fit my budget?"]).slice(0, 3).map((s) => (
              <button key={s} type="button" className={e.starter} onClick={() => send(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        )}

        {neg?.turns.filter((t) => t.role !== "system" && t.content).map((t) => (
          <div key={t.id} className={t.role === "buyer" ? e.msgMe : e.msgAgent}>{t.content}</div>
        ))}
        {busy && <div className={e.msgAgent} aria-live="polite"><span className={e.typing}><i /><i /><i /></span></div>}

        {latestOffers.length > 0 && (
          <div className={e.offers}>
            {latestOffers.map((o) => (
              <div key={o.candidateId} className={e.offer}>
                <div>
                  <p className={e.offerTitle}>{o.tierName}</p>
                  <p className={e.mono}>{Number(o.units).toLocaleString()} {unitFor(o.units, product?.unitLabel ?? "unit")} · {o.prepaidTotalUsd}</p>
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

      <form className={e.composer} onSubmit={(ev: FormEvent) => { ev.preventDefault(); void send(draft); }}>
        <input value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="Volume, budget, questions…" aria-label="Message the deal agent" maxLength={4000} disabled={!product} />
        <button type="submit" disabled={!draft.trim() || busy || !product} aria-label="Send"><Send size={16} /></button>
      </form>
      <footer className={e.foot}>
        Prices come from {seller?.name ?? "the seller"}'s rules, not the AI · <ArcMark size={10} /> <a href="/" target="_blank" rel="noopener">Proteus AI</a>
      </footer>
    </div>
  );
}
