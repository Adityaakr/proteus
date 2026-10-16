import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Check, ChevronRight, Loader2, SendHorizontal, User } from "lucide-react";
import { Link } from "react-router-dom";
import { SellerMark, possessive, useLogoShape } from "../ui/SellerMark";
import type { SellerBrand } from "../lib/types";
import { T_DEFAULT } from "../../lib/motion";
import { AppShell } from "../layouts/AppShell";
import { AgentActivity, type ActivityLine } from "../agentic/AgentActivity";
import { ActionButton } from "../ui/ActionButton";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Notice } from "../ui/misc";
import { api, errorMessage, qk, type Negotiation, type Offer, type Turn } from "../lib/api";
import { OfferCard } from "./OfferCard";
import { ErrorState, FLOW_STAGES, fmtUnits, prettyIntegration } from "./common";
import s from "./buyer.module.css";
import n from "./negotiate.module.css";

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
      navigate(`/app/offers/${q.id}`);
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

  const wideLogo = useLogoShape(negQ.data?.sellerBrand?.logoUrl) === "wide";
  // Size the chat to the space left under the header so the composer is always on screen (desktop only).
  const chatRef = useRef<HTMLElement>(null);
  const [chatHeight, setChatHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = chatRef.current;
      if (!el || window.innerWidth <= 1100) return setChatHeight(null);
      const top = el.getBoundingClientRect().top + window.scrollY;
      setChatHeight(Math.max(320, window.innerHeight - top - 24));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (chatRef.current?.parentElement) ro.observe(chatRef.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [negQ.data]);

  if (negQ.isLoading)
    return (
      <AppShell title="Negotiation">
        <LoadingCard label="Loading the negotiation" lines={6} />
      </AppShell>
    );
  if (negQ.error || !negQ.data)
    return (
      <AppShell title="Negotiation">
        <ErrorState error={negQ.error} onRetry={() => negQ.refetch()} />
      </AppShell>
    );

  const neg = negQ.data;
  const sellerName = neg.sellerName ?? prettyName(neg.sellerSlug);
  const productName = neg.productName ?? prettyName(neg.productSlug);
  const agentName = `${possessive(sellerName)} agent`;
  const offers = neg.offers;
  const topId = offers.find((o) => o.status === "eligible")?.candidateId;
  const unsupported = Array.from(new Set(offers.flatMap((o) => o.unsupportedIntegrations)));
  const req = neg.requirements;
  const closed = neg.status === "closed" || neg.status === "accepted";
  const mutationError = send.error ?? counter.error ?? accept.error;

  return (
    <AppShell title="Negotiation">
      <header className={n.head}>
        <nav className={n.crumbs} aria-label="Breadcrumb">
          <Link to="/app/market">Market</Link>
          <ChevronRight size={13} aria-hidden />
          <Link to={`/app/market/${neg.sellerSlug}`}>{sellerName}</Link>
          <ChevronRight size={13} aria-hidden />
          <Link to={`/app/market/${neg.sellerSlug}/${neg.productSlug}`}>{productName}</Link>
        </nav>
        <div className={n.sellerRow}>
          {wideLogo ? <SellerMark name={sellerName} brand={neg.sellerBrand} variant="wordmark" size="sm" /> : <><SellerMark name={sellerName} brand={neg.sellerBrand} size="sm" /><span className={n.sellerName}>{sellerName}</span></>}
          {neg.labels?.seller === "live" ? <span className={n.badgeOk}><BadgeCheck size={13} strokeWidth={2.25} aria-hidden /> Verified seller</span> : <span className={n.badgeMuted}>Demo seller</span>}
          <span className={neg.status === "closed" ? n.badgeMuted : n.badgeState}>{neg.status === "open" ? "Open" : neg.status === "quoted" ? "Offers ready" : neg.status === "accepted" ? "Accepted" : "Closed"}</span>
        </div>
        <div className={n.titleRow}>
          <h1 className={n.title}>{productName}</h1>
          <span className={`hide-phone ${n.steps}`} aria-label="Deal progress">
            {FLOW_STAGES.map((st, i) => (
              <span key={st} className={n.steps}>
                {i > 0 && <i aria-hidden>/</i>}
                {i === 0 ? <b>{st}</b> : <span>{st}</span>}
              </span>
            ))}
          </span>
        </div>
        <p className={n.lede}>Describe your volume, tools and budget. Offers come from the seller's pricing rules, so the agent cannot be talked past them. Negotiation {neg.publicId}.</p>
      </header>

      <div className={n.grid}>
        <section ref={chatRef} className={n.chat} style={chatHeight ? { height: chatHeight, minHeight: 0, maxHeight: "none" } : undefined} aria-label="Conversation with the seller's agent">
          <div ref={threadRef} className={n.thread} role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" tabIndex={0}>
            <AnimatePresence initial={false}>
              {turns.map((t) => (
                <TurnView key={t.id} turn={t} agentName={agentName} sellerName={sellerName} brand={neg.sellerBrand} />
              ))}
              {pendingText && (
                <TurnView key="pending-buyer" turn={{ id: "pending", role: "buyer", content: pendingText, createdAt: new Date().toISOString() }} agentName={agentName} sellerName={sellerName} brand={neg.sellerBrand} />
              )}
              {working && (
                <motion.div key="working" className={`${n.turn} ${n.turnAgent}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T_DEFAULT}>
                  <span className={n.who}><SellerMark name={sellerName} brand={neg.sellerBrand} size="sm" /> {agentName}</span>
                  <ol className={n.working} aria-live="polite" aria-label="The seller's agent is working">
                    {(counter.isPending ? COUNTER_STEPS : WORKING_STEPS).map((label, i) => {
                      const st = steps[i]?.state ?? "pending";
                      return (
                        <li key={label} className={`${n.workStep} ${st === "done" ? n.workDone : st === "running" ? n.workNow : ""}`}>
                          <span className={n.workIcon} aria-hidden>{st === "done" ? <Check size={12} strokeWidth={3} /> : st === "running" ? <Loader2 size={13} strokeWidth={2.25} className={n.spin} /> : null}</span>
                          <span>{label}</span>
                        </li>
                      );
                    })}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {mutationError && (
            <div style={{ padding: "0 12px 8px" }}>
              <Notice tone="danger">{errorMessage(mutationError)}</Notice>
            </div>
          )}
          <form className={n.composer} onSubmit={submit}>
            <div className={n.composerRow}>
            <label htmlFor="composer" className="sr-only">Message the seller's agent</label>
            <textarea
              id="composer"
              className={n.composerInput}
              rows={1}
              placeholder={closed ? "This negotiation is closed" : `Message ${agentName}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={closed}
              maxLength={4000}
            />
            <ActionButton type="submit" variant="primary" aria-label="Send message" disabled={!draft.trim() || closed} loading={send.isPending} icon={<SendHorizontal size={16} strokeWidth={2} />}>
              Send
            </ActionButton>
            </div>
            {!closed && <span className={n.composerHint}>Enter to send. Shift+Enter for a new line.</span>}
          </form>
        </section>

        <aside className={n.rail} aria-label="Deal">
          <div className={n.block}>
            <span className={n.label}>Deal summary</span>
            <dl className={n.kv}>
              <dt>Seller</dt>
              <dd><SellerMark name={sellerName} brand={neg.sellerBrand} variant="wordmark" size="sm" /></dd>
              <dt>Product</dt>
              <dd>{productName}</dd>
              <dt>Term</dt>
              <dd>{neg.termDays ? `${neg.termDays} days, prepaid in escrow` : "Prepaid in escrow"}</dd>
              <dt>Billing</dt>
              <dd>Per {neg.unitLabel ?? "unit"} delivered, only what you countersign</dd>
            </dl>
          </div>

          <div className={n.block}>
            <span className={n.label}>Offers</span>
            {offers.length === 0 ? (
              <p className={n.blockNote}>No offers yet. Share your expected volume or budget and the agent will propose options.</p>
            ) : (
              <>
                <p className={n.blockNote}>
                  Accept one to see the full terms. Nothing is binding until you sign.
                  {unsupported.length > 0 && <> {unsupported.map(prettyIntegration).join(", ")} {unsupported.length > 1 ? "are" : "is"} not offered by this seller and {unsupported.length > 1 ? "are" : "is"} excluded from every offer.</>}
                </p>
                <div className={n.offers}>
                  {offers.map((o) => (
                    <OfferCard
                      key={o.candidateId}
                      offer={o}
                      unitLabel={neg.unitLabel}
                      termDays={neg.termDays}
                      top={o.candidateId === topId}
                      busy={acceptingId === o.candidateId}
                      counterBusy={counteringId === o.candidateId}
                      onAccept={(offer) => accept.mutate(offer)}
                      onCounter={closed ? undefined : (offer, ask) => counter.mutate({ offer, ask })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={n.block}>
            <span className={n.label}>What the agent understood</span>
            <dl className={n.kv}>
              <dt>Volume</dt>
              <dd>{req.desiredUnits ? `${fmtUnits(req.desiredUnits)} per term` : <span className={n.muted}>Not stated yet</span>}</dd>
              <dt>Budget</dt>
              <dd>{req.budget ? <Money micro={req.budget} digits={0} /> : <span className={n.muted}>Not stated yet</span>}</dd>
              <dt>Integrations</dt>
              <dd>{req.integrations.length ? req.integrations.map(prettyIntegration).join(", ") : <span className={n.muted}>None mentioned</span>}</dd>
            </dl>
            {req.openQuestions.length > 0 && (
              <>
                <span className={n.label} style={{ marginTop: 6 }}>Open questions</span>
                <ul className={n.list}>{req.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
              </>
            )}
            {req.assumptions.length > 0 && (
              <>
                <span className={n.label} style={{ marginTop: 6 }}>Assumptions</span>
                <ul className={n.list}>{req.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </>
            )}
          </div>

          {neg.activity.length > 0 && (
            <div className={n.block}>
              <AgentActivity
                items={neg.activity.map((a, i) => ({ id: `${a.at}-${i}`, type: "text", content: a.label, state: a.state === "done" ? "done" : "running" }))}
                status={neg.activity.some((a) => a.state === "working") ? "working" : "complete"}
                duration={lastDuration}
                completeLabel={lastDuration ? undefined : "Latest agent steps"}
                collapseOnComplete
                defaultOpen={false}
              />
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function prettyName(slug: string) {
  const v = slug.replace(/[-_]+/g, " ").trim();
  return v ? v[0]!.toUpperCase() + v.slice(1) : slug;
}

function TurnView({ turn, agentName, sellerName, brand }: { turn: Turn; agentName: string; sellerName: string; brand?: SellerBrand }) {
  const buyer = turn.role === "buyer";
  const system = turn.role === "system";
  const cls = buyer ? n.turnBuyer : system ? n.turnSystem : n.turnAgent;
  const bubble = buyer ? n.bubbleBuyer : system ? n.bubbleSystem : n.bubbleAgent;
  return (
    <motion.div className={`${n.turn} ${cls}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T_DEFAULT}>
      {!system && (
        <span className={n.who}>
          {buyer ? <span className={n.youMark} aria-hidden><User size={11} /></span> : <SellerMark name={sellerName} brand={brand} size="sm" />}
          {buyer ? "You" : agentName}
        </span>
      )}
      <div className={`${n.bubble} ${bubble}`}>{turn.content}</div>
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
        <span className={n.note}>
          <Check size={12} strokeWidth={2.5} aria-hidden /> {turn.offers.length} {turn.offers.length === 1 ? "offer" : "offers"} added to the offers panel
        </span>
      )}
    </motion.div>
  );
}
