import { Briefcase } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { EmptyState } from "../ui/EmptyState";
import { ActionButton } from "../ui/ActionButton";

export default function SellPlaceholder() {
  return (
    <AppShell title="Start selling">
      <EmptyState
        icon={<Briefcase size={20} strokeWidth={1.75} />}
        title="Selling is almost ready"
        description="Publishing a product and the seller console arrive in this space shortly. Your account and wallet already work for both."
        action={<ActionButton variant="secondary" to="/app">Back to home</ActionButton>}
      />
    </AppShell>
  );
}
