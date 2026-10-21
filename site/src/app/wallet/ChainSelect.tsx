import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import type { BridgeSource } from "../lib/bridge";
import w from "./wallet.module.css";

/** A chain's logo, or a quiet monogram when there is none. */
export function ChainLogo({ chain, size = 18 }: { chain: Pick<BridgeSource, "label" | "logo">; size?: number }) {
  if (chain.logo) return <img src={chain.logo} alt="" className={w.chainLogo} style={{ width: size, height: size }} />;
  return (
    <span className={w.chainMono} style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden>
      {chain.label.slice(0, 1)}
    </span>
  );
}

/**
 * Source-chain picker for the bridge: a compact button showing the current chain that opens a searchable list,
 * popular chains first. Keyboard: Enter/Space opens, Esc closes, arrows move, Enter picks.
 */
export function ChainSelect({ chains, value, onChange, disabled, suffix }: { chains: readonly BridgeSource[]; value: string; onChange: (id: string) => void; disabled?: boolean; suffix?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reduce = useReducedMotion();
  const current = chains.find((c) => c.id === value) ?? chains[0];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? chains.filter((c) => c.label.toLowerCase().includes(q)) : chains;
    return [...list.filter((c) => c.popular), ...list.filter((c) => !c.popular)];
  }, [chains, query]);
  const popularCount = query ? 0 : shown.filter((c) => c.popular).length;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, shown.findIndex((c) => c.id === value)));
    const t = window.setTimeout(() => search.current?.focus(), 30);
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    // Esc closes only this list: capture it before the sheet's own Esc handler (on window) closes the whole sheet.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      pick(shown[active].id);
    }
  };

  return (
    <div className={w.chainSelect} ref={root} onKeyDown={open ? onKey : undefined}>
      <button type="button" className={w.chainSelectBtn} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)} disabled={disabled}>
        <ChainLogo chain={current} />
        <span>{current.label}{suffix ? <span className={w.chainSuffix}> {suffix}</span> : null}</span>
        <ChevronDown size={14} strokeWidth={2} className={w.chainChevron} data-open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={w.chainMenu}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            <label className={w.chainSearch}>
              <Search size={14} strokeWidth={2} aria-hidden />
              <input ref={search} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder={`Search ${chains.length} chains`} aria-label="Search chains" autoComplete="off" spellCheck={false} />
            </label>
            <ul id={listId} role="listbox" aria-label="Source chain" className={w.chainList}>
              {shown.length === 0 && <li className={w.chainEmpty}>No chain matches “{query}”.</li>}
              {shown.map((c, i) => (
                <li key={c.id}>
                  {i === popularCount && popularCount > 0 && <div className={w.chainGroup}>More chains</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === value}
                    className={w.chainOption}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(c.id)}
                  >
                    <ChainLogo chain={c} size={22} />
                    <span>{c.label}</span>
                    {c.id === value && <Check size={14} strokeWidth={2.4} className={w.chainCheck} />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
