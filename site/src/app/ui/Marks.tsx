import type { CSSProperties } from "react";

/** The Arc network mark (arc.io), dark ink. */
export function ArcMark({ size = 14, style }: { size?: number; style?: CSSProperties }) {
  return <img src="/assets/arc-icon.svg" alt="" width={size} height={size} style={{ width: size, height: size, display: "inline-block", flex: "none", ...style }} aria-hidden />;
}

/** The USDC token mark (Circle). */
export function UsdcMark({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return <img src="/assets/usdc.svg" alt="" width={size} height={size} style={{ width: size, height: size, display: "inline-block", flex: "none", borderRadius: "50%", ...style }} aria-hidden />;
}

/** The Circle mark (circle.com), dark ink. */
export function CircleMark({ size = 14, style }: { size?: number; style?: CSSProperties }) {
  return <img src="/assets/circle-mark.svg" alt="" width={size} height={size} style={{ width: size, height: size, display: "inline-block", flex: "none", ...style }} />;
}

/** The Circle wordmark, dark ink. Height sets the size; width follows the 410:111 ratio. */
export function CircleWordmark({ height = 14, style }: { height?: number; style?: CSSProperties }) {
  const width = Math.round(height * (410 / 111));
  return <img src="/assets/circle-wordmark.svg" alt="Circle" width={width} height={height} style={{ width, height, display: "inline-block", flex: "none", ...style }} />;
}
