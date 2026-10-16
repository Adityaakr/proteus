import { useEffect, useState } from "react";

/**
 * Framer "scrollVariantEffect" with trigger onScrollTarget: as each target section crosses
 * the viewport threshold, the active id updates. Used by the Decisions tab indicators.
 * Returns the id of the most recently intersecting target (threshold 0.5), or null.
 */
export function useScrollTarget(ids: string[], threshold = 0.5): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { threshold },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join("|"), threshold]);
  return active;
}

/** Framer "onInView" variant switch (replay false): true once the element has been 50% visible. */
export function useInViewOnce(ref: React.RefObject<HTMLElement | null>, threshold = 0.5): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, seen]);
  return seen;
}
