/**
 * Generates the blog's crawlable files from site/src/app/blog/posts.ts, so search engines, answer engines and link
 * previews read the same text as the page:
 *   public/blog/<slug>.md   each post as Markdown (the "Read as .md" link)
 *   public/blog/ssr.json    prerendered HTML, meta and JSON-LD the server injects for /blog and /blog/<slug>
 *   public/blog/rss.xml     RSS 2.0 feed
 *   public/sitemap.xml      home, docs pages and blog posts
 *   public/robots.txt       allow everything public, point at the sitemap
 * Run by `pnpm --filter ./site build` after gen-agent-docs.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POSTS, readMinutes, type Post } from "../src/app/blog/posts";
import { renderMarkdown } from "../src/app/blog/markdown";
import { BLOG_LEDE, BLOG_TITLE, formatDate, indexLd, ogImage, postLd } from "../src/app/blog/seo";
import { FACTS_AS_OF, SECTIONS } from "../src/app/docs/docsContent";

const ORIGIN = "https://app.proteus.co.in";
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(join(pub, "blog"), { recursive: true });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (md: string) => md.replace(/\]\((\/[^)\s]*)/g, `](${ORIGIN}$1`);

function postMarkdown(p: Post) {
  return [
    `# ${p.title}`,
    "",
    `> ${p.description}`,
    "",
    `${p.author} · published ${p.date}${p.updated && p.updated !== p.date ? `, updated ${p.updated}` : ""} · ${readMinutes(p)} min read · ${ORIGIN}/blog/${p.slug}`,
    "",
    "## Key takeaways",
    "",
    ...p.takeaways.map((t) => `- ${t}`),
    abs(p.body),
    "## Frequently asked questions",
    "",
    ...p.faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
  ].join("\n");
}

/** Static article HTML for crawlers; the SPA replaces it on load with the same content. */
function postHtml(p: Post) {
  const { html } = renderMarkdown(p.body);
  return [
    `<main><article>`,
    `<nav><a href="/">Proteus AI</a> / <a href="/blog">Blog</a></nav>`,
    `<h1>${esc(p.title)}</h1>`,
    `<p>${esc(p.description)}</p>`,
    `<p>${esc(p.author)} · Published <time datetime="${p.date}">${formatDate(p.date)}</time>${p.updated && p.updated !== p.date ? ` · Updated <time datetime="${p.updated}">${formatDate(p.updated)}</time>` : ""} · ${readMinutes(p)} min read</p>`,
    `<img src="${p.hero.src}" alt="${esc(p.hero.alt)}" />`,
    `<h2>Key takeaways</h2><ul>${p.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`,
    html,
    `<h2>Frequently asked questions</h2>`,
    ...p.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`),
    `<h2>Keep reading</h2><ul>${p.related.map((r) => POSTS.find((x) => x.slug === r)).filter(Boolean).map((r) => `<li><a href="/blog/${r!.slug}">${esc(r!.title)}</a></li>`).join("")}</ul>`,
    `</article></main>`,
  ].join("\n");
}

const indexHtml = [
  `<main><h1>${esc(BLOG_TITLE)}</h1><p>${esc(BLOG_LEDE)}</p><ul>`,
  ...POSTS.map((p) => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a><p>${esc(p.description)}</p></li>`),
  `</ul></main>`,
].join("\n");

for (const p of POSTS) writeFileSync(join(pub, "blog", `${p.slug}.md`), postMarkdown(p));

const ssr = {
  index: { title: `Blog · Proteus AI`, description: BLOG_LEDE, image: `${ORIGIN}/og/blog.jpg`, html: indexHtml, ld: [indexLd(ORIGIN)] },
  posts: Object.fromEntries(POSTS.map((p) => [p.slug, { title: `${p.title} · Proteus AI`, description: p.description, image: ogImage(ORIGIN, p), date: p.date, tags: p.tags, html: postHtml(p), ld: postLd(ORIGIN, p) }])),
};
writeFileSync(join(pub, "blog", "ssr.json"), JSON.stringify(ssr));

const rfc822 = (d: string) => new Date(`${d}T09:00:00Z`).toUTCString();
const rss = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
  `<channel>`,
  `<title>${esc(BLOG_TITLE)}</title>`,
  `<link>${ORIGIN}/blog</link>`,
  `<description>${esc(BLOG_LEDE)}</description>`,
  `<language>en</language>`,
  `<atom:link href="${ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml" />`,
  ...POSTS.map((p) => [
    `<item>`,
    `<title>${esc(p.title)}</title>`,
    `<link>${ORIGIN}/blog/${p.slug}</link>`,
    `<guid isPermaLink="true">${ORIGIN}/blog/${p.slug}</guid>`,
    `<pubDate>${rfc822(p.date)}</pubDate>`,
    `<description>${esc(p.description)}</description>`,
    ...p.tags.map((t) => `<category>${esc(t)}</category>`),
    `</item>`,
  ].join("\n")),
  `</channel>`,
  `</rss>`,
  "",
].join("\n");
writeFileSync(join(pub, "blog", "rss.xml"), rss);

const urls: [string, string][] = [
  ["/", FACTS_AS_OF],
  ["/docs", FACTS_AS_OF],
  ...SECTIONS.map((x) => [`/docs/${x.id}`, FACTS_AS_OF] as [string, string]),
  ["/docs/api", FACTS_AS_OF],
  ["/blog", POSTS.map((p) => p.updated ?? p.date).sort().at(-1)!],
  ...POSTS.map((p) => [`/blog/${p.slug}`, p.updated ?? p.date] as [string, string]),
];
const isoDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date(d).toISOString().slice(0, 10));
writeFileSync(join(pub, "sitemap.xml"), [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...urls.map(([u, d]) => `  <url><loc>${ORIGIN}${u === "/" ? "" : u}</loc><lastmod>${isoDay(d)}</lastmod></url>`),
  `</urlset>`,
  "",
].join("\n"));

writeFileSync(join(pub, "robots.txt"), [
  "# Proteus AI. Public pages, docs and the blog are open to search engines and AI agents.",
  "User-agent: *",
  "Allow: /",
  "Disallow: /app/",
  "Disallow: /embed/",
  "",
  `Sitemap: ${ORIGIN}/sitemap.xml`,
  "",
].join("\n"));

console.log(`blog: ${POSTS.length} posts (${POSTS.map((p) => `${p.slug} ${readMinutes(p)}m`).join(", ")}), rss.xml, sitemap.xml (${urls.length} urls), robots.txt`);
