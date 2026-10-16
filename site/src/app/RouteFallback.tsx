import { Compass } from "lucide-react";
import { ActionButton } from "./ui/ActionButton";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import "./app.css";

export function RouteFallback() {
  return (
    <div data-app style={{ padding: "80px 24px", display: "flex", justifyContent: "center" }} role="status" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton width="45%" height={28} />
        <Skeleton lines={3} />
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div data-app style={{ padding: "80px 16px", display: "flex", justifyContent: "center" }}>
      <main id="main" style={{ width: "100%", maxWidth: 560 }}>
        <EmptyState
          icon={<Compass size={20} strokeWidth={1.75} />}
          title="Page not found"
          description="The link may be incomplete, or the record may have moved."
          action={<ActionButton to="/">Go to the home page</ActionButton>}
        />
      </main>
    </div>
  );
}
