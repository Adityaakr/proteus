import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, Send } from "lucide-react";
import { ARC_TESTNET_FAUCET, explorerAddress, explorerTx } from "@proteus/domain";
import { getAddress, type Hex } from "viem";
import { BuyerShell } from "../layouts/BuyerShell";
import { ToolApproval, type ToolApprovalStatus } from "../agentic/ToolApproval";
import { ReasoningText } from "../agentic/ReasoningText";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard, Skeleton } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { ExplorerLink, KeyValue, MonoValue, Notice } from "../ui/misc";
import { api, errorMessage, isMock, qk, type Deal } from "../lib/api";
import { approveUsdc, createAndFundDeal, readUsdcAllowance, readUsdcBalance, useWallet, waitForReceipt, walletErrorMessage } from "../lib/wallet";
import { ErrorState, PageHeader } from "./common";
import { WalletLine } from "./walletParts";
import s from "./buyer.module.css";

type Tx = { hash?: Hex; status: "idle" | "signing" | "pending" | "confirmed" | "failed"; error?: string };

export default function Checkout() {
  const { dealId = "" } = useParams();
  const dealQ = useQuery({
    queryKey: qk.deal(dealId),
    queryFn: () => api.deal(dealId),
    refetchInterval: (q) => (q.state.data && ["awaiting_funding", "funding_pending"].includes(q.state.data.status) ? 2500 : false),
  });
  const funded = dealQ.data && !["awaiting_funding", "funding_pending"].includes(dealQ.data.status);
  return (
    <BuyerShell stage={funded ? "Use" : "Fund"} sellerLabel={dealQ.data?.labels.seller}>
      {dealQ.isLoading ? (
        <LoadingCard label="Loading checkout" lines={6} />
      ) : dealQ.error || !dealQ.data ? (
        <ErrorState error={dealQ.error} onRetry={() => dealQ.refetch()} />
      ) : (
        <CheckoutView deal={dealQ.data} />
      )}
    </BuyerShell>
  );
}

