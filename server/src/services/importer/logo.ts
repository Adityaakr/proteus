/**
 * The seller's logo, copied into the store as a data URL. Many sites serve their images with
 * Cross-Origin-Resource-Policy: same-site, so a hotlinked logo shows as broken on Proteus. Candidates, best first:
 * the header or menu image that says "logo" (a Next.js /_next/image URL also gives its original file), the JSON-LD
 * Organization logo, the apple-touch-icon, a PNG or SVG icon, and last any other image on the page that says "logo"
 * (a product photo such as "Logo Cap" must not outrank the site's own logo). Each is fetched through the site's guarded fetch
 * and kept only when it is a PNG, JPEG, WebP or SVG whose bytes match its type and that fits the logo size limit.
 */
import type { SafeResponse } from "../../lib/net-guard";
import { MAX_DATA_URL } from "../brand";
import { decodeEntities, jsonLdObjects, linksOf, typeIs } from "./html";
import type { SiteFetcher } from "./site-fetcher";

const BUILDER_HOSTS = /(^|\.)(wix|squarespace|weebly|webflow|godaddy|framer)\.com$/i;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(String.raw`\s${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`, "i").exec(tag);
  const v = m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  return v === undefined ? undefined : decodeEntities(v).trim();
}

function logoImages(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = attr(tag, "src");
    if (!src || !/logo/i.test([attr(tag, "alt"), attr(tag, "class"), attr(tag, "id"), src].join(" "))) continue;
    try {
      const u = new URL(src, pageUrl);
      const inner = u.pathname.endsWith("/_next/image") ? u.searchParams.get("url") : null;
      if (inner) out.push(new URL(inner, u).toString());
      out.push(u.toString());
    } catch {
      continue;
    }
  }
  return out;
}

/** Logo URLs from a page, best first. */
export function logoCandidates(html: string, pageUrl: string): string[] {
  const top = [...html.matchAll(/<(header|nav)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]).join("\n");
  const org = jsonLdObjects(html).find((o) => typeIs(o, "Organization") || typeIs(o, "Store") || typeIs(o, "OnlineStore") || typeIs(o, "LocalBusiness"));
  const ldLogo = org?.logo && typeof org.logo === "object" ? (org.logo as { url?: unknown }).url : org?.logo;
  const links = linksOf(html, pageUrl);
  const raw = [
    ...logoImages(top, pageUrl),
    typeof ldLogo === "string" ? ldLogo : undefined,
    links.find((l) => l.rel.includes("apple-touch-icon"))?.url,
    links.find((l) => l.rel.split(/\s+/).includes("icon") && /\.(png|svg)(\?|$)/i.test(l.url))?.url,
    ...logoImages(html, pageUrl),
  ];
  const out: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    try {
      const u = new URL(r, pageUrl);
      if (u.protocol !== "https:" || BUILDER_HOSTS.test(u.hostname)) continue;
      if (!out.includes(u.toString())) out.push(u.toString());
    } catch {
      continue;
    }
  }
  return out;
}

const MATCHES: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.length > 8 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG",
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
  "image/svg+xml": (b) => {
    const text = b.toString("utf8").replace(/^\uFEFF/, "");
    return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(text) && !/<script|\son[a-z]+\s*=|javascript:/i.test(text);
  },
};

/** The response as a data URL, when it is an accepted image type whose bytes match and it fits the logo limit. */
export function imageDataUrl(res: SafeResponse): string | undefined {
  const type = res.contentType.split(";")[0]!.trim().toLowerCase();
  const bytes = res.bytes;
  if (res.status !== 200 || res.truncated || !bytes || !MATCHES[type]?.(bytes)) return undefined;
  const url = `data:${type};base64,${bytes.toString("base64")}`;
  return url.length <= MAX_DATA_URL ? url : undefined;
}

/** The first candidate that is a usable image, as a data URL. At most four requests. */
export async function inlineLogo(site: SiteFetcher, candidates: string[]): Promise<string | undefined> {
  const maxBytes = Math.floor(MAX_DATA_URL * 0.75);
  for (const c of candidates.slice(0, 4)) {
    const res = await site.asset(c, { bytes: true, maxBytes, accept: "image/png,image/svg+xml,image/webp,image/jpeg;q=0.9" });
    const url = res && imageDataUrl(res);
    if (url) return url;
  }
  return undefined;
}
