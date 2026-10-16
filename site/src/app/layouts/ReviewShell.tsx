import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { NetworkBadge, StatusTag } from "../ui/StatusTag";
import { Wordmark } from "./Wordmark";
import { isMock } from "../lib/api";
import "../app.css";
import s from "./shells.module.css";

export function ReviewShell({ children }: { children: ReactNode }) {
  return (
    <div data-app className={s.root}>
      <a href="#main" className="app-skip-link">Skip to content</a>
      <header className={s.topbar}>
        <Wordmark />
        <nav aria-label="Review" className={s.topCenter} style={{ justifyContent: "flex-start" }}>
          <Link to="/review" className={s.navLink}>Public records</Link>
        </nav>
        <div className={s.topRight}>
          {isMock() && <StatusTag network="illustrative" label="Mock data" />}
          <NetworkBadge network="testnet" />
        </div>
      </header>
      <main id="main" tabIndex={-1} className={s.main}>
        {children}
      </main>
      <footer className={s.footer}>
        <span>Records are redacted. No buyer details, seller costs or transcripts are shown.</span>
      </footer>
    </div>
  );
}
