/** /blog: the featured post, then the rest as cards. */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { POSTS, readMinutes, type Post } from "./posts";
import { BLOG_LEDE, BLOG_TITLE, formatDate, indexLd } from "./seo";
import { BlogLayout, Foot } from "./BlogLayout";
import s from "./blog.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://app.proteus.co.in";

export function Meta({ p }: { p: Post }) {
  return (
    <div className={s.meta}>
      <time dateTime={p.date}>{formatDate(p.date)}</time>
      <span className={s.dot} aria-hidden />
      <span>{readMinutes(p)} min read</span>
    </div>
  );
}

export function PostCard({ p }: { p: Post }) {
  return (
    <Link to={`/blog/${p.slug}`} className={s.card}>
      <div className={s.cardImg}><img src={p.hero.src} alt={p.hero.alt} loading="lazy" decoding="async" /></div>
      <div className={s.cardBody}>
        <div className={s.tags}>{p.tags.slice(0, 2).map((t) => <span key={t} className={s.tag}>{t}</span>)}</div>
        <h3 className={s.cardTitle}>{p.title}</h3>
        <p className={s.excerpt}>{p.description}</p>
        <Meta p={p} />
      </div>
    </Link>
  );
}

export default function BlogIndex() {
  const [first, ...others] = POSTS;
  const rest = [...others].sort((a, b) => b.date.localeCompare(a.date));
  useEffect(() => {
    document.title = "Blog · Proteus AI";
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <BlogLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(indexLd(ORIGIN)) }} />
      <main className={s.wrap} id="main">
        <header className={s.hero}>
          <span className={s.eyebrow}>Blog</span>
          <h1 className={s.title}>{BLOG_TITLE}</h1>
          <p className={s.lede}>{BLOG_LEDE}</p>
        </header>

        {first && (
          <Link to={`/blog/${first.slug}`} className={s.featured}>
            <div className={s.featuredImg}><img src={first.hero.src} alt={first.hero.alt} decoding="async" /></div>
            <div className={s.featuredBody}>
              <span className={s.eyebrow}>Start here</span>
              <h2 className={s.featuredTitle}>{first.title}</h2>
              <p className={s.excerpt}>{first.description}</p>
              <Meta p={first} />
              <span className={s.readMore}>Read the article <ArrowRight size={14} aria-hidden /></span>
            </div>
          </Link>
        )}

        <div className={s.grid}>{rest.map((p) => <PostCard key={p.slug} p={p} />)}</div>
        <Foot />
      </main>
    </BlogLayout>
  );
}
