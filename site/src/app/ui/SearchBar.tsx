import { useEffect, useId, useRef, type ReactNode } from "react";
import { Search, SearchX, X } from "lucide-react";
import { ActionButton } from "./ActionButton";
import { EmptyState } from "./EmptyState";
import s from "./search.module.css";

/**
 * The app's list search: one input with a clear button, optional filter chips below it and a live "12 of 96" count.
 * Press "/" anywhere on the page to focus it, Escape to clear it. Pair it with `useSearchParam` to keep the query in
 * the URL (?q=), and filter rows with `filterBySearch` from @proteus/domain so the API's `?q=` matches the same rows.
 */
export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, e.g. "Search products". */
  label: string;
  placeholder?: string;
  /** Rows shown after search and filters, and the total; with `noun` this renders "12 of 96 products". */
  shown?: number;
  total?: number;
  /** Plural noun for the count, e.g. "products". */
  noun?: string;
  /** Filter chips (FilterChips), shown under the input. */
  filters?: ReactNode;
  /** Focus with the "/" key. Default true; turn off where a page has more than one bar or runs in an iframe. */
  hotkey?: boolean;
  /** Smaller, full-width input for sheets and side panels. */
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, label, placeholder, shown, total, noun, filters, hotkey = true, compact, autoFocus, className }: SearchBarProps) {
  const ref = useRef<HTMLInputElement>(null);
  const countId = useId();
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);
  const count = countText(shown, total, noun);
  return (
    <div className={[s.bar, compact ? s.compact : "", className].filter(Boolean).join(" ")} role="search">
      <div className={s.top}>
        <label className={s.field}>
          <Search size={16} strokeWidth={2} aria-hidden />
          <span className={s.sr}>{label}</span>
          <input
            ref={ref}
            type="search"
            value={value}
            placeholder={placeholder ?? label}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (value) {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              } else e.currentTarget.blur();
            }}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            autoFocus={autoFocus}
            aria-describedby={count ? countId : undefined}
          />
          {value ? (
            <button type="button" className={s.clear} onClick={() => { onChange(""); ref.current?.focus(); }} aria-label="Clear search">
              <X size={16} aria-hidden />
            </button>
          ) : (
            hotkey && !compact && <kbd className={s.key} aria-hidden title="Press / to search">/</kbd>
          )}
        </label>
        {count && <span id={countId} className={s.count} aria-live="polite">{count}</span>}
      </div>
      {filters}
    </div>
  );
}

export interface FilterOption<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
}

/** A row of toggle chips; exactly one is on. Scrolls sideways at phone width instead of wrapping into a wall. */
export function FilterChips<V extends string>({ label, options, value, onChange }: { label: string; options: FilterOption<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`${s.chip} ${o.value === value ? s.chipOn : ""}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className={s.chipCount}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** The empty state for a search or filter that matched nothing, with one way back. */
export function NoMatches({ query, noun, onClear, filtered }: { query: string; noun: string; onClear: () => void; filtered?: boolean }) {
  const q = query.trim();
  return (
    <EmptyState
      icon={<SearchX size={20} strokeWidth={1.75} />}
      title={q ? `No ${noun} match “${q}”` : `No ${noun} match these filters`}
      description={q ? "Check the spelling, or search by another word from the name." : "Choose another filter to see more."}
      action={<ActionButton variant="secondary" size="sm" onClick={onClear}>{q && !filtered ? "Clear search" : "Clear search and filters"}</ActionButton>}
    />
  );
}

export function countText(shown: number | undefined, total: number | undefined, noun: string | undefined): string | null {
  if (shown === undefined || !noun) return null;
  if (total === undefined || total === shown) return `${shown.toLocaleString()} ${shown === 1 ? singular(noun) : noun}`;
  return `${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`;
}

/** "products" -> "product", "matches" -> "match": enough for the plural nouns the lists use. */
const singular = (noun: string) => (/(ch|sh|x)es$/.test(noun) ? noun.slice(0, -2) : noun.replace(/s$/, ""));

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
