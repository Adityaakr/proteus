import type { Transition, Variants } from "framer-motion";

/**
 * Parse a Framer transition string into a framer-motion transition.
 *  "spring-duration 1s 0.2 0.4s"  -> duration-based spring (duration, bounce, delay)
 *  "spring-physics 400 60 1 0s"   -> physics spring (stiffness, damping, mass, delay)
 *  "tween 0.44,0,0.56,1 0.35s 0s" -> cubic-bezier tween (ease, duration, delay)
 */
export function parseTransition(spec: string): Transition {
  const parts = spec.trim().split(/\s+/);
  const kind = parts[0];
  const sec = (v: string | undefined) => (v ? parseFloat(v) : 0);
  if (kind === "spring-duration") {
    return { type: "spring", duration: sec(parts[1]), bounce: sec(parts[2]), delay: sec(parts[3]) };
  }
  if (kind === "spring-physics") {
    return { type: "spring", stiffness: sec(parts[1]), damping: sec(parts[2]), mass: sec(parts[3]) || 1, delay: sec(parts[4]) };
  }
  if (kind === "tween") {
    const ease = parts[1].split(",").map(Number) as [number, number, number, number];
    return { type: "tween", ease, duration: sec(parts[2]), delay: sec(parts[3]) };
  }
  return { type: "spring", duration: 0.4, bounce: 0.2 };
}

/** The default Framer layer transition used across this template. */
export const T_DEFAULT = parseTransition("spring-duration 0.4s 0.2 0s");
export const T_HOVER = parseTransition("spring-duration 0.3s 0.2 0s");
export const T_SLOW = parseTransition("spring-duration 2s 0.2 0s");
export const T_PHYSICS = parseTransition("spring-physics 400 60 1 0s");

/**
 * Appear effect presets from the export. Framer's "onMount" trigger with threshold 0.5
 * behaves like whileInView once at 50% visibility, so use with `viewport={{ once: true, amount: 0.5 }}`.
 */
export type AppearPreset = "fade" | "fade-0.8" | "fade-1" | "pop" | "pop-0.4" | "pop-0.6" | "fade-fast";

export function appearVariants(preset: AppearPreset): Variants {
  const map: Record<AppearPreset, { scale: number; spec: string }> = {
    fade: { scale: 1, spec: "spring-duration 1s 0 0s" },
    "fade-0.8": { scale: 1, spec: "spring-duration 1s 0 0.8s" },
    "fade-1": { scale: 1, spec: "spring-duration 1s 0 1s" },
    pop: { scale: 0, spec: "spring-duration 1s 0.2 0.2s" },
    "pop-0.4": { scale: 0, spec: "spring-duration 1s 0.2 0.4s" },
    "pop-0.6": { scale: 0, spec: "spring-duration 1s 0.2 0.6s" },
    "fade-fast": { scale: 1, spec: "spring-duration 0.4s 0.2 0.5s" },
  };
  const { scale, spec } = map[preset];
  return {
    hidden: { opacity: 0, scale },
    visible: { opacity: 1, scale: 1, transition: parseTransition(spec) },
  };
}

export const VIEWPORT_ONCE = { once: true, amount: 0.5 } as const;

/** Framer hover effect used on buttons and cards: opacity 0.9, spring 0.3s bounce 0.2. */
export const HOVER_DIM = { opacity: 0.9, transition: T_HOVER };
