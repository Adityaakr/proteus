/**
 * /docs: the product docs. Content lives in docsContent.ts so the page and "Copy Markdown" always say the same thing.
 * Three columns: sections grouped on the left, the document, and the active section's headings on the right.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import "../app.css";
import { Wordmark } from "../layouts/Wordmark";
import { DOC_LEDE, DOC_TITLE, GROUPS, SECTIONS, docsMarkdown, type Block } from "./docsContent";
import s from "./productDocs.module.css";

export default function ProductDocs() {
  const [active, setActive] = useState(SECTIONS[0]!.id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Proteus AI docs";
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-90px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = SECTIONS.find((x) => x.id === active) ?? SECTIONS[0]!;
  const onPage = useMemo(() => {
    const subs = current.blocks.filter((b): b is Extract<Block, { kind: "h3" }> => b.kind === "h3");
    return subs.length ? subs.map((b) => ({ id: b.id, text: b.text })) : SECTIONS.filter((x) => x.group === current.group).map((x) => ({ id: x.id, text: x.title }));
  }, [current]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(docsMarkdown(window.location.origin));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <div data-app className={s.root}>
      <header className={s.top}>
        <Link to="/" className={s.brand} aria-label="Proteus AI home"><Wordmark /></Link>
        <nav className={s.pills} aria-label="Docs sections">
          {GROUPS.map((g) => {
            const first = SECTIONS.find((x) => x.group === g)!;
            return (
              <a key={g} href={`#${first.id}`} className={`${s.pill} ${current.group === g ? s.pillOn : ""}`}>{g}</a>
            );
          })}
        </nav>
        <a href="https://app.proteus.co.in" className={s.cta}>Open the app <ArrowUpRight size={14} aria-hidden /></a>
      </header>

      <div className={s.grid}>
        <aside className={s.side} aria-label="Contents">
          {GROUPS.map((g) => (
            <div key={g} className={s.sideGroup}>
              <span className={s.sideLabel}>{g}</span>
              {SECTIONS.filter((x) => x.group === g).map((x) => (
                <a key={x.id} href={`#${x.id}`} className={`${s.sideLink} ${active === x.id ? s.sideOn : ""}`}>{x.title}</a>
              ))}
              {g === "Reference" && (
                <>
                  <Link to="/docs/api" className={s.sideLink}>API reference</Link>
                  <a href="/api/public/agents/skill.md" className={s.sideLink}>Agent skill</a>
                </>
              )}
            </div>
          ))}
        </aside>

        <main className={s.doc} id="main">
          <header className={s.hero}>
            <h1 className={s.title}>{DOC_TITLE}</h1>
            <p className={s.lede}>{DOC_LEDE}</p>
            <div className={s.actions}>
              <button type="button" className={s.btn} onClick={copy}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? "Copied" : "Copy Markdown"}</button>
              <Link to="/docs/api" className={s.btn}>API reference</Link>
              <a href="https://github.com/Adityaakr/proteus" className={s.btn} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} aria-hidden /></a>
            </div>
          </header>

          {SECTIONS.map((sec) => (
            <section key={sec.id} id={sec.id} className={s.section} aria-labelledby={`h-${sec.id}`}>
              <h2 id={`h-${sec.id}`} className={s.h2}>{sec.title}</h2>
              {sec.blocks.map((b, i) => <BlockView key={i} b={b} />)}
            </section>
          ))}
          <footer className={s.foot}>Facts as of October 24, 2026. Market figures are third-party estimates; each one links to its source.</footer>
        </main>

        <aside className={s.toc} aria-label="On this page">
          <span className={s.sideLabel}>On this page</span>
          {onPage.map((x) => (
            <a key={x.id} href={`#${x.id}`} className={s.tocLink}>{x.text}</a>
          ))}
        </aside>
      </div>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "p":
      return <p className={s.p}>{b.text}</p>;
    case "callout":
      return <blockquote className={s.callout}>{b.text}</blockquote>;
    case "h3":
      return <h3 id={b.id} className={s.h3}>{b.text}</h3>;
    case "list":
      return (
        <ul className={s.list}>
          {b.items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      );
    case "steps":
      return (
        <ol className={s.steps}>
          {b.items.map((st, i) => (
            <li key={st.title} className={s.step}>
              <span className={s.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.stepTitle}>{st.title}</span>
              <span className={s.stepText}>{st.text}</span>
            </li>
          ))}
        </ol>
      );
    case "stats":
      return (
        <div className={s.stats}>
          {b.items.map((st) => (
            <div key={st.label} className={s.stat}>
              <span className={s.statValue}>{st.value}</span>
              <span className={s.statLabel}>{st.label}</span>
              {st.source && <a href={st.source.url} target="_blank" rel="noreferrer" className={s.statSource}>{st.source.name} <ArrowUpRight size={11} aria-hidden /></a>}
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>{b.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={r[0] === "Proteus AI" ? s.rowUs : undefined}>
                  {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
          {b.note && <p className={s.note}>{b.note}</p>}
        </div>
      );
    case "links":
      return (
        <ul className={s.links}>
          {b.items.map((l) => (
            <li key={l.label}>
              {l.href.startsWith("/docs") ? <Link to={l.href} className={s.linkRow}><LinkBody l={l} /></Link> : <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={s.linkRow}><LinkBody l={l} /></a>}
            </li>
          ))}
        </ul>
      );
  }
}

function LinkBody({ l }: { l: { label: string; note?: string } }) {
  return (
    <>
      <span className={s.linkLabel}>{l.label}</span>
      {l.note && <span className={s.linkNote}>{l.note}</span>}
      <ArrowUpRight size={14} aria-hidden className={s.linkArrow} />
    </>
  );
}
