/**
 * /docs and /docs/:page: the product docs as a multi-page site. Content lives in docsContent.ts; each section is a
 * page, grouped in the left nav, with its own "On this page", prev/next, and the same text as Markdown at
 * /docs/<page>.md for agents (generated at build). Unknown pages fall back to the first page.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, FileText, Info, Lightbulb, Minus } from "lucide-react";
import "../app.css";
import { WordmarkImage } from "../layouts/Wordmark";
import { compare } from "../../content/proteus";
import { DOC_LEDE, DOC_TITLE, FACTS_AS_OF, GROUPS, SECTIONS, SELLER_EXAMPLES, docsMarkdown, type Block, type DocSection } from "./docsContent";
import { CodeBlock, CodeTabs } from "./Code";
import { TryIt } from "./TryIt";
import { SELLER_API_REFERENCE } from "../sell/developers/reference";
import c from "./code.module.css";
import { DIAGRAMS, Sketch } from "./Sketch";
import s from "./productDocs.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://app.proteus.co.in";
const ids = new Set(SECTIONS.map((x) => x.id));
/** A section's page, or the page that holds an anchor (an h3 id). */
const pageOf = (id: string) => (ids.has(id) ? id : SECTIONS.find((sec) => sec.blocks.some((b) => (b.kind === "h3" && b.id === id) || (b.kind === "channels" && b.items.some((c) => c.id === id))))?.id);

export default function ProductDocs() {
  const { page } = useParams();
  const current = page ? SECTIONS.find((x) => x.id === page) : SECTIONS[0];
  if (!current) return <Navigate to="/docs" replace />;
  return <DocsPage sec={current} />;
}

