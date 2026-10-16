import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Re-implementation of the Framer "Text Wave" component as used in this template:
 * per-letter color wave that sweeps left to right, looping on appear.
 * Defaults match the instances in the export (per Letter, waveWidth 30, speed 80,
 * scale 1.01, delay 0.2s, loop true, defaultColor Dark 40%, waveInColor Dark).
 */
export interface TextWaveProps {
  text: string;
  defaultColor?: string;
  waveInColor?: string;
  waveWidth?: number; // percent of the text width the highlight spans
  speed?: number; // percent per second
  scale?: number;
  delay?: number;
  loop?: boolean;
  fontSize?: number;
  lineHeight?: string;
  letterSpacing?: string;
  fontWeight?: number;
  style?: CSSProperties;
  className?: string;
}

export function TextWave({
  text,
  defaultColor = "var(--c-dark-40)",
  waveInColor = "var(--c-dark)",
  waveWidth = 30,
  speed = 80,
  scale = 1.01,
  delay = 0.2,
  loop = true,
  fontSize = 16,
  lineHeight = "16px",
  letterSpacing = "-0.3px",
  fontWeight = 400,
  style,
  className,
}: TextWaveProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState(-waveWidth); // wave head in % of text length
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setRunning(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let start: number | null = null;
    const total = 100 + waveWidth * 2;
    const tick = (t: number) => {
      if (start === null) start = t + delay * 1000;
      const elapsed = Math.max(0, (t - start) / 1000);
      let p = (elapsed * speed) % (total + 40); // 40% pause between loops
      if (!loop && elapsed * speed > total) p = total;
      setPos(p - waveWidth);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, waveWidth, delay, loop]);

  const letters = Array.from(text);
  const n = letters.length;
  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block", whiteSpace: "pre", fontFamily: "var(--font-body)", fontSize, lineHeight, letterSpacing, fontWeight, color: defaultColor, ...style }}
      aria-label={text}
    >
      {letters.map((ch, i) => {
        const center = ((i + 0.5) / n) * 100;
        const d = Math.abs(center - pos);
        const k = Math.max(0, 1 - d / waveWidth); // 1 at the wave head, 0 outside
        return (
          <span
            key={i}
            aria-hidden
            style={{
              display: "inline-block",
              color: k > 0 ? waveInColor : defaultColor,
              opacity: k > 0 ? 1 : undefined,
              transform: `scale(${1 + (scale - 1) * k})`,
              transition: "color 120ms linear",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
