import type { HTMLAttributes, ReactNode } from "react";
import s from "./ui.module.css";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right side of the header (tags, actions). */
  actions?: ReactNode;
  variant?: "default" | "muted";
  padding?: "default" | "compact" | "flush";
  as?: "section" | "div" | "article" | "aside";
  /** Heading level for `title` (default 2). */
  level?: 2 | 3 | 4;
  children?: ReactNode;
}

export function Card({ title, subtitle, actions, variant = "default", padding = "default", as = "section", level = 2, className, children, ...rest }: CardProps) {
  const Comp = as;
  const H = `h${level}` as "h2";
  const cls = [s.card, variant === "muted" ? s.card_muted : "", padding === "compact" ? s.card_compact : padding === "flush" ? s.card_flush : "", className].filter(Boolean).join(" ");
  return (
    <Comp className={cls} {...rest}>
      {(title || actions) && (
        <div className={s.cardHead}>
          <div className={s.cardTitleWrap}>
            {title && <H className="h5">{title}</H>}
            {subtitle && <p className="body3">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Comp>
  );
}
