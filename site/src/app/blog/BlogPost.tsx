/** /blog/:slug: one article with key takeaways, contents, FAQ, a call to action and related posts. */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, Check, CheckCircle2, Copy, FileText, Plus } from "lucide-react";
import { postBySlug, readMinutes } from "./posts";
import { renderMarkdown } from "./markdown";
import { formatDate, postLd } from "./seo";
import { BlogLayout, Foot } from "./BlogLayout";
import { PostCard } from "./BlogIndex";
import s from "./blog.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://app.proteus.co.in";

export default function BlogPost() {
  const { slug } = useParams();
  const p = slug ? postBySlug(slug) : undefined;
  const { html, headings } = useMemo(() => (p ? renderMarkdown(p.body) : { html: "", headings: [] }), [p]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!p) return;
    document.title = `${p.title} · Proteus AI`;
    window.scrollTo({ top: 0 });
  }, [p]);

  if (!p) return <Navigate to="/blog" replace />;
  const url = `${ORIGIN}/blog/${p.slug}`;
  const related = p.related.map(postBySlug).filter((x): x is NonNullable<typeof x> => !!x);
  const ask = encodeURIComponent(`Read ${url}.md and answer my questions about it.`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <BlogLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postLd(ORIGIN, p)) }} />
      <main className={s.wrap} id="main">
        <header className={s.head}>
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <Link to="/">Proteus AI</Link><span aria-hidden>/</span><Link to="/blog">Blog</Link>
          </nav>
          <div className={s.tags}>{p.tags.map((t) => <span key={t} className={s.tag}>{t}</span>)}</div>
          <h1 className={s.postTitle}>{p.title}</h1>
          <p className={s.postLede}>{p.description}</p>
          <div className={s.byline}>
            <span className={s.avatar} aria-hidden><img src="/assets/7QuYVNK6yeb3hmBB6mc2yJ1DBUg.png" alt="" width={18} height={18} /></span>
            <span className={s.author}>{p.author}</span>
            <span className={s.dot} aria-hidden />
            <span>Published <time dateTime={p.date}>{formatDate(p.date)}</time></span>
            {p.updated && p.updated !== p.date && <><span className={s.dot} aria-hidden /><span>Updated <time dateTime={p.updated}>{formatDate(p.updated)}</time></span></>}
            <span className={s.dot} aria-hidden />
            <span>{readMinutes(p)} min read</span>
          </div>
        </header>

        <figure className={s.heroShot}><img src={p.hero.src} alt={p.hero.alt} decoding="async" fetchPriority="high" /></figure>

        <div className={s.layout}>
          <article>
            <section className={s.takeaways} aria-labelledby="takeaways">
              <h2 id="takeaways">Key takeaways</h2>
              <ul>{p.takeaways.map((t) => <li key={t}><CheckCircle2 size={17} aria-hidden />{t}</li>)}</ul>
            </section>

            <div className={s.prose} dangerouslySetInnerHTML={{ __html: html }} />

            <section className={s.section} aria-labelledby="faq">
              <h2 id="faq" className={s.sectionTitle}>Frequently asked questions</h2>
              <div className={s.faq}>
                {p.faq.map((f, i) => (
                  <details key={f.q} open={i === 0}>
                    <summary>{f.q}<Plus size={18} aria-hidden /></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className={s.ctaCard}>
              <h2>Give your business a deal desk</h2>
              <p>Set your products and rules once. Proteus AI negotiates inside them, both sides sign the same terms, and USDC waits on Arc until you deliver.</p>
              <div className={s.ctaRow}>
                <a href="https://app.proteus.co.in/app" className={s.ctaPrimary}>Start selling <ArrowUpRight size={14} aria-hidden /></a>
                <Link to="/docs/quickstart-seller" className={s.ctaGhost}>Read the quickstart</Link>
              </div>
            </section>
          </article>

          <aside className={s.toc} aria-label="On this page">
            <span className={s.tocLabel}>On this page</span>
            <a href="#takeaways" className={s.tocLink}>Key takeaways</a>
            {headings.map((h) => <a key={h.id} href={`#${h.id}`} className={`${s.tocLink} ${h.level === 3 ? s.tocSub : ""}`}>{h.text}</a>)}
            <a href="#faq" className={s.tocLink}>FAQ</a>
            <div className={s.share}>
              <button type="button" className={s.btn} onClick={copyLink}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? "Link copied" : "Copy link"}</button>
              <a href={`/blog/${p.slug}.md`} className={s.btn}><FileText size={14} aria-hidden /> Read as .md</a>
              <a href={`https://claude.ai/new?q=${ask}`} className={s.btn} target="_blank" rel="noreferrer">Ask Claude <ArrowUpRight size={13} aria-hidden /></a>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className={s.section} aria-labelledby="related">
            <h2 id="related" className={s.sectionTitle}>Keep reading</h2>
            <div className={s.related}>{related.map((r) => <PostCard key={r.slug} p={r} />)}</div>
          </section>
        )}
        <Foot />
      </main>
    </BlogLayout>
  );
}

