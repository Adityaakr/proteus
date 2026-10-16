import { motion } from "framer-motion";
import { parseTransition } from "../lib/motion";

/**
 * Framer "Toggle button" component (B5ge51dPW). Two variants, Annual (right selected) and
 * Monthly (left selected). From the export:
 *  pill      1px border Dark/10%, fill Page BG, padding 4, gap 4, radius 100
 *  left      padding 10px 16px, height 40, radius 100, Label text
 *  right     padding 8px 10px 8px 16px, gap 8, radius 100, Label text + badge
 *  badge     fill White, padding 4px 7px, radius 100, Label; 1px Dark/10% border when unselected
 *  selected  fill Brand/Primary, white label. Variant transition: spring-duration 0.4s 0.2 0s
 */
export interface ToggleProps {
  left: string;
  right: string;
  /** Badge shown on the right side (the "Integrated discount" frame). */
  badge?: string;
  value: "left" | "right";
  onChange: (value: "left" | "right") => void;
}

const T = parseTransition("spring-duration 0.4s 0.2 0s");

const pill: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: 100, background: "var(--c-primary)" };

export function Toggle({ left, right, badge, value, onChange }: ToggleProps) {
  const leftOn = value === "left";
  const rightOn = value === "right";
  return (
    <div
      role="radiogroup"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 100,
        border: "1px solid var(--c-dark-10)",
        background: "var(--c-page)",
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={leftOn}
        onClick={() => onChange("left")}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 16px", height: 40, borderRadius: 100 }}
      >
        {leftOn && <motion.span layoutId="toggle-pill" transition={T} style={pill} />}
        <motion.span
          className="label"
          initial={false}
          animate={{ color: leftOn ? "rgba(255,255,255,1)" : "rgba(0,0,0,0.7)" }}
          transition={T}
          style={{ position: "relative", whiteSpace: "nowrap" }}
        >
          {left}
        </motion.span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={rightOn}
        onClick={() => onChange("right")}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 10px 8px 16px", borderRadius: 100 }}
      >
        {rightOn && <motion.span layoutId="toggle-pill" transition={T} style={pill} />}
        <motion.span
          className="label"
          initial={false}
          animate={{ color: rightOn ? "rgba(255,255,255,1)" : "rgba(0,0,0,0.7)" }}
          transition={T}
          style={{ position: "relative", whiteSpace: "nowrap" }}
        >
          {right}
        </motion.span>
        {badge && (
          <motion.span
            initial={false}
            animate={{ borderColor: rightOn ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.1)" }}
            transition={T}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 7px",
              borderRadius: 100,
              border: "1px solid",
              background: "var(--c-white)",
            }}
          >
            <span className="label" style={{ whiteSpace: "nowrap" }}>
              {badge}
            </span>
          </motion.span>
        )}
      </button>
    </div>
  );
}