function CheckoutView({ deal }: { deal: Deal }) {
  const qc = useQueryClient();
  const w = useWallet();
  const health = useQuery({ queryKey: qk.health, queryFn: api.health, staleTime: 60_000 });
  const amount = BigInt(deal.terms.prepaid);
  const mock = isMock();
  const buyerMatches = w.account && getAddress(w.account) === getAddress(deal.buyerAddress);

  const balanceQ = useQuery({
    queryKey: ["usdc", w.account, deal.usdcAddress, deal.escrowAddress],
    queryFn: async () => {
      const [balance, allowance] = await Promise.all([readUsdcBalance(w.account!, deal.usdcAddress), readUsdcAllowance(w.account!, deal.escrowAddress, deal.usdcAddress)]);
      return { balance, allowance };
    },
    enabled: Boolean(w.account),
    retry: 0,
  });

  const [approveTx, setApproveTx] = useState<Tx>({ status: "idle" });
  const [fundTx, setFundTx] = useState<Tx>({ status: "idle" });
  const allowanceOk = (balanceQ.data?.allowance ?? 0n) >= amount || approveTx.status === "confirmed";
  const balanceOk = (balanceQ.data?.balance ?? 0n) >= amount;

  const intent = useMutation({
    mutationFn: (txHash?: string) => api.fundingIntent(deal.id, txHash ? { txHash } : {}),
    onSuccess: (d) => qc.setQueryData(qk.deal(deal.id), d),
  });

  useEffect(() => {
    if (deal.funding.txHash && fundTx.status === "idle") setFundTx({ hash: deal.funding.txHash, status: deal.status === "funding_pending" ? "pending" : "confirmed" });
  }, [deal.funding.txHash, deal.status, fundTx.status]);

  /** Connects or switches chain first; returns true only when the wallet is ready to send. */
  const ensureReady = async () => {
    if (!w.account) {
      await w.connect();
      return false;
    }
    if (!w.onArc) {
      await w.switchToArc();
      return false;
    }
    return true;
  };

  const doApprove = async () => {
    if (!(await ensureReady())) return;
    setApproveTx({ status: "signing" });
    try {
      const hash = await approveUsdc(w.account!, deal.escrowAddress, amount, deal.usdcAddress);
      setApproveTx({ hash, status: "pending" });
      const r = await waitForReceipt(hash);
      setApproveTx({ hash, status: r.status === "success" ? "confirmed" : "failed", error: r.status === "success" ? undefined : "The approval transaction reverted." });
      balanceQ.refetch();
    } catch (e) {
      setApproveTx((t) => ({ ...t, status: "failed", error: walletErrorMessage(e) }));
    }
  };

  const doFund = async () => {
    if (!(await ensureReady())) return;
    setFundTx({ status: "signing" });
    try {
      const hash = await createAndFundDeal(w.account!, deal.escrowAddress, deal.terms, deal.signatures.buyer, deal.signatures.seller);
      setFundTx({ hash, status: "pending" });
      intent.mutate(hash);
      const r = await waitForReceipt(hash);
      setFundTx({ hash, status: r.status === "success" ? "confirmed" : "failed", error: r.status === "success" ? undefined : "The funding transaction reverted." });
      qc.invalidateQueries({ queryKey: qk.deal(deal.id) });
    } catch (e) {
      setFundTx((t) => ({ ...t, status: "failed", error: walletErrorMessage(e) }));
    }
  };

  const relayerAvailable = mock || (health.data?.relayer && health.data.relayer !== "none");
  const pending = deal.status === "funding_pending";
  const done = !["awaiting_funding", "funding_pending"].includes(deal.status);

  if (done) {
    return (
      <>
        <PageHeader eyebrow={<StatusTag state={deal.status} />} title="Escrow funded" lede="Your prepaid balance is held by the escrow contract. The seller is paid only for usage you acknowledge." />
        <Card title="You are all set" actions={<CheckCircle2 size={22} strokeWidth={2} color="var(--c-green-ink)" aria-hidden />}>
          <KeyValue
            items={[
              { k: "Deposited", v: <Money micro={deal.balances.deposit} unit /> },
              { k: "Funding transaction", v: deal.funding.txHash ? <ExplorerLink href={deal.funding.explorerUrl ?? explorerTx(deal.funding.txHash)} hash={deal.funding.txHash} /> : mock ? "None, mock mode does not send transactions" : "Submitted by the relayer" },
              { k: "Balance source", v: deal.balances.source === "chain" ? "Read from chain" : "Pending chain confirmation" },
            ]}
          />
          <div>
            <ActionButton to={`/portal/deals/${deal.id}`} icon>
              Open your deal portal
            </ActionButton>
          </div>
        </Card>
      </>
    );
  }

  const approveStatus: ToolApprovalStatus = allowanceOk ? "complete" : approveTx.status === "signing" ? "approving" : approveTx.status === "pending" ? "running" : "pending";
  const fundStatus: ToolApprovalStatus = pending || fundTx.status === "pending" ? "running" : fundTx.status === "signing" || intent.isPending ? "approving" : fundTx.status === "confirmed" ? "complete" : "pending";
  const walletBlocked = !w.available || mock;
  const walletLabel = !w.account ? "Connect wallet" : !w.onArc ? "Switch to Arc testnet" : null;

  return (
    <>
      <PageHeader
        eyebrow={<StatusTag state={deal.status} />}
        title="Fund the escrow"
        lede="Two wallet steps: allow the escrow to pull the exact prepaid amount, then fund the deal. Unused funds are refundable after the term."
      />
      <div className={s.grid2}>
        <div className={s.stack}>
          <ToolApproval
            tool="usdc.approve"
            title="Step 1. Allow the escrow to use your USDC"
            description="Approves exactly the prepaid amount. Nothing leaves your wallet yet."
            icon={<Coins size={18} strokeWidth={2} />}
            moneyMovement
            status={approveStatus}
            parameters={[
              { label: "Amount", value: <Money micro={deal.terms.prepaid} unit />, mono: true },
              { label: "Spender (escrow)", value: <MonoValue value={deal.escrowAddress} short /> },
              { label: "Token", value: "USDC on Arc testnet" },
            ]}
            approveLabel={walletLabel ?? "Approve USDC"}
            onApprove={doApprove}
            disabled={walletBlocked || (Boolean(w.account) && w.onArc && !balanceOk && !balanceQ.isLoading)}
            disabledReason={mock ? "Mock mode: onchain steps are disabled because this deal does not exist onchain." : !w.available ? "Connect a browser wallet to approve USDC." : !balanceOk ? "Your USDC balance is below the prepaid amount." : undefined}
            error={approveTx.error}
          >
            {approveTx.hash && <TxLine label="Approval" tx={approveTx} />}
          </ToolApproval>

          <ToolApproval
            tool="escrow.createAndFundDeal"
            title="Step 2. Fund the deal"
            description="Moves the prepaid amount into escrow under the terms both sides signed."
            icon={<Send size={18} strokeWidth={2} />}
            moneyMovement
            status={fundStatus}
            parameters={[
              { label: "Deal id", value: <MonoValue value={deal.dealIdOnchain} short />, mono: true },
              { label: "Amount", value: <Money micro={deal.terms.prepaid} unit />, mono: true },
              { label: "Escrow", value: <MonoValue value={deal.escrowAddress} short /> },
            ]}
            approveLabel={walletLabel ?? "Fund from my wallet"}
            onApprove={doFund}
            disabled={walletBlocked || !allowanceOk || (Boolean(w.account) && !buyerMatches)}
            disabledReason={
              mock
                ? "Mock mode: use Simulate funding to continue without a transaction."
                : !w.available
                  ? "Connect a browser wallet to fund the deal."
                  : w.account && !buyerMatches
                    ? "Switch to the wallet that signed the terms."
                    : !allowanceOk
                      ? "Finish step 1 first."
                      : undefined
            }
            error={fundTx.error ?? (intent.error ? errorMessage(intent.error) : undefined)}
          >
            {fundTx.hash && <TxLine label="Funding" tx={fundTx} />}
            {pending && (
              <p className="body3" role="status">
                <ReasoningText phrases={["Waiting for the funding to confirm", "Reading the escrow balance"]} variant="swap" srLabel="Waiting for the funding to confirm" />
              </p>
            )}
            {!pending && relayerAvailable && (
              <div className={s.stackTight}>
                <hr className={s.divider} />
                <p className="body3">
                  {mock ? "Simulate the relayer path. No transaction is sent in mock mode." : "Prefer not to send the transaction yourself? The relayer submits createAndFundDeal with both signatures. Step 1 is still required."}
                </p>
                <div>
                  <ActionButton variant="secondary" onClick={() => intent.mutate(undefined)} loading={intent.isPending && !fundTx.hash} disabled={!mock && !allowanceOk}>
                    {mock ? "Simulate funding" : "Ask the relayer"}
                  </ActionButton>
                </div>
              </div>
            )}
          </ToolApproval>
        </div>

        <div className={`${s.stack} ${s.sticky}`}>
          <Card title="Payment summary" level={2}>
            <span className={s.bigValue}>
              <Money micro={deal.terms.prepaid} />
            </span>
            <KeyValue
              items={[
                { k: "Network", v: <span className={s.row}>Arc testnet <StatusTag network="testnet" /></span> },
                { k: "Escrow", v: <span className={s.row}><MonoValue value={deal.escrowAddress} short copy label="escrow address" /><a className="body3" href={explorerAddress(deal.escrowAddress)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Explorer</a></span> },
                { k: "Signed by", v: <MonoValue value={deal.buyerAddress} short /> },
                {
                  k: "Your USDC",
                  v: !w.account ? "Connect a wallet to see your balance" : balanceQ.isLoading ? <Skeleton width={90} /> : balanceQ.error ? "Could not read balance" : <Money micro={balanceQ.data?.balance ?? 0n} unit />,
                },
              ]}
            />
            <WalletLine w={w} />
            {w.account && !w.onArc && (
              <ActionButton variant="secondary" onClick={() => w.switchToArc()}>Switch to Arc testnet</ActionButton>
            )}
            {w.account && balanceQ.data && !balanceOk && (
              <Notice tone="warn" title="Not enough testnet USDC">
                Get free testnet USDC from the{" "}
                <a href={ARC_TESTNET_FAUCET} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  Circle faucet
                </a>
                , then refresh.
              </Notice>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function TxLine({ label, tx }: { label: string; tx: Tx }) {
  return (
    <div className={s.txRow} role="status" aria-live="polite">
      <StatusTag state={tx.status === "confirmed" ? "confirmed" : tx.status === "failed" ? "failed" : "pending"} label={tx.status === "confirmed" ? `${label} confirmed` : tx.status === "failed" ? `${label} failed` : `${label} pending`} />
      {tx.hash && <ExplorerLink href={explorerTx(tx.hash)} hash={tx.hash} />}
    </div>
  );
}
