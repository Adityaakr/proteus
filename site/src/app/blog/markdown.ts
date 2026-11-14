/**
 * A small Markdown renderer for the blog, shared by the React page and the server-side prerender, so people, search
 * engines and answer engines all read the same HTML. Content is ours (site/src/app/blog/posts.ts); text is still
 * escaped. Supported: ## and ### headings (with ids), paragraphs, - and 1. lists, > callouts, ``` code fences,
 * | tables |, ![alt](src "caption") figures, and inline **bold**, `code` and [links](url).
 */

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`*]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline formatting on already-escaped text. */
function inline(raw: string): string {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const external = /^https?:\/\//.test(href) && !href.includes("proteus.co.in");
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  });
  return s;
}

export interface Heading { id: string; text: string; level: 2 | 3 }

export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  const headings: Heading[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i++;
      out.push(`<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length as 2 | 3;
      const text = h[2]!.trim();
      const id = slugify(text);
      headings.push({ id, text: text.replace(/[`*]/g, ""), level });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    const fig = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (fig) {
      const [, alt, src, cap] = fig;
      out.push(`<figure><img src="${esc(src!)}" alt="${esc(alt!)}" loading="lazy" decoding="async" />${cap ? `<figcaption>${inline(cap)}</figcaption>` : ""}</figure>`);
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) body.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push(`<aside class="callout">${body.map((b) => `<p>${inline(b)}</p>`).join("")}</aside>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        const cells = lines[i++]!.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        rows.push(cells);
      }
      const [head, ...body] = rows;
      // A comparison (empty first header cell): the last column is ours, and Yes/No cells get a mark.
      const cmp = head![0] === "";
      const cell = (c: string) => {
        if (!cmp) return inline(c);
        const kind = /^yes\b/i.test(c) ? "yes" : /^(no|rarely|not applicable)\b/i.test(c) ? "no" : "";
        return kind ? `<span class="mark ${kind}"><i aria-hidden="true"></i>${inline(c)}</span>` : inline(c);
      };
      out.push(`<div class="table${cmp ? " cmp" : ""}"><table><thead><tr>${head!.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, j) => `<td>${j === 0 ? inline(c) : cell(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]!) : /^- /.test(lines[i]!))) items.push(lines[i++]!.replace(ordered ? /^\d+\.\s+/ : /^-\s+/, ""));
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{2,3}\s|```|>|\||- |\d+\. |!\[)/.test(lines[i]!)) para.push(lines[i++]!);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return { html: out.join("\n"), headings };
}

/** Plain text of a Markdown string, for descriptions and word counts. */
export const plainText = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
