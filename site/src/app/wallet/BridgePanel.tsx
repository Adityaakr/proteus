import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownUp, Check, Loader2, X } from "lucide-react";
import { isAddress } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { qk } from "../lib/api";
import { arcChain, bridgeDestinations, bridgeFromArc, bridgeSources, bridgeStepError, bridgeToArc, burnSent, estimateBridgeFee, retryBridge, retryBridgeFromArc, stepLabel, watchBridgeWallets, type BridgeOutcome, type BridgeProgress, type BridgeWallet } from "../lib/bridge";
import { walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { ArcMark } from "../ui/Marks";
import { Notice } from "../ui/misc";
import { ChainSelect } from "./ChainSelect";
import { useBalances } from "./useBalances";
import w from "./wallet.module.css";

const STEP_ORDER = ["approve", "burn", "fetchAttestation", "mint"];
/** Kept on Arc when sending out, so the wallet can still pay gas (approve and burn, in USDC) and its next action. */
const GAS_RESERVE = 0.05;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const WALLET_KEY = "proteus:bridge-wallet";

function rememberedWallet(vm: string): string | null {
  try { return localStorage.getItem(`${WALLET_KEY}:${vm}`); } catch { return null; }
}
function rememberWallet(vm: string, id: string) {
  try { localStorage.setItem(`${WALLET_KEY}:${vm}`, id); } catch { /* the choice just is not remembered */ }
}

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

export function BridgePanel({ onArrived, onDirection }: { onArrived?: (info: BridgeArrival) => void; onDirection?: (outbound: boolean) => void }) {
  const { wallet, mock, getWalletClient } = useAuth();
  const qc = useQueryClient();
  const sources = bridgeSources();
  const destinations = bridgeDestinations();
  const [outbound, setOutbound] = useState(false);
  const [source, setSource] = useState<string>(sources[0].id);
  const [destination, setDestination] = useState<string>(destinations.find((d) => d.label === "Base")?.id ?? destinations[0].id);
  const [sendTo, setSendTo] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<BridgeProgress[]>([]);
  const [outcome, setOutcome] = useState<BridgeOutcome | null>(null);
  const account = wallet?.address ?? "";
  const dest = destinations.find((d) => d.id === destination) ?? destinations[0];
  // Same address on other EVM chains by default; a Solana address can only come from the person.
  const recipient = outbound ? (sendTo ?? (dest.vm === "evm" ? account : "")) : account;
  const recipientOk = !outbound || (dest.vm === "solana" ? SOLANA_ADDRESS.test(recipient) : isAddress(recipient));
  const bal = useBalances({ poll: outbound ? 8_000 : false });
  const from = outbound ? arcChain() : source;
  const to = outbound ? destination : arcChain();
  const network = ARC_NETWORK_NAMES[defaultNetwork()];
  const testnet = defaultNetwork() === "testnet";
  const src = sources.find((s) => s.id === source) ?? sources[0];
  const [wallets, setWallets] = useState<BridgeWallet[]>([]);
  const [chosenWallet, setChosenWallet] = useState<string | null>(null);
  // Phantom also answers for EVM chains; it is only the default there when nothing else is installed.
  const signer = wallets.find((w) => w.id === chosenWallet) ?? wallets.find((w) => w.id === rememberedWallet(src.vm)) ?? wallets.find((w) => src.vm === "solana" || !/phantom/i.test(w.name)) ?? wallets[0];
  const walletKind = src.vm === "solana" ? "Solana wallet" : "browser wallet";
  const amt = cleanAmount(amount);
  const receive = amt && fee != null ? Math.max(0, Number(amt) - Number(fee)) : null;

  useEffect(() => {
    setChosenWallet(null);
    return watchBridgeWallets(src.vm, setWallets);
  }, [src.vm]);

  // Live quote of Circle's fee as the amount or route changes (debounced; no wallet prompt).
  useEffect(() => {
    setFee(null);
    if (!amt || !recipient || !recipientOk) return;
    let live = true;
    const t = window.setTimeout(() => {
      setQuoting(true);
      estimateBridgeFee(from, to, amt, recipient)
        .then((f) => live && setFee(f))
        .catch(() => live && setFee(null))
        .finally(() => live && setQuoting(false));
    }, 450);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [amt, from, to, recipient, recipientOk]);

  const track = (s: BridgeProgress) =>
    setSteps((prev) => prev.filter((p) => p.name !== s.name).concat(s).sort((a, b) => STEP_ORDER.indexOf(a.name) - STEP_ORDER.indexOf(b.name)));

  const finish = (r: BridgeOutcome) => {
    setSteps(r.steps.filter((s) => s.state !== "noop"));
    // Only a burned transfer can be resumed; before that nothing has left the wallet, so it simply starts again.
    if (!r.ok && !burnSent(r.steps)) {
      setOutcome(null);
      return setError(`${bridgeStepError(r.steps)} No USDC left your wallet.`);
    }
    setOutcome(r);
    if (r.ok) {
      void qc.invalidateQueries({ queryKey: qk.balances(account || "none") });
      const url = (name: string) => r.steps.find((x) => x.name === name)?.explorerUrl;
      if (!outbound) onArrived?.({ sourceLabel: src.label, sourceLogo: src.logo, burnUrl: url("burn"), mintUrl: url("mint") });
    } else setError(`Your transfer from ${outbound ? "Arc" : src.label} was sent but has not arrived yet. ${bridgeStepError(r.steps)} Resume below; it will not be sent twice.`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mock) return setError("Mock mode does not send transactions.");
    if (!amt) return setError("Enter an amount in USDC, up to 6 decimals.");
    if (!account) return setError("Your account wallet is still being set up.");
    if (!outbound && !signer) return setError(`No ${walletKind} found in this browser.`);
    if (outbound && !recipientOk) return setError(`Enter a valid ${dest.vm === "solana" ? "Solana" : dest.label} address to receive the USDC.`);
    if (outbound && bal.data && Number(amt) > Number(bal.data.usdc) / 1e6 - GAS_RESERVE) return setError(`You can send up to ${Math.max(0, Number(bal.data.usdc) / 1e6 - GAS_RESERVE).toFixed(2)} USDC; ${GAS_RESERVE} is kept for gas on Arc.`);
    if (outbound && fee != null && Number(amt) <= Number(fee)) return setError(`The amount has to be more than Circle's ${up2(Number(fee))} USDC fee to ${dest.label}.`);
    setError(null);
    setSteps([]);
    setOutcome(null);
    setBusy(true);
    try {
      finish(outbound ? await bridgeFromArc(await getWalletClient(), destination, amt, recipient, track) : await bridgeToArc(source, signer!, amt, recipient, track));
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!outcome || (!outbound && !signer)) return;
    setError(null);
    setBusy(true);
    try {
      finish(outbound ? await retryBridgeFromArc(outcome, await getWalletClient(), destination, recipient) : await retryBridge(outcome, source, signer!, recipient));
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const flip = () => {
    const next = !outbound;
    setOutbound(next);
    onDirection?.(next);
    setSendTo(null);
    setAmount("");
    setError(null);
    setSteps([]);
    setOutcome(null);
  };
  const stuck = Boolean(outcome && !outcome.ok);

  return (
    <form className={w.sheetSingle} onSubmit={submit} noValidate>
      <div className={w.bridgeStack}>
        <div className={w.bridgeCard}>
          <div className={w.bridgeCardHead}>
            <span className={w.sheetLabelSm}>From</span>
            {outbound ? (
              <span className={w.bridgeDest}><ArcMark size={14} />{network}</span>
            ) : (
              <ChainSelect chains={sources} value={source} onChange={(id) => { setSource(id); setError(null); }} disabled={busy} suffix={testnet ? (src.vm === "solana" ? "devnet" : "testnet") : undefined} />
            )}
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
          {outbound ? (
            <span className={w.bridgeSub}>from your account wallet {account ? <span className="app-mono">{account.slice(0, 6)}…{account.slice(-4)}</span> : "…"}</span>
          ) : (
            <div className={w.bridgeFrom}>
              <span className={w.bridgeSub}>on {src.label}{testnet ? (src.vm === "solana" ? " devnet" : " testnet") : ""} · from {wallets.length ? "" : `your ${walletKind}`}</span>
              {wallets.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={w.walletPick}
                  aria-pressed={x.id === signer?.id}
                  disabled={busy || stuck}
                  onClick={() => { setChosenWallet(x.id); rememberWallet(src.vm, x.id); setError(null); }}
                >
                  {x.icon && <img src={x.icon} alt="" />}{x.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className={w.bridgeArrow} onClick={flip} disabled={busy || stuck} aria-label={outbound ? "Switch to bringing USDC to Arc" : "Switch to sending USDC from Arc"} title="Switch direction">
          <ArrowDownUp size={14} strokeWidth={2.2} />
        </button>

        <div className={w.bridgeCard}>
          <div className={w.bridgeCardHead}>
            <span className={w.sheetLabelSm}>To</span>
            {outbound ? (
              <ChainSelect chains={destinations} value={destination} onChange={(id) => { setDestination(id); setSendTo(null); setError(null); }} disabled={busy} suffix={testnet ? (dest.vm === "solana" ? "devnet" : "testnet") : undefined} />
            ) : (
              <span className={w.bridgeDest}><ArcMark size={14} />{network}</span>
            )}
          </div>
          <div className={w.bridgeAmountRow}>
            <span className={`${w.bridgeAmount} ${w.bridgeAmountMuted}`} aria-live="polite">{receive != null ? down2(receive) : quoting ? "…" : "0.00"}</span>
            <span className={w.bridgeToken}><img src="/assets/usdc.svg" alt="" className={w.chainLogo} />USDC</span>
          </div>
          {outbound ? (
            <input
              className={w.bridgeRecipient}
              value={recipient}
              onChange={(e) => { setSendTo(e.target.value.trim()); setError(null); }}
              placeholder={dest.vm === "solana" ? "Solana address that receives the USDC" : "0x address that receives the USDC"}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Address on ${dest.label} that receives the USDC`}
              aria-invalid={Boolean(recipient) && !recipientOk}
              disabled={busy || stuck}
            />
          ) : (
            <span className={w.bridgeSub}>to your account wallet {account ? <span className="app-mono">{account.slice(0, 6)}…{account.slice(-4)}</span> : "…"}</span>
          )}
        </div>
      </div>

      <div className={w.bridgeMeta}>
        <span>Circle fee {fee != null ? `${up2(Number(fee))} USDC` : quoting ? "…" : "–"}</span>
        <span className={w.statusSep}>·</span>
        <span>About 20 seconds</span>
        <span className={w.statusSep}>·</span>
        <span>{outbound ? `No gas needed on ${dest.label}` : "No Arc gas needed"}</span>
      </div>

      {steps.length > 0 && (
        <ol className={w.bridgeSteps} aria-live="polite">
          {steps.map((s) => (
            <li key={s.name}>
              <span className={w.stepDot} data-state={s.state} aria-hidden>
                {s.state === "success" ? <Check size={12} strokeWidth={3} /> : s.state === "error" ? <X size={12} strokeWidth={3} /> : <Loader2 size={14} className={w.stepSpin} />}
              </span>
              {stepLabel(s.name, from, to)}
              {s.explorerUrl && <a href={s.explorerUrl} target="_blank" rel="noreferrer">View</a>}
            </li>
          ))}
        </ol>
      )}

      {!outbound && !signer && <Notice tone="info">{src.vm === "solana" ? `Bridging from Solana needs a Solana wallet such as Phantom, Solflare or Backpack holding USDC.` : `Bridging needs a browser wallet such as MetaMask or Rabby holding USDC on ${src.label}.`}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {outcome?.ok && <Notice tone="success">{outbound ? `USDC delivered to ${recipient.slice(0, 6)}…${recipient.slice(-4)} on ${dest.label}.` : `USDC delivered to your account wallet on ${network}.`}</Notice>}

      {outcome && !outcome.ok ? (
        <ActionButton onClick={resume} loading={busy} loadingLabel="Resuming" fullWidth>Resume transfer</ActionButton>
      ) : (
        <ActionButton type="submit" loading={busy} loadingLabel="Confirm in your wallet" disabled={outbound ? !account || !recipientOk || outcome?.ok : !signer || !account || outcome?.ok} fullWidth>
          {outbound ? `Send to ${dest.label}` : `Bridge to ${network}`}
        </ActionButton>
      )}
      <p className={w.sheetFoot}>Native USDC via Circle CCTP: burned on {outbound ? "Arc" : src.label}, minted on {outbound ? dest.label : "Arc"}. Nothing is wrapped.</p>
    </form>
  );
}
