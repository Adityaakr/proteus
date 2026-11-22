import { MICRO, formatUsd, type Micro, type UnitPrice } from "./money";

/**
 * Display currencies. Escrow, signatures and settlement are always USDC (priced 1:1 with USD); INR is a way to state
 * and read prices. Amounts in rupees are integer paise (1 INR = 100 paise) as bigint, like micro-USDC.
 *
 * Rounding rules (the same everywhere, server and site):
 *  - INR to USDC (a list price, a floor-checked counter or a budget the seller or buyer gave in rupees): divide by the
 *    rate and round UP to the next cent (to 0.0001 USDC below 1 USDC), so the seller is never paid less than its rupee
 *    amount at the stated rate. ₹1,050 at ₹92.68/$ is 11.33 USDC; ₹45,000 is 485.55 USDC. A budget rounds DOWN, so
 *    an offer that fits the USDC budget also fits the rupee budget.
 *  - USDC to INR (only for display, when no rupee amount was set): multiply by the rate and round to the nearest
 *    paisa; shown to the whole rupee with "≈".
 *  - Totals are units × the unit price in each currency; a rupee total is never re-derived from a rounded USDC one.
 *  - An INR floor is checked exactly, without rounding: an offer's USDC total at the current rate must be worth at
 *    least units × the rupee floor.
 */
export type CurrencyCode = "USD" | "INR";
export const CURRENCIES: CurrencyCode[] = ["USD", "INR"];
export type Paise = bigint;

/** A dated rate: rupees per 1 USD (USDC). */
export interface FxRate {
  currency: "INR";
  /** INR per 1 USD as a decimal string with up to 4 decimals, e.g. "92.68". */
  perUsd: string;
  /** The date the rate is for, YYYY-MM-DD. */
  asOf: string;
  /** "fixed": the seller's own stated rate. "reference": a published daily reference rate the server refreshes. */
  kind: "fixed" | "reference";
  /** Where it comes from, in words. */
  source: string;
}

/** A price in rupees carried with an offer, with the rate it was fixed at. */
export interface LocalPrice {
  currency: "INR";
  /** Paise per unit (rounded to the paisa when it was derived). */
  unitPrice: Paise;
  /** Paise for the whole offer. */
  total: Paise;
  /** true: the seller (a rupee list price) or the buyer (a rupee counter) stated this amount; false: converted from USDC. */
  stated: boolean;
  rate: FxRate;
}

const DECIMAL = /^\d{1,12}(\.\d{1,2})?$/;
const RATE = /^\d{1,6}(\.\d{1,4})?$/;

/** "1,050.5" or "1050.50" or "₹1050" -> 105050n paise. Throws on anything else (more than two decimals included). */
export function toPaise(v: string | number): Paise {
  const s = (typeof v === "number" ? String(v) : v).trim().replace(/^₹\s?|^(?:rs\.?|inr)\s?/i, "").replace(/,/g, "");
  if (!DECIMAL.test(s)) throw new Error(`invalid INR amount: ${v}`);
  const [w, f = ""] = s.split(".") as [string, string?];
  return BigInt(w) * 100n + BigInt((f + "00").slice(0, 2));
}

/** True when `v` is a rupee amount toPaise accepts. */
export function isInrAmount(v: unknown): v is string {
  try {
    return (typeof v === "string" || typeof v === "number") && toPaise(v) >= 0n;
  } catch {
    return false;
  }
}

/** 105050n -> "1050.50". */
export function fromPaise(p: Paise): string {
  const neg = p < 0n;
  const a = neg ? -p : p;
  return `${neg ? "-" : ""}${a / 100n}.${(a % 100n).toString().padStart(2, "0")}`;
}

/** A rate string as a fraction: "92.68" -> { num: 9268n, den: 100n }. */
export function rateFraction(perUsd: string): { num: bigint; den: bigint } {
  const s = perUsd.trim();
  if (!RATE.test(s)) throw new Error(`invalid rate: ${perUsd}`);
  const [w, f = ""] = s.split(".") as [string, string?];
  const den = 10n ** BigInt(f.length);
  const num = BigInt(w) * den + BigInt(f || "0");
  if (num <= 0n) throw new Error("rate must be more than 0");
  return { num, den };
}

