import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { ArcSpinner } from "../fx-ext/ArcSpinner";

/**
 * Framer "UI card loading" component (XQfVZNDnD): a horizontal row, padding 12px 16px, gap 16,
 * Body 3 title filling the row. Variants:
 *  Loading    ArcSpinner 24px (Brand/Primary, track 0.1, stroke 2, 1s clockwise) before the title
 *  Completed  Check icon 24px, stroke "Active" green, before the title
 */
export interface UiCardLoadingProps {
  title: string;
  variant?: "Loading" | "Completed";
  style?: CSSProperties;
  className?: string;
}

const ACTIVE_GREEN = "var(--token-03157c8f-9190-4af0-ae5c-b10d22f4922d, rgb(43, 182, 115))";

export function UiCardLoading({ title, variant = "Loading", style, className }: UiCardLoadingProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "12px 16px",
        width: "100%",
        overflow: "clip",
        ...style,
      }}
    >
      <span style={{ width: 24, height: 24, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {variant === "Completed" ? (
          <Check size={24} strokeWidth={2} color={ACTIVE_GREEN} aria-hidden />
        ) : (
          <ArcSpinner size={24} color="var(--token-b48b7134-7ad2-4f07-b792-c7a8003d791a)" track={0.1} stroke={2} duration={1} label="Loading" />
        )}
      </span>
      <p className="body3" style={{ flex: "1 1 0", minWidth: 0, textAlign: "start" }}>
        {title}
      </p>
    </div>
  );
}
