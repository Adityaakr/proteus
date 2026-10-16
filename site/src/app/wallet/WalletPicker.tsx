import { Check, Plus } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { walletLabel, type AuthWallet } from "../auth/context";
import { Money } from "../ui/Money";
import { useBalances } from "./useBalances";
import s from "./picker.module.css";

function Balance({ address }: { address: AuthWallet["address"] }) {
  const q = useBalances({ address, poll: false });
  if (q.isLoading) return <span className={s.bal}>…</span>;
  if (!q.data) return <span className={s.bal}>–</span>;
  return <span className={s.bal}><Money micro={q.data.usdc} /> USDC</span>;
}

/**
 * Every wallet on the account with its USDC balance; one is active. Used in the account menu (compact)
 * and on the wallet page. Picking a wallet changes what the whole app uses: balance, deposits, funding,
 * payouts and signatures.
 */
export function WalletPicker({ compact, onPick }: { compact?: boolean; onPick?: () => void }) {
  const { wallet, wallets, setActiveWallet, connectExternalWallet, mock } = useAuth();
  return (
    <div className={`${s.list} ${compact ? s.compact : ""}`} role="group" aria-label="Wallets">
      {wallets.map((w) => {
        const active = wallet?.address.toLowerCase() === w.address.toLowerCase();
        return (
          <button
            key={w.address}
            type="button"
            className={`${s.row} ${active ? s.active : ""}`}
            aria-pressed={active}
            onClick={() => {
              if (!active) setActiveWallet(w.address);
              onPick?.();
            }}
          >
            <span className={s.check} aria-hidden>{active && <Check size={14} strokeWidth={2.5} />}</span>
            <span className={s.main}>
              <span className={s.label}>{walletLabel(w)}{w.type === "external" && !w.connected ? <span className={s.off}> · not connected</span> : null}</span>
              <span className={`app-mono ${s.addr}`}>{w.address.slice(0, 6)}…{w.address.slice(-4)}</span>
            </span>
            <Balance address={w.address} />
          </button>
        );
      })}
      {!mock && (
        <button type="button" className={`${s.row} ${s.add}`} onClick={() => { connectExternalWallet(wallet?.type === "external" && !wallet.connected ? wallet.address : undefined); onPick?.(); }}>
          <span className={s.check} aria-hidden><Plus size={14} strokeWidth={2.5} /></span>
          <span className={s.main}><span className={s.label}>{wallet?.type === "external" && !wallet.connected ? `Connect ${walletLabel(wallet)}` : "Connect a wallet"}</span><span className={s.addr}>{wallet?.type === "external" && !wallet.connected ? "Reconnect it in this browser" : "MetaMask, Coinbase Wallet, WalletConnect"}</span></span>
        </button>
      )}
    </div>
  );
}
