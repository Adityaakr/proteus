import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Appear } from "../lib/Appear";
import { parseTransition } from "../lib/motion";
import { useInViewOnce } from "../lib/useScrollTarget";

/**
 * Framer "User roles card" (ezA3Bb8pm), remixed as the Proteus AI approvals card.
 * Four variants cycle once the card is 50% in view (onInView 1 -> 2, then a timed loop):
 *  1  cursor off-card, dropdown hidden
 *  2  cursor enters next to the first row's pill
 *  3  first pill border turns Primary, the option dropdown opens, cursor moves onto it
 *  4  dropdown closes, cursor leaves (same as 1)
 * Layer transition: spring-duration 2s 0.2 0s. Avatars are the PNGs from the export.
 */
export interface ApprovalsData {
  campaign: string;
  meta: string;
  heading: string;
  rows: { handle: string; note: string; action: string }[];
  you: string;
  menu: string[];
}

export interface ApprovalsCardProps {
  data: ApprovalsData;
  /** `$control__avatarVisible`: false on tablet and phone in the export. */
  avatarVisible?: boolean;
  className?: string;
  style?: CSSProperties;
}

const T = parseTransition("spring-duration 2s 0.2 0s");
const STEP_MS = 2500;

const FOLDER_ICON = "/assets/Uwu6oCqaeQirmXZy5Q37Nkh5gE.png";
const AVATARS = [
  "/assets/YbIkbpKaq9pmlSfHIsww2gkTTJ4.png",
  "/assets/nKIuCad9RRDJNuMGgFOiKx2ok.png",
  "/assets/cs3yZGn9FSQ4XwD6sY1pFBvg0k.png",
  "/assets/E6Vvalfnflvfo6p24k9l0apIXc.png",
];

/* Cursor frame (uuIKzHXZp) offsets per variant: right / bottom in px. */
const CURSOR: Record<1 | 2 | 3 | 4, { right: number; bottom: number }> = {
  1: { right: -100, bottom: -100 },
  2: { right: -1, bottom: 219 },
  3: { right: -13, bottom: 149 },
  4: { right: -100, bottom: -100 },
};

export function ApprovalsCard({ data, avatarVisible = true, className, style }: ApprovalsCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref, 0.5);
  const [variant, setVariant] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    if (!seen) return;
    const order: (2 | 3 | 4)[] = [2, 3, 4];
    let i = 0;
    setVariant(order[0]);
    const t = setInterval(() => {
      i = (i + 1) % order.length;
      setVariant(order[i]);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [seen]);

  const open = variant === 3;
  const cursor = CURSOR[variant];

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 24,
        padding: 24,
        border: "1px solid var(--c-white-10)",
        background: "var(--c-white-80)",
        borderRadius: 24,
        overflow: "clip",
        ...style,
      }}
    >
      {/* n69plX9oV Folder Header */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, width: "100%" }}>
        <div
          aria-hidden
          style={{ width: 44, height: 44, borderRadius: 1000, flex: "none", backgroundImage: `url(${FOLDER_ICON})`, backgroundSize: "cover", backgroundPosition: "center", overflow: "clip" }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, flex: "1 0 0", minWidth: 0 }}>
          <h6 className="h6" style={{ width: "100%" }}>{data.campaign}</h6>
          <p className="body3" style={{ width: "100%" }}>{data.meta}</p>
        </div>
      </div>

      {/* SeNSIg1vP Invite Controls */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, paddingTop: 16, width: "100%" }}>
        <h6 className="h6" style={{ width: "100%" }}>{data.heading}</h6>
      </div>

      {/* Ky8USarW0 Access Section > m9yvuAFcN Access List */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 24, paddingTop: 8, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 24, width: "100%" }}>
          {data.rows.map((row, i) => (
            <div key={row.handle} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, flex: "1 0 0", minWidth: 0 }}>
                {avatarVisible && (
                  <div
                    aria-hidden
                    data-avatar
                    style={{ width: 40, height: 40, borderRadius: "100%", flex: "none", backgroundImage: `url(${AVATARS[i % AVATARS.length]})`, backgroundSize: "cover", backgroundPosition: "center", overflow: "clip" }}
                  />
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, flex: "1 0 0", minWidth: 0 }}>
                  <h6 className="h6" style={{ width: "100%" }}>{row.handle}</h6>
                  <p className="body3" style={{ width: "100%" }}>{row.note}</p>
                </div>
              </div>
              {/* ykcVWo0gY Permission Select: border Dark 20%, Primary on the first row in variant 3 */}
              <motion.div
                initial={false}
                animate={{ borderColor: i === 0 && open ? "rgb(1, 43, 255)" : "rgba(0, 0, 0, 0.2)" }}
                transition={T}
                style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid rgba(0, 0, 0, 0.2)", borderRadius: 1000, overflow: "clip", flex: "none" }}
              >
                <p className="body3" style={{ color: "var(--c-dark)", whiteSpace: "nowrap" }}>{row.action}</p>
                <span style={{ width: 16, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--c-dark-80)" }}>
                  <ChevronDown size={16} strokeWidth={2} />
                </span>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* NXaoKzcjl Option container: visible only in variant 3 */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={T}
            style={{
              position: "absolute",
              right: 8,
              bottom: 158,
              width: 138,
              height: 106,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              padding: 16,
              border: "1px solid var(--c-dark-10)",
              background: "var(--c-white)",
              borderRadius: 16,
              overflow: "clip",
              zIndex: 1,
            }}
          >
            {/* uYTWht93X Overlay: Secondary 20%, appear fade (spring 0.4s 0.2, delay 0.5s) */}
            <Appear
              preset="fade-fast"
              aria-hidden
              style={{ position: "absolute", left: 6, right: 6, top: "50%", marginTop: -16, height: 32, borderRadius: 8, background: "var(--c-secondary-20)", zIndex: 0 }}
            />
            {data.menu.map((item) => (
              <p key={item} className="body3" style={{ position: "relative", zIndex: 1, width: "100%", whiteSpace: "nowrap" }}>
                {item}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* uuIKzHXZp Cursor (90 x 62): arrow + "Owner" comment pill */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ right: cursor.right, bottom: cursor.bottom }}
        transition={T}
        style={{ position: "absolute", width: 90, height: 62, zIndex: 2, pointerEvents: "none" }}
      >
        <svg width={26} height={26} viewBox="0 0 26 26" fill="none" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M4 3 L4 20.5 L8.6 16.2 L12 23.5 L15.4 22 L12 14.8 L18.6 14.8 Z" fill="rgb(21, 111, 238)" stroke="rgb(255, 255, 255)" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 22,
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            padding: "8px 16px",
            border: "2px solid rgba(21, 111, 238, 1)",
            background: "rgba(21, 111, 238, 1)",
            borderRadius: 24,
            whiteSpace: "nowrap",
          }}
        >
          <p className="body2" style={{ color: "var(--c-white)" }}>{data.you}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
