import { useParams } from "react-router-dom";
import { AgentActivity, Card, KeyValue, Money, Notice, StatusTag, type ActivityLine } from "../kit";
import { useApprovals, useNegotiation, useProducts } from "../api";
import { ApprovalCard } from "../parts/ApprovalCard";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { SellerOnly } from "../parts/SellerOnly";
import { CandidateTable } from "../parts/CandidateTable";
import { RuleChips } from "../parts/Rules";
import { dateTime, pct, units } from "../format";
import type { AgentRun as AgentRunT, Approval, NegotiationDetail as Neg } from "../types";
import s from "../seller.module.css";

export default function NegotiationDetail() {
  const { id = "" } = useParams();
  const q = useNegotiation(id);
  const approvals = useApprovals();
  const candIds = new Set(q.data?.candidates.map((c) => c.candidateId) ?? []);
  const pending = approvals.data?.find((a) => a.status === "pending" && (a.negotiationId === id || (a.candidateId !== undefined && candIds.has(a.candidateId))));
  return (
    <div className={s.page}>
      <PageHeader
        title={q.data?.buyerLabel ?? "Negotiation"}
        back={{ to: "/app/sell/negotiations", label: "Negotiations" }}
        status={q.data && <StatusTag state={q.data.status} />}
        description={q.data ? `${q.data.productName ?? q.data.productSlug} · ${q.data.publicId}` : undefined}
      />
      <QueryView q={q} label="negotiation">
        {(n) => <Body n={n} pending={pending} />}
      </QueryView>
    </div>
  );
}

function Body({ n, pending }: { n: Neg; pending?: Approval }) {
  const products = useProducts();
  const floor = pending?.floorBps ?? products.data?.find((p) => p.slug === n.productSlug)?.policy.minMarginBps;
  const quotedId = n.quotes?.find((x) => x.status !== "declined")?.candidateId;
  const r = n.requirements;
  return (
    <>
      {pending && <OwnerApproval a={pending} floor={floor} />}
      <div className={s.split}>
        <div className={s.stack}>
          <Card title="Buyer requirements" subtitle="Extracted by the agent. Free text never sets a price.">
            <KeyValue
              items={[
                { k: "Desired units", v: r.desiredUnits ? <span className={s.mono}>{units(r.desiredUnits)}</span> : <span className={s.muted}>Not stated</span> },
                { k: "Budget", v: r.budget ? <Money micro={r.budget} /> : <span className={s.muted}>Not stated</span> },
                { k: "Integrations", v: r.integrations.length ? <span className={s.mono}>{r.integrations.join(", ")}</span> : <span className={s.muted}>None</span> },
                ...(r.assumptions.length ? [{ k: "Assumptions", v: r.assumptions.join("; ") }] : []),
                ...(r.openQuestions.length ? [{ k: "Open questions", v: r.openQuestions.join("; ") }] : []),
              ]}
            />
          </Card>
          <Card title="Transcript" subtitle={`${n.turns.length} turns`}>
            <ol className={s.transcript}>
              {n.turns.map((t) => (
                <li key={t.id} className={`${s.turn} ${s[`turn_${t.role}`]}`}>
                  <span className={s.turnMeta}>
                    {t.role === "buyer" ? "Buyer" : t.role === "agent" ? "Your agent" : "System"} · {dateTime(t.createdAt)}
                  </span>
                  <div className={s.bubble}>{t.content}</div>
                  {t.decision && <StatusTag state={t.decision.decision} />}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className={s.stack}>
          <Card title="Agent runs" subtitle="Tool calls the agent made. Numbers only come from the pricing engine.">
            <div className={s.stack}>
              {n.agentRuns.length === 0 && <p className="body3">The agent has not run yet.</p>}
              {[...n.agentRuns].reverse().map((run, i) => {
                const working = run.steps.some((x) => x.state === "working");
                return (
                  <div key={run.id} className={s.stack} style={{ gap: 6 }}>
                    <span className={`${s.sub}`}>
                      {dateTime(run.at)} · adapter <span className={s.mono}>{run.adapter}</span>
                    </span>
                    <AgentActivity
                      items={runItems(run)}
                      status={working ? "working" : "complete"}
                      duration={run.durationMs}
                      completeLabel={`Complete in ${(run.durationMs / 1000).toFixed(1)}s`}
                      defaultOpen={i === 0}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
      <SellerOnly title="Candidates and private economics" description="Every offer the engine generated for this buyer, with the rules that fired.">
        {n.candidates.length ? <CandidateTable candidates={n.candidates} floorBps={floor} highlight={quotedId} /> : <p className="body3">No candidates yet. They appear after the buyer states volume or budget.</p>}
      </SellerOnly>
      <SellerOnly title="Decisions log" description="Private basis next to what the buyer was told.">
        <ol className={s.log}>
          {n.decisions.map((d) => (
            <li key={d.id} className={s.logItem}>
              <div className={s.logHead}>
                <span className={s.row}>
                  <span className={s.kind}>{d.kind}</span>
                  <span className="body3">{dateTime(d.at)}</span>
                </span>
                <RuleChips rules={d.ruleIds} emptyText="No rules fired" />
              </div>
              <span className={`body3 ${s.strong}`}>{d.summary}</span>
              {d.privateBasis.expectedContribution !== undefined && (
                <span className="body3">
                  Contribution <Money micro={String(d.privateBasis.expectedContribution)} /> on revenue <Money micro={String(d.privateBasis.expectedRevenue ?? "0")} />, margin{" "}
                  <span className={s.mono}>{pct(String(d.privateBasis.expectedContributionMarginBps ?? "0"))}</span>
                </span>
              )}
              <span className={s.publicLine}>Buyer saw: "{d.publicExplanation}"</span>
            </li>
          ))}
        </ol>
      </SellerOnly>
    </>
  );
}

function OwnerApproval({ a, floor }: { a: Approval; floor?: string }) {
  return (
    <section id="owner-approval" className={s.stack} aria-label="Owner approval required">
      <Notice tone="warn" title="Owner approval required">
        This quote is above your approval threshold. The buyer cannot sign until you decide.
      </Notice>
      <ApprovalCard a={a} showNegotiationLink={false} floorBps={floor} />
    </section>
  );
}

function runItems(run: AgentRunT): ActivityLine[] {
  return run.steps.map((st, i) => {
    const m = st.label.match(/^Called\s+(\S+)/);
    const detail = st.detail ? ` (${st.detail})` : "";
    const blocked = st.state === "blocked" ? " (blocked)" : "";
    return {
      id: `${run.id}_${i}`,
      type: m ? "tool" : "text",
      tool: m ? m[1] : undefined,
      content: m ? `${detail.trim()}${blocked}` || "called" : `${st.label}${detail}${blocked}`,
      state: st.state === "done" ? "done" : st.state === "working" ? "running" : "error",
    };
  });
}
