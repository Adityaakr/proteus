import type { CSSProperties } from "react";
import s from "./ui.module.css";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** Render n stacked lines. */
  lines?: number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 14, radius = 8, lines, className, style }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <span aria-hidden style={{ display: "flex", flexDirection: "column", gap: 8, width }}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={[s.skeleton, className].filter(Boolean).join(" ")} style={{ height, borderRadius: radius, width: i === lines - 1 ? "60%" : "100%", ...style }} />
        ))}
      </span>
    );
  }
  return <span aria-hidden className={[s.skeleton, className].filter(Boolean).join(" ")} style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A full-card loading placeholder with a polite live status for screen readers. */
export function LoadingCard({ label = "Loading", lines = 4 }: { label?: string; lines?: number }) {
  return (
    <div className={s.card} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton width="40%" height={20} />
      <Skeleton lines={lines} />
    </div>
  );
}
