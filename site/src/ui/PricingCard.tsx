import { motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import type { Plan } from "../content/proteus";
import { pricing } from "../content/proteus";
import SlotCounter from "../fx/SlotCounter";
import { Button } from "./Button";

/**
 * Framer "Pricing plan card" component (trGKj0u8_, variant Desktop). From the export:
 *  outer   1px border Dark/10%, fill White, padding 8, radius 22
 *  inner   1px border Dark/10%, fill rgb(246,248,247), padding 28, gap 22, radius 16, clip
 *  name    Heading 4 + optional tag (gradient Secondary → Secondary dark, padding 4px 10px,
 *          radius 100, Label white, with a looping "shiny frame" sweep)
 *  price   Slot Counter (prefix "$", 46px, roll up, stagger left → right, 3 rolls, 1.3s, 0.1s)
 *          + period Body 2, aligned to the baseline (gap 6)
 *  then    description Body 2, 1px divider Dark/10%, "INCLUDES" Label Dark/40%,
 *          five Pricing list rows (CircleCheck 20px Green 1.5 + Body 2, gap 10; list gap 14,
 *          padding-bottom 24), and a full-width Button.
 */
export interface PricingCardProps {
  plan: Plan;
  /** Change this to remount the counter so the digits roll again (toggle switch). */
  counterKey?: string | number;
  className?: string;
}

const counterFont: React.ComponentProps<typeof SlotCounter>["font"] = {
  fontFamily: "var(--font-heading)",
  fontWeight: 500,
  fontSize: "46px",
  letterSpacing: "-0.7px",
  lineHeight: "1em",
  textAlign: "left",
};

export function PricingCard({ plan, counterKey, className }: PricingCardProps) {
  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", padding: 8, borderRadius: 22, border: "1px solid var(--c-dark-10)", background: "var(--c-white)", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 22,
          padding: 28,
          borderRadius: 16,
          border: "1px solid var(--c-dark-10)",
          background: "var(--token-a75fb687-8d00-4d08-9407-fce93f119924)",
          overflow: "clip",
          width: "100%",
        }}
      >
        {/* Starter heading */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 0", minWidth: 0 }}>
            <h4 className="h4">{plan.name}</h4>
          </div>
          {plan.tag && (
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 100,
                overflow: "clip",
                flex: "none",
                background: "linear-gradient(135deg, var(--c-secondary) 0%, var(--c-secondary-dark) 100%)",
              }}
            >
              <span className="label" style={{ color: "var(--c-white)", whiteSpace: "nowrap" }}>
                {plan.tag}
              </span>
              {/* Shiny frame: loop x 0 → 140, y 0 → 50, tween linear 1s, repeat delay 1s */}
              <motion.span
                aria-hidden
                initial={{ x: 0, y: 0 }}
                animate={{ x: 140, y: 50 }}
                transition={{ duration: 1, ease: "linear", repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}
                style={{
                  position: "absolute",
                  left: -13,
                  top: -47,
                  width: 9,
                  height: 68,
                  rotate: "28deg",
                  opacity: 0.7,
                  background: "var(--c-white)",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </div>

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <SlotCounter
              key={counterKey}
              value={plan.value}
              prefix="$"
              suffix=""
              decimals={0}
              grouping
              direction="up"
              staggerFrom="left"
              rolls={3}
              duration={1.3}
              stagger={0.1}
              trigger="inView"
              replay={false}
              fadeEdges
              digitGap={1}
              digitWidth={0.63}
              color="var(--c-dark)"
              font={counterFont}
            />
            <p className="body2" style={{ whiteSpace: "nowrap" }}>
              {plan.period}
            </p>
          </div>
        </div>

        <p className="body2" style={{ width: "100%" }}>
          {plan.description}
        </p>

        <div style={{ width: "100%", height: 1, background: "var(--c-dark-10)" }} />

        <p className="label" style={{ color: "var(--c-dark-40)" }}>
          {pricing.includes}
        </p>

        <ul style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "0 0 24px 0", width: "100%", position: "relative", zIndex: 1 }}>
          {plan.features.map((feature) => (
            <li key={feature} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <span style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <CircleCheck size={20} strokeWidth={1.5} color="var(--c-green)" />
              </span>
              <p className="body2" style={{ flex: "1 1 0", minWidth: 0 }}>
                {feature}
              </p>
            </li>
          ))}
        </ul>

        <Button label={plan.cta.label} href={plan.cta.href} variant={plan.primary ? "primary" : "secondary"} fullWidth />
      </div>
    </div>
  );
}
