import { motion } from "framer-motion";
import { Command, Mic, Paperclip, RefreshCw, Sparkles } from "lucide-react";
import { howItWorks } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { HOVER_DIM } from "../lib/motion";
import { SectionHeader } from "../ui/SectionHeader";
import { UiCardLoading } from "../ui/UiCardLoading";
import Typewriter from "../fx/Typewriter";
import AnimatedBeam from "../fx/Animated_beam";
import { RippleLoader } from "../fx-ext/RippleLoader";
import styles from "./HowItWorks.module.css";

/* Image fills from the export, mapped through design/framer-export/asset-map.json. */
const MEDIA = [
  "/assets/svSq1hHi3TFnZce7BPcnb7uXyFw.png", // e90RFZl3f
  "/assets/7JLgNnHNWS2ZheqZrTXBTaVCv6Q.png", // aGc3ZJ8FO
  "/assets/3zE3eLjjpwMLVNUEK5PAUEZaCJk.png", // xTc0PCOro
];

/* AnimatedBeam instance TOiaa23n3 */
const BEAM = {
  centerImage: "/assets/7QuYVNK6yeb3hmBB6mc2yJ1DBUg.png",
  leftNodes: [
    { image: "/assets/ghA1dv8Ec7AjGLyCNKFyk2YW2Y.png" },
    { image: "/assets/cu4MfUe9qRDMpZkhNA7m7eIhaM.png" },
    { image: "/assets/nETSPvMOZHE9F2AVkfuiTnVEI.png" },
  ],
  rightNodes: [
    { image: "/assets/Bdk9u0YFihVafXCtWkTxTzKmFu4.png" },
    { image: "/assets/zxWuBWsLWrG577sK8JjS6ztMbo.png" },
    { image: "/assets/tA26PW4Ptu6P0TTTuRjOs0Jsvs.png" },
  ],
};

/* Typewriter instance EeGn74y4S: Geist 16px, letter-spacing -0.01em, line-height 1.1em, ss01 */
const TYPEWRITER_FONT = {
  fontFamily: "var(--font-body)",
  fontSize: "16px",
  fontWeight: 400,
  letterSpacing: "-0.01em",
  lineHeight: "1.1em",
  textAlign: "left" as const,
  fontFeatureSettings: '"ss01"',
};

const DARK = "var(--token-7ce17e0b-526a-4831-8d21-f7773fb57072)";
const WHITE = "var(--token-4b2e1e47-a7ec-4fea-a0ce-eadd74c77d3b)";

const PRESETS = ["pop", "pop-0.4", "pop-0.6"] as const;

export function HowItWorks() {
  const { steps, mandates, promptCard, agent } = howItWorks;

  const media = [
    // Card 1: Prompt Card (YL6gfLsTV) with the Typewriter, New Suggestion row and Run Agent pill
    <div className={styles.promptCard} key="prompt">
      <div className={styles.typewriter}>
        <Typewriter
          text1={mandates[0]}
          text2={mandates[1]}
          text3={mandates[2]}
          typingSpeed={50}
          pauseDuration={500}
          textColor={DARK}
          font={TYPEWRITER_FONT}
          showCursor
          cursorColor={DARK}
          cursorBlinkSpeed={530}
        />
      </div>
      <div className={styles.promptBar}>
        <div className={styles.suggestion}>
          <RefreshCw size={14} strokeWidth={2} color="rgba(17,22,46,0.6)" aria-hidden />
          <span className={`body3 ${styles.suggestionText}`}>{promptCard.suggestion}</span>
        </div>
        <div className={styles.barRight}>
          <Paperclip size={16} strokeWidth={2} color="rgba(17,22,46,0.45)" aria-hidden />
          <Mic size={16} strokeWidth={2} color="rgba(17,22,46,0.45)" aria-hidden />
          <motion.div className={styles.run} whileHover={HOVER_DIM}>
            <span className="body3" style={{ color: WHITE }}>
              {promptCard.run}
            </span>
            <Sparkles size={14} strokeWidth={2} color={WHITE} aria-hidden />
          </motion.div>
        </div>
      </div>
    </div>,

    // Card 2: AnimatedBeam (TOiaa23n3)
    <div className={styles.beam} key="beam">
      <AnimatedBeam
        centerImage={BEAM.centerImage}
        leftNodes={BEAM.leftNodes}
        rightNodes={BEAM.rightNodes}
        nodeSize={48}
        centerSize={64}
        padding={24}
        gap={32}
        nodeBackground={WHITE}
        nodeBorderColor="#e5e7eb"
        nodeBorderWidth={1}
        nodeRadius={12}
        pathColor="var(--token-b39a48ae-2f48-4067-9b92-9d8fcfd251a1)"
        pathWidth={3}
        pathOpacity={0.35}
        gradientStartColor="var(--token-b48b7134-7ad2-4f07-b792-c7a8003d791a)"
        gradientStopColor="var(--token-52d49a3a-3ad9-4835-a3cb-87d0d1f6fc06)"
        curvature={75}
        endYOffset={10}
        duration={1}
        delay={0}
        stagger={0}
        repeatDelay={0}
        speedVariation={1}
        easing="linear"
        reverseFlow={false}
        style={{ height: "auto" }}
      />
    </div>,

    // Card 3: Desktop (lGzgXaPhR) with the Agent working header, divider and loading list
    <div className={styles.desktop} key="desktop">
      <div className={styles.agentHeader}>
        <span className={styles.ripple}>
          <RippleLoader cellSize={6} spacing={1} radius={4} duration={1.5} cellDelay={0.1} />
        </span>
        <p className="h6" style={{ flex: "1 1 0", minWidth: 0 }}>
          {agent.title}
        </p>
      </div>
      <div className={styles.divider} />
      <div className={styles.list}>
        {agent.items.map((item) => (
          <UiCardLoading key={item.label} title={item.label} variant={item.state === "done" ? "Completed" : "Loading"} />
        ))}
      </div>
    </div>,
  ];

  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.content}>
          <Appear preset="pop" className={styles.header} style={{ width: "100%" }}>
            <SectionHeader
              tag={howItWorks.tag}
              heading={howItWorks.heading}
              description={howItWorks.description}
              align="center"
              icon={<Command size={16} strokeWidth={2} />}
              gap={32}
              textGap={16}
              headingMaxWidth={500}
              descriptionMaxWidth={500}
            />
          </Appear>

          <div className={styles.cards}>
            {steps.map((step, i) => (
              <Appear key={step.title} preset={PRESETS[i]} className={styles.card}>
                <div className={styles.media} style={{ backgroundImage: `url(${MEDIA[i]})` }}>
                  {media[i]}
                </div>
                <div className={styles.text}>
                  <h3 className="h5">{step.title}</h3>
                  <p className={`body2 ${styles.body}`}>{step.body}</p>
                </div>
              </Appear>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
