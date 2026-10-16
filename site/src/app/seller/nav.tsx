import { Gauge, Handshake, Landmark, MessagesSquare, Package, Settings, ShieldCheck } from "lucide-react";
import { SELL } from "./paths";

/**
 * Sell-side navigation (mounted at /app/sell). Only sections that exist in this build are listed:
 * Customers, Usage, Audit and Team are in the spec but intentionally absent.
 */
export const SELLER_NAV = [
  { label: "Overview", to: SELL, icon: <Gauge size={16} strokeWidth={2} />, end: true },
  { label: "Products", to: `${SELL}/products`, icon: <Package size={16} strokeWidth={2} /> },
  { label: "Negotiations", to: `${SELL}/negotiations`, icon: <MessagesSquare size={16} strokeWidth={2} /> },
  { label: "Approvals", to: `${SELL}/approvals`, icon: <ShieldCheck size={16} strokeWidth={2} /> },
  { label: "Deals", to: `${SELL}/deals`, icon: <Handshake size={16} strokeWidth={2} /> },
  { label: "Finance", to: `${SELL}/finance`, icon: <Landmark size={16} strokeWidth={2} /> },
  { label: "Settings", to: `${SELL}/settings`, icon: <Settings size={16} strokeWidth={2} /> },
];
