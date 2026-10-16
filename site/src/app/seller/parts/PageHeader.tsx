import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { StatusTag } from "../kit";
import s from "./parts.module.css";

export interface PageHeaderProps {
  /** Detail pages pass a title; top-level pages rely on the shell heading and omit it. */
  title?: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  /** Status tag(s) next to the title. */
  status?: ReactNode;
  /** The page's one primary action (plus optional secondary ones). */
  actions?: ReactNode;
  /** Repeat the sandbox seller + testnet labels in the page header (the shell top bar always shows them). */
  labels?: boolean;
  sellerLabel?: "sandbox" | "live";
}

export function PageHeader({ title, description, back, status, actions, labels = false, sellerLabel = "sandbox" }: PageHeaderProps) {
  return (
    <header className={s.header}>
      <div className={s.headerText}>
        {back && (
          <Link to={back.to} className={s.crumb}>
            <ChevronLeft size={14} strokeWidth={2} aria-hidden />
            {back.label}
          </Link>
        )}
        {(title || status) && (
          <div className={s.titleRow}>
            {title && <h2 className="h3">{title}</h2>}
            {status}
          </div>
        )}
        {description && <p className="body3">{description}</p>}
        {labels && (
          <div className={s.labels}>
            <StatusTag network={sellerLabel === "live" ? "live" : "sandbox"} label={sellerLabel === "live" ? "Live seller" : "Sandbox seller"} />
            <StatusTag network="testnet" label="Arc testnet" />
          </div>
        )}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </header>
  );
}
