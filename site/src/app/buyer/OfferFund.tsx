import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3 } from "lucide-react";
import { explorerAddress, publicTermsHash } from "@proteus/domain";
import { AppShell } from "../layouts/AppShell";
import { ReasoningText } from "../agentic/ReasoningText";
import { ActionButton } from "../ui/ActionButton";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { MonoValue } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { api, qk, type Quote } from "../lib/api";
import { ErrorState, FLOW_STAGES, fmtDateTime, fmtUnits, prettyIntegration } from "./common";
import { FundFlow, rememberedDealFor } from "./FundFlow";
import f from "./fund.module.css";

/** Offer and checkout in one screen: the terms as a document, then one "Fund deal from balance" approval in the rail. */
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

const STATUS_LABEL: Record<string, string> = { draft: "Ready to sign", approved: "Approved by the seller", approval_required: "Waiting for the seller", accepted: "Signed", declined: "Declined", expired: "Expired" };

function OfferView({ quote }: { quote: Quote }) {
  const navigate = useNavigate();
  const o = quote.offer;
  const pt = quote.publicTerms;
  // The public terms hash the contract stores is the keccak of the canonical JSON of these terms; recompute it here so the buyer can see it matches.
  const hashMatches = Boolean(quote.terms && pt && publicTermsHash(pt as unknown as Record<string, unknown>).toLowerCase() === quote.terms.publicTermsHash.toLowerCase());
  const acceptable = quote.status === "draft" || quote.status === "approved";
  const knownDealId = rememberedDealFor(quote.id);
  const dealQ = useQuery({ queryKey: qk.deal(knownDealId ?? "none"), queryFn: () => api.deal(knownDealId!), enabled: Boolean(knownDealId) && quote.status === "accepted" });
  const backToChat = `/app/negotiations/${quote.negotiationId}`;
  const unitDigits = (o.unitPriceUsd.split(".")[1]?.replace(/0+$/, "").length ?? 0) > 2 ? 4 : 2;
  const badge = quote.status === "accepted" || quote.status === "approved" ? f.badgeOk : quote.status === "approval_required" ? f.badgeWarn : "";

  return (
    <div className={f.page}>
      <article className={f.doc}>
        <header className={f.head}>
          <div className={f.eyebrow}>
            <span className={`${f.badge} ${badge}`}>{STATUS_LABEL[quote.status] ?? quote.status}</span>
            <span>Expires {fmtDateTime(quote.expiresAt)}</span>
          </div>
          <div className={f.titleRow}>
            <h1 className={f.title}>Review the terms and fund</h1>
            <span className={`hide-phone ${f.steps}`} aria-label="Deal progress">
              {FLOW_STAGES.map((st, i) => (
                <span key={st} className={f.steps}>
                  {i > 0 && <i aria-hidden>/</i>}
                  {i === 1 ? <b>{st}</b> : <s>{st}</s>}
                </span>
              ))}
            </span>
          </div>
          <p className={f.lede}>Check exactly what you are agreeing to. Funding signs these terms and moves the prepaid amount from your balance into escrow.</p>
        </header>

        <section className={f.section} aria-labelledby="h-terms">
          <div className={f.sectionHead}>
            <div>
              <h2 id="h-terms" className={f.h2}>{o.tierName}, {fmtUnits(o.units)} units</h2>
              <span className={f.h2Sub}>{pt.termDays}-day term, prepaid</span>
            </div>
            <span className={f.total}><Money usd={o.prepaidTotalUsd} /></span>
          </div>
          <dl className={f.kv}>
            <div><dt>Price per unit</dt><dd><Money usd={o.unitPriceUsd} digits={unitDigits} /></dd></div>
            <div><dt>Billable unit</dt><dd>{pt.billableUnit}</dd></div>
            <div><dt>Included</dt><dd>{pt.includes.join(", ")}</dd></div>
            <div><dt>Integrations</dt><dd>{pt.integrations.map(prettyIntegration).join(", ") || <span className={f.muted}>None</span>}</dd></div>
            {pt.overage && <div><dt>Overage</dt><dd>{pt.overage}</dd></div>}
            <div><dt>Refunds</dt><dd>{pt.refundPolicy}</dd></div>
          </dl>
          {o.unsupportedIntegrations.length > 0 && <p className={f.fine}>{o.unsupportedIntegrations.map(prettyIntegration).join(", ")} {o.unsupportedIntegrations.length > 1 ? "are" : "is"} not offered by this seller and {o.unsupportedIntegrations.length > 1 ? "are" : "is"} excluded from these terms.</p>}
        </section>

        <section className={f.section} aria-labelledby="h-chain">
          <div className={f.sectionHead}>
            <h2 id="h-chain" className={f.h2}>Onchain details</h2>
            <span className={f.h2Sub}>Arc testnet, chain {quote.chainId}</span>
          </div>
          <dl className={f.kv}>
            <div><dt>Escrow contract</dt><dd><MonoValue value={quote.escrowAddress} short copy label="escrow address" href={explorerAddress(quote.escrowAddress)} /></dd></div>
            <div><dt>USDC</dt><dd><MonoValue value={quote.usdcAddress} short copy label="USDC address" href={explorerAddress(quote.usdcAddress)} /></dd></div>
            <div>
              <dt>Deal id</dt>
              <dd>
                {quote.terms ? <MonoValue value={quote.terms.dealId} short copy label="deal id" href={`${explorerAddress(quote.escrowAddress)}?tab=read_contract`} /> : <span className={f.muted}>Derived for your wallet</span>}
                {quote.terms && <small>Look it up under "deals" on the contract's read tab once funded.</small>}
              </dd>
            </div>
            <div>
              <dt>Terms hash</dt>
              <dd>
                {quote.terms ? <MonoValue value={quote.terms.publicTermsHash} short copy label="public terms hash" /> : <span className={f.muted}>Derived for your wallet</span>}
                {quote.terms && (
                  <small className={hashMatches ? f.ok : f.warn}>
                    {hashMatches ? <><Check size={12} strokeWidth={2.5} aria-hidden /> Recomputed in your browser from the terms above. It matches.</> : "Does not match the terms shown. Do not sign; contact support."}
                  </small>
                )}
              </dd>
            </div>
          </dl>
          <p className={f.fine}>Both signatures over these terms are what the contract checks. The hash above is the keccak of the public terms shown on this page; your wallet signs the full terms, which the contract stores by deal id.</p>
        </section>
      </article>

      <aside className={f.rail} aria-label="Fund">
        {quote.status === "approval_required" ? (
          <>
            <span className={f.label}>Seller approval</span>
            <h2 className={f.railTitle}>Waiting for the seller</h2>
            <p className={f.railText}>{quote.approval?.reason ?? "This agreement needs the seller's approval before you can fund it."}</p>
            <div className={f.statusLine} role="status" aria-live="polite">
              <Clock3 size={14} strokeWidth={2} aria-hidden />
              <ReasoningText phrases={["Waiting for the seller's approval", "Checking again every few seconds"]} variant="swap" srLabel="Waiting for the seller's approval" />
            </div>
            <p className={f.fine}>You can leave this page open. It updates as soon as the seller decides.</p>
            <div className={f.actions}><ActionButton variant="secondary" to={backToChat}>Back to the negotiation</ActionButton></div>
          </>
        ) : acceptable ? (
          <FundFlow quote={quote} onFunded={(d) => navigate(`/app/deals/${d.id}`)} onCancel={() => navigate(backToChat)} />
        ) : quote.status === "accepted" && dealQ.data ? (
          <FundFlow deal={dealQ.data} onFunded={(d) => navigate(`/app/deals/${d.id}`)} onCancel={() => navigate(backToChat)} />
        ) : quote.status === "accepted" && dealQ.isLoading ? (
          <LoadingCard label="Loading your deal" lines={3} />
        ) : (
          <>
            <span className={f.label}>{quote.status === "accepted" ? "Signed" : quote.status === "expired" ? "Expired" : "Declined"}</span>
            <h2 className={f.railTitle}>{quote.status === "accepted" ? "Already accepted" : quote.status === "expired" ? "This offer expired" : "This offer was declined"}</h2>
            <p className={f.railText}>
              {quote.status === "accepted" ? "These terms were already signed. Your deal is listed under Deals." : quote.status === "declined" ? `The seller declined this agreement${quote.approval?.reason ? `: ${quote.approval.reason}` : "."}` : "Ask the agent for a fresh offer."}
            </p>
            <div className={f.actions}><ActionButton to={quote.status === "accepted" ? "/app/deals" : backToChat}>{quote.status === "accepted" ? "Go to deals" : "Back to the negotiation"}</ActionButton></div>
          </>
        )}
      </aside>
    </div>
  );
}
