/**
 * One import: read robots.txt, the homepage and the catalog through the source chain, then the brand, the store
 * policies and order hints. Scraped text that reads like instructions to an AI is dropped and counted, never passed on.
 */
import { nameColours } from "../../lib/colours";
import { BlockedUrlError, checkPublicHttpsUrl } from "../../lib/net-guard";
import type { PageRenderer } from "./browser";
import { browserSource, elsewhereOf, type BrowserReadResult } from "./browser-source";
import { cleanText, faqHints, hintsFrom, jsonLdObjects, linksOf, metaTags, socialLinks, titleOf, typeIs, visibleText } from "./html";
import { inlineLogo, logoCandidates } from "./logo";
import { SiteFetcher, type RawFetch } from "./site-fetcher";
import { pageReadDetail, pageTextSource, PRODUCT_PATH, readProductPages, shopifySource, structuredSource, wooSource, type PageBudget, type PageExtractor, type RenderedPages } from "./sources";
import { LIMITS, type BusinessType, type ImportProgress, type ImportResult, type ImportedBrand, type ImportedPolicy, type ImportedProduct, type SourceReport } from "./types";

export interface ImportDeps {
  fetch: RawFetch;
  extractor?: PageExtractor;
  rendered?: RenderedPages;
  /** A real browser for sites that need JavaScript (local headless Chromium or a cloud browser). */
  renderer?: PageRenderer;
  onProgress?: (p: ImportProgress) => void;
  delayMs?: number;
  /** Smaller product-page budgets, for tests. */
  pageBudget?: Partial<PageBudget>;
}

/** Progress while product pages are read: one line, replaced as it advances ("Reading product pages (140 of 200)"). */
function pageProgress(progress: (label: string, state?: ImportProgress["state"]) => void) {
  return (n: number, of: number) => {
    if (n === 1 || n % 10 === 0 || n === of) progress(`Reading product pages (${n} of ${of})`, "working");
  };
}

/** "Read all 200 product pages", or how many were read and how many are left. */
function pagesLine(total: number, unread: number, stoppedBy?: string): string {
  return unread ? `Read ${total - unread} of ${total} product pages; ${unread} not read yet${stoppedBy ? ` (stopped at ${stoppedBy})` : ""}` : `Read all ${total} product pages`;
}

function unreadOf(urls: string[], total: number, stoppedBy?: string): Pick<ImportResult, "unread" | "limited"> {
  if (!urls.length) return {};
  return { unread: { urls, total, ...(stoppedBy ? { stoppedBy } : {}) }, limited: `stopped${stoppedBy ? ` at ${stoppedBy}` : ""} after reading ${total - urls.length} of ${total} product pages; ${urls.length} were not read` };
}

