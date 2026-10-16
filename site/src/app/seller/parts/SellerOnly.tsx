import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import s from "./parts.module.css";

/** Tinted panel for private seller economics. Always carries a visible "Seller only" tag. */
export function SellerOnly({ title, description, actions, children, as = "section" }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; as?: "section" | "div" }) {
  const Comp = as;
  return (
    <Comp className={s.private} aria-label={typeof title === "string" ? `${title} (seller only)` : undefined}>
      <div className={s.privateHead}>
        <div className={s.privateTitle}>
          <h2 className="h5">{title}</h2>
          {description && <p className="body3">{description}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {actions}
          <SellerOnlyTag />
        </div>
      </div>
      {children}
    </Comp>
  );
}

export function SellerOnlyTag() {
  return (
    <span className={s.privateTag} title="Never shown to buyers">
      <Lock size={12} strokeWidth={2.25} aria-hidden />
      Seller only
    </span>
  );
}
