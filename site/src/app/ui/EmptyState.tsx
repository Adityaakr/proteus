import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import s from "./ui.module.css";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Usually one ActionButton. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={[s.empty, className].filter(Boolean).join(" ")}>
      <span className={s.emptyIcon} aria-hidden>
        {icon ?? <Inbox size={20} strokeWidth={1.75} />}
      </span>
      <h2 className={s.emptyTitle}>{title}</h2>
      {description && <p className="body3" style={{ maxWidth: 480 }}>{description}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  );
}
