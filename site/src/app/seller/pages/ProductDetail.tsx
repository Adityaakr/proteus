import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Calculator } from "lucide-react";
import type { CostUpdateBody, PolicyUpdateBody } from "@proteus/domain";
import { ActionButton, Card, Field, Money, Notice, StatusTag } from "../kit";
import { usePreview, useProduct, useUpdateCost, useUpdatePolicy } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { SellerOnly } from "../parts/SellerOnly";
import { CandidateTable } from "../parts/CandidateTable";
import { RULE_TEXT, bpsToInput, dateTime, duration, microToInput, pct, pctToBps, unitPrice, units, usdToMicro } from "../format";
import { errorMessage } from "../transport";
import type { ProductWithPrivate, WireCandidate } from "../types";
import s from "../seller.module.css";

export default function ProductDetail() {
  const { id = "" } = useParams();
  const q = useProduct(id);
  return (
    <div className={s.page}>
      <PageHeader title={q.data?.name ?? "Product"} back={{ to: "/app/sell/products", label: "Products" }} description={q.data?.billableUnit} />
      <QueryView q={q} label="product">
        {(p) => <ProductBody p={p} />}
      </QueryView>
    </div>
  );
}

function ProductBody({ p }: { p: ProductWithPrivate }) {
  return (
    <>
      <PublicProduct p={p} />
      <PrivateSummary p={p} />
      <div className={s.grid2}>
        <PolicyForm p={p} />
        <CostForm p={p} />
      </div>
      <Preview p={p} />
    </>
  );
}

