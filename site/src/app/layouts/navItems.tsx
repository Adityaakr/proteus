/** Sidebar items for the app shell. Kept apart from AppShell so the menu can be checked without rendering the shell. */
import type { ReactNode } from "react";
import { Activity, BarChart3, Briefcase, Code2, Handshake, Home, Landmark, LayoutDashboard, MessagesSquare, Package, ShieldCheck, SlidersHorizontal, Store, Users, Wallet } from "lucide-react";

export interface AppNavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** Match the route exactly (index routes such as "/app"). */
  end?: boolean;
  /** Shorter label for the phone tab bar. */
  short?: string;
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
  { label: "Developers", to: "/app/sell/developers", icon: ic(Code2) },
  { label: "Seller settings", to: "/app/sell/settings", icon: ic(SlidersHorizontal) },
];

