import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Search } from "lucide-react";
import { decisions } from "../content/proteus";
import { SectionHeader } from "../ui/SectionHeader";
import { ApprovalsCard } from "../ui/ApprovalsCard";
import { TextWave } from "../fx-ext/TextWave";
import { RippleLoader } from "../fx-ext/RippleLoader";
import { ArcSpinner } from "../fx-ext/ArcSpinner";
import AnimatedBeamLines from "../fx/Animated_lines";
import { parseTransition } from "../lib/motion";
import { useScrollTarget } from "../lib/useScrollTarget";
import s from "./Decisions.module.css";

/* Image fills of the four "Content" frames (asset-map.json -> /assets). */
const CARD_IMAGES = [
  "/assets/7hinuK1ca5NnE0jxQx6Xp0Rgc.png",
  "/assets/uQIV8SHQg9uwGTWj9BcWtwDTp9E.png",
  "/assets/GomaCIogYngvxNRqv2ME24dcRUs.png",
  "/assets/um0Pkcj6XWmxCznDT9BJPaQKV8.png",
];

/* Feature indicator (C11k882cT): Active / Inactive, transition spring-duration 0.4s 0.2 0s. */
const T_INDICATOR = parseTransition("spring-duration 0.4s 0.2 0s");

function FeatureIndicator({ number, title, active }: { number: string; title: string; active: boolean }) {
  return (
    <motion.div
      className={s.indicator}
      initial={false}
      animate={{
        borderColor: active ? "rgb(9, 174, 255)" : "rgba(0, 0, 0, 0.1)",
        backgroundColor: active ? "rgba(9, 174, 255, 0.1)" : "rgba(9, 174, 255, 0)",
      }}
      transition={T_INDICATOR}
    >
      <motion.span
        className={`h6 ${s.indicatorNumber}`}
        initial={false}
        animate={{ backgroundColor: active ? "rgb(9, 174, 255)" : "rgba(0, 0, 0, 0.2)" }}
        transition={T_INDICATOR}
      >
        {number}
      </motion.span>
      <span className={`h6 ${s.indicatorTitle}`}>{title}</span>
    </motion.div>
  );
}

/* Feature card container > Feature card > Step + info | Content */
function FeatureCard({ id, title, body, image, children }: { id: string; title: string; body: string; image: string; children: ReactNode }) {
  return (
    <div id={id} className={s.cardOuter}>
      <div className={s.card}>
        <div className={s.info}>
          <div className={s.infoText}>
            <div className={s.headingDesc}>
              <h5 className={`h5 ${s.cardTitle}`}>{title}</h5>
              <p className={`body2 ${s.cardBody}`}>{body}</p>
            </div>
          </div>
        </div>
        <div className={s.visual} style={{ backgroundImage: `url(${image})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Decisions() {
  const [c0, c1, c2, c3] = decisions.cards;
  const ids = useMemo(() => decisions.cards.map((c) => c.id), []);
  const active = useScrollTarget(ids, 0.5);

  const search = c0.search!;
  const paragraphs = c2.paragraphs!;
  const approvals = c3.approvals!;

  return (
    <section id="features" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            className={s.header}
            tag={decisions.tag}
            heading={decisions.heading}
            description={decisions.description}
            align="left"
            icon={<LayoutGrid size={16} strokeWidth={2} />}
            gap={32}
            textGap={16}
            headingMaxWidth={720}
            descriptionMaxWidth={500}
          />

          <div className={s.row}>
            {/* tbPYNwSEV Feature indicator container */}
            <div className={s.indicators}>
              {decisions.tabs.map((tab, i) => (
                <FeatureIndicator key={tab.number} number={tab.number} title={tab.title} active={active === ids[i]} />
              ))}
            </div>

            {/* Ajem5uGTt Feature card container */}
            <div className={s.cards}>
              {/* Card 1: Search */}
              <FeatureCard id={c0.id} title={c0.title} body={c0.body} image={CARD_IMAGES[0]}>
                <div className={s.search}>
                  <div className={s.promptCard}>
                    <div className={s.searchBar}>
                      <span className={s.searchIcon}>
                        <Search size={20} strokeWidth={2} />
                      </span>
                      <TextWave text={search.wave} />
                    </div>
                    <div className={s.results}>
                      <div className={s.resultsInner}>
                        {search.results.map((line) => (
                          <p key={line} className={`body2 ${s.darkLine}`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </FeatureCard>

              {/* Card 2: Automation (pill + converging beams) */}
              <FeatureCard id={c1.id} title={c1.title} body={c1.body} image={CARD_IMAGES[1]}>
                <div className={s.lines}>
                  <div className={s.automatingPill}>
                    <span className={s.ripple}>
                      <RippleLoader cellSize={6} spacing={1} radius={4} duration={1.5} cellDelay={0.1} />
                    </span>
                    <span className={s.waveNarrow}>
                      <TextWave text={c1.wave!} />
                    </span>
                  </div>
                  <div className={s.beams}>
                    <div className={s.beamsRot}>
                      <AnimatedBeamLines
                        mode="converge"
                        lineCount={3}
                        convergeX={0.5}
                        convergeY={0.95}
                        bend={0.55}
                        orientation="vertical"
                        curvature={2}
                        inset={0}
                        pathColor="rgb(9, 153, 224)"
                        pathWidth={3}
                        pathOpacity={0.2}
                        gradientStartColor="rgb(1, 43, 255)"
                        gradientStopColor="rgba(1, 43, 255, 0.2)"
                        beamLength={32}
                        duration={1.5}
                        delay={0}
                        stagger={0}
                        repeatDelay={0}
                        speedVariation={0}
                        easing="linear"
                        reverse
                      />
                    </div>
                  </div>
                </div>
              </FeatureCard>

              {/* Card 3: Realtime (status pill + message card) */}
              <FeatureCard id={c2.id} title={c2.title} body={c2.body} image={CARD_IMAGES[2]}>
                <div className={s.automation}>
                  <div className={s.statusPill}>
                    <span className={s.spinner}>
                      <ArcSpinner size={24} color="var(--c-primary)" track={0.1} stroke={2} duration={1} label="Loading" />
                    </span>
                    <span className={s.statusWave}>
                      <TextWave text={c2.wave!} />
                    </span>
                  </div>
                  <div className={s.msgCard}>
                    <div className={s.msgInner}>
                      <div className={`body2 ${s.msgText}`}>
                        {paragraphs.map((p) => (
                          <p key={p}>{p}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </FeatureCard>

              {/* Card 4: User roles card */}
              <FeatureCard id={c3.id} title={c3.title} body={c3.body} image={CARD_IMAGES[3]}>
                {/* `$control__avatarVisible` is false on tablet and phone: hidden via .approvals CSS */}
                <ApprovalsCard data={approvals} avatarVisible className={s.approvals} style={{ position: "absolute" }} />
              </FeatureCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
