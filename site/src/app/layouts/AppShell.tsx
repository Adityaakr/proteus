/**
 * AppShell: the signed in dashboard frame for every /app route (buy and sell).
 *  - 240px sidebar: Buy group [Home, Market, Negotiations, Deals, Wallet] and Sell group
 *    ["Start selling" until the account has an org, then Products, Negotiations, Approvals, Deals, Finance]
 *  - sticky top bar: page title, actions slot, network badge, account menu
 *  - bottom tab bar on phone widths (< 810px); sidebar hidden there
 *  - skip link to #app-main
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Activity, BarChart3, Briefcase, ChevronDown, Handshake, Home, KeyRound, Landmark, LayoutDashboard, LogOut, MessagesSquare, Package, Settings, ShieldCheck, SlidersHorizontal, Store, Users, Wallet } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { NetworkBadge, StatusTag } from "../ui/StatusTag";
import { CopyButton, shortHex } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { isMock } from "../lib/api";
import { Wordmark } from "./Wordmark";
import { SANDBOX_TEXT } from "./SandboxNote";
import "../app.css";
import s from "./shells.module.css";

export { SandboxNote, SANDBOX_TEXT } from "./SandboxNote";

export interface AppNavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** Match the route exactly (index routes such as "/app"). */
  end?: boolean;
  /** Shorter label for the phone tab bar. */
  short?: string;
}

export interface AppShellProps {
  children: ReactNode;
  /** Top bar title. Defaults to the active nav label. */
  title?: ReactNode;
  /** Right side of the top bar, before the account menu. */
  actions?: ReactNode;
}

const ic = (C: typeof Home) => <C size={17} strokeWidth={1.9} />;

export const BUY_NAV: AppNavItem[] = [
  { label: "Home", to: "/app", icon: ic(Home), end: true },
  { label: "Market", to: "/app/market", icon: ic(Store) },
  { label: "Negotiations", to: "/app/negotiations", icon: ic(MessagesSquare) },
  { label: "Deals", to: "/app/deals", icon: ic(Handshake) },
  { label: "Wallet", to: "/app/wallet", icon: ic(Wallet) },
];

export const SELL_NAV_START: AppNavItem[] = [{ label: "Start selling", to: "/app/sell", icon: ic(Briefcase), short: "Sell" }];

export const SELL_NAV_ORG: AppNavItem[] = [
  { label: "Overview", to: "/app/sell", icon: ic(LayoutDashboard), end: true },
  { label: "Negotiations", to: "/app/sell/negotiations", icon: ic(MessagesSquare) },
  { label: "Deals", to: "/app/sell/deals", icon: ic(Handshake) },
  { label: "Customers", to: "/app/sell/customers", icon: ic(Users) },
  { label: "Products & pricing", to: "/app/sell/products", icon: ic(Package) },
  { label: "Payments", to: "/app/sell/payments", icon: ic(Landmark) },
  { label: "Usage & delivery", to: "/app/sell/usage", icon: ic(Activity) },
  { label: "Insights", to: "/app/sell/insights", icon: ic(BarChart3) },
  { label: "Agent policies", to: "/app/sell/policies", icon: ic(ShieldCheck) },
  { label: "Settings", to: "/app/sell/settings", icon: ic(SlidersHorizontal) },
];

const SETTINGS: AppNavItem = { label: "Settings", to: "/app/settings", icon: ic(Settings) };

function matches(pathname: string, it: AppNavItem) {
  if (it.end) return pathname === it.to || pathname === it.to + "/";
  return pathname === it.to || pathname.startsWith(it.to + "/");
}

