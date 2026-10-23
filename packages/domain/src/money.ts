/**
 * Money is integer micro-USDC (1 USDC = 1_000_000) as bigint everywhere.
 * Decimal strings exist only at the UI/API boundary. Never use JS number for money.
 */
export type Micro = bigint;

export const USDC_DECIMALS = 6;
export const MICRO = 1_000_000n;
export const BPS = 10_000n;

export function toMicro(usdc: string | number): Micro {
  const s = typeof usdc === "number" ? usdc.toString() : usdc.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`invalid USDC amount: ${usdc}`);
  const neg = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".") as [string, string?];
  const fracPadded = (frac + "000000").slice(0, 6);
  const v = BigInt(whole) * MICRO + BigInt(fracPadded);
  return neg ? -v : v;
}

export function fromMicro(m: Micro, opts: { trim?: boolean } = {}): string {
  const neg = m < 0n;
  const a = neg ? -m : m;
  const whole = a / MICRO;
  const frac = (a % MICRO).toString().padStart(6, "0");
  let out = `${whole}.${frac}`;
  if (opts.trim) out = out.replace(/\.?0+$/, "");
  return neg ? `-${out}` : out;
}

/** Format micro-USDC for display: "$1,440.00" (two decimals, grouped). */
export function formatUsd(m: Micro, fractionDigits = 2): string {
  const neg = m < 0n;
  const a = neg ? -m : m;
  const whole = a / MICRO;
  const frac = a % MICRO;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracStr = frac.toString().padStart(6, "0").slice(0, fractionDigits);
  return `${neg ? "-" : ""}$${grouped}${fractionDigits > 0 ? "." + fracStr : ""}`;
}

/** floor(a * num / den) */
export function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error("den must be > 0");
  return (a * num) / den;
}

/** Basis points of `part` in `whole`, floored. Returns 0n when whole <= 0. */
export function bpsOf(part: bigint, whole: bigint): bigint {
  if (whole <= 0n) return 0n;
  return (part * BPS) / whole;
}

/** A rational unit price: micro-USDC per unit = num/den. */
export interface UnitPrice {
  num: bigint;
  den: bigint;
}

/**
 * Cumulative-charge metering. The incremental debit for a usage batch is
 * floor(totalUnits * num / den) - previouslyCharged, so repeated small batches
 * sum to exactly the batch total (no per-call rounding leakage).
 */
export function cumulativeCharge(totalUnits: bigint, price: UnitPrice): bigint {
  return mulDivFloor(totalUnits, price.num, price.den);
}

export function incrementalCharge(totalUnits: bigint, price: UnitPrice, previouslyCharged: bigint): bigint {
  const cum = cumulativeCharge(totalUnits, price);
  if (cum < previouslyCharged) throw new Error("cumulative charge went backwards");
  return cum - previouslyCharged;
}

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
export function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** English plural of a unit label for prose: "box" -> "boxes", "inquiry" -> "inquiries", "call" -> "calls". */
export function pluralUnit(label: string): string {
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}
