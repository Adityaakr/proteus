/**
 * A prepared seller listing (site/public/listings/<name>.json) that the business publishes from its own signed-in
 * wallet: the account it creates is owned by that wallet, payouts go to it, and the business registers on Arc
 * itself afterwards. Prices are editable here, so nothing goes live that the seller did not see and approve.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Card } from "../../ui/Card";
import { ActionButton } from "../../ui/ActionButton";
import { Notice } from "../../ui/misc";
import { SellerMark } from "../../ui/SellerMark";
import { SocialLinks } from "../../ui/SocialLinks";
import { useMe } from "../hooks";
import { useAuth, v1 } from "../v1";
import type { ProductCreateBody, SellerBrand } from "../../lib/types";
import s from "../sell.module.css";

interface Listing {
  business: { name: string; slug: string; brand: SellerBrand };
  products: (ProductCreateBody & { slug: string })[];
}

type Status = { slug: string; state: "created" | "exists" | "failed"; detail?: string };

export default function ImportListing() {
  const { name = "" } = useParams();
  const { me, ready } = useMe();
  const { refetchMe } = useAuth();
  const qc = useQueryClient();
  const listing = useQuery({
    queryKey: ["sell", "listing", name],
    queryFn: async () => {
      const r = await fetch(`/listings/${encodeURIComponent(name)}.json`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("This listing link is not valid.");
      return (await r.json()) as Listing;
    },
    retry: false,
  });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Status[] | null>(null);

  if (!ready || listing.isPending) return <div className={s.page}><Card title="Loading the listing" /></div>;
  if (listing.isError || !listing.data) return <div className={s.page}><Notice tone="danger" title="Listing not found">{(listing.error as Error)?.message}</Notice></div>;
  const l = listing.data;
  const otherOrg = me?.org && me.org.slug !== l.business.slug ? me.org : null;
  const key = (p: string, i: number) => `${p}:${i}`;

  async function publish() {
    setBusy(true);
    setError(null);
    const out: Status[] = [];
    try {
      if (!me?.org) await v1.createOrg({ name: l.business.name, slug: l.business.slug, brand: l.business.brand });
      const existing = new Set((await v1.app.products()).map((p) => p.slug));
      for (const p of l.products) {
        if (skip[p.slug]) continue;
        if (existing.has(p.slug)) {
          out.push({ slug: p.slug, state: "exists" });
          continue;
        }
        const body = { ...p, tiers: p.tiers.map((t, i) => ({ ...t, unitPriceUsd: (prices[key(p.slug, i)] ?? t.unitPriceUsd).trim() })) };
        try {
          await v1.app.createProduct(body);
          out.push({ slug: p.slug, state: "created" });
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
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>Signed in as {me?.wallets?.find((w) => w.primary)?.address ?? "your wallet"}. This wallet becomes the owner and payout address.</p>
      </Card>

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
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            The agent never quotes below your floor: cost ${p.cost.variableCostPerUnitUsd} per {p.unitLabel} plus at least {p.policy.minMarginBps / 100}% margin, and at most {p.policy.maxDiscountBps / 100}% off list. Offers above ${p.policy.approvalThresholdUsd} wait for your approval. {p.refundPolicy}
          </p>
        </Card>
      ))}

      {error && <Notice tone="danger" title="Could not publish">{error}</Notice>}
      {done ? (
        <Card title="Published" subtitle="Next, register on Arc from this wallet so buyers and their agents can verify you on chain before paying.">
          <ul>
            {done.map((d) => (
              <li key={d.slug} className={s.row}><CheckCircle2 size={14} aria-hidden /> {d.slug}: {d.state}{d.detail ? `: ${d.detail}` : ""}</li>
            ))}
          </ul>
          <div className={s.row} style={{ marginTop: 12 }}>
            <ActionButton to="/app/sell/settings" icon>Register on Arc</ActionButton>
            <ActionButton to={`/app/market/${l.business.slug}`} variant="secondary">See the listing</ActionButton>
          </div>
        </Card>
      ) : (
        <div className={s.row}>
          <ActionButton onClick={publish} loading={busy} loadingLabel="Publishing">Publish {l.business.name}</ActionButton>
        </div>
      )}
    </div>
  );
}
