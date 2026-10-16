import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field } from "../ui/Field";
import { SellerMark, CATEGORY_LABELS } from "../ui/SellerMark";
import type { SellerBrand } from "../lib/types";
import s from "./sell.module.css";

const MAX_BYTES = 96 * 1024;

/** Reads a PNG, JPEG, WebP or SVG file into a small data URL (raster files are downscaled to 512 px). */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPEG, WebP or SVG file.");
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    if (/<script|on\w+=/i.test(text)) throw new Error("SVG files with scripts are not allowed.");
    const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
    if (url.length > MAX_BYTES) throw new Error("SVG is too large; keep it under 96 KB.");
    return url;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / bitmap.width, 256 / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  let url = canvas.toDataURL("image/png");
  if (url.length > MAX_BYTES) url = canvas.toDataURL("image/webp", 0.85);
  if (url.length > MAX_BYTES) throw new Error("Logo is too large after resizing; try a simpler image or an SVG.");
  return url;
}

export interface BrandFormState {
  logoUrl: string;
  markUrl: string;
  tagline: string;
  category: string;
  website: string;
}

export const EMPTY_BRAND: BrandFormState = { logoUrl: "", markUrl: "", tagline: "", category: "", website: "" };

export function brandFromState(b: BrandFormState): SellerBrand {
  return {
    ...(b.logoUrl ? { logoUrl: b.logoUrl } : {}),
    ...(b.markUrl ? { markUrl: b.markUrl } : {}),
    ...(b.tagline.trim() ? { tagline: b.tagline.trim() } : {}),
    ...(b.category ? { category: b.category } : {}),
    ...(b.website.trim() ? { website: b.website.trim() } : {}),
  };
}

export function validateBrandState(b: BrandFormState): Partial<Record<keyof BrandFormState, string>> {
  const e: Partial<Record<keyof BrandFormState, string>> = {};
  if (b.tagline.trim().length > 140) e.tagline = "Keep the tagline under 140 characters.";
  if (b.website.trim()) {
    try {
      const u = new URL(b.website.trim());
      if (u.protocol !== "https:") throw new Error();
    } catch {
      e.website = "Full https URL, for example https://yourcompany.com";
    }
  }
  return e;
}

/** Logo, tagline, category and website for a seller org. Used by onboarding and settings. */
export function BrandFields({ name, value, onChange, errors = {} }: { name: string; value: BrandFormState; onChange: (v: BrandFormState) => void; errors?: Partial<Record<keyof BrandFormState, string>> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const markRef = useRef<HTMLInputElement>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const catId = useId();
  const set = <K extends keyof BrandFormState>(k: K, v: BrandFormState[K]) => onChange({ ...value, [k]: v });

  const onFile = (key: "logoUrl" | "markUrl") => async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLogoErr(null);
    setBusy(true);
    try {
      set(key, await fileToLogoDataUrl(f));
    } catch (err) {
      setLogoErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.fields}>
      <div className={s.logoRow}>
        <SellerMark name={name || "Your business"} brand={value.logoUrl ? { logoUrl: value.logoUrl } : undefined} variant="auto" size="xl" />
        <div className={s.logoActions}>
          <span className={s.label}>Logo</span>
          <span className={s.hint}>Your wordmark. PNG, JPEG, WebP or SVG, up to 96 KB after resizing. Shown on your market card, product page and negotiation header.</span>
          <div className={s.row}>
            <button type="button" className={s.textBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus size={14} aria-hidden /> {busy ? "Processing" : value.logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {value.logoUrl && (
              <button type="button" className={s.textBtn} onClick={() => set("logoUrl", "")}>
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile("logoUrl")} className="sr-only" aria-label="Upload logo" />
        </div>
      </div>
      <div className={s.logoRow}>
        <SellerMark name={name || "Your business"} brand={value.markUrl ? { markUrl: value.markUrl } : undefined} size="lg" />
        <div className={s.logoActions}>
          <span className={s.label}>Square mark</span>
          <span className={s.hint}>Optional icon for small slots: chat avatars, lists, the deal summary. Without one, buyers see your initials.</span>
          <div className={s.row}>
            <button type="button" className={s.textBtn} onClick={() => markRef.current?.click()} disabled={busy}>
              <ImagePlus size={14} aria-hidden /> {busy ? "Processing" : value.markUrl ? "Replace mark" : "Upload mark"}
            </button>
            {value.markUrl && (
              <button type="button" className={s.textBtn} onClick={() => set("markUrl", "")}>
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            )}
          </div>
          {logoErr && <span className={s.error}>{logoErr}</span>}
          <input ref={markRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile("markUrl")} className="sr-only" aria-label="Upload square mark" />
        </div>
      </div>
      <div className={s.grid2}>
        <Field label="Tagline" placeholder="Order support for online stores." hint="One line under your name." value={value.tagline} onChange={(e) => set("tagline", e.target.value)} error={errors.tagline} maxLength={140} />
        <div className={s.fields} style={{ gap: 6 }}>
          <label htmlFor={catId} className={s.label}>Category</label>
          <select id={catId} className={s.select} value={value.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Choose a category</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className={s.hint}>Buyers filter the market by it.</span>
        </div>
      </div>
      <Field label="Website" placeholder="https://yourcompany.com" hint="Optional. Linked from your market card." value={value.website} onChange={(e) => set("website", e.target.value)} error={errors.website} inputMode="url" autoComplete="url" />
    </div>
  );
}
