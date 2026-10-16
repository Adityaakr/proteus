import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import { FaqCard } from "../ui/FaqCard";
import { faq } from "../content/proteus";
import s from "./Faq.module.css";

/**
 * FAQs section (section-FAQs.json): centered header (tag + Heading 2 + Body 1, maxWidth 500),
 * then the "FAQs card container" component: 8 variants = which card is expanded, the first
 * expanded by default; clicking a collapsed card switches variant (one open at a time).
 * Heading + tag gap 32 (24 on tablet/phone); heading/description gap 16.
 */
export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faqs" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={faq.tag}
            icon={<TriangleAlert size={16} strokeWidth={1.5} />}
            heading={faq.heading}
            description={faq.description}
            align="center"
            gap={32}
            textGap={16}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
            className={s.header}
          />
          <div className={s.list}>
            {faq.items.map((item, i) => (
              <FaqCard key={item.q} question={item.q} answer={item.a} expanded={open === i} onClick={() => setOpen(i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
