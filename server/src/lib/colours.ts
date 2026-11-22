/**
 * Colour options read from a seller's website are sometimes only a swatch's code ("#273a6b"). Buyers never see a code:
 * it becomes the nearest plain colour name ("navy"), and real names ("Black", "Forest Green") stay as they are.
 */

/** Plain colour names a buyer would say, each at a typical shade. */
const PALETTE: [string, number, number, number][] = [
  ["black", 0x11, 0x11, 0x11],
  ["charcoal", 0x36, 0x45, 0x4f],
  ["dark grey", 0x4a, 0x4a, 0x4a],
  ["grey", 0x80, 0x80, 0x80],
  ["light grey", 0xd3, 0xd3, 0xd3],
  ["white", 0xff, 0xff, 0xff],
  ["cream", 0xff, 0xfd, 0xd0],
  ["beige", 0xf5, 0xf5, 0xdc],
  ["khaki", 0xc3, 0xb0, 0x91],
  ["tan", 0xd2, 0xb4, 0x8c],
  ["brown", 0x7b, 0x4a, 0x2a],
  ["maroon", 0x80, 0x10, 0x20],
  ["rust", 0xa8, 0x4a, 0x3a],
  ["red", 0xd3, 0x2f, 0x2f],
  ["pink", 0xf4, 0xa6, 0xc0],
  ["orange", 0xf5, 0x8a, 0x1f],
  ["mustard", 0xd8, 0xa9, 0x1b],
  ["yellow", 0xf9, 0xe0, 0x4b],
  ["olive", 0x6b, 0x70, 0x2a],
  ["green", 0x2e, 0x7d, 0x32],
  ["forest green", 0x1f, 0x45, 0x35],
  ["mint", 0xa8, 0xe6, 0xc1],
  ["teal", 0x00, 0x80, 0x80],
  ["sky blue", 0x87, 0xce, 0xeb],
  ["blue", 0x1e, 0x5b, 0xd6],
  ["navy", 0x1f, 0x2a, 0x5a],
  ["purple", 0x6a, 0x1b, 0x9a],
  ["lavender", 0xb5, 0x9e, 0xdc],
  ["gold", 0xd4, 0xaf, 0x37],
];

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/gi;

function rgbOf(code: string): [number, number, number] | undefined {
  const rgb = new RegExp(RGB.source, "i").exec(code);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => Math.min(255, n)) as [number, number, number];
  const h = code.replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) return undefined;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** sRGB to CIE Lab (D65), where distance follows how different two colours look. */
function lab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const PALETTE_LAB = PALETTE.map(([name, r, g, b]) => ({ name, lab: lab([r, g, b]) }));

/** The plain name closest to a colour code ("#273a6b" → "navy"), by distance in CIE Lab. */
export function nearestColourName(code: string): string | undefined {
  const c = rgbOf(code.trim());
  if (!c) return undefined;
  const [L, A, B] = lab(c);
  let best: { name: string; d: number } | undefined;
  for (const p of PALETTE_LAB) {
    const d = (L - p.lab[0]) ** 2 + (A - p.lab[1]) ** 2 + (B - p.lab[2]) ** 2;
    if (!best || d < best.d) best = { name: p.name, d };
  }
  return best?.name;
}

/** Every colour code inside a piece of text named instead: "Utility Cap / #273a6b" → "Utility Cap / navy". */
export function nameColourCodes(text: string): string {
  return text.replace(new RegExp(HEX.source, "gi"), (m) => nearestColourName(m) ?? m).replace(new RegExp(RGB.source, "gi"), (m) => nearestColourName(m) ?? m);
}

/** Option values with every code named, then duplicates dropped ("#111", "#121212" → one "black"); real names kept. */
export function nameColourValues(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const named = nameColourCodes(v).trim();
    if (named && !out.some((o) => o.toLowerCase() === named.toLowerCase())) out.push(named);
  }
  return out;
}

/**
 * A last guard on text a buyer reads (the agent's reply, what it says it understood): six- or eight-digit codes with a
 * letter in them ("#273a6b") are named. Shorter or all-digit ones ("order #123456") could be anything, so they stay.
 */
export function nameColourCodesInProse(text: string): string {
  return text.replace(/#(?=[0-9a-f]*[a-f])(?:[0-9a-f]{8}|[0-9a-f]{6})\b/gi, (m) => nearestColourName(m) ?? m);
}

/** Options and variant names with colour codes named: what a buyer, or an agent answering one, may read. */
export function nameColours<T extends { options: { name: string; values: string[] }[]; variants: (string | { name: string })[] }>(k: T): T {
  return {
    ...k,
    options: k.options.map((o) => ({ ...o, values: nameColourValues(o.values) })),
    variants: k.variants.map((v) => (typeof v === "string" ? nameColourCodes(v) : { ...v, name: nameColourCodes(v.name) })),
  };
}
