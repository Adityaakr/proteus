/**
 * FundFlow: the single "Fund deal from balance" approval. From a quote it signs the EIP-712 Terms with
 * the account wallet, records the acceptance, approves exactly the prepaid USDC and calls
 * createAndFundDeal (or asks the relayer to submit it). From an accepted deal it starts at the approval.
 */
import { useRef, useState, type ReactNode } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { ARC_TESTNET_FAUCET, explorerTx } from "@proteus/domain";
import { getAddress, type Address, type Hex, type WalletClient } from "viem";
import type { ToolApprovalStatus } from "../agentic/ToolApproval";
import type { TodoItem, TodoStatus } from "../agentic/TodoList";
import { ActionButton } from "../ui/ActionButton";
import { Money, formatMoney } from "../ui/Money";
import { ExplorerLink, MonoValue, Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { ApiError, api, errorMessage, qk, type Deal, type Quote } from "../lib/api";
import { approveUsdc, createAndFundDeal, readUsdcAllowance, readUsdcBalance, signTerms, waitForReceipt, walletErrorMessage } from "../lib/wallet";
import { useBalances } from "../wallet/useBalances";
import { fmtUnits } from "./common";
import f from "./fund.module.css";

const ZERO = "0x0000000000000000000000000000000000000000";
const PLACEHOLDER_SIG = ("0x" + "00".repeat(65)) as Hex;
type StepId = "sign" | "accept" | "approve" | "fund" | "confirm";
const UNFUNDED = ["awaiting_funding", "funding_pending"];

const dealMapKey = (quoteId: string) => `proteus:quote-deal:${quoteId}`;
export function rememberedDealFor(quoteId: string): string | null {
  try {
    return sessionStorage.getItem(dealMapKey(quoteId));
  } catch {
    return null;
  }
}
function rememberDeal(quoteId: string, dealId: string) {
  try {
    sessionStorage.setItem(dealMapKey(quoteId), dealId);
  } catch {
    /* ignore */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FundFlowProps {
  quote?: Quote;
  deal?: Deal;
  onFunded?: (deal: Deal) => void;
  onCancel?: () => void;
}

export function FundFlow({ quote, deal: initialDeal, onFunded, onCancel }: FundFlowProps) {
  const qc = useQueryClient();
  const { wallet, getWalletClient, mock } = useAuth();
  const bal = useBalances();
  const health = useQuery({ queryKey: qk.health, queryFn: api.health, staleTime: 60_000, retry: false });
  const relayerAvailable = !mock && Boolean(health.data?.relayer && health.data.relayer !== "none");

  const [deal, setDeal] = useState<Deal | undefined>(initialDeal);
  const dealRef = useRef<Deal | undefined>(initialDeal);
  const alreadyFunded = Boolean(initialDeal && !UNFUNDED.includes(initialDeal.status));
  const [steps, setSteps] = useState<Record<StepId, TodoStatus | "failed">>(() => ({
    sign: initialDeal ? "completed" : "pending",
    accept: initialDeal ? "completed" : "pending",
    approve: alreadyFunded ? "completed" : "pending",
    fund: alreadyFunded || initialDeal?.status === "funding_pending" ? "completed" : "pending",
    confirm: alreadyFunded ? "completed" : initialDeal?.status === "funding_pending" ? "in-progress" : "pending",
  }));
  const [txs, setTxs] = useState<{ approve?: Hex; fund?: Hex }>({ fund: initialDeal?.funding.txHash });
  const [useRelayer, setUseRelayer] = useState(false);
  const [phase, setPhase] = useState<ToolApprovalStatus>(alreadyFunded ? "complete" : "pending");
  const [err, setErr] = useState<string | null>(null);
  const [lowBalance, setLowBalance] = useState(false);
  const [before, setBefore] = useState<bigint | null>(null);
  const [after, setAfter] = useState<bigint | null>(null);
  const [mockNote, setMockNote] = useState(false);

  const amountMicro = deal?.terms.prepaid ?? quote?.terms?.prepaid ?? quote?.offer.prepaidTotal ?? "0";
  const units = deal?.terms.maxUnits ?? quote?.terms?.maxUnits ?? quote?.offer.units ?? "0";
  const escrow = (deal?.escrowAddress ?? quote?.escrowAddress) as Address | undefined;

  const mark = (id: StepId, st: TodoStatus | "failed") => setSteps((p) => ({ ...p, [id]: st }));
  const current = useRef<StepId>("sign");
  const step = async <R,>(id: StepId, fn: () => Promise<R>): Promise<R> => {
    current.current = id;
    mark(id, "in-progress");
    const r = await fn();
    mark(id, "completed");
    return r;
  };

  const run = async () => {
    setErr(null);
    setLowBalance(false);
    setPhase("approving");
    let client: WalletClient | null = null;
    const getClient = async () => (client ??= await getWalletClient());
    try {
      const start = (await bal.refetch()).data?.usdc ?? null;
      if (before === null) setBefore(start);

      let d = dealRef.current;
      if (!d) {
        if (!quote) throw new Error("Nothing to fund.");
        let account!: Address;
        const sig = await step("sign", async () => {
          if (mock) {
            account = wallet!.address;
            return PLACEHOLDER_SIG;
          }
          const c = await getClient();
          account = c.account!.address;
          const fresh = quote.typedData && quote.typedData.message.buyer.toLowerCase() !== ZERO ? quote : await api.quote(quote.id, account);
          if (!fresh.typedData) throw new Error("The server did not return terms to sign. Is the escrow configured?");
          const td = fresh.typedData.message.buyer.toLowerCase() === ZERO ? { ...fresh.typedData, message: { ...fresh.typedData.message, buyer: account } } : fresh.typedData;
          return signTerms(c, td);
        });
        setPhase("running");
        d = await step("accept", () => api.acceptQuote(quote.id, { buyerAddress: account, buyerSignature: sig }));
        rememberDeal(quote.id, d.id);
        qc.setQueryData(qk.deal(d.id), d);
        dealRef.current = d;
        setDeal(d);
      }
      const amount = BigInt(d.terms.prepaid);

      if (d.status === "awaiting_funding") {
        if (mock) {
          await step("approve", async () => undefined);
          setMockNote(true);
          setPhase("running");
          d = await step("fund", () => api.fundingIntent(d!.id, {}));
        } else {
          const c = await getClient();
          const account = c.account!.address;
          if (getAddress(account) !== getAddress(d.buyerAddress)) throw new Error("This deal was signed by a different wallet. Sign in with that account to fund it.");
          const have = await readUsdcBalance(account, d.usdcAddress);
          if (have < amount) {
            setLowBalance(true);
            throw new Error(`Not enough testnet USDC. This deal needs ${formatMoney(amount)} and your balance is ${formatMoney(have)}.`);
          }
          await step("approve", async () => {
            const allowance = await readUsdcAllowance(account, d!.escrowAddress, d!.usdcAddress);
            if (allowance >= amount) return;
            const hash = await approveUsdc(c, d!.escrowAddress, amount, d!.usdcAddress);
            setTxs((t) => ({ ...t, approve: hash }));
            setPhase("running");
            const r = await waitForReceipt(hash);
            if (r.status !== "success") throw new Error("The approval transaction reverted.");
          });
          setPhase("running");
          d = await step("fund", async () => {
            if (useRelayer) return api.fundingIntent(d!.id, {});
            const hash = await createAndFundDeal(c, d!.escrowAddress, d!.terms, d!.signatures.buyer, d!.signatures.seller);
            setTxs((t) => ({ ...t, fund: hash }));
            const intent = api.fundingIntent(d!.id, { txHash: hash }).catch(() => d!);
            const r = await waitForReceipt(hash);
            if (r.status !== "success") throw new Error("The funding transaction reverted.");
            return intent;
          });
        }
        dealRef.current = d;
        setDeal(d);
      } else {
        mark("approve", "completed");
        mark("fund", "completed");
      }

      setPhase("running");
      d = await step("confirm", async () => {
        let cur = d!;
        for (let i = 0; i < 40 && UNFUNDED.includes(cur.status); i++) {
          await sleep(2500);
          cur = await api.deal(cur.id);
        }
        if (UNFUNDED.includes(cur.status)) throw new Error("Funding is taking longer than usual. This page keeps the deal; check its status in Deals.");
        return cur;
      });
      dealRef.current = d;
      setDeal(d);
      if (d.funding.txHash) setTxs((t) => ({ ...t, fund: t.fund ?? d!.funding.txHash }));
      qc.setQueryData(qk.deal(d.id), d);
      void qc.invalidateQueries({ queryKey: ["me"] });
      setAfter((await bal.refetch()).data?.usdc ?? null);
      setPhase("complete");
    } catch (e) {
      mark(current.current, "failed");
      setErr(e instanceof ApiError ? errorMessage(e) : walletErrorMessage(e));
      setPhase("pending");
    }
  };

  const todo = (id: StepId, label: string, detail?: ReactNode): TodoItem => {
    const st = steps[id];
    return { id, label, status: st === "failed" ? "pending" : st, detail: st === "failed" ? "Stopped here. You can try again." : detail };
  };
  const items: TodoItem[] = [
    ...(quote && !initialDeal ? [todo("sign", "Sign the terms", "EIP-712 signature, no gas"), todo("accept", "Record your acceptance")] : []),
    todo("approve", "Approve exactly the prepaid USDC", txs.approve ? <ExplorerLink href={explorerTx(txs.approve)} hash={txs.approve} /> : mockNote ? "Skipped in mock mode" : undefined),
    todo("fund", useRelayer ? "Relayer funds the escrow" : "Fund the escrow", txs.fund ? <ExplorerLink href={explorerTx(txs.fund)} hash={txs.fund} /> : mockNote ? "Mock mode, no transaction sent" : undefined),
    todo("confirm", "Funding confirmed"),
  ];

  const done = phase === "complete";
  const label = !wallet ? "Waiting for your wallet" : err ? "Try again" : "Fund deal from balance";

  const busy = phase === "approving" || phase === "running";
  const stepClass = (st: TodoStatus | "failed") => (st === "completed" ? f.stepDone : st === "in-progress" ? f.stepActive : st === "failed" ? f.stepFailed : "");

  return (
    <>
      <span className={f.label}>Fund</span>
      <h2 className={f.railTitle}>{done ? "Escrow funded" : "Fund deal from balance"}</h2>
      <p className={f.railText}>{done ? "Your prepaid balance is now held by the escrow contract." : "One confirmation runs every step: sign the terms, approve exactly this amount, and move it into escrow. Unused funds are refundable after the term."}</p>
      <dl className={f.summary}>
        <div className={f.big}><dt>Prepaid amount</dt><dd><Money micro={amountMicro} unit /></dd></div>
        <div><dt>Units</dt><dd>{fmtUnits(units)}</dd></div>
        <div><dt>From</dt><dd>{wallet ? <MonoValue value={wallet.address} short /> : "Setting up your wallet"}</dd></div>
        <div><dt>Escrow</dt><dd>{escrow ? <MonoValue value={escrow} short /> : "Arc testnet escrow"}</dd></div>
        <div><dt>Your balance</dt><dd>{bal.data ? <Money micro={bal.data.usdc} unit /> : "Reading"}</dd></div>
        {before !== null && <div><dt>Balance before</dt><dd><Money micro={before} unit /></dd></div>}
        {done && after !== null && <div><dt>Balance after</dt><dd><Money micro={after} unit /></dd></div>}
      </dl>
      <ol className={f.stepList} aria-label="Funding steps">
        {items.map((it) => (
          <li key={it.id} className={`${f.step} ${stepClass(steps[it.id as StepId])}`}>
            <span className={f.stepIcon} aria-hidden>{steps[it.id as StepId] === "completed" && <Check size={11} strokeWidth={3} />}</span>
            <span className={f.stepBody}>
              <span>{it.label}</span>
              {it.detail && <span className={f.stepDetail}>{it.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {lowBalance && (
        <p className={f.fine}>
          Not enough testnet USDC. Get some from the <a href={ARC_TESTNET_FAUCET} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Circle faucet</a>, then try again. Your address is on the <a href="/app/wallet" style={{ textDecoration: "underline" }}>Wallet</a> page.
        </p>
      )}
      {!done && relayerAvailable && steps.fund !== "completed" && (
        <label className={f.check}>
          <input type="checkbox" checked={useRelayer} onChange={(e) => setUseRelayer(e.target.checked)} disabled={phase !== "pending"} />
          <span>Let PROTEUS submit the funding transaction. You still approve the USDC yourself.</span>
        </label>
      )}
      {err && <Notice tone="danger">{err}</Notice>}
      {!wallet && <p className={f.fine}>Your wallet is still being created. This takes a few seconds after sign in.</p>}
      <div className={f.actions}>
        {done && deal ? (
          <ActionButton onClick={() => onFunded?.(deal)} icon>Open your deal</ActionButton>
        ) : (
          <>
            <ActionButton onClick={run} loading={busy} loadingLabel={phase === "approving" ? "Confirm in your wallet" : "Working"} disabled={!wallet}>{label}</ActionButton>
            <button type="button" className={f.textBtn} onClick={onCancel} disabled={busy}>Not now</button>
          </>
        )}
      </div>
      {deal && !done && deal.status === "funding_pending" && phase === "pending" && <p className={f.fine}>Funding was submitted. Press the button to keep checking.</p>}
      <p className={f.fine}>Arc testnet. Testnet USDC has no value.</p>
    </>
  );
}
