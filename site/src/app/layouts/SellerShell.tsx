import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutGroup, motion } from "framer-motion";
import { T_DEFAULT } from "../../lib/motion";
import { NetworkBadge, StatusTag } from "../ui/StatusTag";
import { Wordmark } from "./Wordmark";
import "../app.css";
import s from "./shells.module.css";

/**
 * SellerShell contract (used by site/src/app/seller/**):
 *  - 240px sidebar with the wordmark and nav, active item drawn as a pill
 *  - sticky top bar with page title, the sandbox tag and an actions slot
 *  - bottom tab bar on phone widths (< 810px); sidebar hidden there
 *  - skip link to #seller-main
 */
export interface SellerNavItem {
  label: string;
  to: string;
  icon?: ReactNode;
  /** Match the route exactly (use for index routes like "/app"). */
  end?: boolean;
}

export interface SellerShellProps {
  nav: SellerNavItem[];
  children: ReactNode;
  /** Top bar title (defaults to the active nav label). */
  title?: ReactNode;
  /** Org label for the sandbox tag. Default "sandbox". */
  orgLabel?: "sandbox" | "live";
  orgName?: string;
  /** Right side of the top bar. */
  actions?: ReactNode;
  /** Bottom of the sidebar. */
  sidebarFooter?: ReactNode;
}

export function SellerShell({ nav, children, title, orgLabel = "sandbox", orgName, actions, sidebarFooter }: SellerShellProps) {
  const { pathname } = useLocation();
  const isActive = (it: SellerNavItem) => (it.end ? pathname === it.to || pathname === it.to + "/" : pathname === it.to || pathname.startsWith(it.to.endsWith("/") ? it.to : it.to + "/"));
  // Pick the most specific active item so "/app" does not stay active under "/app/deals".
  const active = nav.filter(isActive).sort((a, b) => b.to.length - a.to.length)[0];
  const heading = title ?? active?.label ?? "Console";

  return (
    <div data-app className={s.seller}>
      <a href="#seller-main" className="app-skip-link">Skip to content</a>
      <aside className={s.sidebar} aria-label="Seller console">
        <div className={s.sideBrand}>
          <Wordmark to={nav[0]?.to ?? "/app"} />
        </div>
        <LayoutGroup id="seller-side">
          <nav aria-label="Seller sections" className={s.sideNav}>
            {nav.map((it) => {
              const on = active === it;
              return (
                <NavLink key={it.to} to={it.to} end={it.end} className={`${s.sideItem} ${on ? s.sideItemActive : ""}`} aria-current={on ? "page" : undefined}>
                  {on && <motion.span layoutId="seller-pill" className={s.activePill} transition={T_DEFAULT} aria-hidden />}
                  {it.icon && <span className={s.sideIcon} aria-hidden>{it.icon}</span>}
                  <span className={s.sideLabel}>{it.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </LayoutGroup>
        <div className={s.sideFoot}>
          {orgName && <p className="body3">{orgName}</p>}
          {sidebarFooter}
        </div>
      </aside>
      <div className={s.sellerCol}>
        <header className={s.sellerTop}>
          <span className={s.mobileBrand}>
            <Wordmark to={nav[0]?.to ?? "/app"} />
          </span>
          <div className={s.sellerTitle}>
            {typeof heading === "string" ? <h1 className="h5">{heading}</h1> : heading}
          </div>
          {actions}
          <StatusTag network={orgLabel === "sandbox" ? "sandbox" : "live"} label={orgLabel === "sandbox" ? "Sandbox seller" : "Live seller"} />
          <span className="hide-phone"><NetworkBadge /></span>
        </header>
        <main id="seller-main" tabIndex={-1} className={s.sellerMain}>
          {children}
        </main>
      </div>
      <LayoutGroup id="seller-tabs">
        <nav aria-label="Seller sections" className={s.tabbar}>
          {nav.map((it) => {
            const on = active === it;
            return (
              <NavLink key={it.to} to={it.to} end={it.end} className={`${s.tabItem} ${on ? s.tabItemActive : ""}`} aria-current={on ? "page" : undefined}>
                {on && <motion.span layoutId="seller-tab-pill" className={s.activePill} transition={T_DEFAULT} aria-hidden />}
                {it.icon && <span className={s.sideIcon} aria-hidden>{it.icon}</span>}
                <span className={s.tabLabel}>{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}
