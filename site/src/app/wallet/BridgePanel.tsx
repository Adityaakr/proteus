import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { qk } from "../lib/api";
import { bridgeSources, bridgeToArc, estimateBridgeFee, hasBrowserWallet, retryBridge, stepLabel, type BridgeOutcome, type BridgeProgress } from "../lib/bridge";
import { walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { Notice } from "../ui/misc";
import w from "./wallet.module.css";

const STEP_ORDER = ["approve", "burn", "fetchAttestation", "mint"];

function cleanAmount(text: string): string | null {
  const t = text.trim().replace(/,/g, "");
  return /^\d+(\.\d{1,6})?$/.test(t) && Number(t) > 0 ? t : null;
}

/**
 * Deposit from another chain: the browser wallet burns USDC on Base, Ethereum or Arbitrum with Circle's CCTP and
 * Circle's Forwarder mints it on Arc to the account wallet. Lives inside the deposit sheet; the sheet's watcher
 * confirms the arrival the same way it does for a direct transfer.
 */
export function BridgePanel({ onArrived }: { onArrived?: () => void }) {
  const { wallet, mock } = useAuth();
  const qc = useQueryClient();
  const sources = bridgeSources();
  const [source, setSource] = useState<string>(sources[0].id);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<BridgeProgress[]>([]);
  const [outcome, setOutcome] = useState<BridgeOutcome | null>(null);
  const recipient = wallet?.address ?? "";
  const network = ARC_NETWORK_NAMES[defaultNetwork()];
  const browserWallet = hasBrowserWallet();

  // Live quote of Circle's fee as the amount or route changes (debounced; no wallet prompt).
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    const amt = cleanAmount(amount);
    setFee(null);
    if (!amt || !recipient) return;
    let live = true;
    const t = window.setTimeout(() => {
      setQuoting(true);
      estimateBridgeFee(source, amt, recipient)
        .then((f) => live && setFee(f))
        .catch(() => live && setFee(null))
        .finally(() => live && setQuoting(false));
    }, 450);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [amount, source, recipient]);

  const track = (s: BridgeProgress) =>
    setSteps((prev) => {
      const next = prev.filter((p) => p.name !== s.name).concat(s);
      return next.sort((a, b) => STEP_ORDER.indexOf(a.name) - STEP_ORDER.indexOf(b.name));
    });

  const finish = (r: BridgeOutcome) => {
    setOutcome(r);
    setSteps(r.steps.filter((s) => s.state !== "noop"));
    if (r.ok) {
      void qc.invalidateQueries({ queryKey: qk.balances(recipient || "none") });
      onArrived?.();
    } else setError("The transfer stopped part way. Your USDC is safe; resume it below.");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mock) return setError("Mock mode does not send transactions.");
    const amt = cleanAmount(amount);
    if (!amt) return setError("Enter an amount in USDC, up to 6 decimals.");
    if (!recipient) return setError("Your account wallet is still being set up.");
    setError(null);
    setSteps([]);
    setOutcome(null);
    setBusy(true);
    try {
      finish(await bridgeToArc(source, amt, recipient, track));
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!outcome) return;
    setError(null);
    setBusy(true);
    try {
      finish(await retryBridge(outcome, source, recipient));
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const srcLabel = sources.find((s) => s.id === source)?.label ?? source;

  return (
    <form className={w.sheetSingle} onSubmit={submit} noValidate>
      <p className={w.hint}>
        Have USDC on another chain? Move it to {network} with Circle's CCTP. Your browser wallet sends it, and Circle delivers it to your account wallet. No {network} gas needed.
      </p>
      <div className={w.sheetField}>
        <span className={w.sheetLabelSm}>From</span>
        <div className={w.chainRow} role="group" aria-label="Source chain">
          {sources.map((s) => (
            <button key={s.id} type="button" className={w.chainChip} aria-pressed={source === s.id} onClick={() => { setSource(s.id); setError(null); }} disabled={busy}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className={w.sheetField}>
        <span className={w.sheetLabelSm}>Amount</span>
        <div className={w.amountWrap}>
          <Field label="Amount in USDC" hideLabel value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} placeholder="0.00" inputMode="decimal" autoComplete="off" disabled={busy} />
          <span className={w.amountSide}>USDC</span>
        </div>
      </div>
      <div className={w.summary}>
        <div><span>Route</span><span>{srcLabel} → {network}</span></div>
        <div><span>Arrives at</span><span className="app-mono">{recipient ? `${recipient.slice(0, 6)}…${recipient.slice(-4)}` : "…"}</span></div>
        <div><span>Circle fee</span><span className="app-mono">{fee != null ? `≈ ${fee} USDC` : quoting ? "Quoting…" : "Enter an amount"}</span></div>
      </div>

      {steps.length > 0 && (
        <ol className={w.bridgeSteps} aria-live="polite">
          {steps.map((s) => (
            <li key={s.name}>
              <span className={w.stepDot} data-state={s.state} aria-hidden>
                {s.state === "success" ? <Check size={12} strokeWidth={3} /> : s.state === "error" ? <X size={12} strokeWidth={3} /> : <Loader2 size={14} className={w.stepSpin} />}
              </span>
              {stepLabel(s.name, source)}
              {s.explorerUrl && <a href={s.explorerUrl} target="_blank" rel="noreferrer">View</a>}
            </li>
          ))}
        </ol>
      )}

      {!browserWallet && <Notice tone="info">Bridging needs a browser wallet (MetaMask, Rabby, Coinbase Wallet) holding USDC on {srcLabel}. Open this page in a browser that has one.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {outcome?.ok && <Notice tone="success">USDC delivered to your account wallet on {network}.</Notice>}

      <div className={w.sheetActions}>
        {outcome && !outcome.ok ? (
          <ActionButton onClick={resume} loading={busy} loadingLabel="Resuming">Resume transfer</ActionButton>
        ) : (
          <ActionButton type="submit" loading={busy} loadingLabel="Confirm in your wallet" disabled={!browserWallet || !recipient || outcome?.ok}>
            Bridge to {network}
          </ActionButton>
        )}
      </div>
      <p className={w.sheetFoot}>Powered by Circle CCTP. Native USDC is burned on {srcLabel} and minted on {network}; nothing is wrapped.</p>
    </form>
  );
}
