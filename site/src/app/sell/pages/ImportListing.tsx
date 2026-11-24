/**
 * A prepared seller listing (site/public/listings/<name>.json) that the business publishes from its own signed-in
 * wallet: the account it creates is owned by that wallet, payouts go to it, and the business registers on Arc
 * itself. Prices are editable here, so nothing goes live that the seller did not see and approve.
 *
 * The listing file is served to anyone, so it carries public fields only. The seller's costs and limits are entered here
 * by the signed-in owner, sent to the authenticated product API, and kept in this page's memory until then.
 *
 * Order matters on chain: products are created unlisted, the seller registers on Arc (ERC-8004, from its own wallet),
 * the server confirms owner, payee and signer from chain and commits each product's policy to ProteusPolicyRegistry,
 * and only then are the products listed. No buyer can get a quote from an identity that is not on chain yet.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import { AgentIdentityCard } from "../developers/IdentityCards";
import { Card } from "../../ui/Card";
import { ActionButton } from "../../ui/ActionButton";
import { Notice } from "../../ui/misc";
import { SellerMark } from "../../ui/SellerMark";
import { SocialLinks } from "../../ui/SocialLinks";
import { SellerOnly } from "../../seller/parts/SellerOnly";
import { EMPTY_PRIVATE_TERMS, privateTermsBody, validatePrivateTerms, type PrivateTerms } from "../onboarding/privateTerms";
import { PrivateTermsFields } from "../onboarding/PrivateTermsFields";
import { useMe } from "../hooks";
import { useAuth, v1 } from "../v1";
import type { ProductCreateBody, SellerBrand } from "../../lib/types";
import s from "../sell.module.css";

interface Listing {
  /** ownerAddress: the business's own wallet; only it may publish this listing (owner and payee). */
  business: { name: string; slug: string; ownerAddress?: string; brand: SellerBrand };
  products: ListingProduct[];
}

type ListingProduct = Omit<ProductCreateBody, "cost" | "policy"> & { slug: string };

type Status = { slug: string; id?: string; state: "created" | "exists" | "failed"; detail?: string };

