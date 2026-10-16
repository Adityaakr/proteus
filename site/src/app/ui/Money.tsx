import { formatUsd } from "@proteus/domain";
import s from "./ui.module.css";

/**
 * Money: renders micro-USDC (bigint or integer string) or a decimal `Usd` string with tabular,
 * monospace numerals. Never converts through JS number.
 */
export interface MoneyProps {
  /** Integer micro-USDC as bigint or string ("1440000000" = $1,440.00). */
  micro?: bigint | string | null;
  /** Decimal USD display string from fields ending in Usd ("1440.00"). */
  usd?: string | null;
  digits?: number;
  /** Append " USDC". */
  unit?: boolean;
  className?: string;
}

export function microFromString(v: bigint | string | null | undefined): bigint | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "bigint") return v;
  return /^-?\d+$/.test(v) ? BigInt(v) : null;
}

export function usdStringToDisplay(usd: string, digits = 2): string {
  const neg = usd.trim().startsWith("-");
  const [w, f = ""] = usd.trim().replace("-", "").split(".");
  const grouped = (w || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = digits > 0 ? "." + (f + "000000").slice(0, digits) : "";
  return `${neg ? "-" : ""}$${grouped}${frac}`;
}

export function formatMoney(micro: bigint | string | null | undefined, digits = 2): string {
  const m = microFromString(micro);
  return m === null ? "$0.00" : formatUsd(m, digits);
}

export function Money({ micro, usd, digits = 2, unit, className }: MoneyProps) {
  let text = "";
  if (usd !== undefined && usd !== null) text = usdStringToDisplay(usd, digits);
  else text = formatMoney(micro ?? null, digits);
  return (
    <span className={[s.money, className].filter(Boolean).join(" ")}>
      {text}
      {unit ? " USDC" : ""}
    </span>
  );
}
