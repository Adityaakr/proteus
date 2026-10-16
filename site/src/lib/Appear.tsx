import { motion, type HTMLMotionProps } from "framer-motion";
import { appearVariants, VIEWPORT_ONCE, type AppearPreset } from "./motion";

type Props = HTMLMotionProps<"div"> & { preset?: AppearPreset; as?: "div" | "section" | "span" | "li" };

/** Wraps children in the Framer "appear" effect (fade / pop from scale 0) once in view. */
export function Appear({ preset = "pop", as = "div", children, style, ...rest }: Props) {
  const Comp = (motion as unknown as Record<string, typeof motion.div>)[as] ?? motion.div;
  return (
    <Comp
      variants={appearVariants(preset)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      style={{ transformOrigin: "50% 50%", ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
