import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { nav } from "../content/proteus";
import { Button } from "../ui/Button";
import { useBreakpoint } from "../ui/useBreakpoint";
import { parseTransition } from "../lib/motion";
import s from "./Nav.module.css";

const LOGO = "/assets/proteus-ai-wordmark.png";

/** Phone Closed -> Open: spring-duration 0.35s 0.25 0s. Open -> Closed: tween 0.44,0,0.56,1 0.35s. */
const T_OPEN = parseTransition("spring-duration 0.35s 0.25 0s");
const T_CLOSE = parseTransition("tween 0.44,0,0.56,1 0.35s 0s");

/**
 * Framer "Navigation bar" (component-Navigation_bar__UXHe4J1PZ.json): Desktop variant at
 * >=1200px, the Phone Closed / Phone Open variants below (layout-template.json gives the Tablet
 * breakpoint the Phone Closed variant too).
 */
export function Nav() {
  const bp = useBreakpoint();
  const phone = bp !== "desktop";
  const [open, setOpen] = useState(false);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const f = () => setVh(window.innerHeight);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  useEffect(() => {
    if (!phone) setOpen(false);
  }, [phone]);

  const showMenu = phone && open;
  const T = showMenu ? T_OPEN : T_CLOSE;
  const close = () => setOpen(false);

  return (
    <div className={s.wrap}>
      <motion.nav
        className={`${s.nav} ${phone ? s.phone : s.desktop}`}
        initial={false}
        animate={{ minHeight: showMenu ? `${vh}px` : "0px" }}
        transition={T}
      >
        <div className={s.logoRow}>
          <a className={s.logo} href="/#hero">
            <img src={LOGO} alt="" width={137} height={26} />
          </a>
          {phone && (
            <button type="button" className={s.trigger} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {(!phone || open) && (
            <motion.ul
              key="links"
              className={s.links}
              initial={phone ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={T}
            >
              {nav.items.map((item) => (
                <li key={item.href}>
                  <a className={`body2 ${s.link}`} href={item.href} onClick={close}>
                    {item.label}
                  </a>
                </li>
              ))}
            </motion.ul>
          )}
          {(!phone || open) && (
            <motion.div
              key="actions"
              className={s.actions}
              initial={phone ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={T}
            >
              <Button label={nav.secondary.label} href={nav.secondary.href} variant="secondary" size="small" icon={false} />
              <Button label={nav.primary.label} href={nav.primary.href} variant="primary" size="small" icon={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}
