import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { parseTransition } from "../../lib/motion";
import s from "./agentic.module.css";

/**
 * ReasoningText: a shimmering, cycling status phrase while an agent works.
 *  variant "cascade"  letters rise in one after another
 *  variant "swap"     the phrase slides up and is replaced
 *  variant "scramble" letters resolve from random glyphs
 * Under reduced motion it renders the first phrase statically. Screen readers get one stable
 * label (`srLabel`) instead of every cycled phrase.
 */
export type ReasoningVariant = "cascade" | "swap" | "scramble";

export interface ReasoningTextProps {
  phrases?: string[];
  /** Single phrase shorthand. */
  text?: string;
  variant?: ReasoningVariant;
  /** Milliseconds per phrase. */
  interval?: number;
  /** Shimmer gradient across the text. Default true. */
  shimmer?: boolean;
  /** Stop cycling (shows the current phrase). */
  paused?: boolean;
  srLabel?: string;
  className?: string;
}

const T = parseTransition("spring-duration 0.5s 0.15 0s");
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789$#%&*+=";

function useScramble(target: string, enabled: boolean): string {
  const [out, setOut] = useState(target);
  useEffect(() => {
    if (!enabled) {
      setOut(target);
      return;
    }
    let frame = 0;
    const total = Math.max(12, target.length);
    const id = setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * target.length * 1.2);
      setOut(
        target
          .split("")
          .map((ch, i) => (ch === " " || i < settled ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (settled >= target.length) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [target, enabled]);
  return out;
}

export function ReasoningText({ phrases, text, variant = "swap", interval = 2200, shimmer = true, paused, srLabel, className }: ReasoningTextProps) {
  const list = useMemo(() => (phrases && phrases.length ? phrases : [text ?? "Thinking"]), [phrases, text]);
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const animate = !reduce;

  useEffect(() => {
    setI(0);
  }, [list]);
  useEffect(() => {
    if (!animate || paused || list.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % list.length), interval);
    return () => clearInterval(id);
  }, [animate, paused, list, interval]);

  const phrase = list[animate ? i % list.length : 0]!;
  const scrambled = useScramble(phrase, animate && variant === "scramble");
  const textCls = [s.reasonPhrase, shimmer ? s.shimmer : ""].join(" ");

  let body;
  if (!animate) {
    body = <span className={s.reasonPhrase}>{phrase}</span>;
  } else if (variant === "cascade") {
    body = (
      <span className={s.swapWrap}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={phrase} className={textCls} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            {phrase.split("").map((ch, k) => (
              <motion.span key={k} className={s.char} initial={{ opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ ...T, delay: k * 0.018 }}>
                {ch}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  } else if (variant === "scramble") {
    body = <span className={`${textCls} ${s.scramble}`}>{scrambled}</span>;
  } else {
    body = (
      <span className={s.swapWrap}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={phrase} className={textCls} initial={{ y: "100%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={T}>
            {phrase}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return (
    <span className={[s.reasoning, className].filter(Boolean).join(" ")}>
      <span aria-hidden>{body}</span>
      <span className="sr-only">{srLabel ?? list[0]}</span>
    </span>
  );
}
