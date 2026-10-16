import { useEffect, useState } from "react";

/** Framer breakpoints from layout-template.json: Desktop >=1200, Tablet 810-1199.98, Phone <=809.98. */
export type Breakpoint = "desktop" | "tablet" | "phone";

const Q_TABLET = "(max-width: 1199.98px)";
const Q_PHONE = "(max-width: 809.98px)";

function read(): Breakpoint {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(Q_PHONE).matches) return "phone";
  if (window.matchMedia(Q_TABLET).matches) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read);
  useEffect(() => {
    const a = window.matchMedia(Q_TABLET);
    const b = window.matchMedia(Q_PHONE);
    const on = () => setBp(read());
    a.addEventListener("change", on);
    b.addEventListener("change", on);
    on();
    return () => {
      a.removeEventListener("change", on);
      b.removeEventListener("change", on);
    };
  }, []);
  return bp;
}
