import type { ReactNode } from "react";
import s from "./ui.module.css";

/**
 * StatusTag: a pill that always carries a text label (never color only).
 *  <StatusTag network="testnet" />           environment labels
 *  <StatusTag state="funded" />              known lifecycle states with tone + label
 *  <StatusTag tone="warn" label="Custom" />  anything else
 */
export type StatusTone = "neutral" | "info" | "success" | "warn" | "danger";
export type NetworkKind = "sandbox" | "testnet" | "mainnet" | "illustrative" | "live";

export const NETWORK_LABELS: Record<NetworkKind, string> = {
  sandbox: "Demo",
  testnet: "Testnet",
  mainnet: "Mainnet",
  illustrative: "Illustrative",
  live: "Live seller",
};

export const STATE_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  // negotiation
  open: { label: "Open", tone: "info" },
  quoted: { label: "Quoted", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  // candidates / quotes / approvals
  eligible: { label: "Ready to accept", tone: "success" },
  approval_required: { label: "Needs seller approval", tone: "warn" },
  rejected: { label: "Not available", tone: "danger" },
  draft: { label: "Draft", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  pending: { label: "Pending", tone: "warn" },
  // deals
  awaiting_funding: { label: "Awaiting funding", tone: "warn" },
  funding_pending: { label: "Funding pending", tone: "info" },
  funded: { label: "Funded", tone: "success" },
  active: { label: "Active", tone: "success" },
  disputed: { label: "Disputed", tone: "danger" },
  // service
  provisioned: { label: "Provisioned", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  // receipts
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed, not billed", tone: "danger" },
  handoff: { label: "Handed off, not billed", tone: "warn" },
  // refunds / txs
  submitted: { label: "Submitted", tone: "info" },
  too_early: { label: "Too early", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "success" },
  settled: { label: "Settled", tone: "success" },
  working: { label: "Working", tone: "info" },
  done: { label: "Done", tone: "success" },
  blocked: { label: "Blocked", tone: "danger" },
};

export interface StatusTagProps {
  network?: NetworkKind;
  state?: string;
  tone?: StatusTone;
  label?: ReactNode;
  icon?: ReactNode;
  /** Hide the leading dot. */
  noDot?: boolean;
  className?: string;
  title?: string;
}

export function statusLabel(state: string): string {
  return STATE_LABELS[state]?.label ?? state.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function StatusTag({ network, state, tone, label, icon, noDot, className, title }: StatusTagProps) {
  let variant: string;
  let text: ReactNode;
  if (network) {
    variant = `tag_${network === "live" ? "mainnet" : network}`;
    text = label ?? NETWORK_LABELS[network];
  } else if (state) {
    const known = STATE_LABELS[state];
    variant = `tag_${tone ?? known?.tone ?? "neutral"}`;
    text = label ?? statusLabel(state);
  } else {
    variant = `tag_${tone ?? "neutral"}`;
    text = label;
  }
  return (
    <span className={[s.tag, s[variant], className].filter(Boolean).join(" ")} title={title}>
      {icon ? <span aria-hidden style={{ display: "inline-flex" }}>{icon}</span> : noDot ? null : <span className={s.tagDot} aria-hidden />}
      <span>{text}</span>
    </span>
  );
}

/** "Arc testnet" network badge used in shells. */
export function NetworkBadge({ network = "testnet", label }: { network?: NetworkKind; label?: string }) {
  return <StatusTag network={network} label={label ?? (network === "testnet" ? "Arc testnet" : NETWORK_LABELS[network])} />;
}
