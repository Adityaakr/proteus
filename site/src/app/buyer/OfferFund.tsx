import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ReasoningText } from "../agentic/ReasoningText";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Stepper } from "../ui/Stepper";
import { KeyValue, MonoValue, Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { api, qk, type Quote } from "../lib/api";
import { ErrorState, FLOW_STAGES, PageHeader, fmtDateTime, fmtUnits, prettyIntegration } from "./common";
import { FundFlow, rememberedDealFor } from "./FundFlow";
import s from "./buyer.module.css";

/** Offer and checkout in one screen: the terms, then one "Fund deal from balance" approval. */
export default function OfferFund() {
  const { quoteId = "" } = useParams();
  const { wallet } = useAuth();
  const quoteQ = useQuery({
    queryKey: [...qk.quote(quoteId), wallet?.address ?? "anon"],
    queryFn: () => api.quote(quoteId, wallet?.address),
    refetchInterval: (q) => (q.state.data?.status === "approval_required" ? 3000 : false),
  });
  return (
    <AppShell title="Offer">
      {quoteQ.isLoading ? (
        <LoadingCard label="Loading the offer" lines={6} />
      ) : quoteQ.error || !quoteQ.data ? (
        <ErrorState error={quoteQ.error} onRetry={() => quoteQ.refetch()} />
      ) : (
        <OfferView quote={quoteQ.data} />
      )}
    </AppShell>
  );
}

function OfferView({ quote }: { quote: Quote }) {
  const navigate = useNavigate();
  const o = quote.offer;
  const pt = quote.publicTerms;
  const acceptable = quote.status === "draft" || quote.status === "approved";
  const knownDealId = rememberedDealFor(quote.id);
  const dealQ = useQuery({ queryKey: qk.deal(knownDealId ?? "none"), queryFn: () => api.deal(knownDealId!), enabled: Boolean(knownDealId) && quote.status === "accepted" });
  const backToChat = `/app/negotiations/${quote.negotiationId}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <StatusTag state={quote.status} />
            <span className="body3">Expires {fmtDateTime(quote.expiresAt)}</span>
          </>
        }
        title="Review the terms and fund"
        lede="Check exactly what you are agreeing to. Funding signs these terms and moves the prepaid amount from your balance into escrow."
        actions={<Stepper current={1} steps={FLOW_STAGES} />}
      />

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card title={`${o.tierName}, ${fmtUnits(o.units)} units`} subtitle={`${pt.termDays}-day term, prepaid`} actions={<span className={s.bigValue}><Money usd={o.prepaidTotalUsd} /></span>}>
            <KeyValue
              items={[
                { k: "Price per unit", v: <Money usd={o.unitPriceUsd} digits={(o.unitPriceUsd.split(".")[1]?.length ?? 2) > 2 ? 4 : 2} /> },
                { k: "Billable unit", v: pt.billableUnit },
                { k: "Included", v: pt.includes.join(", ") },
                { k: "Integrations", v: pt.integrations.map(prettyIntegration).join(", ") || "None" },
                ...(pt.overage ? [{ k: "Overage", v: pt.overage }] : []),
                { k: "Refunds", v: pt.refundPolicy },
              ]}
            />
            {o.unsupportedIntegrations.length > 0 && <Notice tone="warn">{o.unsupportedIntegrations.map(prettyIntegration).join(", ")} is not supported and is excluded from these terms.</Notice>}
          </Card>
          <Card title="Onchain details" variant="muted" padding="compact">
            <KeyValue
              items={[
                { k: "Network", v: <span className={s.row}>Arc testnet <StatusTag network="testnet" /></span> },
                { k: "Chain id", v: <span className="app-mono">{quote.chainId}</span> },
                { k: "Escrow", v: <MonoValue value={quote.escrowAddress} short copy label="escrow address" /> },
                { k: "USDC", v: <MonoValue value={quote.usdcAddress} short copy label="USDC address" /> },
                { k: "Deal id", v: quote.terms ? <MonoValue value={quote.terms.dealId} short copy label="deal id" /> : <span className={s.muted}>Derived for your wallet</span> },
                { k: "Terms hash", v: quote.terms ? <MonoValue value={quote.terms.publicTermsHash} short copy label="public terms hash" /> : <span className={s.muted}>Derived for your wallet</span> },
              ]}
            />
          </Card>
        </div>

        <div className={`${s.stack} ${s.sticky}`}>
          {quote.status === "approval_required" ? (
            <Card title="Waiting for the seller" subtitle={quote.approval?.reason ?? "This agreement needs the seller's approval before you can fund it."}>
              <div className={s.row} role="status" aria-live="polite">
                <Clock3 size={16} strokeWidth={2} aria-hidden />
                <ReasoningText phrases={["Waiting for the seller's approval", "Checking again every few seconds"]} variant="swap" srLabel="Waiting for the seller's approval" />
              </div>
              <p className="body3">You can leave this page open. It updates as soon as the seller decides.</p>
              <ActionButton variant="secondary" to={backToChat}>Back to the negotiation</ActionButton>
            </Card>
          ) : acceptable ? (
            <FundFlow quote={quote} onFunded={(d) => navigate(`/app/deals/${d.id}`)} onCancel={() => navigate(backToChat)} />
          ) : quote.status === "accepted" && dealQ.data ? (
            <FundFlow deal={dealQ.data} onFunded={(d) => navigate(`/app/deals/${d.id}`)} onCancel={() => navigate(backToChat)} />
          ) : quote.status === "accepted" && dealQ.isLoading ? (
            <LoadingCard label="Loading your deal" lines={3} />
          ) : (
            <Card title={quote.status === "accepted" ? "Already accepted" : quote.status === "expired" ? "This offer expired" : "This offer was declined"}>
              <p className="body2">
                {quote.status === "accepted" ? "These terms were already signed. Your deal is listed under Deals." : quote.status === "declined" ? `The seller declined this agreement${quote.approval?.reason ? `: ${quote.approval.reason}` : "."}` : "Ask the agent for a fresh offer."}
              </p>
              <ActionButton to={quote.status === "accepted" ? "/app/deals" : backToChat}>{quote.status === "accepted" ? "Go to deals" : "Back to the negotiation"}</ActionButton>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