/** "shoonyastore.com", "http://shop.example.com/x" → an https URL. Throws BlockedUrlError for anything else. */
export function normalizeSiteUrl(input: string): URL {
  const t = input.trim().replace(/^http:\/\//i, "https://");
  if (!t || t.length > 300) throw new BlockedUrlError("enter your website address, for example shop.example.com");
  return checkPublicHttpsUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
}

const INSTRUCTION_LIKE = [
  /ignore (all |any |the |your )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /disregard (the |your |all )?(instructions|rules|policy|system)/i,
  /\b(system|developer) (prompt|message|instructions?)\b/i,
  /you are (now )?(an? )?(ai|assistant|language model|chatgpt|claude|gpt)/i,
  /(reveal|show|tell|print) (me )?(your|the) (cost|floor|margin|instructions|prompt|secret)/i,
  /\b(offer|give|sell)\b.{0,40}\b(free|100% off|for \$?0)\b/i,
  /<\/?(system|assistant|user|instructions?)>/i,
];

export function looksLikeInstructions(s: string | undefined): boolean {
  return Boolean(s) && INSTRUCTION_LIKE.some((re) => re.test(s!));
}

/** Policy pages by their path (link text is often a generic "Learn more"); product pages never count. */
const POLICY_KINDS: [ImportedPolicy["kind"], RegExp, RegExp][] = [
  ["shipping", /\/(shipping|delivery)([-_](policy|info|information))?\/?$|\/policies\/shipping/i, /shipping|delivery/i],
  ["returns", /\/(returns?|refunds?|exchanges?)([-_](policy|and[-_]exchanges?))?\/?$|\/policies\/refund/i, /return|refund|exchange/i],
  ["custom-orders", /\/(custom[-_]?(order|request)s?|bulk[-_]?orders?|wholesale|corporate[-_]?orders?)\/?$/i, /custom|bulk|wholesale|quote/i],
  ["terms", /\/(terms([-_](of[-_](service|use)|and[-_]conditions))?|tos)\/?$|\/policies\/terms/i, /terms|conditions/i],
  ["faq", /\/faqs?\/?$/i, /faq|question/i],
];

function brandOf(html: string, url: string): ImportedBrand {
  const m = metaTags(html);
  const ld = jsonLdObjects(html);
  const org = ld.find((o) => typeIs(o, "Organization") || typeIs(o, "Store") || typeIs(o, "OnlineStore") || typeIs(o, "LocalBusiness"));
  const site = ld.find((o) => typeIs(o, "WebSite"));
  const links = linksOf(html, url);
  const name = cleanText(m["og:site_name"] ?? org?.name ?? site?.name ?? m["application-name"] ?? titleOf(html).split(/[|–—-]/)[0], 80) || new URL(url).hostname.replace(/^www\./, "");
  const logoUrl = logoCandidates(html, url)[0];
  const description = cleanText(m.description ?? m["og:description"] ?? org?.description, 300) || undefined;
  const title = titleOf(html);
  const slogan = cleanText(org?.slogan, 140) || (title.includes("|") || title.includes(" - ") ? cleanText(title.split(/[|]| - /).slice(1).join(" ").trim(), 140) : "") || undefined;
  return { name, tagline: slogan && slogan.toLowerCase() !== name.toLowerCase() ? slogan : undefined, description, logoUrl, website: new URL(url).origin, socials: socialLinks(links) };
}

const TYPE_WORDS: [BusinessType, RegExp][] = [
  ["merch", /merch|custom print|branded|corporate gift|swag|promotional|sticker|badge|tote/i],
  ["apparel", /apparel|t-?shirt|tee\b|hoodie|clothing|fashion|dress|polo/i],
  ["packaging", /packaging|carton|gift box|rigid box|mailer/i],
  ["food", /food|bakery|coffee|tea\b|snack|spice|chocolate|restaurant/i],
  ["beauty", /beauty|skin ?care|cosmetic|soap|fragrance|perfume/i],
  ["home", /home decor|furniture|kitchen|candle|ceramic/i],
  ["electronics", /electronic|gadget|charger|earbud|power ?bank|laptop/i],
  ["services", /consult|agency|studio services|booking|appointment|subscription/i],
];

function guessType(products: ImportedProduct[], text: string): ImportResult["businessType"] {
  const hay = `${text.slice(0, 4000)} ${products.map((p) => `${p.name} ${p.category ?? ""}`).join(" ")}`;
  const scored = TYPE_WORDS.map(([t, re]) => ({ t, n: (hay.match(new RegExp(re.source, "gi")) ?? []).length })).sort((a, b) => b.n - a.n);
  const best = scored[0]!;
  if (!best.n) return { guess: "other", reason: "nothing on the site says clearly what kind of business it is" };
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))].slice(0, 4);
  return { guess: best.t, reason: cats.length ? `categories such as ${cats.join(", ")}` : `words on the site such as "${(hay.match(TYPE_WORDS.find(([t]) => t === best.t)![1]) ?? [""])[0]}"` };
}

