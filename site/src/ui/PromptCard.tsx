import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowUp, Mic, Paperclip, Sparkles } from "lucide-react";
import { hero } from "../content/proteus";
import { HOVER_DIM, parseTransition, T_PHYSICS } from "../lib/motion";
import { useInViewOnce } from "../lib/useScrollTarget";
import { RippleLoader } from "../fx-ext/RippleLoader";
import { TextWave } from "../fx-ext/TextWave";

/**
 * Framer "Prompt Card" (component-Prompt_Card__WiYRi7zrg.json). Five variants that Framer cycles
 * through with onAppear -> SET_VARIANT:
 *   1 -(1s)-> 2 -(1.5s)-> 3 -(1.5s)-> 4 -(1s)-> 5 -(4s)-> 1
 * Card: 466x593, fill White 80%, backdrop blur 10px, radius 16, padding 24, vertical stack,
 * space-between, items end. Variant transition: spring-physics 400 60 1 0s.
 *   1  user bubble; status row present but empty (loader hidden, text wave opacity 0)
 *   2  loader + text wave "Reading the mandate..."
 *   3  loader + text wave "Draft ready"
 *   4  status row hidden; reply bubble (pop 0.2s); "Draft ready" row with icon (opacity 0.5)
 *   5  container fills height, anchored to the bottom (padding-bottom 40); suggestion pills
 *      (pop 0.2 / 0.4 / 0.6s) and the "Suggestions" label appear
 * Layers that are hidden in a variant are unmounted, so their appear effects replay on return.
 */
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_MS: Record<Step, number> = { 1: 1000, 2: 1500, 3: 1500, 4: 1000, 5: 4000 };
const NEXT: Record<Step, Step> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 1 };

const ICON_MUTED = "rgba(17,22,46,0.45)";

function pop(delay: number): Variants {
  return {
    hidden: { opacity: 0, scale: 0 },
    visible: { opacity: 1, scale: 1, transition: parseTransition(`spring-duration 1s 0.2 ${delay}s`) },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  };
}

const bubble: CSSProperties = {
  background: "var(--c-dark-5)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 16,
  padding: "12px 16px",
  borderRadius: 16,
  width: "100%",
  maxWidth: "80%",
  transformOrigin: "50% 50%",
};

function Bubble({ text, delay, align, persistent }: { text: string; delay: number; align: "start" | "end"; persistent?: boolean }) {
  return (
    <motion.div
      layout={persistent ? "position" : undefined}
      transition={T_PHYSICS}
      variants={pop(delay)}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ ...bubble, alignSelf: align === "end" ? "flex-end" : "flex-start" }}
    >
      <p className="body2" style={{ color: "var(--c-dark)", width: "100%" }}>
        {text}
      </p>
    </motion.div>
  );
}

function Pill({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      variants={pop(delay)}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ background: "var(--c-secondary-20)", padding: "12px 16px", borderRadius: 1000, display: "flex", flexDirection: "column", gap: 16, transformOrigin: "50% 50%" }}
    >
      <p className="body2" style={{ color: "var(--c-dark)" }}>
        {text}
      </p>
    </motion.div>
  );
}

/** A variant-level row; AnimatePresence (popLayout) needs the ref so exiting rows leave the flow. */
function Row({ children, style, ref }: { children: ReactNode; style?: CSSProperties; ref?: React.Ref<HTMLDivElement> }) {
  return (
    <motion.div
      ref={ref}
      layout="position"
      transition={T_PHYSICS}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      style={{ width: "100%", display: "flex", ...style }}
    >
      {children}
    </motion.div>
  );
}

export interface PromptCardProps {
  className?: string;
  style?: CSSProperties;
  /** Start on a given variant and stop cycling (for screenshots / tests). */
  freeze?: Step;
}

export function PromptCard({ className, style, freeze }: PromptCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref, 0.3);
  const [step, setStep] = useState<Step>(freeze ?? 1);

  useEffect(() => {
    if (freeze || !seen) return;
    const t = window.setTimeout(() => setStep((s) => NEXT[s]), STEP_MS[step]);
    return () => window.clearTimeout(t);
  }, [step, seen, freeze]);

  const chat = hero.chat;
  const statusText = step === 3 ? chat.done : chat.status[0];
  const final = step === 5;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        zIndex: 1,
        background: "var(--c-white-80)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-end",
        overflow: "clip",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Container: its own size switches instantly; the children animate position (spring-physics). */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: final ? "flex-end" : "center",
          gap: 24,
          flex: final ? "1 1 0%" : "0 0 auto",
          minHeight: 0,
          paddingBottom: final ? 40 : 0,
        }}
      >
        <Bubble text={chat.user} delay={0.2} align="end" persistent />

        <AnimatePresence initial={false} mode="popLayout">
          {step >= 4 && (
            <Row key="reply" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10, maxWidth: "100%" }}>
              <Bubble text={chat.reply} delay={0.2} align="start" />
            </Row>
          )}

          {step <= 3 && (
            <Row key="status" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {step >= 2 && (
                <span style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <RippleLoader cellSize={6} spacing={1} radius={4} duration={1.5} cellDelay={0.1} />
                </span>
              )}
              <motion.div initial={false} animate={{ opacity: step >= 2 ? 1 : 0 }} transition={T_PHYSICS} style={{ flex: "1 1 0%", minWidth: 0, display: "flex" }}>
                <TextWave key={statusText} text={statusText} fontSize={16} lineHeight="16px" letterSpacing="-0.3px" waveWidth={30} speed={80} scale={1.01} delay={0.2} loop />
              </motion.div>
            </Row>
          )}

          {final && (
            <Row key="suggestions" style={{ flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                {chat.suggestions.map((s, i) => (
                  <Pill key={s} text={s} delay={0.2 + i * 0.2} />
                ))}
              </div>
              <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
                <p className="body2" style={{ opacity: 0.5 }}>
                  {chat.suggestionsLabel}
                </p>
              </div>
            </Row>
          )}

          {step >= 4 && (
            <Row key="done" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <span style={{ width: 16, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: 0.5, flex: "none" }}>
                <Sparkles size={16} strokeWidth={2} color="var(--c-body)" />
              </span>
              <p className="body2" style={{ opacity: 0.5 }}>
                {chat.done}
              </p>
            </Row>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <motion.div
        layout="position"
        transition={T_PHYSICS}
        style={{ background: "var(--c-dark-5)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, padding: "16px 14px", borderRadius: 16, width: "100%", flex: "none" }}
      >
        <p className="body2" style={{ color: "var(--c-dark-60)" }}>
          {chat.placeholder}
        </p>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 52, overflow: "clip" }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14 }}>
            <div style={{ flex: "1 1 0%", display: "flex", alignItems: "center", gap: 10 }}>
              <Paperclip size={16} strokeWidth={2} color={ICON_MUTED} />
            </div>
            <Mic size={16} strokeWidth={2} color={ICON_MUTED} />
            <motion.button
              type="button"
              whileHover={HOVER_DIM}
              style={{ background: "var(--c-primary)", padding: 10, borderRadius: 1000, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
            >
              <ArrowUp size={14} strokeWidth={2} color="var(--c-white)" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
