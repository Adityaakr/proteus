import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { ARC_TESTNET_FAUCET, explorerAddress } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { ActionButton } from "../ui/ActionButton";
import { CopyButton, ExplorerLink } from "../ui/misc";
import { Money } from "../ui/Money";
import { Qr } from "./QrCode";
import { ArcMark } from "../ui/Marks";
import { useDepositWatch } from "./useDepositWatch";
import w from "./wallet.module.css";

/**
 * Deposit sheet: QR + address, the faucet link, and a live watcher that confirms the moment USDC lands.
 * Centered dialog on desktop, bottom sheet on phones. Esc, backdrop click and the close button dismiss it.
 */
export function DepositDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallet } = useAuth();
  const reduce = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const watch = useDepositWatch();

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
    else watch.reset();
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
    >
      <div className={w.sheetHandle} aria-hidden />
      <header className={w.sheetHead}>
        <div className={w.sheetTitleRow}>
          <span className={w.sheetLabel}><ArcMark size={12} style={{ marginRight: 6, verticalAlign: "-1px" }} />Arc testnet</span>
          <h2 id={titleId} className={w.sheetTitle}>Deposit testnet USDC</h2>
        </div>
        <button ref={closeRef} type="button" className={w.sheetClose} onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {arrived ? (
          <motion.div key="done" className={w.sheetDone} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.span className={w.doneBadge} initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
              <Check size={28} strokeWidth={2.5} />
            </motion.span>
            <p className={w.doneTitle}>
              <Money micro={arrived.delta} /> USDC arrived
            </p>
            <p className="body2">
              Balance now <strong><Money micro={watch.q.data?.usdc ?? 0n} /></strong> USDC. You can fund deals and pay per call.
            </p>
            <div className={w.sheetActions}>
              <ActionButton onClick={onClose} icon>Done</ActionButton>
              <ActionButton variant="secondary" to="/app/market" onClick={onClose}>Browse the market</ActionButton>
            </div>
          </motion.div>
        ) : (
          <motion.div key="deposit" className={w.sheetBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className={w.sheetQrCol}>
              {address ? <Qr value={address} className={w.sheetQr} /> : <span className={w.sheetQrEmpty} />}
              <span className="body3">Scan to send Arc testnet USDC</span>
            </div>
            <div className={w.sheetMain}>
              <div className={w.sheetField}>
                <span className={w.sheetLabelSm}>Your address</span>
                <div className={w.addr}>
                  <span style={{ minWidth: 0 }}>{address || "Setting up your wallet"}</span>
                  {address && <CopyButton value={address} label="Copy wallet address" />}
                </div>
              </div>
              <ol className={w.sheetSteps}>
                <li><span>1</span>Copy your address.</li>
                <li><span>2</span>Open the Circle faucet, choose Arc testnet, paste it and request USDC.</li>
                <li><span>3</span>Keep this open. The balance updates here the moment it lands.</li>
              </ol>
              <div className={w.sheetActions}>
                <ActionButton href={ARC_TESTNET_FAUCET} newTab icon={<ExternalLink size={16} strokeWidth={2} />}>Open Circle faucet</ActionButton>
                {address && <ExplorerLink href={explorerAddress(address)}>View on explorer</ExplorerLink>}
              </div>
              <div className={w.sheetStatus} aria-live="polite">
                {watch.watching ? (
                  <>
                    Watching for the deposit. Balance <Money micro={watch.q.data?.usdc ?? 0n} /> USDC.
                  </>
                ) : watch.result?.kind === "none" ? (
                  <>
                    Nothing yet. Faucet transfers can take a minute.
                    <button type="button" className={w.linkBtn} onClick={watch.start}>Keep watching</button>
                  </>
                ) : (
                  <>
                    Balance <Money micro={watch.q.data?.usdc ?? 0n} /> USDC.
                    <button type="button" className={w.linkBtn} onClick={watch.start}>Check again</button>
                  </>
                )}
              </div>
              <p className={w.sheetFoot}>Testnet USDC has no value. Only Arc testnet USDC sent to this address shows up here.</p>
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
