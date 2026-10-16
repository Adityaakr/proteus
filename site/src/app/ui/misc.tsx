import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Info, XCircle } from "lucide-react";
import s from "./ui.module.css";

/** Copy a value to the clipboard with an announced confirmation. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={s.iconBtn}
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={2} aria-hidden />}
      <span className="sr-only" aria-live="polite">{done ? "Copied" : ""}</span>
    </button>
  );
}

export function shortHex(v: string, head = 6, tail = 4): string {
  if (!v || v.length <= head + tail + 2) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

/** Monospace value (address, hash, key) with optional truncation and copy. */
export function MonoValue({ value, short, copy, label, href }: { value: string; short?: boolean; copy?: boolean; label?: string; /** Opens this page (an explorer) in a new tab; the value becomes the link text. */ href?: string }) {
  const text = short ? shortHex(value) : value;
  return (
    <span className={s.monoValue}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={s.monoText} title={`${value}. Opens the explorer.`} style={{ color: "var(--c-primary)", textDecoration: "underline", textUnderlineOffset: 3, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {text}
          <ExternalLink size={12} strokeWidth={2} aria-hidden />
        </a>
      ) : (
        <span className={s.monoText} title={value}>
          {text}
        </span>
      )}
      {copy && <CopyButton value={value} label={label ? `Copy ${label}` : "Copy"} />}
    </span>
  );
}

/** Link to a block explorer page. Shows the short hash as text so it is never icon only. */
export function ExplorerLink({ href, hash, children }: { href: string; hash?: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={s.monoValue} style={{ color: "var(--c-primary)", textDecoration: "underline", textUnderlineOffset: 3 }}>
      <span className={s.monoText}>{children ?? (hash ? shortHex(hash, 8, 6) : "View on explorer")}</span>
      <ExternalLink size={14} strokeWidth={2} aria-hidden />
      <span className="sr-only">(opens Arc testnet explorer in a new tab)</span>
    </a>
  );
}

export function KeyValue({ items }: { items: { k: ReactNode; v: ReactNode }[] }) {
  return (
    <dl className={s.kv}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "neutral", children, title }: { tone?: "neutral" | "info" | "warn" | "danger" | "success"; title?: ReactNode; children?: ReactNode }) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "danger" ? XCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={[s.notice, tone !== "neutral" ? s[`notice_${tone}`] : ""].join(" ")} role={tone === "danger" ? "alert" : undefined}>
      <span className={s.noticeIcon} aria-hidden>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        {title && <strong style={{ fontWeight: 600, color: "var(--c-dark)" }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
