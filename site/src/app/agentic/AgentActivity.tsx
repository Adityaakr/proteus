import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, CircleDot, LoaderCircle, Sparkles, Wrench, X } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { ReasoningText } from "./ReasoningText";
import s from "./agentic.module.css";

/**
 * AgentActivity: a collapsible, streaming log of what an agent is doing.
 * While working, the list is clipped to `maxHeight` and translated (transform only) so the newest
 * line stays in view. When complete it can collapse (`collapseOnComplete`) and the expanded list
 * becomes normally scrollable. New lines are announced politely.
 */
export interface ActivityLine {
  id: string;
  type: "text" | "tool";
  content: ReactNode;
  /** Tool name shown as a chip for type "tool". */
  tool?: string;
  state?: "pending" | "running" | "done" | "error";
}

export interface AgentActivityProps {
  items: ActivityLine[];
  status: "working" | "complete";
  /** Elapsed milliseconds (number) or a preformatted label. */
  duration?: number | string;
  /** Header label while working (cycled through ReasoningText when several). */
  workingLabel?: string | string[];
  /** Header label when complete. Defaults to "Worked for 1.2s". */
  completeLabel?: string;
  maxHeight?: number;
  collapseOnComplete?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

function fmtDuration(d?: number | string) {
  if (d === undefined) return "";
  if (typeof d === "string") return d;
  return d < 1000 ? `${d}ms` : `${(d / 1000).toFixed(1)}s`;
}

export function AgentActivity({
  items,
  status,
  duration,
  workingLabel = ["Reading your request", "Checking seller rules", "Preparing a reply"],
  completeLabel,
  maxHeight = 180,
  collapseOnComplete = false,
  defaultOpen = true,
  className,
}: AgentActivityProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const [offset, setOffset] = useState(0);
  const reduce = useReducedMotion();
  const working = status === "working";

  useEffect(() => {
    if (!working && collapseOnComplete) setOpen(false);
    if (working) setOpen(true);
  }, [working, collapseOnComplete]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setOffset(working ? Math.max(0, el.scrollHeight - maxHeight) : 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, working, maxHeight]);

  const label = working
    ? <ReasoningText phrases={Array.isArray(workingLabel) ? workingLabel : [workingLabel]} variant="swap" srLabel="Agent is working" />
    : <span>{completeLabel ?? (duration !== undefined ? `Worked for ${fmtDuration(duration)}` : "Done")}</span>;

  return (
    <div className={[s.activity, className].filter(Boolean).join(" ")}>
      <button type="button" className={s.activityHead} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <span className={`${s.activityIcon} ${working ? "" : s.activityIconDone}`} aria-hidden>
          {working ? <Sparkles size={13} strokeWidth={2} /> : <Check size={13} strokeWidth={2.5} />}
        </span>
        <span className={s.activityTitle}>{label}</span>
        {duration !== undefined && <span className={s.activityMeta}>{fmtDuration(duration)}</span>}
        <span className={`${s.chev} ${open ? s.chevOpen : ""}`} aria-hidden>
          <ChevronDown size={16} strokeWidth={2} />
        </span>
        <span className="sr-only">{open ? "Hide activity" : "Show activity"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            className={s.activityBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={T_DEFAULT}
          >
            <div
              className={[s.viewport, working ? "" : s.viewportScroll, offset > 0 ? s.viewportFade : ""].join(" ")}
              style={{ maxHeight }}
              tabIndex={working ? undefined : 0}
              aria-label="Agent activity"
              role="region"
            >
              <motion.ol
                ref={listRef}
                className={s.lines}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                animate={{ y: -offset }}
                transition={reduce ? { duration: 0 } : T_DEFAULT}
              >
                <AnimatePresence initial={false}>
                  {items.map((it) => (
                    <motion.li
                      key={it.id}
                      className={s.line}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={T_DEFAULT}
                    >
                      <span
                        className={[s.lineIcon, it.state === "done" ? s.lineDone : it.state === "error" ? s.lineError : it.state === "running" ? s.lineRunning : ""].join(" ")}
                        aria-hidden
                      >
                        {it.state === "running" ? (
                          <LoaderCircle size={14} strokeWidth={2} className={s.spin} />
                        ) : it.state === "done" ? (
                          <Check size={14} strokeWidth={2.5} />
                        ) : it.state === "error" ? (
                          <X size={14} strokeWidth={2.5} />
                        ) : it.type === "tool" ? (
                          <Wrench size={13} strokeWidth={2} />
                        ) : (
                          <CircleDot size={12} strokeWidth={2} />
                        )}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        {it.type === "tool" && it.tool && <span className={s.lineTool}>{it.tool}</span>} {it.content}
                        {it.state && it.state !== "pending" && (
                          <span className="sr-only">{it.state === "running" ? ", in progress" : it.state === "done" ? ", done" : ", failed"}</span>
                        )}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
