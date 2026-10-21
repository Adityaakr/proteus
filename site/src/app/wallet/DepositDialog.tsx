import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { ARC_NETWORK_NAMES, ARC_TESTNET_FAUCET, defaultNetwork, explorerAddress } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { ActionButton } from "../ui/ActionButton";
import { CopyButton } from "../ui/misc";
import { Money } from "../ui/Money";
import { Qr } from "./QrCode";
import { ArcMark, UsdcMark } from "../ui/Marks";
import { BridgePanel, type BridgeArrival } from "./BridgePanel";
import { ChainLogo } from "./ChainSelect";
import { useDepositWatch } from "./useDepositWatch";
import w from "./wallet.module.css";

/**
 * Deposit sheet with two methods: send USDC on Arc (QR + address, the faucet link), or bridge it from another
 * chain with Circle's CCTP. A live watcher confirms the moment USDC lands, whichever way it came.
 * Centered dialog on desktop, bottom sheet on phones. Esc, backdrop click and the close button dismiss it.
 */
export function DepositDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallet } = useAuth();
  const reduce = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const watch = useDepositWatch();
  const [method, setMethod] = useState<"arc" | "bridge">("arc");
  const [bridged, setBridged] = useState<BridgeArrival | null>(null);

  // Esc closes; body scroll locks; focus moves in and back out.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  // Start watching for the deposit as soon as the sheet opens; stop when it closes.
  useEffect(() => {
    if (open) watch.start();
    else {
      watch.reset();
      setMethod("arc");
      setBridged(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const address = wallet?.address ?? "";
  const arrived = watch.result?.kind === "arrived" ? watch.result : null;

  const panel: ReactNode = (
    <motion.div
      className={w.sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: 520 }}
    >
      <div className={w.sheetHandle} aria-hidden />
      <header className={w.sheetHead}>
        <div className={w.sheetTitleRow}>
          <span className={w.sheetLabel}><ArcMark size={12} style={{ marginRight: 6, verticalAlign: "-1px" }} />{ARC_NETWORK_NAMES[defaultNetwork()]}</span>
          <h2 id={titleId} className={w.sheetTitle}>Deposit USDC</h2>
        </div>
        <button ref={closeRef} type="button" className={w.sheetClose} onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {arrived ? (
          <motion.div key="done" className={w.sheetSingle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className={w.doneHero}>
              <motion.span className={w.doneRing} initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                <Check size={30} strokeWidth={2.5} />
              </motion.span>
              <p className={w.doneAmount}>
                <UsdcMark size={28} />
                <Money micro={arrived.delta} />
              </p>
              <p className={w.doneCaption}>USDC arrived in your account wallet</p>
            </div>
            <div className={w.doneRoute}>
              {bridged && (
                <div className={w.doneRow}>
                  <span>Route</span>
                  <span className={w.doneChain}>
                    <ChainLogo chain={{ label: bridged.sourceLabel, logo: bridged.sourceLogo }} />
                    {bridged.sourceLabel}
                    <span aria-hidden style={{ color: "var(--c-dark-40)" }}>→</span>
                    <ArcMark size={14} />
                    {ARC_NETWORK_NAMES[defaultNetwork()]}
                  </span>
                </div>
              )}
              <div className={w.doneRow}>
                <span>New balance</span>
                <span className="app-mono" style={{ color: "var(--c-dark)" }}><Money micro={watch.q.data?.usdc ?? 0n} /> USDC</span>
              </div>
              {bridged && (bridged.burnUrl || bridged.mintUrl) && (
                <div className={w.doneRow}>
                  <span>Transactions</span>
                  <span className={w.doneLinks}>
                    {bridged.burnUrl && <a href={bridged.burnUrl} target="_blank" rel="noreferrer">On {bridged.sourceLabel}</a>}
                    {bridged.mintUrl && <a href={bridged.mintUrl} target="_blank" rel="noreferrer">On Arc</a>}
                  </span>
                </div>
              )}
              {!bridged && address && (
                <div className={w.doneRow}>
                  <span>Wallet</span>
                  <a className={w.quietLink} href={explorerAddress(address)} target="_blank" rel="noreferrer">View on explorer</a>
                </div>
              )}
            </div>
            <div className={w.doneActions}>
              <ActionButton to="/app/market" onClick={onClose} fullWidth>Browse the market</ActionButton>
              <ActionButton variant="secondary" onClick={onClose} fullWidth>Done</ActionButton>
            </div>
          </motion.div>
        ) : (
          <motion.div key="deposit" className={w.sheetSingle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className={w.methodTabs} role="tablist" aria-label="Deposit method">
              <button type="button" role="tab" className={w.methodTab} aria-selected={method === "arc"} onClick={() => setMethod("arc")}>Send on Arc</button>
              <button type="button" role="tab" className={w.methodTab} aria-selected={method === "bridge"} onClick={() => setMethod("bridge")}>From another chain</button>
            </div>
            {method === "bridge" ? (
              <BridgePanel onArrived={(info) => { setBridged(info); watch.start(); }} />
            ) : (
            <div className={w.depositRow}>
              <div className={w.depositMain}>
                <span className={w.sheetLabelSm}>Your address</span>
                <div className={w.addrCompact}>
                  <span className={w.addrShort} title={address}>{address ? `${address.slice(0, 10)}…${address.slice(-8)}` : "Setting up your wallet"}</span>
                  {address && <CopyButton value={address} label="Copy wallet address" />}
                </div>
                <p className={w.hint}>
                  Send USDC on {ARC_NETWORK_NAMES[defaultNetwork()]} to this address. {defaultNetwork() === "testnet" ? "Testnet USDC is free from the Circle faucet." : "From an exchange or a wallet. USDC on another chain? Use From another chain."}
                </p>
                <div className={w.sheetActions}>
                  {defaultNetwork() === "testnet" && <ActionButton variant="secondary" size="sm" href={ARC_TESTNET_FAUCET} newTab icon={<ExternalLink size={14} strokeWidth={2} />}>Circle faucet</ActionButton>}
                  {address && <a className={w.quietLink} href={explorerAddress(address)} target="_blank" rel="noreferrer">View on explorer</a>}
                </div>
              </div>
              {address ? <Qr value={address} className={w.qrSmall} /> : <span className={w.qrSmallEmpty} />}
            </div>
            )}
            <div className={w.sheetStatus} aria-live="polite">
              {watch.watching ? (
                <>
                  <span className={w.pulse} aria-hidden />
                  Watching for the deposit
                  <span className={w.statusSep}>·</span>
                  Balance <Money micro={watch.q.data?.usdc ?? 0n} /> USDC
                </>
              ) : watch.result?.kind === "none" ? (
                <>
                  Nothing yet. Faucet transfers can take a minute.
                  <button type="button" className={w.linkBtn} onClick={watch.start}>Keep watching</button>
                </>
              ) : (
                <>
                  Balance <Money micro={watch.q.data?.usdc ?? 0n} /> USDC
                  <button type="button" className={w.linkBtn} onClick={watch.start}>Check again</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={w.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          {panel}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
