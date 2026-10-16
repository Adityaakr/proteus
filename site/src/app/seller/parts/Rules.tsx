import type { RuleId } from "@proteus/domain";
import { RULE_TEXT, big, pct } from "../format";
import s from "./parts.module.css";

const HARD = new Set(["MARGIN_FLOOR_BPS", "NON_POSITIVE_CONTRIBUTION", "MAX_DISCOUNT_BPS", "CAPACITY", "MAX_UNITS_PER_DEAL", "PREPAID_MINIMUM", "COST_MODEL_STALE"]);

/** Rule ids as monospace chips; the id is the label, and the plain-language reason is the title. */
export function RuleChips({ rules, emptyText = "None fired" }: { rules: (RuleId | string)[]; emptyText?: string }) {
  if (!rules.length) return <span className="body3" style={{ fontSize: 12 }}>{emptyText}</span>;
  return (
    <span className={s.rules}>
      {rules.map((r) => (
        <span key={r} className={[s.rule, HARD.has(r) ? s.rule_hard : s.rule_soft].join(" ")} title={RULE_TEXT[r] ?? r}>
          {r}
        </span>
      ))}
    </span>
  );
}

/** Margin bps vs policy floor, with a small bar and explicit "above/below floor" text. */
export function MarginVsFloor({ bps, floor }: { bps: string; floor?: string }) {
  const v = big(bps);
  const f = floor !== undefined ? big(floor) : undefined;
  const below = f !== undefined && v < f;
  const clamp = (x: bigint) => Math.max(0, Math.min(100, Number(x) / 100));
  return (
    <span className={s.margin}>
      <span className={[s.mono, below ? s.below : ""].join(" ")}>{pct(v)}</span>
      {f !== undefined && (
        <>
          <span className={s.marginBar} aria-hidden>
            <span className={[s.marginFill, below ? s.marginFill_below : ""].join(" ")} style={{ width: `${clamp(v)}%` }} />
            <span className={s.marginFloor} style={{ left: `${clamp(f)}%` }} />
          </span>
          <span className={[s.marginNote, below ? s.below : ""].join(" ")}>
            {below ? "Below" : "Above"} floor {pct(f)}
          </span>
        </>
      )}
    </span>
  );
}
