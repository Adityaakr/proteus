import type { CSSProperties } from "react";

/** The Arc network mark (arc.io), dark ink. */
export function ArcMark({ size = 14, style }: { size?: number; style?: CSSProperties }) {
  return <img src="/assets/arc-icon.svg" alt="" width={size} height={size} style={{ width: size, height: size, display: "inline-block", flex: "none", ...style }} aria-hidden />;
}

/** The USDC token mark (Circle). */
export function UsdcMark({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return <img src="/assets/usdc.svg" alt="" width={size} height={size} style={{ width: size, height: size, display: "inline-block", flex: "none", borderRadius: "50%", ...style }} aria-hidden />;
}
