import { NetworkBadge } from "../ui/StatusTag";
import s from "./shells.module.css";
import { defaultNetwork } from "@proteus/domain";

/** @deprecated kept for callers; renders only the network badge now. */
export const SANDBOX_TEXT = "";

/** Network label shown wherever a balance appears. */
export function SandboxNote(_props: { compact?: boolean }) {
  return (
    <p className={s.sandboxNote}>
      <NetworkBadge network={defaultNetwork()} />
    </p>
  );
}
