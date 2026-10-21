import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, Check, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { qk } from "../lib/api";
import { bridgeSources, bridgeToArc, estimateBridgeFee, hasBrowserWallet, retryBridge, stepLabel, type BridgeOutcome, type BridgeProgress } from "../lib/bridge";
import { walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { ArcMark } from "../ui/Marks";
import { Notice } from "../ui/misc";
import { ChainSelect } from "./ChainSelect";
import w from "./wallet.module.css";

const STEP_ORDER = ["approve", "burn", "fetchAttestation", "mint"];

function cleanAmount(text: string): string | null {
  const t = text.trim().replace(/,/g, "");
  return /^\d+(\.\d{1,6})?$/.test(t) && Number(t) > 0 ? t : null;
}
/** Money for display: 2 decimals, rounded down for what arrives and up for what it costs, so the quote never over-promises. */
const down2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);
const up2 = (n: number) => (n > 0 && n < 0.01 ? "<0.01" : (Math.ceil(n * 100) / 100).toFixed(2));

/**
 * Deposit from another chain: the browser wallet burns USDC on Ethereum, Arbitrum or Base with Circle's CCTP and
 * Circle's Forwarder mints it on Arc to the account wallet. Lives inside the deposit sheet; the sheet's watcher
 * confirms the arrival the same way it does for a direct transfer.
 */
/** What the success view shows for a bridged deposit: the source chain and both sides' explorer links. */
export interface BridgeArrival {
  sourceLabel: string;
  sourceLogo?: string;
  burnUrl?: string;
  mintUrl?: string;
}

export function BridgePanel({ onArrived }: { onArrived?: (info: BridgeArrival) => void }) {
  const { wallet, mock } = useAuth();
  const qc = useQueryClient();
  const sources = bridgeSources();
  const [source, setSource] = useState<string>(sources[0].id);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<BridgeProgress[]>([]);
  const [outcome, setOutcome] = useState<BridgeOutcome | null>(null);
  const recipient = wallet?.address ?? "";
  const network = ARC_NETWORK_NAMES[defaultNetwork()];
  const testnet = defaultNetwork() === "testnet";
  const src = sources.find((s) => s.id === source) ?? sources[0];
  const browserWallet = hasBrowserWallet(source);
  const walletKind = src.vm === "solana" ? "Solana wallet" : "browser wallet";
  const amt = cleanAmount(amount);
  const receive = amt && fee != null ? Math.max(0, Number(amt) - Number(fee)) : null;

  // Live quote of Circle's fee as the amount or route changes (debounced; no wallet prompt).
  useEffect(() => {
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
  }, [amt, source, recipient]);

  const track = (s: BridgeProgress) =>
    setSteps((prev) => prev.filter((p) => p.name !== s.name).concat(s).sort((a, b) => STEP_ORDER.indexOf(a.name) - STEP_ORDER.indexOf(b.name)));

  const finish = (r: BridgeOutcome) => {
    setOutcome(r);
    setSteps(r.steps.filter((s) => s.state !== "noop"));
    if (r.ok) {
      void qc.invalidateQueries({ queryKey: qk.balances(recipient || "none") });
      const url = (name: string) => r.steps.find((x) => x.name === name)?.explorerUrl;
      onArrived?.({ sourceLabel: src.label, sourceLogo: src.logo, burnUrl: url("burn"), mintUrl: url("mint") });
    } else setError("The transfer stopped part way. Your USDC is safe; resume it below.");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mock) return setError("Mock mode does not send transactions.");
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

  return (
    <form className={w.sheetSingle} onSubmit={submit} noValidate>
      <div className={w.bridgeStack}>
        <div className={w.bridgeCard}>
          <div className={w.bridgeCardHead}>
            <span className={w.sheetLabelSm}>From</span>
            <ChainSelect chains={sources} value={source} onChange={(id) => { setSource(id); setError(null); }} disabled={busy} suffix={testnet ? (src.vm === "solana" ? "devnet" : "testnet") : undefined} />
          </div>
          <div className={w.bridgeAmountRow}>
            <input
              className={w.bridgeAmount}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Amount in USDC"
              disabled={busy}
            />
            <span className={w.bridgeToken}><img src="/assets/usdc.svg" alt="" className={w.chainLogo} />USDC</span>
          </div>
          <span className={w.bridgeSub}>on {src.label}{testnet ? (src.vm === "solana" ? " devnet" : " testnet") : ""} · from your {walletKind}</span>
        </div>

        <span className={w.bridgeArrow} aria-hidden><ArrowDown size={14} strokeWidth={2.2} /></span>

        <div className={w.bridgeCard}>
          <div className={w.bridgeCardHead}>
            <span className={w.sheetLabelSm}>To</span>
            <span className={w.bridgeDest}><ArcMark size={14} />{network}</span>
          </div>
          <div className={w.bridgeAmountRow}>
            <span className={`${w.bridgeAmount} ${w.bridgeAmountMuted}`} aria-live="polite">{receive != null ? down2(receive) : quoting ? "…" : "0.00"}</span>
            <span className={w.bridgeToken}><img src="/assets/usdc.svg" alt="" className={w.chainLogo} />USDC</span>
          </div>
          <span className={w.bridgeSub}>to your account wallet {recipient ? <span className="app-mono">{recipient.slice(0, 6)}…{recipient.slice(-4)}</span> : "…"}</span>
        </div>
      </div>

      <div className={w.bridgeMeta}>
        <span>Circle fee {fee != null ? `${up2(Number(fee))} USDC` : quoting ? "…" : "–"}</span>
        <span className={w.statusSep}>·</span>
        <span>About 20 seconds</span>
        <span className={w.statusSep}>·</span>
        <span>No Arc gas needed</span>
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

      {!browserWallet && <Notice tone="info">{src.vm === "solana" ? `Bridging from Solana needs a Solana wallet such as Phantom, Solflare or Backpack holding USDC.` : `Bridging needs a browser wallet such as MetaMask or Rabby holding USDC on ${src.label}.`}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {outcome?.ok && <Notice tone="success">USDC delivered to your account wallet on {network}.</Notice>}

      {outcome && !outcome.ok ? (
        <ActionButton onClick={resume} loading={busy} loadingLabel="Resuming" fullWidth>Resume transfer</ActionButton>
      ) : (
        <ActionButton type="submit" loading={busy} loadingLabel="Confirm in your wallet" disabled={!browserWallet || !recipient || outcome?.ok} fullWidth>
          Bridge to {network}
        </ActionButton>
      )}
      <p className={w.sheetFoot}>Native USDC via Circle CCTP: burned on {src.label}, minted on Arc. Nothing is wrapped.</p>
    </form>
  );
}
