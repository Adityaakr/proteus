import { useMemo } from "react";
import { encodeQr, qrPath } from "./qr";
import w from "./wallet.module.css";

/** QR code of a wallet address, rendered as crisp SVG. Returns null if the value cannot be encoded. */
export function Qr({ value, className }: { value: string; className?: string }) {
  const m = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      return null;
    }
  }, [value]);
  if (!m) return null;
  const dim = m.size + 8;
  return (
    <svg className={className ?? w.qr} viewBox={`0 0 ${dim} ${dim}`} role="img" aria-label="QR code of your wallet address" shapeRendering="crispEdges">
      <rect width={dim} height={dim} fill="#fff" />
      <path d={qrPath(m)} fill="#0b0b0f" />
    </svg>
  );
}
