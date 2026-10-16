import { useState } from "react";
import { ArrowDownToLine, ExternalLink, RefreshCw } from "lucide-react";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_FAUCET, explorerAddress } from "@proteus/domain";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { CopyButton, ExplorerLink, KeyValue, Notice } from "../ui/misc";
import { StatusTag } from "../ui/StatusTag";
import { LoadingCard } from "../ui/Skeleton";
import { useAuth } from "../auth/useAuth";
import { PageHeader } from "../buyer/common";
import { BalanceCard } from "./BalanceCard";
import { useDepositWatch } from "./useDepositWatch";
import { DepositDialog } from "./DepositDialog";
import { Qr } from "./QrCode";
import w from "./wallet.module.css";

export const CUSTODY_NOTE = "Embedded wallet. Your key is split between a hardware enclave and your login. You can export it from the account menu. PROTEUS never holds your key.";
export default function WalletPage() {
  const { wallet } = useAuth();
  const [deposit, setDeposit] = useState(false);
  const watch = useDepositWatch();
  const { watching: polling, result } = watch;
  const refresh = watch.start;

  return (
    <AppShell title="Wallet">
      <PageHeader title="Your wallet" lede="One balance for everything: fund deals, pay per call, and receive payouts when you sell." />
      {!wallet ? (
        <LoadingCard label="Setting up your wallet" lines={3} />
      ) : (
        <div className={w.grid}>
          <div className={w.stack}>
            <BalanceCard
              title="Balance"
              poll={watch.pollMs}
              action={
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton variant="secondary" size="sm" onClick={refresh} loading={polling} loadingLabel="Checking" iconLeft={<RefreshCw size={14} strokeWidth={2} />}>
                    Refresh
                  </ActionButton>
                  <ActionButton size="sm" onClick={() => setDeposit(true)} iconLeft={<ArrowDownToLine size={14} strokeWidth={2} />}>
                    Deposit
                  </ActionButton>
                </span>
              }
            />
            <DepositDialog open={deposit} onClose={() => setDeposit(false)} />
            {result?.kind === "arrived" && <Notice tone="success" title="Funds arrived">Your balance is updated.</Notice>}
            {result?.kind === "none" && <Notice tone="info" title="No change yet">Faucet transfers can take a minute. Try refreshing again shortly.</Notice>}
            <Card title="Add testnet USDC" subtitle="The Circle faucet sends free testnet USDC on Arc testnet.">
              <ol className={w.steps}>
                <li>Copy your address.</li>
                <li>Open the faucet, choose Arc testnet and paste it.</li>
                <li>Come back and press "Refresh", or use "Deposit" to watch it land live.</li>
              </ol>
              <div className={w.actions}>
                <ActionButton href={ARC_TESTNET_FAUCET} newTab icon={<ExternalLink size={16} strokeWidth={2} />}>
                  Get testnet USDC
                </ActionButton>
              </div>
            </Card>
            <Card title="Network" variant="muted" padding="compact">
              <KeyValue
                items={[
                  { k: "Chain", v: <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>Arc testnet <StatusTag network="testnet" /></span> },
                  { k: "Chain id", v: <span className="app-mono">{ARC_TESTNET_CHAIN_ID}</span> },
                  { k: "Gas", v: "Paid in USDC from this balance. Funding a deal takes two small transactions." },
                  { k: "Explorer", v: <ExplorerLink href={explorerAddress(wallet.address)}>View address on explorer</ExplorerLink> },
                ]}
              />
            </Card>
          </div>
          <div className={w.stack}>
            <Card title="Your address">
              <div className={w.addrBox}>
                <Qr value={wallet.address} />
                <div className={w.addr}>
                  <span style={{ minWidth: 0 }}>{wallet.address}</span>
                  <CopyButton value={wallet.address} label="Copy wallet address" />
                </div>
                <p className="body3">Send only Arc testnet USDC to this address.</p>
              </div>
            </Card>
            <Card title="Custody" variant="muted" padding="compact">
              <p className="body2">{wallet.type === "external" ? "External wallet. You signed in with a wallet you control; PROTEUS never holds your key." : CUSTODY_NOTE}</p>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
