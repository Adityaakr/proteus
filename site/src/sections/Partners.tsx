import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import { partners } from "../content/proteus";
import GrowthGraph from "../fx/GrowthGraph";
import s from "./Partners.module.css";

/**
 * "Metrics" section (Framer node dAUcpVWwG, elementId "partners").
 * Left-aligned header, a 2x2 grid of Metric cards (left border in Brand/Secondary, Heading 3
 * number, Body 2 title in Dark 60%) and the GrowthGraph code component pinned to the bottom of
 * the padded container (left 0, right 0, bottom 0, 635px tall) behind the content.
 */

/** Heading + tag gap is 32 on desktop and 24 on tablet / phone (export deltas). */
function useHeaderGap(): number {
  const [gap, setGap] = useState(32);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1199.98px)");
    const update = () => setGap(mq.matches ? 24 : 32);
    mq.addEventListener("change", update);
    update();
    return () => mq.removeEventListener("change", update);
  }, []);
  return gap;
}

export function Partners() {
  const gap = useHeaderGap();
  return (
    <section id="partners" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={partners.tag}
            icon={<Activity size={16} strokeWidth={2} />}
            heading={partners.heading}
            description={partners.description}
            align="left"
            gap={gap}
            textGap={16}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
          />
          <div className={s.metrics}>
            {partners.steps.map((step) => (
              <div className={s.metric} key={step.number}>
                <h3 className="h3" style={{ width: "100%" }}>{step.number}</h3>
                <p className={`body2 ${s.metricTitle}`}>{step.title}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={s.graph}>
          {/* SVG presentation attributes cannot resolve var(); these are the resolved token values:
              Secondary 20% (621d9ebc), Secondary dark (fd2642e7), Dark 10% (8144f193). */}
          <GrowthGraph
            lineColor="rgba(9, 174, 255, 0.2)"
            useLineGradient
            lineEndColor="rgb(9, 153, 224)"
            fillColor="rgba(9, 174, 255, 0.2)"
            ruleColor="rgba(0, 0, 0, 0.1)"
            startHeight={15}
            endHeight={100}
            duration={4}
            showRules
          />
        </div>
      </div>
    </section>
  );
}
