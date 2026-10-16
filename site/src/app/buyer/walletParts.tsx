import { Wallet } from "lucide-react";
import { ARC_TESTNET_CHAIN_ID } from "@proteus/domain";
import { MonoValue, Notice } from "../ui/misc";
import { isMock } from "../lib/api";
import type { WalletState } from "../lib/wallet";
import s from "./buyer.module.css";

/** Small status line for the connected wallet (or the no-wallet demo state). */
export function WalletLine({ w }: { w: WalletState }) {
  if (!w.available)
    return (
      <Notice tone={isMock() ? "info" : "warn"} title="No browser wallet detected">
        {isMock()
          ? "You are viewing mock data. You can continue in demo mode, but paying steps stay disabled."
          : "Install a wallet such as MetaMask or Rabby, then reload this page. Paying steps stay disabled until a wallet is connected."}
      </Notice>
    );
  return (
    <div className={s.txRow}>
      <Wallet size={16} strokeWidth={2} aria-hidden />
      {w.account ? (
        <>
          <span>Connected</span>
          <MonoValue value={w.account} short copy label="wallet address" />
          <span>{w.onArc ? "on Arc testnet" : `on chain ${w.chainId ?? "unknown"}, Arc testnet is ${ARC_TESTNET_CHAIN_ID}`}</span>
        </>
      ) : (
        <span>Wallet available, not connected</span>
      )}
    </div>
  );
}
