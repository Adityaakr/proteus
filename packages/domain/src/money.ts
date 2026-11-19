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

/**
 * A per-unit price from a rational micro-USDC amount, for people: always at least two decimals, up to four when the
 * price has sub-cent precision. 6600000/1 -> "$6.60", 35000/1 -> "$0.035", 125/1 -> "$0.0001".
 */
export function formatUnitPrice(num: bigint, den: bigint): string {
  const scaled = (num * 10_000n) / den; // 1e-10 dollars
  const whole = scaled / 10_000_000_000n;
  const frac = (scaled % 10_000_000_000n).toString().padStart(10, "0").slice(0, 4).replace(/0+$/, "").padEnd(2, "0");
  return `$${whole}.${frac}`;
}

/** Normalizes a dollar price string to at least two decimals, keeping sub-cent digits: "$6.5" -> "$6.50", "$0.0350" -> "$0.035". */
export function usdPrice(v: string): string {
  const m = /^(-?)\$?(\d[\d,]*)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return v;
  return `${m[1]}$${m[2]}.${(m[3] ?? "").replace(/0+$/, "").padEnd(2, "0")}`;
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

/** The unit label for a count: "1 box", "20 boxes". */
export function unitFor(count: bigint | number | string, label: string): string {
  return String(count).replace(/,/g, "") === "1" ? label : pluralUnit(label);
}
