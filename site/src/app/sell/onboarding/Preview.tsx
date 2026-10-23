import { useMemo } from "react";
import { formatUsd, getQuoteCandidates, type Candidate, unitFor } from "@proteus/domain";
import { Gauge } from "lucide-react";
import { StatusTag } from "../../seller/kit";
import { SellerOnly } from "../../seller/parts/SellerOnly";
import { MarginVsFloor, RuleChips } from "../../seller/parts/Rules";
import { RULE_TEXT, pct, units } from "../../seller/format";
import { SAMPLE_ASK, sampleRequirements, toEngine, type Errors, type FormState } from "./form";
import s from "../sell.module.css";

const STATUS = { eligible: { tone: "success", label: "Eligible" }, approval_required: { tone: "warn", label: "Needs your approval" }, rejected: { tone: "danger", label: "Refused" } } as const;
const ORIGIN: Record<Candidate["origin"], string> = { tier: "List tier", budget_fit: "Budget fit", requested_units: "Requested units", counter: "Buyer counter" };

/** Runs the real pricing engine in the browser against the form, for a fixed sample ask. */
export function Preview({ form, errors }: { form: FormState; errors: Errors }) {
  const result = useMemo(() => {
    const ctx = toEngine(form, errors, Date.now());
    if (!ctx) return null;
    try {
      return { ctx, candidates: getQuoteCandidates(ctx, sampleRequirements()) };
    } catch {
      return null;
    }
  }, [form, errors]);

  return (
    <SellerOnly
      as="div"
      title="Live preview"
      description={
        <>
          The pricing engine your agent uses, run on this form for a sample ask: <span className={s.strong}>{SAMPLE_ASK.label}</span>.
        </>
      }
    >
      {!result ? (
        <div className={s.previewEmpty}>
          <Gauge size={18} aria-hidden />
          <p className="body3">Add at least one tier and fill in the seller only numbers. The preview shows which offers your agent could make and which it must refuse.</p>
        </div>
      ) : (
        <PreviewBody candidates={result.candidates} floor={result.ctx.policy.minMarginBps} unitLabel={result.ctx.product.unitLabel} />
      )}
    </SellerOnly>
  );
}

function PreviewBody({ candidates, floor, unitLabel }: { candidates: Candidate[]; floor: bigint; unitLabel: string }) {
  const eligible = candidates.filter((c) => c.status === "eligible");
  const approval = candidates.filter((c) => c.status === "approval_required");
  const rejected = candidates.filter((c) => c.status === "rejected");
  const best = eligible[0];
  const summary = best
    ? `Your agent could offer ${best.tierName}: ${units(best.units)} ${unitFor(best.units, unitLabel)} for ${formatUsd(best.prepaidTotal)} at ${pct(best.economics.expectedContributionMarginBps.toString())} margin.`
    : approval[0]
      ? `Every offer within policy needs your approval first. The smallest is ${formatUsd(approval[0].prepaidTotal)}.`
      : "Your agent would refuse this ask. Every package breaks at least one rule below, so it would explain why and ask for a different volume or budget.";
  return (
    <div className={s.previewBody}>
      <p className={`body3 ${s.previewSummary}`} aria-live="polite">
        {summary}
      </p>
      <div className={s.previewCounts}>
        <span>
          <b>{eligible.length}</b> eligible
        </span>
        <span>
          <b>{approval.length}</b> need approval
        </span>
        <span>
          <b>{rejected.length}</b> refused
        </span>
        <span>
          Floor <b>{pct(floor.toString())}</b>
        </span>
      </div>
      <ul className={s.previewList}>
        {candidates.map((c) => (
          <li key={c.candidateId} className={[s.previewItem, c.status === "rejected" ? s.previewRejected : ""].join(" ")}>
            <div className={s.previewHead}>
              <span>
                <span className={s.strong}>{c.tierName}</span>
                <span className={s.sub}>
                  {units(c.units)} {unitFor(c.units, unitLabel)} for {formatUsd(c.prepaidTotal)} · {c.origins.map((o) => ORIGIN[o]).join(", ")}
                </span>
              </span>
              <StatusTag tone={STATUS[c.status].tone} label={STATUS[c.status].label} />
            </div>
            <div className={s.previewFoot}>
              <span className={s.sub}>
                Contribution {formatUsd(c.economics.expectedContribution)} after {formatUsd(c.economics.expectedVariableCost)} variable, {formatUsd(c.economics.allocatedDirectCost)} direct
              </span>
              <MarginVsFloor bps={c.economics.expectedContributionMarginBps.toString()} floor={floor.toString()} />
            </div>
            {c.rules.length > 0 && (
              <div className={s.previewRules}>
                <RuleChips rules={c.rules} />
                <span className={s.sub}>{c.rules.map((r) => RULE_TEXT[r] ?? r).join(". ")}.</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
