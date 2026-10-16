import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import { comparison } from "../content/proteus";
import DottedIcon from "../fx/DottedIcon";
import s from "./Comparison.module.css";

/**
 * "Industries" section (Framer node viN7yKCMO, elementId "comparison").
 * Dark container, centered white header, 3x2 grid (2 columns on tablet, 1 on phone) of
 * Industry cards: Dotted Icon code component (pixels, gradient, density 18, pixel size 1,
 * threshold per card), Heading 5 in White and Body 2 in White 60%.
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

function IndustryCard({ icon, threshold, title, body }: { icon: string; threshold: number; title: string; body: string }) {
  return (
    <div className={s.card}>
      <div className={s.icon}>
        <DottedIcon
          source={icon}
          fit="contain"
          renderStyle="pixels"
          matrixColorMode="solid"
          columns={18}
          dotScale={0.61}
          pixelScale={1}
          pixelRadius={0}
          gradientColor1="#00E5FF"
          gradientColor2="rgb(1, 43, 255)"
          gradientColor3="rgb(9, 174, 255)"
          gradientColor4="rgb(9, 174, 255)"
          gradientColor5="rgb(9, 174, 255)"
          gradientAngle={16}
          detection="alpha"
          threshold={threshold}
          invert={false}
          activeColor="rgb(255, 255, 255)"
          inactiveColor="rgba(255, 255, 255, 0.05)"
          inactiveOpacity={0}
          glow={0}
          shimmer
          shimmerColor="rgb(255, 255, 255)"
          shimmerIntensity={0.4}
          shimmerWidth={0.5}
          shimmerDuration={1.8}
          shimmerAngle={-50}
          background="rgb(0, 0, 0)"
          radius={0}
          padding={0}
          ariaLabel="Dotted icon"
        />
      </div>
      <div className={s.text}>
        <h5 className={`h5 ${s.title}`}>{title}</h5>
        <p className={`body2 ${s.body}`}>{body}</p>
      </div>
    </div>
  );
}

export function Comparison() {
  const gap = useHeaderGap();
  return (
    <section id="comparison" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={comparison.tag}
            icon={<Tag size={16} strokeWidth={2} />}
            heading={comparison.heading}
            description={comparison.description}
            align="center"
            dark
            gap={gap}
            textGap={16}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
          />
          <div className={s.grid}>
            {comparison.cards.map((card) => (
              <IndustryCard key={card.title} icon={card.icon} threshold={card.threshold} title={card.title} body={card.body} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
