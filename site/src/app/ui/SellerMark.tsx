import { useEffect, useState, type CSSProperties } from "react";
import type { SellerBrand } from "../lib/types";
import s from "./ui.module.css";

export const CATEGORY_LABELS: Record<string, string> = {
  support: "Customer support",
  voice: "Voice and calls",
  infra: "AI infrastructure",
  devtools: "Developer tools",
  logistics: "Logistics",
  data: "Data",
  legal: "Legal",
  risk: "Risk and fraud",
  media: "Media",
  finance: "Finance",
  health: "Healthcare",
  other: "Other",
};
export const categoryLabel = (c?: string | null) => (c ? CATEGORY_LABELS[c] ?? c[0]!.toUpperCase() + c.slice(1) : "");

/** Possessive that reads naturally for names ending in s ("Harbor Logistics' agent"). */
export const possessive = (name: string) => (/s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`);

function monogram(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? (words[0]![0]! + words[1]![0]!).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/** Deterministic accent for sellers without one, so the same seller always gets the same color. */
function hashAccent(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [222, 262, 160, 28, 340, 195, 12, 120];
  return `hsl(${hues[h % hues.length]} 70% 42%)`;
}

export type LogoShape = "none" | "loading" | "wide" | "square" | "broken";
const shapeCache = new Map<string, LogoShape>();

/** Loads the logo once and reports whether it is a wide wordmark or a square mark. */
export function useLogoShape(url?: string | null): LogoShape {
  const [shape, setShape] = useState<LogoShape>(() => (url ? shapeCache.get(url) ?? "loading" : "none"));
  useEffect(() => {
    if (!url) return setShape("none");
    const cached = shapeCache.get(url);
    if (cached) return setShape(cached);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const sh: LogoShape = img.naturalWidth > img.naturalHeight * 1.5 ? "wide" : "square";
      shapeCache.set(url, sh);
      if (alive) setShape(sh);
    };
    img.onerror = () => {
      shapeCache.set(url, "broken");
      if (alive) setShape("broken");
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return shape;
}

export interface SellerMarkProps {
  name: string;
  brand?: SellerBrand | null;
  /**
   * avatar: always a square (square logo inside it, monogram otherwise).
   * wordmark: the logo at a fixed height; monogram + name when there is no logo.
   * auto: wordmark when the logo is wide, avatar otherwise.
   */
  variant?: "avatar" | "wordmark" | "auto";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const AVATAR_PX = { sm: 28, md: 40, lg: 56, xl: 72 } as const;
const WORDMARK_PX = { sm: 18, md: 24, lg: 30, xl: 38 } as const;

/**
 * Seller identity. Uploaded logos are shown as they are (wordmarks at a fixed height, square marks in a
 * rounded tile); sellers without one get a monogram on their accent. The name always travels as text or alt.
 */
export function SellerMark({ name, brand, variant = "avatar", size = "md", className }: SellerMarkProps) {
  const shape = useLogoShape(brand?.logoUrl);
  const markShape = useLogoShape(brand?.markUrl);
  const accent = brand?.accent ?? hashAccent(name);
  const px = AVATAR_PX[size];
  const hasLogo = shape === "wide" || shape === "square";
  const showWordmark = hasLogo && (variant === "wordmark" || (variant === "auto" && shape === "wide"));
  const hasMark = markShape === "wide" || markShape === "square";

  // A dedicated square mark wins for avatars (and for "auto" when the wordmark is wide but the slot is small).
  if (!showWordmark && hasMark && variant !== "wordmark") {
    return (
      <span className={`${s.avatar} ${s.avatarLogo} ${className ?? ""}`} style={{ width: px, height: px, borderRadius: Math.round(px * 0.28), padding: 0 } as CSSProperties}>
        <img src={brand!.markUrl} alt={name} decoding="async" />
      </span>
    );
  }

  if (showWordmark) {
    return <img src={brand!.logoUrl} alt={name} className={`${s.wordmark} ${className ?? ""}`} style={{ height: WORDMARK_PX[size] }} decoding="async" />;
  }
  if (hasLogo && shape === "square") {
    const pad = Math.round(px * 0.14);
    return (
      <span className={`${s.avatar} ${s.avatarLogo} ${className ?? ""}`} style={{ width: px, height: px, borderRadius: Math.round(px * 0.28), padding: pad } as CSSProperties}>
        <img src={brand!.logoUrl} alt={name} decoding="async" />
      </span>
    );
  }
  if (variant === "wordmark") {
    return (
      <span className={`${s.markRow} ${className ?? ""}`}>
        <span className={s.avatar} role="img" aria-label={name} style={{ width: px, height: px, borderRadius: Math.round(px * 0.28), background: accent, fontSize: Math.round(px * 0.38) } as CSSProperties}>{monogram(name)}</span>
        <span className={s.markName} style={{ fontSize: WORDMARK_PX[size] * 0.8 }}>{name}</span>
      </span>
    );
  }
  return (
    <span className={`${s.avatar} ${className ?? ""}`} role="img" aria-label={name} style={{ width: px, height: px, borderRadius: Math.round(px * 0.28), background: accent, fontSize: Math.round(px * 0.38), visibility: shape === "loading" ? "hidden" : undefined } as CSSProperties}>
      {monogram(name)}
    </span>
  );
}
