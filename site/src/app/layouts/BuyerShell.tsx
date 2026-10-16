import type { ReactNode } from "react";
import { Stepper, type DealStage } from "../ui/Stepper";
import { NetworkBadge, StatusTag } from "../ui/StatusTag";
import { Wordmark } from "./Wordmark";
import { isMock } from "../lib/api";
import "../app.css";
import s from "./shells.module.css";

export interface BuyerShellProps {
  /** Current deal stage for the stepper. Omit to hide it (storefront). */
  stage?: number | DealStage;
  /** Seller label for the right side of the top bar. */
  sellerLabel?: "sandbox" | "live";
  children: ReactNode;
}

export function BuyerShell({ stage, sellerLabel, children }: BuyerShellProps) {
  return (
    <div data-app className={s.root}>
      <a href="#main" className="app-skip-link">Skip to content</a>
      <header className={s.topbar}>
        <Wordmark />
        <div className={s.topCenter}>{stage !== undefined && <Stepper current={stage} />}</div>
        <div className={s.topRight}>
          {sellerLabel === "sandbox" && <StatusTag network="sandbox" label="Sandbox seller" />}
          {isMock() && <StatusTag network="illustrative" label="Mock data" />}
          <NetworkBadge network="testnet" />
        </div>
      </header>
      <main id="main" tabIndex={-1} className={s.main}>
        {children}
      </main>
      <footer className={s.footer}>
        <span>Payments settle in testnet USDC on Arc testnet. No real funds move.</span>
        <a href="/review">Public records</a>
      </footer>
    </div>
  );
}