function dedupe(products: ImportedProduct[]): ImportedProduct[] {
  const seen = new Map<string, ImportedProduct>();
  for (const p of products) {
    const k = p.url ? p.url.replace(/[?#].*$/, "").toLowerCase() : p.name.toLowerCase();
    const prev = seen.get(k) ?? [...seen.values()].find((x) => x.name.toLowerCase() === p.name.toLowerCase() && (x.category ?? "") === (p.category ?? ""));
    if (!prev) seen.set(k, p);
    else if (!prev.price && p.price) seen.set(k, { ...p, key: prev.key });
  }
  return [...seen.values()];
}

export async function runImport(input: string, deps: ImportDeps): Promise<ImportResult> {
  const progress = (label: string, state: ImportProgress["state"] = "done", detail?: string) => deps.onProgress?.({ at: new Date().toISOString(), label, state, detail });
  const start = normalizeSiteUrl(input);
  const site = new SiteFetcher(start, deps.fetch, { delayMs: deps.delayMs });
  const sources: SourceReport[] = [];

  progress(`Reading ${start.hostname}`, "working");
  const robots = await site.loadRobots();
  sources.push(robots);
  progress(robots.status === "blocked" ? "robots.txt does not let us read this site" : "Checked robots.txt", robots.status === "blocked" ? "blocked" : "done", robots.detail);
  if (robots.status === "blocked") throw new Error(`${start.hostname} cannot be read: ${robots.detail}`);

  const home = await site.get(start.pathname === "/" ? "/" : start.pathname + start.search);
  if (!home.res || home.res.status >= 400) throw new Error(`${start.hostname} homepage could not be read${home.res ? ` (HTTP ${home.res.status})` : `: ${home.why}`}`);
  const homeUrl = home.res.url;
  const homepage = home.res.body;
  const brand = brandOf(homepage, homeUrl);
  const generator = metaTags(homepage).generator ?? "";
  const platform = /shopify/i.test(homepage.slice(0, 200_000)) ? "Shopify" : /woocommerce|wp-content/i.test(homepage) ? "WordPress / WooCommerce" : /__next_f|_next\/static/.test(homepage) ? "Next.js (custom)" : generator ? cleanText(generator, 40) : "custom";
  progress(`Found ${brand.name}`, "done", `${platform} site`);

  let products: ImportedProduct[] = [];
  let siteUrls: string[] = [];
  let unread: Pick<ImportResult, "unread" | "limited"> = {};
  const tryPlatform = async (run: () => Promise<{ products: ImportedProduct[]; report: SourceReport }>) => {
    const out = await run();
    sources.push(out.report);
    if (out.products.length) products = out.products;
    return out.products.length > 0;
  };

  // The plain HTML of an app built with JavaScript is an empty shell: its text, links and products appear only in a browser.
  const shell = visibleText(homepage, 4_000).length < 300;
  let viewed: BrowserReadResult | undefined;

  progress("Looking for a store catalog", "working");
  if (!(await tryPlatform(() => shopifySource(site, homepage))) && !(await tryPlatform(() => wooSource(site, homepage)))) {
    const s = await structuredSource(site, homepage, homeUrl, pageProgress(progress), deps.pageBudget);
    sources.push(s.sitemap, s.report);
    siteUrls = s.siteUrls;
    if (s.total) progress(pagesLine(s.total, s.unread.length, s.stoppedBy), "done");
    if (s.products.length) unread = unreadOf(s.unread, s.total, s.stoppedBy);
    if (s.products.length) products = s.products;
    else {
      if (deps.renderer) {
        progress(shell ? "The site is built with JavaScript; opening it in a browser" : "No catalog data; opening the site in a browser", "working");
        viewed = await browserSource(site, deps.renderer, homeUrl, { extractor: deps.extractor, siteName: brand.name ?? start.hostname, progress, delayMs: deps.delayMs });
        sources.push(...viewed.reports);
        if (viewed.products.length) products = viewed.products;
        if (viewed.rendered) progress(`Read ${viewed.rendered} page${viewed.rendered === 1 ? "" : "s"} in the browser`, "done", viewed.engine);
      } else sources.push({ source: "browser", status: "skipped", detail: "no browser is available on this server, so pages that need JavaScript were not opened" });
      // Without a working browser: a rendering service and the model on the plain page text.
      if (!viewed?.rendered) {
        for (const o of await pageTextSource(site, homepage, homeUrl, deps.extractor, brand.name ?? start.hostname, deps.rendered)) {
          sources.push(o.report);
          if (o.products.length) products = o.products;
        }
      }
    }
  }
  products = dedupe(products).slice(0, LIMITS.products);

  // The rendered homepage fills in what the empty shell lacked: social links, logo, description.
  const seenHome = viewed?.home;
  if (seenHome && shell) {
    const b = brandOf(seenHome.html, seenHome.url);
    brand.socials = { ...b.socials, ...Object.fromEntries(Object.entries(brand.socials).filter(([, v]) => v)) };
    brand.logoUrl ??= b.logoUrl;
    brand.description ??= b.description;
  }
  const logo = await inlineLogo(site, [...new Set([...logoCandidates(homepage, homeUrl), ...(seenHome && shell ? logoCandidates(seenHome.html, seenHome.url) : [])])]);
  if (logo) brand.logoUrl = logo;
  const elsewhere = [...(viewed?.elsewhere ?? [])];
  for (const l of linksOf(homepage, homeUrl)) {
    const away = elsewhereOf({ url: l.url, text: l.text }, (u) => site.sameSite(u));
    if (away && !elsewhere.some((e) => e.url === away.url)) elsewhere.push(away);
  }

  // Store policies: shipping, returns, custom-order and terms pages linked from the homepage or listed in the sitemap.
  const policies: ImportedPolicy[] = [];
  const candidates = [...new Set([...linksOf(homepage, homeUrl).map((l) => l.url), ...(viewed?.links ?? []), ...siteUrls])].filter((u) => {
    const x = new URL(u);
    return site.sameSite(x) && !PRODUCT_PATH.test(x.pathname);
  });
  for (const [kind, path, words] of POLICY_KINDS) {
    if (policies.length >= 4) break;
    const url = candidates.find((u) => path.test(new URL(u).pathname));
    if (!url) continue;
    const { res } = await site.get(url);
    if (!res || res.status !== 200) continue;
    const text = visibleText(res.body, 30_000);
    // Start at the first sentence that is about the policy, past the page's navigation.
    const sentences = text.split(/(?<=[.!?])\s+/);
    const first = sentences.findIndex((s) => s.length < 400 && words.test(s));
    const summary = cleanText(sentences.slice(Math.max(0, first)).join(" "), LIMITS.textPerField);
    if (summary && !looksLikeInstructions(summary)) policies.push({ kind, url: res.url, summary });
  }
  sources.push({ source: "policies", status: policies.length ? "used" : "not-found", detail: policies.length ? `read ${policies.map((p) => p.kind).join(", ")}` : "no policy pages linked from the homepage" });

  // Untrusted text: drop anything that reads like instructions to an AI.
  const screen = screenProducts(products);
  products = screen.products;
  let screened = screen.screened;
  if (brand.description && looksLikeInstructions(brand.description)) {
    brand.description = undefined;
    screened++;
  }
  // The rendered text keeps its line breaks, so a heading or an FAQ question is not glued to the next line.
  const staticText = visibleText(homepage, 20_000);
  const homeText = seenHome && seenHome.text.length > staticText.length ? seenHome.text.slice(0, 20_000) : staticText;
  const faq = seenHome ? faqHints(seenHome.text, 4) : [];
  const lines = [...faq, ...hintsFrom(homeText, 4), ...policies.flatMap((p) => hintsFrom(p.summary, 2))];
  const hints = lines.filter((h, i) => !looksLikeInstructions(h) && !lines.some((o, j) => j !== i && o.length > h.length && o.includes(h)) && lines.indexOf(h) === i).slice(0, 8);
  if (screened) sources.push({ source: "policies", status: "blocked", detail: `${screened} piece${screened > 1 ? "s" : ""} of text read like instructions to an AI and ${screened > 1 ? "were" : "was"} left out` });

  const priced = products.filter((p) => p.price).length;
  progress(products.length ? `Found ${products.length} products${priced < products.length ? `, ${priced} with a price` : ""}` : "No products found", products.length ? "done" : "blocked");
  return {
    site: { url: homeUrl, host: new URL(homeUrl).hostname, platform },
    brand,
    products,
    policies,
    hints,
    businessType: guessType(products, `${titleOf(homepage)} ${brand.description ?? ""} ${homeText.replace(/\s+/g, " ")}`),
    sources,
    pagesFetched: site.requests + (viewed?.rendered ?? 0),
    ...(elsewhere.length ? { elsewhere: elsewhere.filter((e) => !looksLikeInstructions(e.label)).slice(0, 5) } : {}),
    ...(viewed?.rendered ? { browser: { engine: viewed.engine, pages: viewed.rendered } } : {}),
    ...(unread.unread ? unread : site.budgetLeft <= 0 ? { limited: `stopped after ${site.requests} requests` } : products.length >= LIMITS.products ? { limited: `kept the first ${LIMITS.products} products` } : {}),
  };
}

/**
 * Drops scraped text that reads like instructions to an AI: a description or hint is cleared, a product so named is
 * left out. Colour swatch codes in options and variants become colour names ("#273a6b" → navy).
 */
function screenProducts(products: ImportedProduct[]): { products: ImportedProduct[]; screened: number } {
  let screened = 0;
  for (const p of products) {
    Object.assign(p, nameColours(p));
    if (looksLikeInstructions(p.description)) {
      p.description = undefined;
      screened++;
    }
    const keep = p.hints.filter((h) => !looksLikeInstructions(h));
    screened += p.hints.length - keep.length;
    p.hints = keep;
  }
  const kept = products.filter((p) => {
    if (!looksLikeInstructions(p.name)) return true;
    screened++;
    return false;
  });
  return { products: kept, screened };
}

/**
 * Continues a read that a budget stopped: the product pages in `prior.unread`, from where it stopped, with fresh
 * budgets, robots.txt read again. The new products join the earlier ones (deduplicated, capped) and the rest, if a
 * budget stops this read too, stays in `unread` for another round.
 */
export async function continueImport(prior: ImportResult, deps: ImportDeps): Promise<ImportResult> {
  const left = prior.unread;
  if (!left?.urls.length) return prior;
  const progress = (label: string, state: ImportProgress["state"] = "done", detail?: string) => deps.onProgress?.({ at: new Date().toISOString(), label, state, detail });
  const site = new SiteFetcher(normalizeSiteUrl(prior.site.url), deps.fetch, { delayMs: deps.delayMs });
  const robots = await site.loadRobots();
  if (robots.status === "blocked") throw new Error(`${prior.site.host} cannot be read now: ${robots.detail}`);
  const done = left.total - left.urls.length;
  progress(`Reading the other ${left.urls.length} product pages`, "working");
  const r = await readProductPages(site, left.urls, { onPage: pageProgress(progress), budget: deps.pageBudget, have: prior.products.length, total: left.total });
  const screen = screenProducts(r.products);
  const products = dedupe([...prior.products, ...screen.products]).slice(0, LIMITS.products);
  const added = products.length - prior.products.length;
  progress(pagesLine(left.total, r.unread.length, r.stoppedBy), "done", `${added} more product${added === 1 ? "" : "s"}`);
  const { unread: _u, limited: _l, ...rest } = prior;
  const priced = products.filter((p) => p.price).length;
  progress(`Found ${products.length} products${priced < products.length ? `, ${priced} with a price` : ""}`, "done");
  return {
    ...rest,
    products,
    sources: [
      ...prior.sources,
      { source: "json-ld", status: added ? "used" : "not-found", detail: `continued: ${pageReadDetail(r, left.total, done)}${added ? `, ${added} more products` : ""}`, products: added },
      ...(screen.screened ? [{ source: "policies" as const, status: "blocked" as const, detail: `${screen.screened} more piece${screen.screened > 1 ? "s" : ""} of text read like instructions to an AI and ${screen.screened > 1 ? "were" : "was"} left out` }] : []),
    ],
    pagesFetched: prior.pagesFetched + site.requests,
    ...(r.unread.length ? unreadOf(r.unread, left.total, r.stoppedBy) : products.length >= LIMITS.products ? { limited: `kept the first ${LIMITS.products} products` } : {}),
  };
}