function PublicProduct({ p }: { p: ProductWithPrivate }) {
  return (
    <Card title="Public offer" subtitle="Exactly what buyers and their agents see." actions={<StatusTag tone="info" label="Visible to buyers" />}>
      <div className={s.tiers}>
        {p.tiers.map((t) => {
          const total = (BigInt(t.includedUnits) * BigInt(t.unitPrice.num)) / BigInt(t.unitPrice.den);
          return (
            <div key={t.id} className={s.tier}>
              <div className={s.between}>
                <span className="h6">{t.name}</span>
                <span className="body3">{units(t.includedUnits)} {p.unitLabel}s</span>
              </div>
              <div>
                <span className={s.tierPrice}>{unitPrice(t.unitPrice, 2)}</span>
                <span className="body3"> per {p.unitLabel}</span>
              </div>
              <span className="body3">
                Prepaid <Money micro={total.toString()} />
                {t.overagePrice && (
                  <>
                    , overage <Money micro={(BigInt(t.overagePrice.num) / BigInt(t.overagePrice.den)).toString()} />
                  </>
                )}
              </span>
              <div className={s.chips}>
                {t.includes.map((i) => (
                  <span key={i} className={s.chip}>{i}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.grid2}>
        <div className={s.stack} style={{ gap: 6 }}>
          <span className={`body3 ${s.strong}`}>Capabilities</span>
          <div className={s.chips}>{p.capabilities.map((c) => <span key={c} className={s.chip}>{c}</span>)}</div>
        </div>
        <div className={s.stack} style={{ gap: 6 }}>
          <span className={`body3 ${s.strong}`}>Supported integrations</span>
          <div className={s.chips}>{p.supportedIntegrations.map((c) => <span key={c} className={`${s.chip} ${s.mono}`}>{c}</span>)}</div>
        </div>
      </div>
      <p className="body3">
        {p.termDays} day term, up to {units(p.maxUnitsPerDeal)} units per deal. {p.refundPolicy}
      </p>
    </Card>
  );
}

function Fig({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={s.fig}>
      <span className={s.figLabel}>{label}</span>
      <span className={s.figValue}>{value}</span>
    </div>
  );
}

function PrivateSummary({ p }: { p: ProductWithPrivate }) {
  const stale = Date.now() > p.cost.freshUntil;
  return (
    <SellerOnly
      title="Private cost model and policy"
      description="The agent evaluates every offer against these numbers. Buyers never see them, only the public reason when an offer is unavailable."
      actions={<span className={`body3 ${s.small}`}>Policy v{p.policy.version} · Cost v{p.cost.version}</span>}
    >
      <div className={s.figs}>
        <Fig label="Minimum margin" value={pct(p.policy.minMarginBps)} />
        <Fig label="Maximum discount" value={pct(p.policy.maxDiscountBps)} />
        <Fig label="Approval threshold" value={<Money micro={p.policy.approvalThreshold} />} />
        <Fig label="Prepaid minimum" value={<Money micro={p.policy.prepaidMinimum} />} />
        <Fig label="Available capacity" value={`${units(p.policy.availableCapacityUnits)} units`} />
        <Fig label="Quote validity" value={duration(p.policy.quoteTtlSeconds)} />
      </div>
      <div className={s.figs}>
        <Fig label="Variable cost per unit" value={<Money micro={p.cost.variableCostPerUnit} digits={4} />} />
        <Fig label="Direct cost per deal" value={<Money micro={p.cost.directCostPerDeal} />} />
        <Fig label="Transaction cost" value={pct(p.cost.txCostBps)} />
        <Fig label="Cost model fresh until" value={<span style={{ fontSize: 14 }}>{dateTime(new Date(p.cost.freshUntil).toISOString())}</span>} />
      </div>
      {stale && <Notice tone="warn" title="Cost model is stale">Every candidate is rejected with COST_MODEL_STALE until you confirm current costs below.</Notice>}
    </SellerOnly>
  );
}

function PolicyForm({ p }: { p: ProductWithPrivate }) {
  const m = useUpdatePolicy(p.id);
  const init = () => ({
    minMarginBps: bpsToInput(p.policy.minMarginBps),
    maxDiscountBps: bpsToInput(p.policy.maxDiscountBps),
    approvalThreshold: microToInput(p.policy.approvalThreshold),
    prepaidMinimum: microToInput(p.policy.prepaidMinimum),
    availableCapacityUnits: p.policy.availableCapacityUnits,
    quoteTtlHours: String(p.policy.quoteTtlSeconds / 3600),
  });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setSaved(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const body: PolicyUpdateBody = {};
    const minM = pctToBps(f.minMarginBps);
    if (minM === undefined) err.minMarginBps = "Enter a percentage between 0 and 100";
    else if (String(minM) !== p.policy.minMarginBps) body.minMarginBps = minM;
    const maxD = pctToBps(f.maxDiscountBps);
    if (maxD === undefined) err.maxDiscountBps = "Enter a percentage between 0 and 100";
    else if (String(maxD) !== p.policy.maxDiscountBps) body.maxDiscountBps = maxD;
    const thr = usdToMicro(f.approvalThreshold);
    if (thr === undefined) err.approvalThreshold = "Enter a dollar amount";
    else if (thr !== p.policy.approvalThreshold) body.approvalThreshold = thr;
    const min = usdToMicro(f.prepaidMinimum);
    if (min === undefined) err.prepaidMinimum = "Enter a dollar amount";
    else if (min !== p.policy.prepaidMinimum) body.prepaidMinimum = min;
    if (!/^\d+$/.test(f.availableCapacityUnits.trim())) err.availableCapacityUnits = "Enter a whole number of units";
    else if (f.availableCapacityUnits.trim() !== p.policy.availableCapacityUnits) body.availableCapacityUnits = f.availableCapacityUnits.trim();
    const ttl = Number(f.quoteTtlHours);
    if (!Number.isFinite(ttl) || ttl * 3600 < 60 || ttl > 168) err.quoteTtlHours = "Between 1 minute and 168 hours";
    else if (Math.round(ttl * 3600) !== p.policy.quoteTtlSeconds) body.quoteTtlSeconds = Math.round(ttl * 3600);
    setErrors(err);
    if (Object.keys(err).length) return;
    if (Object.keys(body).length === 0) {
      setErrors({ form: "Nothing changed yet." });
      return;
    }
    m.mutate(body, { onSuccess: (np) => setSaved(np.policy.version) });
  };

  return (
    <SellerOnly title="Commercial policy" description="Saving creates a new policy version. Open quotes keep the version they were made with.">
      <form className={s.formBox} onSubmit={submit} noValidate>
        <div className={s.formGrid2}>
          <Field label="Minimum margin (%)" inputMode="decimal" value={f.minMarginBps} onChange={set("minMarginBps")} error={errors.minMarginBps} hint="Offers below this contribution margin are rejected" />
          <Field label="Maximum discount (%)" inputMode="decimal" value={f.maxDiscountBps} onChange={set("maxDiscountBps")} error={errors.maxDiscountBps} hint="Off the list unit price" />
          <Field label="Approval threshold ($)" inputMode="decimal" value={f.approvalThreshold} onChange={set("approvalThreshold")} error={errors.approvalThreshold} hint="Prepaid totals above this need you" />
          <Field label="Prepaid minimum ($)" inputMode="decimal" value={f.prepaidMinimum} onChange={set("prepaidMinimum")} error={errors.prepaidMinimum} />
          <Field label="Available capacity (units)" inputMode="numeric" value={f.availableCapacityUnits} onChange={set("availableCapacityUnits")} error={errors.availableCapacityUnits} />
          <Field label="Quote validity (hours)" inputMode="decimal" value={f.quoteTtlHours} onChange={set("quoteTtlHours")} error={errors.quoteTtlHours} />
        </div>
        {errors.form && <Notice>{errors.form}</Notice>}
        {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
        {saved !== null && <Notice tone="success">Saved as policy v{saved}. New candidates use it now.</Notice>}
        <div className={s.formActions}>
          <ActionButton type="submit" variant="secondary" loading={m.isPending} loadingLabel="Saving policy">
            Save policy
          </ActionButton>
          <ActionButton
            variant="ghost"
            onClick={() => {
              setF(init());
              setErrors({});
              setSaved(null);
            }}
          >
            Reset
          </ActionButton>
        </div>
      </form>
    </SellerOnly>
  );
}

function CostForm({ p }: { p: ProductWithPrivate }) {
  const m = useUpdateCost(p.id);
  const init = () => ({ variable: microToInput(p.cost.variableCostPerUnit), direct: microToInput(p.cost.directCostPerDeal), tx: p.cost.txCostBps });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setSaved(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const variable = usdToMicro(f.variable);
    const direct = usdToMicro(f.direct);
    const tx = Number(f.tx);
    if (variable === undefined) err.variable = "Enter a dollar amount, up to 6 decimals";
    if (direct === undefined) err.direct = "Enter a dollar amount";
    if (!Number.isInteger(tx) || tx < 0 || tx > 10000) err.tx = "Whole basis points, 0 to 10,000";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body: CostUpdateBody = { variableCostPerUnit: variable!, directCostPerDeal: direct, txCostBps: tx };
    m.mutate(body, { onSuccess: (np) => setSaved(np.cost.version) });
  };
  return (
    <SellerOnly title="Simulate an upstream cost change: future quotes only" description="Use this when a supplier or model price moves. Signed deals keep their terms; only new candidates are re-evaluated.">
      <form className={s.formBox} onSubmit={submit} noValidate>
        <div className={s.formGrid2}>
          <Field label="Variable cost per unit ($)" inputMode="decimal" value={f.variable} onChange={set("variable")} error={errors.variable} hint="Fulfillment cost of one billable unit" />
          <Field label="Direct cost per deal ($)" inputMode="decimal" value={f.direct} onChange={set("direct")} error={errors.direct} hint="Provisioning and setup" />
          <Field label="Transaction cost (bps)" inputMode="numeric" value={f.tx} onChange={set("tx")} error={errors.tx} hint="Of revenue. 50 bps = 0.5%" />
        </div>
        {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
        {saved !== null && <Notice tone="success">Saved as cost v{saved}. Existing deals are untouched; the preview below re-ran with the new costs.</Notice>}
        <div className={s.formActions}>
          <ActionButton type="submit" variant="secondary" loading={m.isPending} loadingLabel="Applying">
            Apply to future quotes
          </ActionButton>
        </div>
      </form>
    </SellerOnly>
  );
}

function explain(c: WireCandidate, p: ProductWithPrivate): string {
  const parts = c.rules.map((r) => {
    switch (r) {
      case "MARGIN_FLOOR_BPS":
        return `margin ${pct(c.economics.expectedContributionMarginBps)} is below the ${pct(p.policy.minMarginBps)} floor`;
      case "MAX_DISCOUNT_BPS":
        return `discount ${pct(c.economics.discountBps)} is above the ${pct(p.policy.maxDiscountBps)} cap`;
      case "PREPAID_MINIMUM":
        return `prepaid total is below the ${microToUsd(p.policy.prepaidMinimum)} minimum`;
      case "APPROVAL_THRESHOLD":
        return `prepaid total is above the ${microToUsd(p.policy.approvalThreshold)} approval threshold`;
      case "CAPACITY":
        return `${units(c.units)} units exceeds available capacity of ${units(p.policy.availableCapacityUnits)}`;
      default:
        return (RULE_TEXT[r] ?? r).toLowerCase();
    }
  });
  return parts.join("; ");
}

const microToUsd = (m: string) => "$" + Number(microToInput(m)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Preview({ p }: { p: ProductWithPrivate }) {
  const m = usePreview(p.id);
  const first = p.previewCases?.[0];
  const [desired, setDesired] = useState(first?.desiredUnits ?? "1200");
  const [budget, setBudget] = useState(first?.budget ? microToInput(first.budget) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastRun = useRef<{ desiredUnits?: string; budget?: string } | null>(null);

  const run = (d: string, b: string) => {
    const err: Record<string, string> = {};
    const body: { desiredUnits?: string; budget?: string } = {};
    if (d.trim()) {
      if (!/^\d+$/.test(d.trim()) || d.trim() === "0") err.desired = "Whole number of units above zero";
      else body.desiredUnits = d.trim();
    }
    if (b.trim()) {
      const mic = usdToMicro(b);
      if (!mic || mic === "0") err.budget = "Dollar amount above zero";
      else body.budget = mic;
    }
    if (!body.desiredUnits && !body.budget && !Object.keys(err).length) err.desired = "Enter units, a budget, or both";
    setErrors(err);
    if (Object.keys(err).length) return;
    lastRun.current = body;
    m.mutate(body);
  };

  // Run the first test case once so the panel opens with numbers.
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run(desired, budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run after a policy or cost version change so the table never shows stale economics.
  const versionKey = `${p.policy.version}:${p.cost.version}`;
  const prevKey = useRef(versionKey);
  useEffect(() => {
    if (prevKey.current !== versionKey && lastRun.current) m.mutate(lastRun.current);
    prevKey.current = versionKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  const cands = m.data?.candidates ?? [];
  const floor = p.policy.minMarginBps;
  const blocked = cands.filter((c) => c.status !== "eligible");

  return (
    <SellerOnly title="Numeric preview" description="Run the same deterministic engine the agent uses. Nothing is sent to a buyer.">
      <form
        className={s.formBox}
        onSubmit={(e) => {
          e.preventDefault();
          run(desired, budget);
        }}
        noValidate
      >
        <div className={s.formGrid}>
          <Field label="Desired units" inputMode="numeric" value={desired} onChange={(e) => setDesired(e.target.value)} error={errors.desired} placeholder="e.g. 1200" />
          <Field label="Budget ($)" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} error={errors.budget} placeholder="optional" />
          <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 26 }}>
            <ActionButton type="submit" loading={m.isPending} loadingLabel="Evaluating" iconLeft={<Calculator size={16} />} fullWidth>
              Run preview
            </ActionButton>
          </div>
        </div>
        {p.previewCases && p.previewCases.length > 0 && (
          <div className={s.row}>
            <span className={`body3 ${s.small}`}>Test cases:</span>
            {p.previewCases.map((c) => (
              <ActionButton
                key={c.label}
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = c.desiredUnits ?? "";
                  const b = c.budget ? microToInput(c.budget) : "";
                  setDesired(d);
                  setBudget(b);
                  run(d, b);
                }}
              >
                {c.label}
              </ActionButton>
            ))}
          </div>
        )}
      </form>
      {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
      {m.data && (
        <>
          <CandidateTable candidates={cands} floorBps={floor} caption={`${cands.length} candidates, policy v${p.policy.version}, cost v${p.cost.version}`} />
          {blocked.length > 0 && (
            <div className={s.stack} style={{ gap: 8 }} aria-live="polite">
              <span className={`body3 ${s.strong}`}>Why these are not offered as-is</span>
              {blocked.map((c) => (
                <p key={c.candidateId} className="body3">
                  <StatusTag state={c.status} /> {c.tierName}, {units(c.units)} units at {unitPrice(c.unitPrice)}: {explain(c, p)}.
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </SellerOnly>
  );
}