/** True when `v` is a usable rate string (more than 0, at most 4 decimals). */
export function isRate(v: unknown): v is string {
  try {
    return typeof v === "string" && rateFraction(v).num > 0n;
  } catch {
    return false;
  }
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Rounded up to the cent (to 0.0001 USDC below 1 USDC). */
export function roundUsdcUp(m: Micro): Micro {
  const step = m >= MICRO ? 10_000n : 100n;
  return ceilDiv(m, step) * step;
}

/** Rupees to micro-USDC at the rate, rounded up to the cent (the seller's amount always holds). */
export function inrToUsdc(paise: Paise, rate: Pick<FxRate, "perUsd">): Micro {
  const r = rateFraction(rate.perUsd);
  // paise / 100 INR / (num/den INR per USD) * 1e6 micro = paise * 1e4 * den / num
  return roundUsdcUp(ceilDiv(paise * 10_000n * r.den, r.num));
}

/** Rupees to micro-USDC for a budget: rounded down to the cent, so an offer within it is within the rupee budget too. */
export function inrBudgetToUsdc(paise: Paise, rate: Pick<FxRate, "perUsd">): Micro {
  const r = rateFraction(rate.perUsd);
  const exact = (paise * 10_000n * r.den) / r.num;
  const step = exact >= MICRO ? 10_000n : 100n;
  return (exact / step) * step;
}

/** Micro-USDC to paise at the rate, rounded to the nearest paisa (display only). */
export function usdcToInr(m: Micro, rate: Pick<FxRate, "perUsd">): Paise {
  const r = rateFraction(rate.perUsd);
  // m / 1e6 USD * num/den INR * 100 paise = m * num / (den * 1e4)
  const d = r.den * 10_000n;
  return (m * r.num * 2n + d) / (2n * d);
}

/** A rational micro-USDC unit price to paise per unit (nearest paisa). */
export function unitPriceToInr(p: UnitPrice, rate: Pick<FxRate, "perUsd">): Paise {
  const r = rateFraction(rate.perUsd);
  const d = p.den * r.den * 10_000n;
  return (p.num * r.num * 2n + d) / (2n * d);
}

/** Whether `prepaid` micro-USDC for `units` is worth at least units × `floor` paise at the rate (exact, no rounding). */
export function inrFloorHolds(prepaid: Micro, units: bigint, floor: Paise, rate: Pick<FxRate, "perUsd">): boolean {
  const r = rateFraction(rate.perUsd);
  // prepaid/1e6 * num/den * 100 >= units * floor  <=>  prepaid * num >= units * floor * 1e4 * den
  return prepaid * r.num >= units * floor * 10_000n * r.den;
}

/** Indian digit grouping: 4500000 -> "45,00,000". */
function groupIndian(whole: bigint): string {
  const s = whole.toString();
  if (s.length <= 3) return s;
  const last = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last}`;
}

/**
 * "₹45,000", "₹1,299.50", "₹1,05,000". `whole` rounds to the rupee (for "≈" amounts). Paise show only when not zero.
 */
export function formatInr(p: Paise, opts: { whole?: boolean } = {}): string {
  const neg = p < 0n;
  let a = neg ? -p : p;
  if (opts.whole) a = ((a + 50n) / 100n) * 100n;
  const frac = a % 100n;
  return `${neg ? "-" : ""}₹${groupIndian(a / 100n)}${frac ? `.${frac.toString().padStart(2, "0")}` : ""}`;
}

/** "485.55 USDC"; below one cent of precision it keeps up to four decimals ("0.035 USDC"). */
export function formatUsdc(m: Micro): string {
  const neg = m < 0n;
  const a = neg ? -m : m;
  const whole = (a / MICRO).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const f = (a % MICRO).toString().padStart(6, "0").slice(0, 4);
  const frac = f.slice(2) === "00" ? f.slice(0, 2) : f.replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}.${frac} USDC`;
}

/** "₹92.68/$" */
export function formatRate(rate: Pick<FxRate, "perUsd">): string {
  return `₹${rate.perUsd}/$`;
}

/** "$485.55" for the USD side of a dual amount (two decimals, four for sub-cent). */
function usdText(m: Micro): string {
  return `$${formatUsdc(m).replace(/ USDC$/, "")}`;
}

/** A USDC amount and, when known, the same amount in rupees. */
export interface DualAmount {
  usdc: Micro;
  inr?: Paise;
  /** The rupee amount was stated by someone (seller or buyer), not converted for display. */
  stated?: boolean;
}

/**
 * The amount in the buyer's currency, the other in brackets: INR "₹45,000 (≈ 485.55 USDC)", USD "$485.55 (≈ ₹45,000)".
 * Without a rupee amount it is "$485.55" either way: a rate is never invented.
 */
