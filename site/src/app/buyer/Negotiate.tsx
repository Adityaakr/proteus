import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, SendHorizontal, User } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { BuyerShell } from "../layouts/BuyerShell";
import { AgentActivity, type ActivityLine } from "../agentic/AgentActivity";
import { ReasoningText } from "../agentic/ReasoningText";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Notice } from "../ui/misc";
import { api, errorMessage, qk, type Negotiation, type Offer, type Turn } from "../lib/api";
import { OfferCard } from "./OfferCard";
import { ErrorState, PageHeader, fmtUnits, prettyIntegration } from "./common";
import s from "./buyer.module.css";

const WORKING_STEPS = ["Reading your message", "Extracting requirements", "Checking the seller's pricing rules", "Preparing offers"];
const COUNTER_STEPS = ["Reading your counteroffer", "Checking margin and discount rules", "Looking for an alternative", "Writing a decision"];

export default function Negotiate() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const negQ = useQuery({ queryKey: qk.negotiation(id), queryFn: () => api.negotiation(id) });
  const [draft, setDraft] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ActivityLine[]>([]);
  const [lastDuration, setLastDuration] = useState<number | undefined>();
  const startedAt = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const sentStarter = useRef(false);
  const reduce = useReducedMotion();

  const setNeg = (n: Negotiation) => qc.setQueryData(qk.negotiation(id), n);

  const runSteps = (labels: string[]) => {
    startedAt.current = performance.now();
    setSteps([{ id: "s0", type: "text", content: labels[0]!, state: "running" }]);
    labels.slice(1).forEach((label, i) => {
      window.setTimeout(() => {
        setSteps((prev) => (prev.length === 0 ? prev : [...prev.map((p) => ({ ...p, state: "done" as const })), { id: `s${i + 1}`, type: i === 1 ? "tool" : "text", tool: i === 1 ? "pricing.getQuoteCandidates" : undefined, content: label, state: "running" }]));
      }, 380 * (i + 1));
    });
  };
  const finishSteps = () => {
    setLastDuration(Math.round(performance.now() - startedAt.current));
    setSteps([]);
  };

  const send = useMutation({
    mutationFn: (content: string) => api.sendMessage(id, content),
    onMutate: (content) => {
      setPendingText(content);
      runSteps(WORKING_STEPS);
    },
    onSuccess: (n) => {
      setNeg(n);
      setDraft("");
    },
    onSettled: () => {
      setPendingText(null);
      finishSteps();
    },
  });

  const counter = useMutation({
    mutationFn: (v: { offer: Offer; ask: { targetTotal?: string; targetUnits?: string } }) => api.counter(id, { candidateId: v.offer.candidateId, ...v.ask }),
    onMutate: (v) => {
      setCounteringId(v.offer.candidateId);
      runSteps(COUNTER_STEPS);
    },
    onSuccess: setNeg,
    onSettled: () => {
      setCounteringId(null);
      finishSteps();
    },
  });

  const accept = useMutation({
    mutationFn: (offer: Offer) => api.createQuote(id, offer.candidateId),
    onMutate: (offer) => setAcceptingId(offer.candidateId),
    onSuccess: (q) => {
      qc.setQueryData(qk.quote(q.id), q);
      navigate(`/offer/${q.id}`);
    },
    onSettled: () => setAcceptingId(null),
  });

  // Send a starter picked on the storefront exactly once.
  useEffect(() => {
    const starter = (location.state as { starter?: string } | null)?.starter;
    if (!starter || sentStarter.current || !negQ.data) return;
    sentStarter.current = true;
    navigate(location.pathname, { replace: true, state: null });
    send.mutate(starter);
  }, [location.state, location.pathname, negQ.data, navigate, send]);

  const turns = negQ.data?.turns ?? [];
  const working = send.isPending || counter.isPending;
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [turns.length, working, reduce]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || working) return;
    send.mutate(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (negQ.isLoading)
    return (
      <BuyerShell stage="Negotiate">
        <LoadingCard label="Loading the negotiation" lines={6} />
      </BuyerShell>
    );
  if (negQ.error || !negQ.data)
    return (
      <BuyerShell stage="Negotiate">
        <ErrorState error={negQ.error} onRetry={() => negQ.refetch()} />
      </BuyerShell>
    );

  const neg = negQ.data;
  const offers = neg.offers;
  const topId = offers.find((o) => o.status === "eligible")?.candidateId;
  const req = neg.requirements;
  const closed = neg.status === "closed" || neg.status === "accepted";
  const mutationError = send.error ?? counter.error ?? accept.error;

  return (
    <BuyerShell stage="Negotiate">
      <PageHeader
        eyebrow={
          <>
            <StatusTag state={neg.status} />
            <span className="body3">Negotiation {neg.publicId}</span>
          </>
        }
        title="Negotiate your agreement"
        lede="Describe your volume, tools and budget. Offers come from the seller's pricing rules, so the agent cannot be talked past them."
      />

      <div className={s.grid2}>
        <section className={s.chat} aria-label="Conversation with the seller's agent">
          <div ref={threadRef} className={s.thread} role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" tabIndex={0}>
            <AnimatePresence initial={false}>
              {turns.map((t) => (
                <TurnView key={t.id} turn={t} />
              ))}
              {pendingText && (
                <TurnView key="pending-buyer" turn={{ id: "pending", role: "buyer", content: pendingText, createdAt: new Date().toISOString() }} />
              )}
              {working && (
                <motion.div key="working" className={`${s.turn} ${s.turnAgent}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T_DEFAULT} style={{ width: "min(420px, 100%)" }}>
                  <span className={s.who}><Bot size={13} aria-hidden /> Seller's agent</span>
                  <div className={`${s.bubble} ${s.bubbleAgent}`}>
                    <ReasoningText phrases={counter.isPending ? COUNTER_STEPS : WORKING_STEPS} variant="cascade" srLabel="The seller's agent is working" />
                  </div>
                  <AgentActivity items={steps} status="working" maxHeight={120} workingLabel="Working" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {mutationError && (
            <div style={{ padding: "0 12px 8px" }}>
              <Notice tone="danger">{errorMessage(mutationError)}</Notice>
            </div>
          )}
          <form className={s.composer} onSubmit={submit}>
            <label htmlFor="composer" className="sr-only">Message the seller's agent</label>
            <textarea
              id="composer"
              className={s.composerInput}
              rows={1}
              placeholder={closed ? "This negotiation is closed" : "Message the seller's agent"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={closed}
              maxLength={4000}
            />
            <ActionButton type="submit" variant="primary" aria-label="Send message" disabled={!draft.trim() || closed} loading={send.isPending} icon={<SendHorizontal size={16} strokeWidth={2} />}>
              Send
            </ActionButton>
          </form>
        </section>

        <div className={s.stack}>
          <Card title="Offers" subtitle="Accept one to see the full terms. Nothing is binding until you sign." level={2} padding="compact">
            {offers.length === 0 ? (
              <EmptyState title="No offers yet" description="Share your expected volume or budget and the agent will propose options." />
            ) : (
              <div className={s.offers}>
                {offers.map((o) => (
                  <OfferCard
                    key={o.candidateId}
                    offer={o}
                    top={o.candidateId === topId}
                    busy={acceptingId === o.candidateId}
                    counterBusy={counteringId === o.candidateId}
                    onAccept={(offer) => accept.mutate(offer)}
                    onCounter={closed ? undefined : (offer, ask) => counter.mutate({ offer, ask })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title="What the agent understood" level={2} padding="compact">
            <dl className={s.reqList}>
              <dt>Volume</dt>
              <dd>{req.desiredUnits ? `${fmtUnits(req.desiredUnits)} per term` : <span className={s.muted}>Not stated yet</span>}</dd>
              <dt>Budget</dt>
              <dd>{req.budget ? <Money micro={req.budget} digits={0} /> : <span className={s.muted}>Not stated yet</span>}</dd>
              <dt>Integrations</dt>
              <dd>{req.integrations.length ? req.integrations.map(prettyIntegration).join(", ") : <span className={s.muted}>None mentioned</span>}</dd>
            </dl>
            {req.openQuestions.length > 0 && (
              <div className={s.stackTight}>
                <span className="label" style={{ color: "var(--c-dark-60)" }}>Open questions</span>
                <ul className={s.checkList}>
                  {req.openQuestions.map((q) => (
                    <li key={q} style={{ fontSize: 14 }}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {req.assumptions.length > 0 && (
              <div className={s.stackTight}>
                <span className="label" style={{ color: "var(--c-dark-60)" }}>Assumptions</span>
                <ul className={s.checkList}>
                  {req.assumptions.map((a) => (
                    <li key={a} style={{ fontSize: 14 }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {neg.activity.length > 0 && (
            <AgentActivity
              items={neg.activity.map((a, i) => ({ id: `${a.at}-${i}`, type: "text", content: a.label, state: a.state === "done" ? "done" : "running" }))}
              status={neg.activity.some((a) => a.state === "working") ? "working" : "complete"}
              duration={lastDuration}
              completeLabel={lastDuration ? undefined : "Latest agent steps"}
              collapseOnComplete
              defaultOpen={false}
            />
          )}
        </div>
      </div>
    </BuyerShell>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const buyer = turn.role === "buyer";
  const system = turn.role === "system";
  const cls = buyer ? s.turnBuyer : system ? s.turnSystem : s.turnAgent;
  const bubble = buyer ? s.bubbleBuyer : system ? s.bubbleSystem : s.bubbleAgent;
  return (
    <motion.div className={`${s.turn} ${cls}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T_DEFAULT}>
      {!system && (
        <span className={s.who}>
          {buyer ? <User size={13} aria-hidden /> : <Bot size={13} aria-hidden />}
          {buyer ? "You" : "Seller's agent"}
        </span>
      )}
      <div className={`${s.bubble} ${bubble}`}>{turn.content}</div>
      {turn.decision && (
        <div className={s.row}>
          <StatusTag
            tone={turn.decision.decision === "approved" ? "success" : turn.decision.decision === "approval_required" ? "warn" : "danger"}
            label={turn.decision.decision === "approved" ? "Counter accepted" : turn.decision.decision === "approval_required" ? "Needs seller approval" : "Counter declined"}
          />
          {turn.decision.alternative && (
            <span className="body3">
              Alternative: {fmtUnits(turn.decision.alternative.units)} for <Money usd={turn.decision.alternative.prepaidTotalUsd} />
            </span>
          )}
        </div>
      )}
      {turn.offers && turn.offers.length > 0 && !turn.decision && (
        <span className="body3">
          {turn.offers.length} {turn.offers.length === 1 ? "offer" : "offers"} added to the offers panel
        </span>
      )}
    </motion.div>
  );
}
