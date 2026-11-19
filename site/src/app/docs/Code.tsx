/**
 * Code blocks for the docs and the app: syntax highlighting (highlight.js core with only the languages we show), a
 * language label, a copy button that says when it copied, and tabs for the same request in several languages.
 * Blocks are dark in both themes; long lines scroll inside the block, never the page.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import http from "highlight.js/lib/languages/http";
import xml from "highlight.js/lib/languages/xml";
import python from "highlight.js/lib/languages/python";
import { Check, Copy } from "lucide-react";
import c from "./code.module.css";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("http", http);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("python", python);

export type CodeLang = "bash" | "ts" | "json" | "http" | "html" | "text" | "py";

const GRAMMAR: Record<CodeLang, string | null> = { bash: "bash", ts: "typescript", json: "json", http: "http", html: "xml", text: null, py: "python" };
const LABEL: Record<CodeLang, string> = { bash: "cURL", ts: "TypeScript", json: "JSON", http: "HTTP", html: "HTML", text: "Text", py: "Python" };
export const langLabel = (lang: string) => LABEL[lang as CodeLang] ?? lang;

/** Highlighted HTML for a snippet. highlight.js escapes the source, so the result is safe to insert. */
export function highlight(code: string, lang: string): string {
  const grammar = GRAMMAR[lang as CodeLang];
  if (!grammar) return code.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
  return hljs.highlight(code, { language: grammar, ignoreIllegals: true }).value;
}

function Highlighted({ code, lang }: { code: string; lang: string }) {
  const html = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <pre className={c.pre} data-lang={lang} tabIndex={0}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

/** Copies the raw snippet. The label switches to "Copied" and screen readers hear it. */
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  };
  return (
    <button type="button" className={`${c.copy} ${className ?? ""}`} onClick={copy} aria-label={state === "copied" ? "Copied" : `${label} code`}>
      {state === "copied" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Press ⌘C" : label}</span>
    </button>
  );
}

/** One snippet: header with an optional title and the language, then the highlighted code. */
export function CodeBlock({ code, lang, title, extra }: { code: string; lang: string; title?: ReactNode; extra?: ReactNode }) {
  return (
    <div className={c.block}>
      <div className={c.head}>
        <span className={c.title}>{title ?? <span className={c.lang}>{langLabel(lang)}</span>}</span>
        <span className={c.headEnd}>
          {title && <span className={c.lang}>{langLabel(lang)}</span>}
          {extra}
          <CopyButton text={code} />
        </span>
      </div>
      <Highlighted code={code} lang={lang} />
    </div>
  );
}

export interface CodeTab { label: string; lang: string; code: string }

/** The same example in several languages, one tab each. `value`/`onChange` let a page switch every block at once. */
export function CodeTabs({ tabs, title, value, onChange }: { tabs: CodeTab[]; title?: ReactNode; value?: string; onChange?: (label: string) => void }) {
  const [own, setOwn] = useState(tabs[0]!.label);
  const current = tabs.find((t) => t.label === (value ?? own)) ?? tabs[0]!;
  const id = useId();
  const pick = (label: string) => (onChange ? onChange(label) : setOwn(label));
  return (
    <div className={c.block}>
      <div className={c.head}>
        <span className={c.headStart}>
          {title && <span className={c.title}>{title}</span>}
          <span className={c.tabs} role="tablist" aria-label="Language">
            {tabs.map((t) => (
              <button key={t.label} type="button" role="tab" id={`${id}-${t.label}`} aria-selected={t.label === current.label} aria-controls={`${id}-panel`} className={`${c.tab} ${t.label === current.label ? c.tabOn : ""}`} onClick={() => pick(t.label)}>
                {t.label}
              </button>
            ))}
          </span>
        </span>
        <span className={c.headEnd}>
          <CopyButton text={current.code} />
        </span>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${current.label}`}>
        <Highlighted code={current.code} lang={current.lang} />
      </div>
    </div>
  );
}

/** Backwards-compatible single block: `<Code lang="json">{text}</Code>`. */
export function Code({ children, lang = "json" }: { children: string; lang?: CodeLang }) {
  return <CodeBlock code={children} lang={lang} />;
}