export function dualText(a: DualAmount, currency: CurrencyCode): { primary: string; secondary?: string; text: string } {
  if (a.inr === undefined) return { primary: usdText(a.usdc), text: usdText(a.usdc) };
  if (currency === "INR") {
    const primary = formatInr(a.inr, { whole: !a.stated });
    const secondary = `≈ ${formatUsdc(a.usdc)}`;
    return { primary, secondary, text: `${primary} (${secondary})` };
  }
  const primary = usdText(a.usdc);
  const secondary = `≈ ${formatInr(a.inr, { whole: true })}`;
  return { primary, secondary, text: `${primary} (${secondary})` };
}

/** What a buyer sees on checkout: "You pay 485.55 USDC (₹45,000 at ₹92.68/$, rate fixed for this offer)". */
export function checkoutLine(usdc: Micro, local?: Pick<LocalPrice, "total" | "rate" | "stated">): string {
  if (!local) return `You pay ${formatUsdc(usdc)}`;
  return `You pay ${formatUsdc(usdc)} (${formatInr(local.total, { whole: !local.stated })} at ${formatRate(local.rate)}, rate fixed for this offer)`;
}

/** Bigint-safe JSON shape of a LocalPrice (paise as strings), as offers and public terms carry it. */
export interface LocalPriceJson {
  currency: "INR";
  unitPrice: string;
  total: string;
  stated: boolean;
  rate: FxRate;
}

export function localPriceJson(l: LocalPrice): LocalPriceJson {
  return { currency: l.currency, unitPrice: fromPaise(l.unitPrice), total: fromPaise(l.total), stated: l.stated, rate: l.rate };
}

export function reviveLocalPrice(v: unknown): LocalPrice | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const rate = o.rate as FxRate | undefined;
  if (o.currency !== "INR" || !rate || !isRate(rate.perUsd)) return undefined;
  try {
    // Stored as "1050.00" (public JSON) or as a paise string from bigintsToStrings ("105000"): the decimal point tells them apart.
    const paise = (x: unknown) => (typeof x === "string" && x.includes(".") ? toPaise(x) : BigInt(String(x)));
    return { currency: "INR", unitPrice: paise(o.unitPrice), total: paise(o.total), stated: Boolean(o.stated), rate };
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Prose: how the agent writes an amount in the buyer's currency       */
/* ------------------------------------------------------------------ */

/** The buyer's currency and the seller's rate. In USD, every text below is exactly what it was before rupees. */
export interface PriceView {
  currency: CurrencyCode;
  fx?: FxRate;
}

/** "$" prose as the agent always wrote it ("$1,440.00"). */
const usdProse = (m: Micro) => formatUsd(m);

/** Whether amounts are written in rupees: the buyer chose INR and there is a rate. */
export const inRupees = (v: PriceView | undefined): v is PriceView & { fx: FxRate } => v?.currency === "INR" && Boolean(v.fx);

/** An offer's total: "₹45,000 (≈ 485.55 USDC)" in rupees, "$485.55" in USD. */
export function offerTotalText(o: { prepaidTotal: Micro; local?: LocalPrice }, v?: PriceView): string {
  if (!inRupees(v)) return usdProse(o.prepaidTotal);
  const inr = o.local?.total ?? usdcToInr(o.prepaidTotal, v.fx);
  return dualText({ usdc: o.prepaidTotal, inr, stated: o.local?.stated }, "INR").text;
}

/** An offer's unit price in rupees: "₹1,050 (≈ 11.33 USDC)". Undefined in USD (callers keep their own dollar text). */
export function offerUnitText(o: { unitPrice: UnitPrice; local?: LocalPrice }, v?: PriceView): string | undefined {
  if (!inRupees(v)) return undefined;
  const usdc = o.unitPrice.num / o.unitPrice.den;
  const inr = o.local?.unitPrice ?? unitPriceToInr(o.unitPrice, v.fx);
  return dualText({ usdc, inr, stated: o.local?.stated }, "INR").text;
}

/** Any amount (a budget, a counter): in rupees with its USDC, else "$1,440.00". `inr` is the rupee amount if stated. */
export function amountText(m: Micro, v?: PriceView, inr?: Paise, opts: { whole?: boolean } = {}): string {
  if (!inRupees(v)) return opts.whole ? formatUsd(m, 0) : usdProse(m);
  return dualText({ usdc: m, inr: inr ?? usdcToInr(m, v.fx), stated: inr !== undefined }, "INR").text;
}

/** Every figure an amount text contains ("₹45,000", "45,000", "485.55"), for checking a model's reply against. */
export function figuresOf(text: string): string[] {
  const out = new Set<string>();
  for (const f of text.match(/[₹$]?\d[\d,]*(?:\.\d+)?/g) ?? []) {
    out.add(f);
    out.add(f.replace(/^[₹$]/, ""));
  }
  return [...out];
}
