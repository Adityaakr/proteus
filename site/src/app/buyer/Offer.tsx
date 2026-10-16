import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, FileSignature } from "lucide-react";
import type { Address, Hex } from "viem";
import { BuyerShell } from "../layouts/BuyerShell";
import { ToolApproval, type ToolApprovalStatus } from "../agentic/ToolApproval";
import { ReasoningText } from "../agentic/ReasoningText";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { KeyValue, MonoValue, Notice } from "../ui/misc";
import { api, errorMessage, isMock, qk, type Quote } from "../lib/api";
import { signTerms, useWallet, walletErrorMessage } from "../lib/wallet";
import { ErrorState, PageHeader, fmtDateTime, fmtUnits, prettyIntegration } from "./common";
import { WalletLine } from "./walletParts";
import s from "./buyer.module.css";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEMO_BUYER = "0x000000000000000000000000000000000000dEaD" as Address;

export default function OfferPage() {
  const { quoteId = "" } = useParams();
  const w = useWallet();
  const quoteQ = useQuery({
    queryKey: [...qk.quote(quoteId), w.account ?? "anon"],
    queryFn: () => api.quote(quoteId, w.account ?? undefined),
    refetchInterval: (q) => (q.state.data?.status === "approval_required" ? 3000 : false),
  });

  return (
    <BuyerShell stage="Accept">
      {quoteQ.isLoading ? (
        <LoadingCard label="Loading the offer" lines={6} />
      ) : quoteQ.error || !quoteQ.data ? (
        <ErrorState error={quoteQ.error} onRetry={() => quoteQ.refetch()} />
      ) : (
        <OfferView quote={quoteQ.data} />
      )}
    </BuyerShell>
  );
}

