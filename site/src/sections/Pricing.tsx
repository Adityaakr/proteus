import { useState } from "react";
import { DollarSign } from "lucide-react";
import { pricing } from "../content/proteus";
import { SectionHeader } from "../ui/SectionHeader";
import { Toggle } from "../ui/Toggle";
import { PricingCard } from "../ui/PricingCard";
import s from "./Pricing.module.css";

/**
 * Pricing section (UMje28XpX, elementId "pricing").
 * Header (Tag "Pricing" + Heading 2 + Body 1, gap 32), then the "Pricing toggle + cards"
 * component: the toggle switches all three plan cards between monthly (left) and yearly
 * (right) prices. The slot counters remount on every switch so the digits roll again, as the
 * Framer variant swap does.
 */
export function Pricing() {
  const [mode, setMode] = useState<"left" | "right">("left");
  const plans = mode === "right" ? pricing.yearly : pricing.monthly;
  return (
    <section id="pricing" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={pricing.tag}
            heading={pricing.heading}
            description={pricing.description}
            icon={<DollarSign size={16} strokeWidth={2} />}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
            style={{ gap: "var(--header-gap)" }}
          />
          <div className={s.toggleCards}>
            <Toggle left={pricing.toggle.left} right={pricing.toggle.right} badge={pricing.toggle.badge} value={mode} onChange={setMode} />
            <div className={s.cards}>
              {plans.map((plan) => (
                <PricingCard key={plan.name} className={s.card} plan={plan} counterKey={mode} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
