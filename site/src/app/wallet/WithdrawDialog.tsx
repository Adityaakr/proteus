import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAddress, isAddress, type Hex } from "viem";
import { ARC_NETWORK_NAMES, defaultNetwork, explorerTx } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { qk } from "../lib/api";
import { transferUsdc, waitForReceipt, walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { ArcMark } from "../ui/Marks";
import { ExplorerLink, Notice } from "../ui/misc";
import { Money } from "../ui/Money";
import { useBalances } from "./useBalances";
import w from "./wallet.module.css";

/** Kept back so the wallet can still pay gas for its next action. */
const GAS_RESERVE = 20_000n; // 0.02 USDC

function parseUsdc(text: string): bigint | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole!) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}
function formatUsdc(micro: bigint): string {
  const s = micro.toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`.replace(/\.?0+$/, "") || "0";
}

/**
 * Withdraw sheet: send USDC from the account wallet to any address on the same network. Mirrors the deposit
 * sheet: centered dialog on desktop, bottom sheet on phones; the transaction is signed by the active wallet.
 */
export function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallet, getWalletClient, mock } = useAuth();
  const qc = useQueryClient();
  const bal = useBalances({ poll: open ? 8_000 : false });
  const reduce = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"form" | "signing" | "pending" | "done">("form");
  const [hash, setHash] = useState<Hex | null>(null);
  const [sent, setSent] = useState<bigint>(0n);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "signing" && stage !== "pending") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose, stage]);

  // Fresh form each time the sheet opens.
  useEffect(() => {
    if (open) {
      setTo("");
      setAmount("");
      setError(null);
      setStage("form");
      setHash(null);
    }
  }, [open]);

  const available = bal.data ? (bal.data.usdc > GAS_RESERVE ? bal.data.usdc - GAS_RESERVE : 0n) : 0n;
  const parsed = parseUsdc(amount);
  const busy = stage === "signing" || stage === "pending";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mock) return setError("Mock mode does not send transactions.");
    if (!isAddress(to)) return setError("Enter a valid Arc address (0x followed by 40 hex characters).");
    if (parsed == null || parsed <= 0n) return setError("Enter an amount in USDC, up to 6 decimals.");
    if (parsed > available) return setError(`You can send up to ${formatUsdc(available)} USDC; 0.02 is kept for gas.`);
    if (wallet && getAddress(to).toLowerCase() === wallet.address.toLowerCase()) return setError("That is this wallet's own address.");
    setError(null);
    try {
      setStage("signing");
      const client = await getWalletClient();
      const h = await transferUsdc(client, getAddress(to), parsed);
      setHash(h);
      setStage("pending");
      const r = await waitForReceipt(h);
      if (r.status !== "success") throw new Error("The transaction reverted on chain.");
      setSent(parsed);
      setStage("done");
      void qc.invalidateQueries({ queryKey: qk.balances(wallet?.address ?? "none") });
    } catch (err) {
      setStage("form");
      setError(walletErrorMessage(err));
    }
  };

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
          <h2 id={titleId} className={w.sheetTitle}>Withdraw USDC</h2>
        </div>
        <button ref={closeRef} type="button" className={w.sheetClose} onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={18} strokeWidth={2} />
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {stage === "done" ? (
          <motion.div key="done" className={w.sheetDone} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.span className={w.doneBadge} initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
              <Check size={28} strokeWidth={2.5} />
            </motion.span>
            <p className={w.doneTitle}>
              <Money micro={sent} /> USDC sent
            </p>
            <p className="body2">
              To <span className="app-mono">{to.slice(0, 6)}…{to.slice(-4)}</span> on {ARC_NETWORK_NAMES[defaultNetwork()]}.
            </p>
            {hash && <ExplorerLink href={explorerTx(hash)} hash={hash} />}
            <div className={w.sheetActions}>
              <ActionButton onClick={onClose} icon>Done</ActionButton>
            </div>
          </motion.div>
        ) : (
          <motion.form key="form" className={w.sheetSingle} onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className={w.sheetField}>
              <span className={w.sheetLabelSm}>Recipient address</span>
              <Field label="Recipient address" hideLabel value={to} onChange={(e) => { setTo(e.target.value.trim()); setError(null); }} placeholder="0x…" autoComplete="off" spellCheck={false} disabled={busy} />
            </div>
            <div className={w.sheetField}>
              <span className={w.sheetLabelSm}>Amount</span>
              <div className={w.amountWrap}>
                <Field label="Amount in USDC" hideLabel value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} placeholder="0.00" inputMode="decimal" autoComplete="off" disabled={busy} />
                <span className={w.amountSide}>
                  USDC
                  <button type="button" className={w.linkBtn} onClick={() => setAmount(formatUsdc(available))} disabled={busy || !bal.data}>Max</button>
                </span>
              </div>
            </div>
            <div className={w.summary}>
              <div><span>Available</span><span className="app-mono">{bal.data ? `${formatUsdc(available)} USDC` : "…"}</span></div>
              <div><span>Kept for gas</span><span className="app-mono">0.02 USDC</span></div>
              <div><span>Network</span><span>{ARC_NETWORK_NAMES[defaultNetwork()]}</span></div>
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            {stage === "pending" && hash && (
              <div className={w.sheetStatus} aria-live="polite">
                Sent, waiting for confirmation. <ExplorerLink href={explorerTx(hash)} hash={hash} />
              </div>
            )}
            <div className={w.sheetActions}>
              <ActionButton type="submit" loading={busy} loadingLabel={stage === "signing" ? "Confirm in your wallet" : "Confirming"} disabled={!bal.data}>
                Withdraw
              </ActionButton>
              <ActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
            </div>
            <p className={w.sheetFoot}>Only send to an address on {ARC_NETWORK_NAMES[defaultNetwork()]}. Transfers cannot be reversed.</p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={w.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={busy ? undefined : onClose}>
          {panel}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
