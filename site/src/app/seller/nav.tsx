import { Gauge, Handshake, Landmark, MessagesSquare, Package, ShieldCheck } from "lucide-react";

/**
 * Seller console navigation. Only sections that exist in this build are listed:
 * Customers, Usage, Audit, Team and Settings are in the spec but intentionally absent.
 */
export const SELLER_NAV = [
  { label: "Overview", to: "/app", icon: <Gauge size={16} strokeWidth={2} />, end: true },
  { label: "Products", to: "/app/products", icon: <Package size={16} strokeWidth={2} /> },
  { label: "Negotiations", to: "/app/negotiations", icon: <MessagesSquare size={16} strokeWidth={2} /> },
  { label: "Approvals", to: "/app/approvals", icon: <ShieldCheck size={16} strokeWidth={2} /> },
  { label: "Deals", to: "/app/deals", icon: <Handshake size={16} strokeWidth={2} /> },
  { label: "Finance", to: "/app/finance", icon: <Landmark size={16} strokeWidth={2} /> },
];
