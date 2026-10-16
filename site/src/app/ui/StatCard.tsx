import type { ReactNode } from "react";
import s from "./ui.module.css";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** A tag rendered next to the label (for example a network label). */
  tag?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, tag, className }: StatCardProps) {
  return (
    <div className={[s.card, s.card_compact, s.stat, className].filter(Boolean).join(" ")}>
      <div className={s.statLabel}>
        {icon && <span aria-hidden style={{ display: "inline-flex" }}>{icon}</span>}
        <span className="body3" style={{ color: "inherit" }}>{label}</span>
        {tag}
      </div>
      <div className={s.statValue}>{value}</div>
      {hint && <p className={`body3 ${s.statHint}`}>{hint}</p>}
    </div>
  );
}
