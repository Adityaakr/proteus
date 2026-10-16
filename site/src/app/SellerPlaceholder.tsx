import { LayoutDashboard } from "lucide-react";
import { SellerShell } from "./layouts/SellerShell";
import { EmptyState } from "./ui/EmptyState";

export default function SellerPlaceholder() {
  return (
    <SellerShell nav={[{ label: "Overview", to: "/app", icon: <LayoutDashboard size={18} strokeWidth={1.75} />, end: true }]}>
      <EmptyState title="Seller console loading" description="The seller console is being set up. Check back in a moment." />
    </SellerShell>
  );
}