function OfferView({ quote }: { quote: Quote }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const w = useWallet();
  const [phase, setPhase] = useState<ToolApprovalStatus>("pending");
  const [err, setErr] = useState<string | null>(null);
  const o = quote.offer;
  const pt = quote.publicTerms;
  const acceptable = quote.status === "draft" || quote.status === "approved";

  const accept = useMutation({
    mutationFn: (v: { buyerAddress: string; buyerSignature: string }) => api.acceptQuote(quote.id, v),
    onSuccess: (deal) => {
      setPhase("complete");
      qc.setQueryData(qk.deal(deal.id), deal);
      navigate(`/checkout/${deal.id}`);
    },
    onError: (e) => {
      setErr(errorMessage(e));
      setPhase("pending");
    },
  });

  const sign = async () => {
    setErr(null);
    let account = w.account;
    if (!account) {
      account = await w.connect();
      if (!account) return;
      return; // connected; the next click signs
    }
    if (!w.onArc) {
      await w.switchToArc();
      return;
    }
    setPhase("approving");
    try {
      // Fill in the buyer if the server left it open until a wallet is known.
      // The server materializes Terms for a specific buyer; fetch them for the connected account if missing.
      const fresh = quote.typedData ? quote : await api.quote(quote.id, account);
      if (!fresh.typedData) throw new Error("The server did not return terms to sign. Is the escrow configured?");
      const td = fresh.typedData.message.buyer.toLowerCase() === ZERO ? { ...fresh.typedData, message: { ...fresh.typedData.message, buyer: account } } : fresh.typedData;
      const sig: Hex = await signTerms(account, td);
      setPhase("running");
      accept.mutate({ buyerAddress: account, buyerSignature: sig });
    } catch (e) {
      setErr(walletErrorMessage(e));
      setPhase("pending");
    }
  };

  const demoSign = () => {
    setErr(null);
    setPhase("running");
    accept.mutate({ buyerAddress: DEMO_BUYER, buyerSignature: "0x" + "00".repeat(65) });
  };

  const approveLabel = !w.available ? "Connect wallet" : !w.account ? "Connect wallet" : !w.onArc ? "Switch to Arc testnet" : "Sign terms";

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <StatusTag state={quote.status} />
            <span className="body3">Expires {fmtDateTime(quote.expiresAt)}</span>
          </>
        }
        title="Review and sign the terms"
        lede="Signing records your acceptance of exactly these terms. Funds move only in the next step, when you fund the escrow."
      />

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card title={`${o.tierName}, ${fmtUnits(o.units)} resolutions`} subtitle={`${pt.termDays}-day term, prepaid`} actions={<span className={s.bigValue}><Money usd={o.prepaidTotalUsd} /></span>}>
            <KeyValue
              items={[
                { k: "Price per unit", v: <Money usd={o.unitPriceUsd} digits={o.unitPriceUsd.split(".")[1]!.length > 2 ? 4 : 2} /> },
                { k: "Billable unit", v: pt.billableUnit },
                { k: "Included", v: pt.includes.join(", ") },
                { k: "Integrations", v: pt.integrations.map(prettyIntegration).join(", ") || "None" },
                ...(pt.overage ? [{ k: "Overage", v: pt.overage }] : []),
                { k: "Refunds", v: pt.refundPolicy },
              ]}
            />
            {o.unsupportedIntegrations.length > 0 && <Notice tone="warn">{o.unsupportedIntegrations.map(prettyIntegration).join(", ")} is not supported and is excluded from these terms.</Notice>}
          </Card>
          <Card title="Onchain details" variant="muted" padding="compact" level={2}>
            <KeyValue
              items={[
                { k: "Network", v: <span className={s.row}>Arc testnet <StatusTag network="testnet" /></span> },
                { k: "Chain id", v: <span className="app-mono">{quote.chainId}</span> },
                { k: "Escrow", v: <MonoValue value={quote.escrowAddress} short copy label="escrow address" /> },
                { k: "USDC", v: <MonoValue value={quote.usdcAddress} short copy label="USDC address" /> },
                { k: "Deal id", v: <MonoValue value={quote.terms.dealId} short copy label="deal id" /> },
                { k: "Terms hash", v: <MonoValue value={quote.terms.publicTermsHash} short copy label="public terms hash" /> },
              ]}
            />
          </Card>
        </div>

        <div className={`${s.stack} ${s.sticky}`}>
          {quote.status === "approval_required" ? (
            <Card title="Waiting for the seller" subtitle={quote.approval?.reason ?? "This agreement needs the seller's approval before you can sign."}>
              <div className={s.row} role="status" aria-live="polite">
                <Clock3 size={16} strokeWidth={2} aria-hidden />
                <ReasoningText phrases={["Waiting for the seller's approval", "Checking again every few seconds"]} variant="swap" srLabel="Waiting for the seller's approval" />
              </div>
              <p className="body3">You can leave this page open. It updates as soon as the seller decides.</p>
              <ActionButton variant="secondary" to={`/negotiate/${quote.negotiationId}`}>Back to the negotiation</ActionButton>
            </Card>
          ) : !acceptable ? (
            <Card title={quote.status === "accepted" ? "Already accepted" : quote.status === "expired" ? "This offer expired" : "This offer was declined"}>
              <p className="body2">
                {quote.status === "accepted" ? "These terms were already signed." : quote.status === "declined" ? `The seller declined this agreement${quote.approval?.reason ? `: ${quote.approval.reason}` : "."}` : "Ask the agent for a fresh offer."}
              </p>
              <ActionButton to={`/negotiate/${quote.negotiationId}`}>Back to the negotiation</ActionButton>
            </Card>
          ) : (
            <ToolApproval
              tool="wallet.signTypedData"
              title="Sign the agreement terms"
              description="Your wallet asks you to sign an EIP-712 message. It costs no gas and moves no funds."
              icon={<FileSignature size={18} strokeWidth={2} />}
              moneyMovement
              status={phase}
              parameters={[
                { label: "Prepaid amount", value: <Money micro={quote.terms.prepaid} unit />, mono: true },
                { label: "Units", value: fmtUnits(quote.terms.maxUnits), mono: true },
                { label: "Network", value: "Arc testnet" },
                { label: "Signer", value: w.account ? <MonoValue value={w.account} short /> : "Not connected" },
              ]}
              approveLabel={approveLabel}
              denyLabel="Not now"
              onApprove={sign}
              onDeny={() => navigate(`/negotiate/${quote.negotiationId}`)}
              disabled={!w.available}
              disabledReason={
                !w.available ? (
                  <span style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span>No browser wallet found, so signing is unavailable.</span>
                    {isMock() && (
                      <ActionButton variant="secondary" onClick={demoSign} loading={accept.isPending}>
                        Continue with a demo signature
                      </ActionButton>
                    )}
                  </span>
                ) : undefined
              }
              error={err ?? w.error}
            >
              <WalletLine w={w} />
              {phase === "running" && (
                <p className="body3" role="status">
                  <ReasoningText text="Recording your acceptance" variant="swap" />
                </p>
              )}
            </ToolApproval>
          )}
        </div>
      </div>
    </>
  );
}
