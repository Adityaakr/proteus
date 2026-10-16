import { StatusTag } from "../ui/StatusTag";
import s from "./shells.module.css";

export const SANDBOX_TEXT = "Arc testnet. Testnet USDC has no value.";

/** The sandbox label shown wherever a balance appears. */
export function SandboxNote({ compact }: { compact?: boolean }) {
  return (
    <p className={s.sandboxNote}>
      <StatusTag network="sandbox" label="Sandbox" />
      {!compact && <span>{SANDBOX_TEXT}</span>}
      {compact && <span className="sr-only">{SANDBOX_TEXT}</span>}
    </p>
  );
}
