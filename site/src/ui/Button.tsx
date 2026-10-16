import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { T_DEFAULT } from "../lib/motion";

/**
 * Framer "Button" component (component-Button__Jh9jZPCX6.json). Variants from the export:
 *  primary        fill Brand/Primary, hover Brand/Primary dark, white label + icon
 *  secondary      1px border Dark/20%, transparent, Dark label + icon (hover variant is identical)
 *  primary-light  fill Brand/Secondary, hover Brand/Secondary dark
 *  size default   padding 10px 16px       size small   padding 6px 12px (nav)
 * Stack: horizontal, gap 8, radius 1000, overflow clip, transition spring-duration 0.4s 0.2 0s.
 * Label uses the "Button text" preset; icon container 16x16 with Arrow Right, stroke 2.
 */
export interface ButtonProps {
  label: string;
  /** Replaces the label while hovered or focused (the button keeps the wider of the two widths). */
  hoverLabel?: string;
  href: string;
  variant?: "primary" | "secondary" | "primary-light";
  size?: "default" | "small";
  icon?: boolean;
  /** Alias for variant "primary-light" (kept for the shared API in BUILD-BRIEF). */
  light?: boolean;
  newTab?: boolean;
  className?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
}

const fills: Record<NonNullable<ButtonProps["variant"]>, { rest: string; hover: string }> = {
  primary: { rest: "var(--c-primary)", hover: "var(--c-primary-dark)" },
  "primary-light": { rest: "var(--c-secondary)", hover: "var(--c-secondary-dark)" },
  secondary: { rest: "rgba(0,0,0,0)", hover: "rgba(0,0,0,0)" },
};

export function Button({ label, hoverLabel, href, variant, size = "default", icon = true, light, newTab, className, fullWidth, style }: ButtonProps) {
  const v: NonNullable<ButtonProps["variant"]> = variant ?? (light ? "primary-light" : "primary");
  const isSecondary = v === "secondary";
  const color = isSecondary ? "var(--c-dark)" : "var(--c-white)";
  const border = isSecondary ? "var(--c-dark-20)" : "rgba(0,0,0,0)";
  return (
    <motion.a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className={className}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      variants={{ rest: { backgroundColor: fills[v].rest }, hover: { backgroundColor: fills[v].hover } }}
      transition={T_DEFAULT}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: size === "small" ? "6px 12px" : "10px 16px",
        borderRadius: 1000,
        // Framer draws borders inside the box (they do not add to the layout size):
        // reference small buttons are 37.6px, default 45.6px, border included.
        boxShadow: `inset 0 0 0 1px ${border}`,
        overflow: "clip",
        width: fullWidth ? "100%" : "auto",
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...style,
      }}
    >
      {hoverLabel ? (
        <span style={{ display: "grid", textAlign: "center" }}>
          <motion.span className="btn-text" style={{ color, gridArea: "1 / 1" }} variants={{ rest: { opacity: 1, y: 0 }, hover: { opacity: 0, y: -6 } }} transition={T_DEFAULT}>
            {label}
          </motion.span>
          <motion.span className="btn-text" aria-hidden style={{ color, gridArea: "1 / 1" }} variants={{ rest: { opacity: 0, y: 6 }, hover: { opacity: 1, y: 0 } }} transition={T_DEFAULT}>
            {hoverLabel}
          </motion.span>
        </span>
      ) : (
        <span className="btn-text" style={{ color }}>
          {label}
        </span>
      )}
      {icon && (
        <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "clip" }}>
          <ArrowRight size={16} strokeWidth={2} color={color} />
        </span>
      )}
    </motion.a>
  );
}
