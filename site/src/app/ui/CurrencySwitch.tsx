import type { CurrencyCode } from "@proteus/domain";
import s from "./currency.module.css";

/**
 * USD / INR toggle for buyers. Shown only when the seller has a rate. Payment is always USDC; this only changes which
 * currency prices are read in first.
 */
export function CurrencySwitch({ value, onChange, size = "md", className }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={[s.switch, size === "sm" ? s.sm : "", className].filter(Boolean).join(" ")} role="radiogroup" aria-label="Show prices in">
      {(["INR", "USD"] as const).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={value === c ? s.on : undefined} onClick={() => onChange(c)}>
          {c === "INR" ? "₹ INR" : "$ USD"}
        </button>
      ))}
    </div>
  );
}

/** "₹1,050" with "(≈ 11.33 USDC)" after it, the second in a quieter tone. */
export function DualPrice({ primary, secondary, className }: { primary: string; secondary?: string; className?: string }) {
  return (
    <span className={[s.dual, className].filter(Boolean).join(" ")}>
      <span className={s.primary}>{primary}</span>
      {secondary && <span className={s.secondary}> ({secondary})</span>}
    </span>
  );
}
