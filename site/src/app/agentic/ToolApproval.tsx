import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, ShieldCheck, X } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { ActionButton } from "../ui/ActionButton";
import { StatusTag, type StatusTone } from "../ui/StatusTag";
import s from "./agentic.module.css";

/**
 * ToolApproval: a card asking the person to authorize one tool call (sign, pay, call a service).
 * Lifecycle: pending -> approving -> approved -> running -> complete, or denied.
 * "Always allow" is never offered when `moneyMovement` is true.
 */
export type ToolApprovalStatus = "pending" | "approving" | "approved" | "running" | "complete" | "denied";

export interface ToolParameter {
  label: ReactNode;
  value: ReactNode;
  /** Monospace + tabular numerals. */
  mono?: boolean;
}

export interface ToolApprovalProps {
  /** Machine name shown in monospace, for example "wallet.signTypedData". */
  tool: string;
  title: ReactNode;
  description?: ReactNode;
  parameters?: ToolParameter[];
  status: ToolApprovalStatus;
  onApprove?: () => void;
  onDeny?: () => void;
  /** Called with the checkbox value when approving. Hidden when moneyMovement. */
  onAlwaysAllowChange?: (always: boolean) => void;
  /** Moves or commits funds: hides "Always allow". */
  moneyMovement?: boolean;
  approveLabel?: string;
  denyLabel?: string;
  /** Block approval and explain why (for example no wallet). */
  disabled?: boolean;
  disabledReason?: ReactNode;
  /** Rendered under the parameters (results, tx links, extra steps). */
  children?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  /** Heading level for the title. Default 2. */
  level?: 2 | 3;
  className?: string;
}

const STATUS: Record<ToolApprovalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting for you", tone: "warn" },
  approving: { label: "Approving", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  running: { label: "Running", tone: "info" },
  complete: { label: "Complete", tone: "success" },
  denied: { label: "Denied", tone: "danger" },
};

export function ToolApproval({
  tool,
  title,
  description,
  parameters,
  status,
  onApprove,
  onDeny,
  onAlwaysAllowChange,
  moneyMovement,
  approveLabel = "Approve",
  denyLabel = "Deny",
  disabled,
  disabledReason,
  children,
  error,
  icon,
  level = 2,
  className,
}: ToolApprovalProps) {
  const [always, setAlways] = useState(false);
  const descId = useId();
  const H = `h${level}` as "h2";
  const actionable = status === "pending" || status === "approving";
  const st = STATUS[status];

  return (
    <motion.section
      layout
      transition={T_DEFAULT}
      className={[s.approval, actionable ? s.approvalActive : "", className].filter(Boolean).join(" ")}
      aria-describedby={description ? descId : undefined}
    >
      <div className={s.approvalHead}>
        <span className={s.approvalIcon} aria-hidden>
          {icon ?? (status === "complete" || status === "approved" ? <Check size={18} strokeWidth={2} /> : status === "denied" ? <X size={18} strokeWidth={2} /> : moneyMovement ? <ShieldCheck size={18} strokeWidth={2} /> : <KeyRound size={18} strokeWidth={2} />)}
        </span>
        <div className={s.approvalTitleWrap}>
          <span className={s.toolName}>{tool}</span>
          <H className="h6">{title}</H>
          {description && (
            <p id={descId} className="body3">
              {description}
            </p>
          )}
        </div>
        <StatusTag tone={st.tone} label={st.label} />
      </div>

      {parameters && parameters.length > 0 && (
        <dl className={s.params}>
          {parameters.map((p, i) => (
            <div key={i} className={s.param}>
              <dt>{p.label}</dt>
              <dd className={p.mono ? s.paramMono : undefined}>{p.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children && <div className={s.approvalResult}>{children}</div>}

      {error && (
        <p className="body3" role="alert" style={{ color: "var(--c-danger, rgb(214, 40, 40))" }}>
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {actionable && (onApprove || onDeny) && (
          <motion.div key="actions" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={T_DEFAULT} style={{ overflow: "hidden" }}>
            <div className={s.approvalActions}>
              {onApprove && (
                <ActionButton variant="primary" onClick={onApprove} loading={status === "approving"} disabled={disabled} loadingLabel="Waiting for wallet">
                  {approveLabel}
                </ActionButton>
              )}
              {onDeny && (
                <ActionButton variant="secondary" onClick={onDeny} disabled={status === "approving"}>
                  {denyLabel}
                </ActionButton>
              )}
              {!moneyMovement && onAlwaysAllowChange && (
                <label className={s.always}>
                  <input
                    type="checkbox"
                    checked={always}
                    onChange={(e) => {
                      setAlways(e.target.checked);
                      onAlwaysAllowChange(e.target.checked);
                    }}
                  />
                  Always allow
                </label>
              )}
            </div>
            {disabled && disabledReason && (
              <p className="body3" style={{ marginTop: 10 }}>
                {disabledReason}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
