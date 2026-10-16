import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlignLeft, Anchor, Check, Compass, FileText, MessageCircle, Music, SquarePen, Video } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import { verification } from "../content/proteus";
import { parseTransition } from "../lib/motion";
import { useInViewOnce } from "../lib/useScrollTarget";
import { RippleLoader } from "../fx-ext/RippleLoader";
import { TextWave } from "../fx-ext/TextWave";
import AnimatedBeamLines from "../fx/Animated_lines_2";
import s from "./Verification.module.css";

/**
 * "Capabilities" section (Framer node W_2F8FmqT, elementId "capabilities").
 * Centered header + a bento grid of four Capability cards:
 *   1. What counts (Multimodal card: two rows of icon chips that overflow and clip)
 *   2. When to pay (Video, cover, autoplay muted loop)
 *   3. What is real (AnimatedBeamLines, converge fan, 5 lines with label cards)
 *   4. The order never changes (Capability card component cycling variants 1 -> 6)
 * Desktop: 3 columns, spans 1 / 2 / 2 / 1. Tablet: 4 columns, every card spans 2. Phone: 1 column.
 */

type Breakpoint = "desktop" | "tablet" | "phone";

/** Local breakpoint hook (Framer: Desktop >= 1200, Tablet 810 .. 1199.98, Phone <= 809.98). */
function useBreakpoint(): Breakpoint {
  const get = (): Breakpoint => {
    if (typeof window === "undefined") return "desktop";
    if (window.matchMedia("(max-width: 809.98px)").matches) return "phone";
    if (window.matchMedia("(max-width: 1199.98px)").matches) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState<Breakpoint>(get);
  useEffect(() => {
    const mqs = [window.matchMedia("(max-width: 809.98px)"), window.matchMedia("(max-width: 1199.98px)")];
    const update = () => setBp(get());
    mqs.forEach((m) => m.addEventListener("change", update));
    update();
    return () => mqs.forEach((m) => m.removeEventListener("change", update));
  }, []);
  return bp;
}

/* ---------------------------------------------------------------- */
/* Capability card shell: outer white container (padding 8, radius 20) + inner grey card (radius 16) */

function CapabilityCard({ span, visual, title, body }: { span: 1 | 2; visual: ReactNode; title: string; body: string }) {
  return (
    <div className={`${s.shell} ${span === 2 ? s.span2 : s.span1}`}>
      <div className={s.card}>
        <div className={s.visual}>{visual}</div>
        <div className={s.text}>
          <h5 className="h5" style={{ width: "100%" }}>{title}</h5>
          <p className="body2" style={{ width: "100%" }}>{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Multimodal card (qCXDZGj4q): feather icon set, stroke colors from the export, rows clip at the card edge */

const CHIP_ICONS: { Icon: typeof FileText; stroke: string }[] = [
  { Icon: FileText, stroke: "rgb(237, 149, 17)" },
  { Icon: Music, stroke: "rgb(230, 58, 28)" },
  { Icon: Video, stroke: "rgb(179, 28, 230)" },
  { Icon: Compass, stroke: "rgb(28, 58, 230)" },
  { Icon: SquarePen, stroke: "rgb(20, 195, 204)" },
  { Icon: AlignLeft, stroke: "rgb(42, 204, 20)" },
  { Icon: MessageCircle, stroke: "rgb(2, 196, 183)" },
];

function MultimodalCard() {
  const chips = verification.counts.chips;
  const rows = [chips.slice(0, 4), chips.slice(4)];
  let index = 0;
  return (
    <div className={s.multimodal}>
      <div className={s.chipStack}>
        {rows.map((row, r) => (
          <div className={s.chipRow} key={r}>
            {row.map((label) => {
              const { Icon, stroke } = CHIP_ICONS[index++ % CHIP_ICONS.length];
              return (
                <div className={s.chip} key={label}>
                  <span className={s.chipIcon} style={{ color: stroke }}>
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <p className={`body2 ${s.chipLabel}`}>{label}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Video (instance SQlkw2fJV): upload, loop, muted, poster, cover, playing, no controls */

function PayVideo() {
  return (
    <video
      className={s.video}
      src="/assets/R2LuOEH4wpUQhMnB4kQDIJ4RM.mp4"
      poster="/assets/bn9SbXpnsqWIO651wPfywkNq2PA.png"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  );
}

/* ---------------------------------------------------------------- */
/* AnimatedBeamLines (instance cDlqstrY7) with the tablet / phone deltas from the export */

function RealBeams({ bp }: { bp: Breakpoint }) {
  const lineCount = bp === "desktop" ? 5 : 3;
  const convergeY = bp === "desktop" ? 0.9 : bp === "tablet" ? 0.69 : 1;
  const bend = bp === "phone" ? 0.4 : 0.45;
  const inset = bp === "phone" ? 40 : 24;
  return (
    <div className={s.beams}>
      <AnimatedBeamLines
        mode="converge"
        lineCount={lineCount}
        flipVertical
        flipHorizontal={false}
        convergeX={0.5}
        convergeY={convergeY}
        bend={bend}
        meetIcon="/assets/7QuYVNK6yeb3hmBB6mc2yJ1DBUg.png"
        meetIconSize={48}
        meetIconBackground="rgb(255, 255, 255)"
        meetIconBorderColor="rgba(0, 0, 0, 0.2)"
        meetIconBorderWidth={1}
        meetIconRadius={999}
        meetIconPadding={10}
        orientation="horizontal"
        curvature={0}
        inset={inset}
        showCards
        cards={verification.real.signals.map((text) => ({ text }))}
        cardBackground="rgb(255, 255, 255)"
        cardTextColor="rgb(0, 0, 0)"
        cardBorderColor="rgba(0, 0, 0, 0.2)"
        cardBorderWidth={1}
        cardRadius={40}
        cardPaddingX={16}
        cardPaddingY={8}
        cardIconSize={18}
        fontSize={16}
        fontWeight={500}
        pathColor="rgba(0, 0, 0, 0.4)"
        pathWidth={2}
        pathOpacity={0.2}
        gradientStartColor="rgb(1, 43, 255)"
        gradientStopColor="rgba(1, 43, 255, 0.2)"
        beamLength={22}
        duration={2}
        delay={0}
        stagger={0.1}
        repeatDelay={0}
        speedVariation={0}
        easing="linear"
        reverse
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Capability card component (qp1dFT5rB), variants 1 .. 6:
 *  1  prompt card (RippleLoader + TextWave A), TextWave B at opacity 0, model chips hidden
 *  2  (onInView, threshold 0.5)  TextWave B visible
 *  3  (+1s) model chips shown, selector and check hidden (opacity 0, scale 0)
 *  4  (+1s) selector behind "Model" (top 0), bordered
 *  5  (+1s) selector behind "Contract" (top 50)
 *  6  (+1s) green check on the "Contract" row
 */

const T = parseTransition("spring-duration 0.4s 0.2 0s");
const AVATARS = ["/assets/8KaKKxU7M28Rzb4GcWcA3KaCnQ4.png", "/assets/D78PPxXxhqJnQlCBn2cmf5ueuQ.png"];

function OrderCard() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref, 0.5);
  const [stage, setStage] = useState(1);

  useEffect(() => {
    if (!seen) return;
    setStage(2);
    const timers = [3, 4, 5, 6].map((n, i) => window.setTimeout(() => setStage(n), (i + 1) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [seen]);

  const { order } = verification;
  const wave = { fontSize: 16, lineHeight: "16px", letterSpacing: "-0.3px", waveWidth: 30, speed: 80, scale: 1.01, delay: 0.2, loop: true, defaultColor: "var(--c-dark-40)", waveInColor: "var(--c-dark)" };

  return (
    <div className={s.order} ref={ref}>
      <div className={s.orderStack}>
        <div className={s.promptCard}>
          <span className={s.ripple}>
            <RippleLoader cellSize={6} spacing={1} radius={4} duration={1.5} cellDelay={0.1} />
          </span>
          <TextWave text={order.waveA} {...wave} />
        </div>
        <motion.div initial={false} animate={{ opacity: stage >= 2 ? 1 : 0 }} transition={T}>
          <TextWave text={order.waveB} {...wave} />
        </motion.div>
        <AnimatePresence initial={false}>
          {stage >= 3 && (
            <motion.div
              key="model"
              className={s.modelContainer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={T}
            >
              {order.chips.map((label, i) => (
                <div className={s.modelInfo} key={label}>
                  <span className={s.avatar} style={{ backgroundImage: `url(${AVATARS[i]})` }} />
                  <p className="body2">{label}</p>
                  {i === 1 && (
                    <motion.span
                      className={s.check}
                      initial={false}
                      animate={{ opacity: stage >= 6 ? 1 : 0, scale: stage >= 5 ? 1 : 0 }}
                      transition={T}
                    >
                      <Check size={24} strokeWidth={2} />
                    </motion.span>
                  )}
                </div>
              ))}
              <motion.span
                className={s.selector}
                initial={false}
                animate={{
                  opacity: stage >= 4 ? 1 : 0,
                  scale: stage >= 4 ? 1 : 0,
                  top: stage >= 5 ? 50 : 0,
                  borderWidth: stage >= 4 ? 1 : 0,
                }}
                style={{ borderStyle: "solid", borderColor: "var(--c-dark-10)" }}
                transition={T}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function Verification() {
  const bp = useBreakpoint();
  const { counts, pay, real, order } = verification;
  return (
    <section id="capabilities" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader
            tag={verification.tag}
            icon={<Anchor size={16} strokeWidth={2} />}
            heading={verification.heading}
            description={verification.description}
            align="center"
            gap={bp === "desktop" ? 32 : 24}
            textGap={16}
            headingMaxWidth={500}
            descriptionMaxWidth={500}
          />
          <div className={s.grid}>
            <CapabilityCard span={1} visual={<MultimodalCard />} title={counts.title} body={counts.body} />
            <CapabilityCard span={2} visual={<PayVideo />} title={pay.title} body={pay.body} />
            <CapabilityCard span={2} visual={<RealBeams bp={bp} />} title={real.title} body={real.body} />
            <CapabilityCard span={1} visual={<OrderCard />} title={order.title} body={order.body} />
          </div>
        </div>
      </div>
    </section>
  );
}
