import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { ActionButton, Card, Field, Notice } from "../../seller/kit";
import { SellerOnly } from "../../seller/parts/SellerOnly";
import { errorMessage } from "../../seller/transport";
import { sellPath } from "../../seller/paths";
import { usePublishProduct } from "../hooks";
import type { MeOrg } from "../types";
import { ChipInput } from "./ChipInput";
import { Preview } from "./Preview";
import { EMPTY, EXAMPLE, newTier, toBody, toBrand, validate, type FormState, type TierRow } from "./form";
import { BrandFields } from "../BrandFields";
import s from "../sell.module.css";

const CAPABILITY_SUGGESTIONS = ["Order status", "Delivery questions", "Returns", "Human handoff", "Refund status"];
const INTEGRATION_SUGGESTIONS = ["rest-api", "shopify", "zendesk", "intercom", "gorgias"];

/** One screen, one primary action: publish the first product (creating the seller org when needed). */
export default function StartSelling({ org }: { org?: MeOrg }) {
  const nav = useNavigate();
  const publish = usePublishProduct();
  const [f, setF] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const hasOrg = Boolean(org);
  const errors = useMemo(() => validate(f, hasOrg), [f, hasOrg]);
  const err = (key: string) => (submitted || touched[key] ? errors[key] : undefined);
  const touch = (key: string) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const set = <K extends keyof FormState>(key: K, v: FormState[K]) => setF((p) => ({ ...p, [key]: v }));
  const input = (key: keyof FormState) => ({
    id: `f-${key}`,
    value: f[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    onBlur: touch(key),
    error: err(key),
  });
  const setTier = (key: string, patch: Partial<TierRow>) => set("tiers", f.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const keys = Object.keys(errors);
    if (keys.length) {
      const first = keys[0]!;
      const el = document.getElementById(first.startsWith("tier.") ? `f-${first}` : `f-${first}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    publish.mutate(
      { hasOrg, businessName: f.businessName, brand: hasOrg ? undefined : toBrand(f), body: toBody(f) },
      { onSuccess: (p) => nav(sellPath("products", p.id)) },
    );
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className={s.page}>
      <header className={s.intro}>
        <span className={s.eyebrow}>Start selling</span>
        <h2 className="h3">Publish your first product</h2>
        <p className="body3">
          Describe what you sell, set public tiers, and give your negotiation agent the private floor it can never cross. Buyers only ever see the public part.
        </p>
        <button type="button" className={s.textBtn} onClick={() => { setF({ ...EXAMPLE, businessName: hasOrg ? "" : EXAMPLE.businessName }); setTouched({}); }}>
          <Sparkles size={14} aria-hidden />
          Fill with the order support example
        </button>
      </header>

      <form className={s.onboard} onSubmit={onSubmit} noValidate>
        <div className={s.formCol}>
          <Card title="Business">
            {hasOrg ? (
              <p className="body3">
                Publishing as <span className={s.strong}>{org!.name}</span>. Your seller org and signer already exist.
              </p>
            ) : (
              <div className={s.fields}>
                <Field label="Business name" placeholder="Northwind Commerce" hint="Shown to buyers on your market page." autoComplete="organization" {...input("businessName")} />
                <BrandFields name={f.businessName} value={f.brand} onChange={(b) => set("brand", b)} errors={{ tagline: err("brand.tagline"), website: err("brand.website") }} />
              </div>
            )}
          </Card>

          <Card title="Product" subtitle="What buyers negotiate for.">
            <div className={s.fields}>
              <div className={s.grid2}>
                <Field label="Product name" placeholder="AI order support" {...input("productName")} />
                <Field label="One-line summary" placeholder="Order status and delivery answers from the order record." hint="Shown on your market card." {...input("summary")} maxLength={160} />
                <Field label="Unit label" placeholder="resolution" hint="The word for one billable unit." {...input("unitLabel")} />
              </div>
              <Field
                label="Billable unit definition"
                multiline
                rows={2}
                placeholder="one delivered order-status answer sourced from the store's order record"
                hint="One sentence. This is what a buyer pays for, and what usage is counted against."
                {...input("billableUnit")}
              />
              <ChipInput
                id="f-capabilities"
                label="Capabilities"
                values={f.capabilities}
                onChange={(v) => set("capabilities", v)}
                onBlur={touch("capabilities")}
                suggestions={CAPABILITY_SUGGESTIONS}
                placeholder="Type a capability and press Enter"
                error={err("capabilities")}
              />
              <ChipInput
                id="f-integrations"
                label="Supported integrations"
                values={f.integrations}
                onChange={(v) => set("integrations", v)}
                suggestions={INTEGRATION_SUGGESTIONS}
                placeholder="Type an integration id and press Enter"
                hint="Requests for anything else are disclosed to the buyer and left out of the terms."
              />
            </div>
          </Card>

          <Card title="Public pricing" subtitle="Tiers are volume thresholds. A tier's unit price applies at or above its included units.">
            <div className={s.fields}>
              <div className={s.tierHead} aria-hidden>
                <span>Tier name</span>
                <span>Included units</span>
                <span>Unit price USD</span>
                <span>Includes</span>
                <span />
              </div>
              <ol className={s.tierList}>
                {f.tiers.map((t, i) => (
                  <li key={t.key} className={s.tierRow}>
                    <Field id={`f-tier.${t.key}.name`} label="Tier name" className={s.tierCell} placeholder={i === 0 ? "Starter" : "Growth"} value={t.name} onChange={(e) => setTier(t.key, { name: e.target.value })} onBlur={touch(`tier.${t.key}.name`)} error={err(`tier.${t.key}.name`)} />
                    <Field id={`f-tier.${t.key}.includedUnits`} label="Included units" className={s.tierCell} inputMode="numeric" placeholder="1500" value={t.includedUnits} onChange={(e) => setTier(t.key, { includedUnits: e.target.value })} onBlur={touch(`tier.${t.key}.includedUnits`)} error={err(`tier.${t.key}.includedUnits`)} />
                    <Field id={`f-tier.${t.key}.unitPriceUsd`} label="Unit price USD" className={s.tierCell} inputMode="decimal" placeholder="0.96" value={t.unitPriceUsd} onChange={(e) => setTier(t.key, { unitPriceUsd: e.target.value })} onBlur={touch(`tier.${t.key}.unitPriceUsd`)} error={err(`tier.${t.key}.unitPriceUsd`)} />
                    <Field id={`f-tier.${t.key}.includes`} label="Includes" className={s.tierCell} placeholder="Order status, Human handoff" hint={i === f.tiers.length - 1 ? "Comma separated." : undefined} value={t.includes} onChange={(e) => setTier(t.key, { includes: e.target.value })} />
                    <button type="button" className={s.iconBtn} aria-label={`Remove tier ${t.name || i + 1}`} disabled={f.tiers.length === 1} onClick={() => set("tiers", f.tiers.filter((x) => x.key !== t.key))}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
              {err("tiers") && <Notice tone="danger">{err("tiers")}</Notice>}
              <div>
                <ActionButton variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={() => set("tiers", [...f.tiers, newTier()])} disabled={f.tiers.length >= 6}>
                  Add tier
                </ActionButton>
              </div>
              <div className={s.grid2}>
                <Field label="Max units per deal" inputMode="numeric" placeholder="10000" {...input("maxUnitsPerDeal")} />
                <Field label="Term days" inputMode="numeric" placeholder="30" {...input("termDays")} />
              </div>
              <Field label="Refund policy" multiline rows={2} placeholder="Unused prepaid units are refunded to the buyer's wallet when the term ends." {...input("refundPolicy")} />
            </div>
          </Card>

          <SellerOnly title="Your economics" description="Private. Your agent prices against these numbers and never reveals them to buyers.">
            <div className={s.grid3}>
              <PrivField label="Variable cost per unit USD" placeholder="0.48" hint="What one unit costs you to deliver." {...input("variableCostUsd")} inputMode="decimal" />
              <PrivField label="Direct cost per deal USD" placeholder="150" hint="Setup or onboarding per deal." {...input("directCostUsd")} inputMode="decimal" />
              <PrivField label="Transaction cost bps" placeholder="50" hint="100 bps is 1% of revenue." {...input("txCostBps")} inputMode="numeric" />
              <PrivField label="Minimum margin %" placeholder="35" hint="The floor. Offers below it are refused." {...input("minMarginPct")} inputMode="decimal" />
              <PrivField label="Max discount %" placeholder="15" hint="From list unit price." {...input("maxDiscountPct")} inputMode="decimal" />
              <PrivField label="Approval threshold USD" placeholder="3000" hint="Larger deals wait for you." {...input("approvalThresholdUsd")} inputMode="decimal" />
              <PrivField label="Prepaid minimum USD" placeholder="500" hint="Smallest deal you accept." {...input("prepaidMinimumUsd")} inputMode="decimal" />
              <PrivField label="Available capacity units" placeholder="20000" hint="Units you can still commit." {...input("capacityUnits")} inputMode="numeric" />
              <PrivField label="Quote validity hours" placeholder="48" hint="How long an offer can be signed." {...input("quoteValidityHours")} inputMode="numeric" />
            </div>
          </SellerOnly>

          <Card title="Service endpoint" subtitle="What answers each metered request. Buyers call PROTEUS; PROTEUS calls this and bills only what it reports as delivered.">
            <div className={s.choiceRow} role="radiogroup" aria-label="Service endpoint">
              <label className={`${s.choice} ${f.serviceKind === "http" ? s.choiceOn : ""}`}>
                <input type="radio" name="serviceKind" value="http" checked={f.serviceKind === "http"} onChange={() => set("serviceKind", "http")} />
                <span>
                  <strong>My own endpoint</strong>
                  <span className="body3">Your HTTPS API receives a JSON request and answers with a JSON result. Real service, real metering.</span>
                </span>
              </label>
              <label className={`${s.choice} ${f.serviceKind === "sample" ? s.choiceOn : ""}`}>
                <input type="radio" name="serviceKind" value="sample" checked={f.serviceKind === "sample"} onChange={() => set("serviceKind", "sample")} />
                <span>
                  <strong>Sample order store</strong>
                  <span className="body3">First-party order-support demo over seeded sample orders. Labeled as a demo to buyers.</span>
                </span>
              </label>
            </div>
            {f.serviceKind === "http" ? (
              <div className={s.grid2}>
                <Field label="Endpoint URL" placeholder="https://api.yourcompany.com/proteus" hint="POST, JSON in, JSON out. See docs/api.md, Bring your own endpoint." {...input("upstreamUrl")} inputMode="url" autoComplete="off" />
                <Field label="Secret" type="password" placeholder="Optional" hint="Sent on every call. Stored encrypted, never shown again." {...input("upstreamSecret")} autoComplete="new-password" />
                <Field label="Secret header" placeholder="Authorization" hint="Leave empty to send it as a Bearer token." {...input("upstreamAuthHeader")} autoComplete="off" />
              </div>
            ) : (
              <Notice tone="info">Buyers see a "Demo seller" label on products backed by the sample store. Switch to your own endpoint when your service is ready.</Notice>
            )}
          </Card>

          <Card title="Pay per call" subtitle="Optional. Lets buyers try one call at a time before committing to a prepaid deal.">
            <Field label="Pay per call price USD" placeholder="1.20" inputMode="decimal" hint="Leave empty to offer negotiated deals only." {...input("perCallUsd")} />
          </Card>

          <div className={s.submitRow}>
            {publish.isError && <Notice tone="danger" title="Could not publish">{errorMessage(publish.error)}</Notice>}
            {submitted && errorCount > 0 && (
              <Notice tone="warn">
                {errorCount === 1 ? "One field needs attention" : `${errorCount} fields need attention`} before you can publish.
              </Notice>
            )}
            <ActionButton type="submit" size="lg" icon loading={publish.isPending} loadingLabel={hasOrg ? "Publishing product" : "Creating your org and publishing"}>
              Publish product
            </ActionButton>
            <p className={s.hint}>
              {hasOrg ? "Publishing adds the product with cost v1 and policy v1." : "Publishing creates your seller org and its signer, then publishes the product with cost v1 and policy v1."} You can change pricing and policy later.
            </p>
          </div>
        </div>

        <aside className={s.previewCol} aria-label="Live preview">
          <Preview form={f} errors={errors} />
        </aside>
      </form>
    </div>
  );
}

function PrivField(props: Parameters<typeof Field>[0] & { label: ReactNode }) {
  return <Field {...props} className={s.privField} />;
}
