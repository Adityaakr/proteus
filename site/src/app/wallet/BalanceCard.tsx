import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Money } from "../ui/Money";
import { Skeleton } from "../ui/Skeleton";
import { Notice } from "../ui/misc";
import { SandboxNote } from "../layouts/SandboxNote";
import { walletErrorMessage } from "../lib/wallet";
import { UsdcMark } from "../ui/Marks";
import { formatNative, useBalances } from "./useBalances";
import w from "./wallet.module.css";

/** Account balance: USDC on Arc testnet, with the native (gas) view and the sandbox label. */
export function BalanceCard({ action, poll, title = "Balance" }: { action?: ReactNode; poll?: number | false; title?: string }) {
  const q = useBalances({ poll });
  return (
    <Card title={title} actions={action} className={w.balanceCard}>
      <div className={w.balanceRow} aria-live="polite">
        {q.isLoading ? (
          <Skeleton width={180} height={40} />
        ) : q.error ? (
          <Notice tone="warn" title="Could not read your balance">{walletErrorMessage(q.error)}</Notice>
        ) : (
          <span className={w.balance}>
            <Money micro={q.data?.usdc ?? 0n} />
            <span className={w.balanceUnit}><UsdcMark size={18} /> USDC</span>
          </span>
        )}
      </div>
      {q.data && (
        <p className="body3">
          Native balance <span className="app-mono">{formatNative(q.data.native)}</span> USDC, the same funds. Gas on Arc is paid from it.
          {q.data.source === "mock" ? " Mock balance." : ""}
        </p>
      )}
      <SandboxNote />
    </Card>
  );
}
