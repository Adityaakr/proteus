/**
 * The buyer's choice of currency (USD or INR) and how amounts read in it. Escrow and settlement are always USDC; rupees
 * are a way to state and read prices, at the seller's dated rate. Formatting comes from @proteus/domain (fx.ts), so the
 * pages, the agent's replies and the checkout line read the same: "₹1,050 (≈ 11.33 USDC)" or "$11.33 (≈ ₹1,050)".
 * Without a rate there are no rupees: the switch is hidden and amounts read in USD. A rate is never invented here.
 */
import { useCallback, useEffect, useState } from "react";
import { dualText, toMicro, toPaise, usdcToInr, type CurrencyCode } from "@proteus/domain";
import type { FxRateWire, LocalPriceWire, Offer, PublicTier } from "./types";

const KEY = (seller: string) => `proteus:currency:${seller}`;

function stored(seller: string): CurrencyCode | null {
  try {
    const v = window.localStorage.getItem(KEY(seller));
    return v === "USD" || v === "INR" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The currency a buyer reads this seller's prices in: their remembered choice for this seller, else the seller's
 * display currency. `available` is false when the seller has no rate (USD only).
 */
export function useBuyerCurrency(sellerSlug: string, seller?: { display?: CurrencyCode; rate?: FxRateWire | null } | null) {
  const available = Boolean(seller?.rate);
  const [choice, setChoice] = useState<CurrencyCode | null>(() => (sellerSlug && typeof window !== "undefined" ? stored(sellerSlug) : null));
  useEffect(() => {
    if (sellerSlug) setChoice(stored(sellerSlug));
  }, [sellerSlug]);
  const set = useCallback(
    (c: CurrencyCode) => {
      setChoice(c);
      try {
        window.localStorage.setItem(KEY(sellerSlug), c);
      } catch {
        /* private window: the choice holds for this page only */
      }
    },
    [sellerSlug],
  );
  const currency: CurrencyCode = available ? (choice ?? seller?.display ?? "USD") : "USD";
  return { currency, setCurrency: set, available, rate: seller?.rate ?? null };
}

export interface PriceText {
  primary: string;
  secondary?: string;
  text: string;
}

const micro = (usd: string) => toMicro(usd.replace(/[$,\s]/g, ""));

/**
 * A USDC amount (micro or "$1,440.00") with its rupee amount, in the chosen currency first. Without a rupee amount it
 * is converted at the seller's `rate` when one is given (display only), else it reads in USD.
 */
export function priceText(usdc: bigint | string, inr: { amount: string; stated: boolean } | null | undefined, currency: CurrencyCode, rate?: FxRateWire | null): PriceText {
  const m = typeof usdc === "bigint" ? usdc : /^\d+$/.test(usdc) ? BigInt(usdc) : micro(usdc);
  if (inr) return dualText({ usdc: m, inr: toPaise(inr.amount), stated: inr.stated }, currency);
  return dualText({ usdc: m, ...(rate ? { inr: usdcToInr(m, rate), stated: false } : {}) }, currency);
}

/** A list tier's prepaid total. */
export const tierTotal = (t: PublicTier, currency: CurrencyCode) => priceText(t.prepaidTotal ?? t.prepaidTotalUsd, t.inr ? { amount: t.inr.prepaidTotal, stated: t.inr.stated } : null, currency);

/** A list tier's price per unit. */
export const tierUnit = (t: PublicTier, currency: CurrencyCode) => priceText(t.unitPriceUsd, t.inr ? { amount: t.inr.unitPrice, stated: t.inr.stated } : null, currency);

/** An offer's total, from the rupee amount it was fixed at. */
export const offerTotal = (o: Pick<Offer, "prepaidTotal" | "prepaidTotalUsd" | "local">, currency: CurrencyCode) => priceText(o.prepaidTotal ?? o.prepaidTotalUsd, o.local ? { amount: o.local.total, stated: o.local.stated } : null, currency);

/** An offer's price per unit. */
export const offerUnit = (o: Pick<Offer, "unitPriceUsd" | "local">, currency: CurrencyCode) => priceText(o.unitPriceUsd, o.local ? { amount: o.local.unitPrice, stated: o.local.stated } : null, currency);

/** "₹92.68/$ · fixed by the seller, 20 Nov 2026" or "· ECB reference rate, 20 Nov 2026". */
export function rateLabel(r: FxRateWire | LocalPriceWire["rate"]): string {
  const d = new Date(`${r.asOf}T00:00:00Z`);
  const date = Number.isNaN(d.getTime()) ? r.asOf : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `₹${r.perUsd}/$ · ${r.kind === "fixed" ? "fixed by the seller" : "ECB reference rate"}, ${date}`;
}
