import { useEffect, useState, type CSSProperties } from "react";

/**
 * Re-implementation of the Framer "RippleLoader": a 3x3 grid of rounded cells whose color
 * ripples outward from the center. Instances in the export use cellSize 6, spacing 1,
 * radius 4, duration 1.5s, cellDelay 0.1s, start/end Primary, transparent background.
 */
export interface RippleLoaderProps {
  cellSize?: number;
  spacing?: number;
  radius?: number;
  duration?: number;
  cellDelay?: number;
  start?: string;
  end?: string;
  grid?: number;
  style?: CSSProperties;
}

export function RippleLoader({
  cellSize = 6,
  spacing = 1,
  radius = 4,
  duration = 1.5,
  cellDelay = 0.1,
  start = "var(--token-cfa89a90-dbbb-4892-b359-3cd7c161f4ad)",
  end = "var(--token-cfa89a90-dbbb-4892-b359-3cd7c161f4ad)",
  grid = 3,
  style,
}: RippleLoaderProps) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT(((now - t0) / 1000) % duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  const c = (grid - 1) / 2;
  const cells = [];
  for (let y = 0; y < grid; y++)
    for (let x = 0; x < grid; x++) {
      const ring = Math.max(Math.abs(x - c), Math.abs(y - c));
      const phase = (t - ring * cellDelay + duration) % duration;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin((phase / duration) * Math.PI));
      cells.push(
        <span
          key={`${x}-${y}`}
          style={{ width: cellSize, height: cellSize, borderRadius: radius, background: ring % 2 ? end : start, opacity: a, display: "block" }}
        />,
      );
    }
  return (
    <span
      aria-hidden
      style={{ display: "grid", gridTemplateColumns: `repeat(${grid}, ${cellSize}px)`, gap: spacing, width: grid * cellSize + (grid - 1) * spacing, height: grid * cellSize + (grid - 1) * spacing, ...style }}
    >
      {cells}
    </span>
  );
}
