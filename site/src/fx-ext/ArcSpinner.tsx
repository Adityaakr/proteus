import type { CSSProperties } from "react";

/**
 * Re-implementation of the Framer "ArcSpinner": a rotating arc over a faint track.
 * Export values: color Brand/Primary, track 0.1, stroke 2, duration 1s, clockwise.
 */
export interface ArcSpinnerProps {
  size?: number;
  color?: string;
  track?: number;
  stroke?: number;
  duration?: number;
  animate?: boolean;
  style?: CSSProperties;
  label?: string;
}

export function ArcSpinner({ size = 16, color = "var(--c-primary)", track = 0.1, stroke = 2, duration = 1, animate = true, style, label = "Loading" }: ArcSpinnerProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={style}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.28} ${c}`}
        style={{ transformOrigin: "50% 50%", animation: animate ? `arc-spin ${duration}s linear infinite` : undefined }}
      />
      <style>{`@keyframes arc-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
