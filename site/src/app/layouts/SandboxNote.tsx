import { NetworkBadge } from "../ui/StatusTag";
import s from "./shells.module.css";

/** @deprecated kept for callers; renders only the network badge now. */
export const SANDBOX_TEXT = "";

/** Network label shown wherever a balance appears. */
export function SandboxNote(_props: { compact?: boolean }) {
  return (
    <p className={s.sandboxNote}>
      <NetworkBadge network="testnet" />
    </p>
  );
}
