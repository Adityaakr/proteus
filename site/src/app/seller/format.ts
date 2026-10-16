import { formatUsd } from "@proteus/domain";
import type { WireUnitPrice } from "./types";

export function big(v: string | number | bigint | undefined | null): bigint {
  if (v === undefined || v === null || v === "") return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

/** "3,000" */
export function units(v: string | number | bigint | undefined): string {
  return big(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** bps integer string to "39.18%" */
export function pct(bps: string | number | bigint | undefined): string {
  const b = big(bps);
  const neg = b < 0n;
  const a = neg ? -b : b;
  return `${neg ? "-" : ""}${a / 100n}.${(a % 100n).toString().padStart(2, "0")}%`;
}

/** Unit price as "$1.2000" per unit (4 decimals so sub-cent counters stay honest). */
export function unitPrice(p: WireUnitPrice | undefined, digits = 4): string {
  if (!p) return "";
  const num = big(p.num);
  const den = big(p.den) || 1n;
  return formatUsd(num / den, Math.min(digits, 6));
}

/** USD decimal input ("1,250.50") to micro string, or undefined if invalid/empty. */
export function usdToMicro(input: string): string | undefined {
  const s = input.replace(/[$,\s]/g, "");
  if (!s) return undefined;
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return undefined;
  const [w, f = ""] = s.split(".");
  return (BigInt(w!) * 1_000_000n + BigInt((f + "000000").slice(0, 6))).toString();
}

/** micro string to plain decimal for an input field ("1250.5") */
export function microToInput(m: string | undefined): string {
  if (!m) return "";
  const v = big(m);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Percent input ("35" or "35.5") to bps integer, or undefined. */
export function pctToBps(input: string): number | undefined {
  const s = input.trim().replace("%", "");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return undefined;
  const [w, f = ""] = s.split(".");
  const v = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return v >= 0 && v <= 10000 ? v : undefined;
}

export function bpsToInput(bps: string | number | undefined): string {
  if (bps === undefined) return "";
  const b = Number(bps);
  return (b / 100).toString();
}

export function dateTime(isoStr: string | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relTime(isoStr: string | undefined): string {
  if (!isoStr) return "";
  const t = new Date(isoStr).getTime();
  if (Number.isNaN(t)) return isoStr;
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function duration(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  return `${Math.round(seconds / 60)} minutes`;
}

export function unixToDate(sec: string | undefined): string {
  if (!sec) return "";
  const n = Number(sec);
  if (!Number.isFinite(n)) return sec;
  return new Date(n * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const RULE_TEXT: Record<string, string> = {
  MARGIN_FLOOR_BPS: "Contribution margin is below the floor",
  NON_POSITIVE_CONTRIBUTION: "Contribution is zero or negative",
  MAX_DISCOUNT_BPS: "Discount exceeds the cap",
  CAPACITY: "Above available capacity",
  APPROVAL_THRESHOLD: "Prepaid total above approval threshold",
  PREPAID_MINIMUM: "Below the prepaid minimum",
  MAX_UNITS_PER_DEAL: "Above the per-deal unit ceiling",
  UNSUPPORTED_INTEGRATION: "Requested integration not supported",
  COST_MODEL_STALE: "Cost model is stale",
};
