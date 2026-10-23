import type { SellerBrand } from "../lib/types";

/** Small monochrome marks; they inherit the text color so they stay quiet next to the seller's meta line. */
const ICONS: Record<keyof NonNullable<SellerBrand["socials"]>, { label: string; path: string }> = {
  x: { label: "X", path: "M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" },
  instagram: { label: "Instagram", path: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm4.8-8.9a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16ZM12 3.6c2.28 0 2.55 0 3.45.05 2.3.1 3.38 1.2 3.48 3.48.05.9.05 1.17.05 3.45v2.84c0 2.28 0 2.55-.05 3.45-.1 2.28-1.17 3.38-3.48 3.48-.9.05-1.17.05-3.45.05H9.16c-2.28 0-2.55 0-3.45-.05-2.31-.1-3.38-1.2-3.48-3.48-.05-.9-.05-1.17-.05-3.45v-2.84c0-2.28 0-2.55.05-3.45.1-2.29 1.18-3.38 3.48-3.48.9-.05 1.17-.05 3.45-.05H12Zm0-1.6H9.1c-2.32 0-2.62.01-3.53.05C2.45 2.2.7 3.93.56 7.06.51 7.97.5 8.27.5 10.6v2.8c0 2.33.01 2.63.06 3.54.14 3.12 1.88 4.86 5 5 .92.05 1.22.06 3.54.06h2.8c2.33 0 2.63-.01 3.54-.06 3.12-.14 4.87-1.87 5-5 .05-.91.06-1.21.06-3.54v-2.8c0-2.33-.01-2.63-.06-3.54-.14-3.12-1.87-4.86-5-5C15.53 2.01 15.23 2 12.9 2H12Z" },
  farcaster: { label: "Farcaster", path: "M5.5 3h13v2.4h2.5l-.7 2.4h-.6v9.7c.33 0 .6.27.6.6v.65c.33 0 .6.27.6.6V20h-6.3v-.65c0-.33.27-.6.6-.6v-.65c0-.29.2-.53.48-.59V12.2a3.7 3.7 0 0 0-7.36 0v5.31c.28.06.48.3.48.59v.65c.33 0 .6.27.6.6V20H3.3v-.65c0-.33.27-.6.6-.6v-.65c0-.33.27-.6.6-.6V7.8h-.6L3.2 5.4h2.3V3Z" },
};

/** The seller's public profiles as quiet icon links. Hosts are checked server-side when the brand is saved. */
export function SocialLinks({ socials, className }: { socials?: SellerBrand["socials"]; className?: string }) {
  const entries = Object.entries(socials ?? {}).filter(([k, v]) => v && k in ICONS) as [keyof typeof ICONS, string][];
  if (!entries.length) return null;
  return (
    <span className={className} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
      {entries.map(([k, href]) => (
        <a key={k} href={href} target="_blank" rel="noreferrer" aria-label={`${ICONS[k].label}: ${handle(href)}`} title={`${ICONS[k].label} · ${handle(href)}`} style={{ display: "inline-flex", color: "inherit", opacity: 0.75 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d={ICONS[k].path} />
          </svg>
        </a>
      ))}
    </span>
  );
}

function handle(href: string) {
  try {
    const seg = new URL(href).pathname.split("/").filter(Boolean)[0];
    return seg ? `@${seg.replace(/^@/, "")}` : href;
  } catch {
    return href;
  }
}
