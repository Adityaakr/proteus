import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Command } from "lucide-react";
import { parseTransition } from "../lib/motion";
import { useInViewOnce } from "../lib/useScrollTarget";

/**
 * Framer "Tag" component (component-Tag__PR2FImO_h.json): a pill with an icon (16x20) and a
 * Body 3 title, horizontal stack, gap 10, radius 1000, overflow clip.
 *  Inactive: padding 8px, title hidden (icon-only circle)
 *  Active:   padding 6px 12px, title visible
 * Every instance on the page uses scrollVariantEffect onInView (threshold 0.5, no replay):
 * Inactive -> Active, transition spring-duration 1s 0.2 0.3s.
 * Light sections: icon/text Dark, border 1px Dark/20%. Dark sections: White, border White/20%.
 *
 * `bare` renders the hero's plain tag row instead (section-Hero.json node mA8xjBeCO): no pill,
 * horizontal stack gap 8, padding 0 0 8px 0, icon 16px, Body 2 title.
 */
export interface TagProps {
  title: ReactNode;
  icon?: ReactNode;
  dark?: boolean;
  /** Force the state (e.g. always active in tests). */
  active?: boolean;
  /** Unbordered variant used by the hero (image icon + Body 2 text). */
  bare?: boolean;
  className?: string;
}

const T = parseTransition("spring-duration 1s 0.2 0.3s");

export function Tag({ title, icon, dark, active, bare, className }: TagProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref, 0.5);
  const isActive = active ?? seen;
  const color = dark ? "var(--c-white)" : "var(--c-dark)";
  const border = dark ? "var(--c-white-20)" : "var(--c-dark-20)";

  if (bare) {
    return (
      <div className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 0 8px 0", overflow: "clip" }}>
        {icon && <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{icon}</span>}
        <span className="body2" style={{ color: dark ? "var(--c-white-80)" : undefined, textAlign: "center" }}>
          {title}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      layout
      initial={false}
      animate={{ paddingTop: isActive ? 6 : 8, paddingBottom: isActive ? 6 : 8, paddingLeft: isActive ? 12 : 8, paddingRight: isActive ? 12 : 8 }}
      transition={T}
      // Framer borders are drawn inside the box, so the pill stays 32px tall (20 + 6 + 6).
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `inset 0 0 0 1px ${border}`, borderRadius: 1000, overflow: "clip", color }}
    >
      <span style={{ width: 16, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", color, flex: "none" }}>
        {icon ?? <Command size={16} strokeWidth={2} />}
      </span>
      <motion.span
        className="body3"
        initial={false}
        animate={{ opacity: isActive ? 1 : 0, width: isActive ? "auto" : 0, marginLeft: isActive ? 0 : -10 }}
        transition={T}
        style={{ color, whiteSpace: "nowrap", overflow: "hidden", display: "inline-block" }}
      >
        {title}
      </motion.span>
    </motion.div>
  );
}
