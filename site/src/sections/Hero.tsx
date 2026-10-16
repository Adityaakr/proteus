import { hero } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { Button } from "../ui/Button";
import { Tag } from "../ui/Tag";
import { PromptCard } from "../ui/PromptCard";
import s from "./Hero.module.css";

const MARK = "/assets/7QuYVNK6yeb3hmBB6mc2yJ1DBUg.png";

/**
 * section-Hero.json. Appear effects use Framer's "onMount" trigger, so the three animated
 * nodes (tag 0s, buttons 0.8s, BG 1s; all fade, spring-duration 1s 0) run on mount rather
 * than waiting for 50% visibility (the BG frame is taller than half a viewport).
 */
export function Hero() {
  return (
    <section id="hero" className={s.section}>
      <div className={s.content}>
        <div className={s.container}>
          <div className={s.textUi}>
            <div className={s.textButton}>
              <div className={s.headingBody}>
                <Appear preset="fade" animate="visible" whileInView={undefined}>
                  <Tag
                    bare
                    title={
                      <>
                        {hero.tag}{" "}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, verticalAlign: "-1px" }}>
                          <img src="/assets/arc-icon.svg" alt="" width={14} height={14} style={{ width: 14, height: 14 }} />
                          <span style={{ fontWeight: 500 }}>{hero.tagNetwork}</span>
                        </span>
                      </>
                    }
                    icon={<img src={MARK} alt="" width={16} height={16} style={{ width: 16, height: 16 }} />}
                  />
                </Appear>
                <h1 className={`h1 ${s.h1}`}>{hero.headline}</h1>
                <p className={`body1 ${s.body}`}>{hero.subhead}</p>
              </div>
              <Appear preset="fade-0.8" animate="visible" whileInView={undefined} className={s.buttons}>
                <Button label={hero.secondary.label} href={hero.secondary.href} variant="secondary" icon={false} />
                <Button label={hero.primary.label} href={hero.primary.href} variant="primary" icon />
              </Appear>
            </div>
          </div>
          <Appear preset="fade-1" animate="visible" whileInView={undefined} className={s.bg}>
            <PromptCard className={s.card} />
          </Appear>
        </div>
      </div>
    </section>
  );
}