export function AppShell({ children, title, actions }: AppShellProps) {
  const { pathname } = useLocation();
  const { me } = useAuth();
  const hasOrg = Boolean(me?.org);
  const sell = hasOrg ? SELL_NAV_ORG : SELL_NAV_START;
  const all = [...BUY_NAV, ...sell, SETTINGS];
  // Most specific match wins, so "/app" is not active under "/app/deals". Under /app/sell with an
  // org but no specific section (the sell overview), nothing in the Sell group is forced active.
  const active = all.filter((it) => matches(pathname, it)).sort((a, b) => b.to.length - a.to.length)[0];
  const heading = title ?? active?.label ?? "PROTEUS";
  const tabs: AppNavItem[] = [BUY_NAV[0]!, BUY_NAV[1]!, BUY_NAV[3]!, BUY_NAV[4]!, { label: hasOrg ? "Selling" : "Start selling", short: "Sell", to: "/app/sell", icon: ic(Briefcase) }];
  const tabActive = tabs.filter((it) => matches(pathname, it)).sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <div data-app className={s.seller}>
      <a href="#app-main" className="app-skip-link">Skip to content</a>
      <aside className={s.sidebar} aria-label="PROTEUS">
        <div className={s.sideBrand}>
          <Wordmark to="/app" />
        </div>
        <LayoutGroup id="app-side">
          <nav aria-label="Main" className={s.sideNav}>
            <NavGroup label="Buy" items={BUY_NAV} active={active} />
            <NavGroup label="Sell" items={sell} active={active} />
          </nav>
          <div className={s.sideFoot}>
            <nav aria-label="Account" className={s.sideNav}>
              <SideItem it={SETTINGS} on={active === SETTINGS} />
            </nav>
            <p className={s.sideSandbox}>{SANDBOX_TEXT}</p>
          </div>
        </LayoutGroup>
      </aside>
      <div className={s.sellerCol}>
        <header className={s.sellerTop}>
          <span className={s.mobileBrand}>
            <Wordmark to="/app" />
          </span>
          <div className={s.sellerTitle}>{typeof heading === "string" ? <h1 className="h5">{heading}</h1> : heading}</div>
          {actions}
          {isMock() && <span className="hide-phone"><StatusTag network="illustrative" label="Mock data" /></span>}
          <NetworkBadge network="testnet" />
          <AccountMenu />
        </header>
        <main id="app-main" tabIndex={-1} className={s.sellerMain}>
          {children}
        </main>
      </div>
      <LayoutGroup id="app-tabs">
        <nav aria-label="Main" className={s.tabbar}>
          {tabs.map((it) => {
            const on = tabActive === it;
            return (
              <NavLink key={it.to} to={it.to} end={it.end} className={`${s.tabItem} ${on ? s.tabItemActive : ""}`} aria-current={on ? "page" : undefined}>
                {on && <motion.span layoutId="app-tab-pill" className={s.activePill} transition={T_DEFAULT} aria-hidden />}
                <span className={s.sideIcon} aria-hidden>{it.icon}</span>
                <span className={s.tabLabel}>{it.short ?? it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}

export default AppShell;

function NavGroup({ label, items, active }: { label: string; items: AppNavItem[]; active?: AppNavItem }) {
  const id = useId();
  return (
    <div className={s.navGroup} role="group" aria-labelledby={id}>
      <span id={id} className={s.groupLabel}>{label}</span>
      {items.map((it) => (
        <SideItem key={it.to} it={it} on={active === it} />
      ))}
    </div>
  );
}

function SideItem({ it, on }: { it: AppNavItem; on: boolean }) {
  return (
    <NavLink to={it.to} end={it.end} className={`${s.sideItem} ${on ? s.sideItemActive : ""}`} aria-current={on ? "page" : undefined}>
      {on && <motion.span layoutId="app-pill" className={s.activePill} transition={T_DEFAULT} aria-hidden />}
      <span className={s.sideIcon} aria-hidden>{it.icon}</span>
      <span className={s.sideLabel}>{it.label}</span>
    </NavLink>
  );
}

function AccountMenu() {
  const { user, wallet, logout, exportWallet } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = user?.email ?? (wallet ? shortHex(wallet.address) : "Account");
  const initial = (user?.email?.[0] ?? "P").toUpperCase();

  return (
    <div className={s.acct} ref={ref}>
      <button ref={btnRef} type="button" className={s.acctBtn} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
        <span className={s.acctAvatar} aria-hidden>{initial}</span>
        <span className={`${s.acctName} hide-phone`}>{name}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="hide-phone" />
        <span className="sr-only">Account menu</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Account"
            className={s.menu}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={T_DEFAULT}
          >
            <div className={s.menuHead}>
              <strong>{user?.email ?? "Signed in"}</strong>
              {wallet && (
                <span className={s.menuAddr}>
                  <span className="app-mono">{shortHex(wallet.address)}</span>
                  <CopyButton value={wallet.address} label="Copy wallet address" />
                </span>
              )}
              <span className="body3">{wallet?.type === "external" ? "External wallet" : "Embedded wallet"} on Arc testnet</span>
            </div>
            <Link role="menuitem" to="/app/wallet" className={s.menuItem} onClick={() => setOpen(false)}>
              <Wallet size={16} strokeWidth={2} aria-hidden /> Wallet
            </Link>
            {wallet?.type !== "external" && (
              <button
                role="menuitem"
                type="button"
                className={s.menuItem}
                onClick={() => {
                  setOpen(false);
                  void exportWallet().catch(() => {});
                }}
              >
                <KeyRound size={16} strokeWidth={2} aria-hidden /> Export key
              </button>
            )}
            <Link role="menuitem" to="/app/settings" className={s.menuItem} onClick={() => setOpen(false)}>
              <Settings size={16} strokeWidth={2} aria-hidden /> Settings
            </Link>
            <button
              role="menuitem"
              type="button"
              className={s.menuItem}
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate("/", { replace: true });
              }}
            >
              <LogOut size={16} strokeWidth={2} aria-hidden /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
