import type { ReactNode } from "react";
import s from "./docs.module.css";

/** Minimal tokenizer for the snippets on the docs page: comments, strings, numbers, JSON keys, HTTP methods, flags and URLs. */
const RULES: [RegExp, string][] = [
  [/\/\/[^\n]*/y, "cm"],
  [/"[^"\n]*"(?=\s*:)/y, "key"],
  [/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/y, "str"],
  [/\b(?:POST|GET|PATCH|DELETE)\b/y, "method"],
  [/\b(?:Authorization|Content-Type|X-Proteus-Request-Id)\b(?=:)/y, "hdr"],
  [/https?:\/\/[^\s'"]+|\/api\/[^\s'"]+/y, "url"],
  [/\b0x[0-9a-fA-F…]+\b/y, "hex"],
  [/\b\d+(?:\.\d+)?\b/y, "num"],
  [/\b(?:true|false|null)\b/y, "bool"],
  [/\b(?:const|await|method|headers|body|fetch|JSON|stringify|crypto|randomUUID|curl)\b/y, "kw"],
  [/-[A-Za-z]\b|--[a-z-]+/y, "flag"],
];

export function Code({ children, lang = "json" }: { children: string; lang?: "json" | "bash" | "ts" | "http" }) {
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const src = children;
  while (i < src.length) {
    let matched = false;
    for (const [re, cls] of RULES) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i && m[0].length) {
        out.push(<span key={k++} className={s[`t_${cls}`]}>{m[0]}</span>);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const next = src.slice(i).search(/\/\/|["'`]|\b(?:POST|GET|PATCH|DELETE|https?:|true|false|null|const|await|curl)\b|\/api\/|\b0x|\b\d|-[A-Za-z]\b|--[a-z]/);
      const len = next === -1 ? src.length - i : Math.max(1, next);
      out.push(src.slice(i, i + len));
      i += len;
    }
  }
  return (
    <pre className={s.code} data-lang={lang}>
      <span className={s.codeLang} aria-hidden>{lang}</span>
      <code>{out}</code>
    </pre>
  );
}
