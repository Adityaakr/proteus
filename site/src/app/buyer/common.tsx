import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";
import { EmptyState } from "../ui/EmptyState";
import { errorMessage } from "../lib/api";
import s from "./buyer.module.css";

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={s.pageHead}>
      {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
      <div className={s.rowBetween}>
        <h1 className={s.title}>{title}</h1>
        {actions}
      </div>
      {lede && <p className={`body1 ${s.lede}`}>{lede}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "We could not load this page" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <EmptyState
      icon={<AlertTriangle size={20} strokeWidth={1.75} />}
      title={title}
      description={errorMessage(error)}
      action={onRetry ? <ActionButton variant="secondary" onClick={onRetry}>Try again</ActionButton> : <ActionButton variant="secondary" to="/">Go home</ActionButton>}
    />
  );
}

const dtf = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const df = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
export function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dtf.format(d);
}
export function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : df.format(d);
}
export function fmtUnits(units?: string | null) {
  if (!units) return "0";
  return units.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export function prettyIntegration(id: string) {
  const map: Record<string, string> = { "rest-api": "REST API", webhook: "Webhooks", zendesk: "Zendesk", shopify: "Shopify", gorgias: "Gorgias", intercom: "Intercom", salesforce: "Salesforce" };
  return map[id] ?? id;
}

/** Buyer flow stages for the Stepper (offer and checkout are one screen now). */
export const FLOW_STAGES = ["Negotiate", "Sign and fund", "Use", "Receipt"] as const;

export function prettySlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, " ").trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : slug;
}
