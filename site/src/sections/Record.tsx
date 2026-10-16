import { useEffect, useState, type CSSProperties } from "react";
import { Award } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import StaggerTestimonials from "../fx/StaggerTestimonials";
import { record } from "../content/proteus";
import s from "./Record.module.css";

/** Local media-query hook (lib/ is frozen for this pass). */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/* $control__quoteFont: PP Neue Montreal Medium 20px, letterSpacing 0em, lineHeight 1.3em */
const QUOTE_FONT: CSSProperties = { fontFamily: "var(--font-heading)", fontStyle: "normal", fontWeight: 500, fontSize: "20px", letterSpacing: "0em", lineHeight: "1.3em" };
/* $control__metaFont: PP Neue Montreal Book 12px, letterSpacing -0.01em, lineHeight 1.35em */
const META_FONT: CSSProperties = { fontFamily: "var(--font-heading)", fontStyle: "normal", fontWeight: 400, fontSize: "12px", letterSpacing: "-0.01em", lineHeight: "1.35em" };

/**
 * "The record" section (Testimonial, section-Testimonial.json): centered header
 * (tag + Heading 2 + Body 1, maxWidth 500), then the StaggerTestimonials code component
 * (instance WCBHCUmQr) full width, 707px tall (598 on phone, cards 280x320 there).
 */
export function Record() {
  const phone = useMedia("(max-width: 809.98px)");
  return (
    <section id="record" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={record.tag}
            icon={<Award size={16} strokeWidth={1.5} />}
            heading={record.heading}
            description={record.description}
            align="center"
            gap={32}
            textGap={16}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
            className={s.header}
          />
        </div>
      </div>
      <div className={s.carousel}>
        <StaggerTestimonials
          testimonials={record.entries}
          autoplay
          pauseOnHover={false}
          interval={2000}
          surface="rgb(250, 250, 250)"
          inactiveCard="rgb(250, 250, 250)"
          activeCard="rgb(255, 255, 255)"
          borderColor="rgba(0, 0, 0, 0.1)"
          accent="rgb(1, 43, 255)"
          inactiveText="rgba(0, 0, 0, 0.8)"
          activeText="rgb(0, 0, 0)"
          mutedText="rgba(0, 0, 0, 0.6)"
          cardWidth={phone ? 280 : 350}
          cardHeight={phone ? 320 : 390}
          cardGap={235}
          activeLift={56}
          cardRadius="16px"
          previousImage={{ src: "/assets/q4tvq9v1Jwu5IR2f2OcwIK3Tdw.png", alt: "Previous" }}
          nextImage={{ src: "/assets/SuVzHcAIqwwM2vGyCxCIrEKMc.png", alt: "Next" }}
          quoteFont={QUOTE_FONT}
          metaFont={META_FONT}
        />
      </div>
    </section>
  );
}
