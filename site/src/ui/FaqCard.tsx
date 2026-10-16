import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { T_DEFAULT } from "../lib/motion";

/**
 * Framer "FAQ card" component (eWWSXuZM8), variants Expanded / Collapsed.
 *  Outer container: border 1px Dark/10%, radius 16, padding 16px 20px, horizontal stack gap 16.
 *  Text content: vertical stack gap 4; question Heading 6, answer Body 3 (hidden when collapsed).
 *  Icon container 24x24 on the right, stroke Dark/60% (Minus when expanded, Plus when collapsed).
 *  White overlay frame (absolute, fill White/100%) behind the content: opacity 1 expanded, 0 collapsed.
 *  Variant transition: spring-duration 0.4s 0.2 0s. The second Collapsed variant (scale 0.98,
 *  icon Dark/100%) is used as the hover state of a collapsed card.
 */
export interface FaqCardProps {
  question: string;
  answer: string;
  expanded: boolean;
  onClick?: () => void;
}

export function FaqCard({ question, answer, expanded, onClick }: FaqCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "clip", cursor: "pointer", outline: "none" }}
    >
      <motion.div
        initial={false}
        whileHover={expanded ? undefined : "hover"}
        variants={{ hover: { scale: 0.98 } }}
        transition={T_DEFAULT}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "16px 20px",
          borderRadius: 16,
          border: "1px solid var(--c-dark-10)",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 4, flex: "1 1 0px", minWidth: 0, overflow: "clip" }}>
          <h3 className="h6" style={{ width: "100%", textAlign: "left" }}>
            {question}
          </h3>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="answer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={T_DEFAULT}
                style={{ width: "100%", overflow: "hidden" }}
              >
                <p className="body3" style={{ width: "100%", textAlign: "left" }}>
                  {answer}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.div
          aria-hidden="true"
          variants={{ hover: { color: "var(--c-dark)" } }}
          style={{ width: 24, height: 24, flex: "0 0 24px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-dark-60)", overflow: "clip" }}
        >
          {expanded ? <Minus size={24} strokeWidth={1.5} /> : <Plus size={24} strokeWidth={1.5} />}
        </motion.div>
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={T_DEFAULT}
        style={{ position: "absolute", inset: 0, zIndex: 0, background: "var(--c-white)", borderRadius: 16 }}
      />
    </div>
  );
}
