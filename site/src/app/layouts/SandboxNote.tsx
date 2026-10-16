import { NetworkBadge } from "../ui/StatusTag";
import s from "./shells.module.css";

export const SANDBOX_TEXT = "Arc testnet. Testnet USDC has no value.";

/** Network label shown wherever a balance appears: real Arc testnet, real transactions, test-value USDC. */
export function SandboxNote({ compact }: { compact?: boolean }) {
  return (
    <p className={s.sandboxNote}>
      <NetworkBadge network="testnet" />
      {!compact && <span>{SANDBOX_TEXT}</span>}
      {compact && <span className="sr-only">{SANDBOX_TEXT}</span>}
    </p>
  );
}