function DocsPage({ sec }: { sec: DocSection }) {
  const [copied, setCopied] = useState(false);
  const { hash } = useLocation();
  const index = SECTIONS.findIndex((x) => x.id === sec.id);
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  // Wide pages (the comparison) drop the right rail so the table fits.
  const wide = sec.layout === "wide" || sec.blocks.some((b) => b.kind === "compare");
  const onPage = useMemo(() => sec.blocks.filter((b): b is Extract<Block, { kind: "h3" }> => b.kind === "h3"), [sec]);
  const url = `${ORIGIN}/docs/${sec.id}`;
  const md = `${ORIGIN}/docs/${sec.id}.md`;
  const ask = encodeURIComponent(`Read ${md} (and ${ORIGIN}/docs.md for the rest) and help me understand Proteus AI.`);

  useEffect(() => {
    document.title = `${sec.title} · Proteus AI docs`;
    // A link to a heading on another page (/docs/page#heading) lands on that heading, not the top.
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView());
    else window.scrollTo({ top: 0 });
  }, [sec, hash]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(docsMarkdown(ORIGIN, sec.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the .md link still works */
    }
  };

  // Structured data for crawlers and agents that read the rendered page.
  const ld = { "@context": "https://schema.org", "@type": "TechArticle", headline: sec.title, description: sec.summary ?? DOC_LEDE, url, dateModified: FACTS_AS_OF, isPartOf: { "@type": "WebSite", name: "Proteus AI docs", url: `${ORIGIN}/docs` }, encoding: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: md } };

  return (
    <div data-app className={s.root}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className={s.top}>
        <Link to="/" className={s.brand} aria-label="Proteus AI home"><WordmarkImage /></Link>
        <nav className={s.pills} aria-label="Docs sections">
          {GROUPS.map((g) => {
            const first = SECTIONS.find((x) => x.group === g)!;
            return <Link key={g} to={`/docs/${first.id}`} className={`${s.pill} ${sec.group === g ? s.pillOn : ""}`}>{g}</Link>;
          })}
          <Link to="/blog" className={s.pill}>Blog</Link>
        </nav>
        <span className={s.topEnd}>
          <a href="https://app.proteus.co.in" className={s.cta}>Open the app <ArrowUpRight size={14} aria-hidden /></a>
        </span>
      </header>

      <div className={`${s.grid} ${wide ? s.gridWide : ""}`}>
        <aside className={s.side} aria-label="Contents">
          {GROUPS.map((g) => (
            <div key={g} className={s.sideGroup}>
              <span className={s.sideLabel}>{g}</span>
              {SECTIONS.filter((x) => x.group === g).map((x) => (
                <Link key={x.id} to={`/docs/${x.id}`} className={`${s.sideLink} ${sec.id === x.id ? s.sideOn : ""}`} aria-current={sec.id === x.id ? "page" : undefined}>{x.nav ?? x.title}</Link>
              ))}
              {g === "Developers" && <Link to="/docs/api" className={s.sideLink}>Buyer HTTP API</Link>}
            </div>
          ))}
        </aside>

        <main className={s.doc} id="main">
          {index === 0 && (
            <header className={s.hero}>
              <span className={s.eyebrow}>Proteus AI docs</span>
              <h1 className={s.title}>{DOC_TITLE}</h1>
              <p className={s.lede}>{DOC_LEDE}</p>
            </header>
          )}
          <article className={s.page} aria-labelledby="page-title">
            <div className={s.pageHead}>
              <span className={s.eyebrow}>{sec.group}</span>
              {index === 0 ? <h2 id="page-title" className={s.h1Small}>{sec.title}</h2> : <h1 id="page-title" className={s.h1}>{sec.title}</h1>}
              {sec.summary && index !== 0 && <p className={s.summary}>{sec.summary}</p>}
              {sec.intro && <p className={s.intro}><Rich text={sec.intro} /></p>}
              <div className={s.actions}>
                <button type="button" className={s.btn} onClick={copy}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? "Copied" : "Copy page"}</button>
                <a href={md} className={s.btn}><FileText size={14} aria-hidden /> .md</a>
                <a href={`https://claude.ai/new?q=${ask}`} className={s.btn} target="_blank" rel="noreferrer">Open in Claude <ArrowUpRight size={13} aria-hidden /></a>
                <a href={`https://chatgpt.com/?q=${ask}`} className={s.btn} target="_blank" rel="noreferrer">Open in ChatGPT <ArrowUpRight size={13} aria-hidden /></a>
              </div>
            </div>
            <div className={s.body}>
              {sec.blocks.map((b, i) => <BlockView key={i} b={b} />)}
            </div>
          </article>

          <nav className={s.pager} aria-label="Previous and next page">
            {prev ? <Link to={`/docs/${prev.id}`} className={s.pagerCard}><span className={s.pagerDir}><ArrowLeft size={13} aria-hidden /> Previous</span><span className={s.pagerTitle}>{prev.title}</span></Link> : <span />}
            {next ? <Link to={`/docs/${next.id}`} className={`${s.pagerCard} ${s.pagerNext}`}><span className={s.pagerDir}>Next <ArrowRight size={13} aria-hidden /></span><span className={s.pagerTitle}>{next.title}</span></Link> : <span />}
          </nav>
          <footer className={s.foot}>Facts as of {FACTS_AS_OF}. Every claim links its evidence. For agents: <a href="/llms.txt" className={s.a}>llms.txt</a> · <a href="/docs.md" className={s.a}>docs.md</a> · <a href="/docs/facts.json" className={s.a}>facts.json</a></footer>
        </main>

        {!wide && <aside className={s.toc} aria-label="On this page">
          <span className={s.sideLabel}>On this page</span>
          <a href="#page-title" className={s.tocLink}>{sec.title}</a>
          {onPage.map((x) => <a key={x.id} href={`#${x.id}`} className={`${s.tocLink} ${s.tocSub}`}>{x.text}</a>)}
        </aside>}
      </div>
    </div>
  );
}

