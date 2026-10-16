import { Shield } from "lucide-react";
import { trust } from "../content/proteus";
import { SectionHeader } from "../ui/SectionHeader";
import s from "./Trust.module.css";

/**
 * Security section (WYSe0v1Nz, elementId "security"). Dark: Tag "Trust and controls" +
 * Heading 2 white (gap 32), the dotted-key "Image" frame (max 700, ratio 2.82), then the
 * "Security info container" row of four cards (Heading 6 white + Body 3 White/80%).
 */
export function Trust() {
  return (
    <section id="security" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={trust.tag}
            heading={trust.heading}
            description={trust.description}
            dark
            icon={<Shield size={16} strokeWidth={2} />}
            headingMaxWidth={560}
            descriptionMaxWidth={500}
            style={{ gap: "var(--header-gap)" }}
          />
          <div className={s.image} role="img" aria-label="" />
          <div className={s.cards}>
            {trust.cards.map((card) => (
              <div key={card.title} className={s.card}>
                <h6 className={`h6 ${s.title}`}>{card.title}</h6>
                <p className={`body3 ${s.body}`}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