export default function ImportListing() {
  const { name = "" } = useParams();
  const { me, ready } = useMe();
  const { refetchMe } = useAuth();
  const qc = useQueryClient();
  const listing = useQuery({
    queryKey: ["sell", "listing", name],
    queryFn: async () => {
      const r = await fetch(`/listings/${encodeURIComponent(name)}.json`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("This listing link is not valid.");
      return (await r.json()) as Listing;
    },
    retry: false,
  });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState<Record<string, PrivateTerms>>({});
  const [checked, setChecked] = useState(false);
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Status[] | null>(null);
  const [live, setLive] = useState<{ agentId: string; policies: { product: string; tx: string | null }[] } | null>(null);
  const saved = useQuery({ queryKey: ["sell", "import-products", me?.org?.slug], queryFn: () => v1.app.products(), retry: false, enabled: Boolean(me?.org) });
  const agent = useQuery({ queryKey: ["sell", "agent"], queryFn: () => v1.app.agent(), retry: false, enabled: Boolean(done) });

  if (!ready || listing.isPending) return <div className={s.page}><Card title="Loading the listing" /></div>;
  if (listing.isError || !listing.data) return <div className={s.page}><Notice tone="danger" title="Listing not found">{(listing.error as Error)?.message}</Notice></div>;
  const l = listing.data;
  const otherOrg = me?.org && me.org.slug !== l.business.slug ? me.org : null;
  const primary = me?.wallets?.find((w) => w.primary)?.address;
  const expected = l.business.ownerAddress;
  const wrongWallet = Boolean(expected && primary && primary.toLowerCase() !== expected.toLowerCase());
  const canPublish = Boolean(primary) && !wrongWallet;
  const isSaved = (slug: string) => Boolean(saved.data?.some((p) => p.slug === slug));
  const termsOf = (slug: string) => terms[slug] ?? EMPTY_PRIVATE_TERMS;
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  async function discard() {
    setBusy(true);
    setError(null);
    try {
      await v1.discardOrg();
      refetchMe();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["sell"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const key = (p: string, i: number) => `${p}:${i}`;

  async function publish() {
    setBusy(true);
    setError(null);
    setChecked(true);
    const out: Status[] = [];
    try {
      // Products already in the account keep their stored prices and limits, so only new ones need private terms.
      const existing = new Set(me?.org ? (await v1.app.products()).map((p) => p.slug) : []);
      const missing = l.products.filter((p) => !skip[p.slug] && !existing.has(p.slug) && Object.keys(validatePrivateTerms(termsOf(p.slug))).length);
      if (missing.length) {
        setError(`Enter your private costs and limits for ${missing.map((p) => p.name).join(", ")}.`);
        return;
      }
      if (!me?.org) await v1.createOrg({ name: l.business.name, slug: l.business.slug, brand: l.business.brand });
      for (const p of l.products) {
        if (skip[p.slug]) continue;
        if (existing.has(p.slug)) {
          out.push({ slug: p.slug, state: "exists" });
          continue;
        }
        const body: ProductCreateBody = { ...p, ...privateTermsBody(termsOf(p.slug)), tiers: p.tiers.map((t, i) => ({ ...t, unitPriceUsd: (prices[key(p.slug, i)] ?? t.unitPriceUsd).trim() })) };
        try {
          const created = (await v1.app.createProduct(body)) as unknown as { id: string };
          await v1.app.setListing(created.id, false); // listed only after the identity and policies are on chain
          out.push({ slug: p.slug, id: created.id, state: "created" });
        } catch (e) {
          out.push({ slug: p.slug, state: "failed", detail: (e as Error).message });
        }
      }
      setDone(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      refetchMe();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["sell"] });
    }
  }

  async function goLive(agentId: string, policies: { product: string; tx: string | null }[]) {
    setBusy(true);
    setError(null);
    try {
      for (const d of done ?? []) if (d.id) await v1.app.setListing(d.id, true);
      setLive({ agentId, policies });
      qc.invalidateQueries({ queryKey: ["sell"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.page}>
      <Card title={`Publish ${l.business.name} on Proteus AI`} subtitle="Check every product and price. Publishing creates the seller account on the wallet you are signed in with: you own it, and payouts go to that wallet.">
        <div className={s.row} style={{ gap: 12 }}>
          <SellerMark name={l.business.name} brand={l.business.brand} size="sm" />
          <strong>{l.business.name}</strong>
          {l.business.brand.website && <a href={l.business.brand.website} target="_blank" rel="noreferrer">{new URL(l.business.brand.website).hostname}</a>}
          <SocialLinks socials={l.business.brand.socials} />
        </div>
        {l.business.brand.tagline && <p style={{ marginTop: 8 }}>{l.business.brand.tagline}</p>}
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>Signed in as {primary ?? "your wallet"}. This wallet becomes the owner and payout address{expected ? `; it must be ${l.business.name}'s wallet ${expected}` : ""}.</p>
      </Card>

      {wrongWallet && (
        <Notice tone="warn" title={`This listing belongs to ${l.business.name}'s wallet ${short(expected!)}`}>
          You are signed in as {short(primary!)}. {l.business.name} publishes it from its own wallet, so it owns the account and is paid directly.
          {me?.org && me.org.slug === l.business.slug && (
            <span className={s.row} style={{ marginTop: 10 }}>
              A draft from this wallet is holding the name. <ActionButton size="sm" variant="secondary" onClick={discard} loading={busy}>Discard my draft</ActionButton>
            </span>
          )}
        </Notice>
      )}
      {!primary && <Notice tone="info" title="Sign in to publish">Only {l.business.name}'s own wallet can enter its private costs and limits and publish this listing.</Notice>}
      {otherOrg && <Notice tone="warn" title={`This wallet already sells as ${otherOrg.name}`}>Products will be added to {otherOrg.name}, not to a new {l.business.name} account. Sign in with {l.business.name}'s own wallet instead.</Notice>}

      {l.products.map((p) => (
        <Card key={p.slug} title={p.name} subtitle={p.summary} actions={<label className={s.row}><input type="checkbox" checked={!skip[p.slug]} onChange={(e) => setSkip({ ...skip, [p.slug]: !e.target.checked })} /> Publish</label>}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7 }}><th>Tier</th><th>Quantity</th><th>Price per {p.unitLabel} (USD)</th><th>Includes</th></tr>
            </thead>
            <tbody>
              {p.tiers.map((t, i) => (
                <tr key={t.name} style={{ borderTop: "1px solid var(--c-line, #eee)" }}>
                  <td style={{ padding: "8px 0" }}>{t.name}</td>
                  <td>{String(t.includedUnits)}</td>
                  <td><input aria-label={`${t.name} price per ${p.unitLabel}`} inputMode="decimal" value={prices[key(p.slug, i)] ?? t.unitPriceUsd} onChange={(e) => setPrices({ ...prices, [key(p.slug, i)]: e.target.value })} style={{ width: 90 }} /></td>
                  <td style={{ fontSize: 13 }}>{t.includes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>{p.refundPolicy}</p>
          {isSaved(p.slug) ? (
            <p style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>Already in your account. Its saved prices and limits stay as they are.</p>
          ) : (
            canPublish && !done && !skip[p.slug] && (
              <SellerOnly as="div" title="Your costs and limits" description="Private. Your agent never quotes below these and never shows them to buyers.">
                <PrivateTermsFields
                  input={(k) => ({
                    id: `private-${p.slug}-${k}`,
                    value: termsOf(p.slug)[k],
                    onChange: (e) => setTerms((t) => ({ ...t, [p.slug]: { ...(t[p.slug] ?? EMPTY_PRIVATE_TERMS), [k]: e.target.value } })),
                    error: checked ? validatePrivateTerms(termsOf(p.slug))[k] : undefined,
                  })}
                />
              </SellerOnly>
            )
          )}
        </Card>
      ))}

      {error && <Notice tone="danger" title="Could not publish">{error}</Notice>}
      {done ? (
        <>
          <Card title="1. Products saved, not listed yet" subtitle="They stay off the market until your identity and pricing policies are on Arc.">
            <ul>
              {done.map((d) => (
                <li key={d.slug} className={s.row}><CheckCircle2 size={14} aria-hidden /> {d.slug}: {d.state === "created" ? "saved" : d.state}{d.detail ? `: ${d.detail}` : ""}</li>
              ))}
            </ul>
          </Card>
          {live ? (
            <Card title="3. Live on the market" subtitle={`Agent #${live.agentId} on Arc. Each product's pricing policy is committed to ProteusPolicyRegistry; quotes embed it and buyers can check it before paying.`}>
              <ul>
                {live.policies.map((p) => (
                  <li key={p.product} className={s.row}><CheckCircle2 size={14} aria-hidden /> {p.product}: {p.tx ? <a href={explorerTx(p.tx)} target="_blank" rel="noreferrer">policy committed</a> : "policy commits at the first quote"}</li>
                ))}
              </ul>
              <div className={s.row} style={{ marginTop: 12 }}>
                <ActionButton to={`/app/market/${l.business.slug}`} icon>See the listing</ActionButton>
              </div>
            </Card>
          ) : agent.data?.registered ? (
            <Card title="2. Already registered on Arc" subtitle={`Agent #${agent.data.registered.agentId}. New products commit their policy at the first quote.`}>
              <ActionButton onClick={() => goLive(agent.data!.registered!.agentId, [])} loading={busy}>List on the market</ActionButton>
            </Card>
          ) : (
            <AgentIdentityCard onRegistered={(r) => goLive(r.agentId, r.policies ?? [])} />
          )}
        </>
      ) : (
        <div className={s.row}>
          <ActionButton onClick={publish} loading={busy} loadingLabel="Publishing" disabled={!canPublish}>Publish {l.business.name}</ActionButton>
        </div>
      )}
    </div>
  );
}