/** Renders [label](url) links and `code` inside docs text; #anchors that name a page link to that page. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((t, i) => {
        const link = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, raw, href] = link;
          const label = /^`[^`]+`$/.test(raw!) ? <code className={s.code}>{raw!.slice(1, -1)}</code> : raw;
          const anchorPage = href!.startsWith("#") ? pageOf(href!.slice(1)) : undefined;
          if (anchorPage) return <Link key={i} to={`/docs/${anchorPage}${ids.has(href!.slice(1)) ? "" : href}`} className={s.a}>{label}</Link>;
          if (href!.startsWith("/docs/") && !href!.includes(".")) return <Link key={i} to={href!} className={s.a}>{label}</Link>;
          return <a key={i} href={href} className={s.a} target={href!.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{label}</a>;
        }
        if (t.startsWith("`") && t.endsWith("`")) return <code key={i} className={s.code}>{t.slice(1, -1)}</code>;
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "p":
      return <p className={s.p}><Rich text={b.text} /></p>;
    case "callout": {
      const tone = b.tone ?? "note";
      const Icon = tone === "warning" ? AlertTriangle : tone === "tip" ? Lightbulb : Info;
      return (
        <aside className={`${s.callout} ${tone === "warning" ? s.calloutWarn : tone === "tip" ? s.calloutTip : ""}`} role={tone === "warning" ? "note" : undefined}>
          <Icon size={16} aria-hidden className={s.calloutIcon} />
          <p>{b.title && <strong>{b.title}. </strong>}<Rich text={b.text} /></p>
        </aside>
      );
    }
    case "h3":
      return <h3 id={b.id} className={s.h3}><a href={`#${b.id}`} className={s.anchor}>{b.text}</a></h3>;
    case "h4":
      return <h4 className={s.h4}>{b.text}</h4>;
    case "codetabs":
      return <CodeTabs tabs={b.tabs.map((t) => ({ label: t.label, lang: t.lang, code: t.text }))} />;
    case "endpoint":
      return <Endpoint method={b.method} path={b.path} />;
    case "list":
      return <ul className={s.list}>{b.items.map((t) => <li key={t}><Rich text={t} /></li>)}</ul>;
    case "points":
      return (
        <ul className={s.points}>
          {b.items.map((pt) => (
            <li key={pt.title} className={s.point}>
              <span className={s.pointTitle}>{pt.title}</span>
              <span className={s.pointText}><Rich text={pt.text} /></span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className={s.steps}>
          {b.items.map((st, i) => (
            <li key={st.title} className={s.step}>
              <span className={s.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.stepTitle}>{st.title}</span>
              <span className={s.stepText}><Rich text={st.text} /></span>
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
              <span className={s.statLabel}><Rich text={st.label} /></span>
              {st.source && <a href={st.source.url} target="_blank" rel="noreferrer" className={s.statSource}>{st.source.name} <ArrowUpRight size={11} aria-hidden /></a>}
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr>{b.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row"><Rich text={c} /></th> : <td key={j}><Rich text={c} /></td>))}</tr>
              ))}
            </tbody>
          </table>
          {b.note && <p className={s.note}><Rich text={b.note} /></p>}
        </div>
      );
    case "entry":
      return (
        <ul className={s.entry}>
          {b.items.map((e) => (
            <li key={e.title}>
              <Link to={e.href} className={s.entryCard}>
                <span className={s.pointTitle}>{e.title}</span>
                <span className={s.pointText}>{e.text}</span>
                <span className={s.entryCta}>{e.cta} <ArrowRight size={14} aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
      );
    case "links":
      return (
        <ul className={s.links}>
          {b.items.map((l) => (
            <li key={l.label}>
              {l.href.startsWith("/docs/") && !l.href.includes(".") ? (
                <Link to={l.href} className={s.linkRow}><LinkBody l={l} /></Link>
              ) : (
                <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={s.linkRow}><LinkBody l={l} /></a>
              )}
            </li>
          ))}
        </ul>
      );
    case "figure":
      return (
        <figure className={s.figure}>
          <a href={b.src} target="_blank" rel="noreferrer" className={s.shot}><img src={b.src} alt={b.alt} loading="lazy" decoding="async" /></a>
          <figcaption className={s.caption}>
            <span className={b.network === "Arc mainnet" ? s.netMain : b.network === "Arc testnet" ? s.netTest : s.netNone}>{b.network}</span>
            <span><Rich text={b.caption} /></span>
          </figcaption>
        </figure>
      );
    case "code":
      return <CodeBlock code={b.text} lang={b.lang} title={b.title} />;
    case "diagram":
      return (
        <figure className={s.figure}>
          <div className={s.sketchWrap}><Sketch spec={DIAGRAMS[b.name]!} /></div>
          <figcaption className={s.caption}><span className={s.netNone}>Diagram</span><span>{b.caption}</span></figcaption>
        </figure>
      );
    case "compare":
      return <CompareTable />;
    case "channels":
      return (
        <ul className={s.channels}>
          {b.items.map((ch) => (
            <li key={ch.title} id={ch.id} className={s.channel}>
              <div className={s.channelHead}>
                <span className={s.channelTitle}>{ch.title}</span>
                <span className={`${s.status} ${s[`status${ch.status.replace(/\s/g, "")}`] ?? ""}`}>{ch.status}</span>
              </div>
              <dl className={s.channelFacts}>
                <dt>For</dt><dd><Rich text={ch.who} /></dd>
                <dt>Does</dt><dd><Rich text={ch.does} /></dd>
                <dt>Proof</dt><dd><Rich text={ch.proof} /></dd>
              </dl>
              {ch.start.href.startsWith("/docs/") && !ch.start.href.includes(".") && !ch.start.href.includes("#") ? (
                <Link to={ch.start.href} className={s.entryCta}>{ch.start.label} <ArrowRight size={14} aria-hidden /></Link>
              ) : (
                <a href={ch.start.href} className={s.entryCta} target={ch.start.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{ch.start.label} <ArrowRight size={14} aria-hidden /></a>
              )}
            </li>
          ))}
        </ul>
      );
  }
}

/** One seller API endpoint: badge and path, permission, parameters, request beside response, errors, and Try it. */
function Endpoint({ method, path }: { method: string; path: string }) {
  const ex = SELLER_EXAMPLES.find((x) => x.method === method && x.path === path)!;
  const route = SELLER_API_REFERENCE.find((r) => r.method === method && r.path === path)!;
  const rel = path.replace("/v1/seller", "");
  return (
    <div className={s.endpoint}>
      <div className={s.endpointHead}>
        <span className={`${s.verb} ${s[`verb${method}`] ?? ""}`}>{method}</span>
        <code className={s.endpointPath}>{rel}</code>
        <span className={route.scope ? s.scopeChip : s.scopeAny}>{route.scope ?? "Any valid key"}</span>
      </div>
      <p className={s.p}><Rich text={ex.description} /></p>
      {ex.params.length > 0 && (
        <div className={s.params}>
          <span className={s.paramsLabel}>Parameters</span>
          <ul className={s.paramList}>
            {ex.params.map((x) => (
              <li key={x.name} className={s.param}>
                <span className={s.paramHead}>
                  <code className={s.paramName}>{x.name}</code>
                  <span className={s.paramType}>{x.type}</span>
                  <span className={s.paramIn}>{x.in}</span>
                  {x.required && <span className={s.paramReq}>required</span>}
                </span>
                <span className={s.paramText}><Rich text={x.description} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={c.pair}>
        <CodeTabs title="Request" tabs={[{ label: "cURL", lang: "bash", code: ex.bash }, { label: "TypeScript", lang: "ts", code: ex.ts }]} />
        <CodeBlock title={`Response ${ex.status}`} code={ex.response} lang="json" />
      </div>
      <TryIt route={route} example={ex.example} />
      <details className={s.errors}>
        <summary>Errors</summary>
        <ul>
          {ex.errors.map((e) => (
            <li key={e.status}><code className={s.code}>{e.status}</code> <Rich text={e.when} /></li>
          ))}
        </ul>
      </details>
    </div>
  );
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

/** The landing page's comparison (content/proteus.ts), styled for the docs: capability rows, one column per product. */
function CompareTable() {
  const all = [compare.proteus, ...compare.vendors];
  const label = { yes: "Yes", partial: "Partial", "not-core": "Not core focus", planned: "Planned" } as const;
  return (
    <div className={s.tableWrap}>
      <table className={s.cmp}>
        <thead>
          <tr>
            <th scope="col" className={s.cmpCap}>Capability</th>
            {all.map((v, i) => (
              <th key={v.name} scope="col" className={i === 0 ? s.cmpUs : undefined}>
                <a href={v.href} target={v.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={s.cmpVendor} aria-label={v.name}>
                  {v.logo ? <img src={v.logo} alt={v.name} style={{ height: Math.min(v.logoHeight ?? 16, 18) }} /> : v.name}
                  {v.href.startsWith("http") && <ArrowUpRight size={12} aria-hidden />}
                </a>
                <span className={s.cmpDesc}>{v.description}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {compare.capabilities.map((cap, r) => (
            <tr key={cap}>
              <th scope="row" className={s.cmpCap}>{cap}</th>
              {all.map((v, i) => {
                const m = v.marks[r]!;
                return (
                  <td key={v.name} className={i === 0 ? s.cmpUs : undefined}>
                    <span className={`${s.mark} ${m === "yes" ? (i === 0 ? s.markUs : s.markYes) : s.markNo}`}>
                      {m === "yes" ? <Check size={13} strokeWidth={2.6} aria-hidden /> : <Minus size={13} strokeWidth={2.4} aria-hidden />}
                      {label[m]}
                    </span>
                    {v.notes?.[r] && <span className={s.markNote}>{v.notes[r]}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={s.note}>{compare.footnote}</p>
    </div>
  );
}
