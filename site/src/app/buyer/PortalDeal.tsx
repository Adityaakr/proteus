import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Send } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import type { Hex } from "viem";
import { AppShell } from "../layouts/AppShell";
import { useAuth } from "../auth/useAuth";
import { FundFlow } from "./FundFlow";
import type { TodoItem } from "../agentic/TodoList";
import type { ToolApprovalStatus } from "../agentic/ToolApproval";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { statusLabel } from "../ui/StatusTag";
import { CopyButton, ExplorerLink, MonoValue, Notice, shortHex } from "../ui/misc";
import { api, errorMessage, isMock, newRequestId, qk, type Deal, type ExecuteResponse } from "../lib/api";
import { signAcceptance, walletErrorMessage } from "../lib/wallet";
import { ErrorState, FLOW_STAGES, fmtDate, fmtDateTime, fmtUnits } from "./common";
import f from "./fund.module.css";
import d from "./deal.module.css";

const keyStore = (dealId: string) => `proteus:deal-key:${dealId}`;
function loadKey(dealId: string): string | null {
  try {
    return sessionStorage.getItem(keyStore(dealId));
  } catch {
    return null;
  }
}
function saveKey(dealId: string, key: string) {
  try {
    sessionStorage.setItem(keyStore(dealId), key);
  } catch {
    /* ignore */
  }
}

export default function PortalDeal() {
  const { dealId = "" } = useParams();
  const dealQ = useQuery({
    queryKey: qk.deal(dealId),
    queryFn: () => api.deal(dealId),
    refetchInterval: (q) => (q.state.data && (q.state.data.status === "funding_pending" || q.state.data.service.status === "pending") ? 2500 : false),
  });
  const [stage, setStage] = useState<2 | 3>(2);
  return (
    <AppShell title="Deal">
      {dealQ.isLoading ? (
        <LoadingCard label="Loading your deal" lines={6} />
      ) : dealQ.error || !dealQ.data ? (
        <ErrorState error={dealQ.error} onRetry={() => dealQ.refetch()} />
      ) : (
        <PortalView deal={dealQ.data} stage={stage} onSettled={() => setStage(3)} />
      )}
    </AppShell>
  );
}

function PortalView({ deal, stage, onSettled }: { deal: Deal; stage: 2 | 3; onSettled: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { wallet, getWalletClient } = useAuth();
  const mock = isMock();
  const [apiKey, setApiKey] = useState<string | null>(() => loadKey(deal.id));
  const [freshKey, setFreshKey] = useState<string | null>(null);

  // The API key arrives once, on the response that provisions the service.
  useEffect(() => {
    if (deal.service.apiKey) {
      setApiKey(deal.service.apiKey);
      setFreshKey(deal.service.apiKey);
      saveKey(deal.id, deal.service.apiKey);
    }
  }, [deal.service.apiKey, deal.id]);

  const usageQ = useQuery({ queryKey: qk.usage(deal.id), queryFn: () => api.usage(deal.id), enabled: deal.service.status === "provisioned" });
  const usage = usageQ.data;

  /* test request */
  const [question, setQuestion] = useState("");
  const [orderId, setOrderId] = useState("");
  const [qErr, setQErr] = useState<string | null>(null);
  const [lastReq, setLastReq] = useState<{ requestId: string; input: { question: string; orderId?: string } } | null>(null);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [replayed, setReplayed] = useState(false);
  const exec = useMutation({
    mutationFn: (v: { requestId: string; input: { question: string; orderId?: string } }) => api.execute(productSlugFrom(deal), apiKey ?? "", v),
    onSuccess: (r, v) => {
      setReplayed(lastReq?.requestId === v.requestId);
      setResult(r);
      setLastReq(v);
      qc.invalidateQueries({ queryKey: qk.usage(deal.id) });
      qc.invalidateQueries({ queryKey: qk.deal(deal.id) });
    },
  });
  const submitTest = (e: FormEvent) => {
    e.preventDefault();
    setQErr(null);
    if (!question.trim()) return setQErr("Enter a customer question.");
    exec.mutate({ requestId: newRequestId(), input: { question: question.trim(), orderId: orderId.trim() || undefined } });
  };

  /* usage acknowledgment */
  const [ackPhase, setAckPhase] = useState<ToolApprovalStatus>("pending");
  const [ackErr, setAckErr] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<{ txHash?: Hex; status: string } | null>(null);
  const ack = useMutation({
    mutationFn: (sig: string) => {
      const a = usage!.pendingAcceptance!.acceptance;
      return api.acknowledgeUsage(deal.id, { buyerSignature: sig, cumulativeUnits: a.cumulativeUnits, cumulativeAmount: a.cumulativeAmount, receiptsRoot: a.receiptsRoot, nonce: a.nonce, expiry: a.expiry });
    },
    onSuccess: (r) => {
      setSettlement(r.settlement);
      setAckPhase("complete");
      qc.setQueryData(qk.deal(deal.id), r.deal);
      qc.invalidateQueries({ queryKey: qk.usage(deal.id) });
      onSettled();
    },
    onError: (e) => {
      setAckErr(errorMessage(e));
      setAckPhase("pending");
    },
  });
  const signUsage = async () => {
    setAckErr(null);
    setAckPhase("approving");
    try {
      if (mock) {
        setAckPhase("running");
        ack.mutate("0x" + "00".repeat(65));
        return;
      }
      const client = await getWalletClient();
      const sig = await signAcceptance(client, usage!.pendingAcceptance!.typedData);
      setAckPhase("running");
      ack.mutate(sig);
    } catch (e) {
      setAckErr(walletErrorMessage(e));
      setAckPhase("pending");
    }
  };

  /* refund */
  const refund = useMutation({ mutationFn: () => api.requestRefund(deal.id) });
  const rotate = useMutation({
    mutationFn: async () => {
      const c = await getWalletClient();
      const address = c.account!.address;
      const ts = Math.floor(Date.now() / 1000);
      const signature = await c.signMessage({ account: c.account!, message: `PROTEUS rotate service key\ndeal: ${deal.id}\nts: ${ts}` });
      return api.rotateServiceKey(deal.id, { address, ts, signature });
    },
    onSuccess: (d) => {
      if (d.service.apiKey) {
        setApiKey(d.service.apiKey);
        setFreshKey(d.service.apiKey);
        saveKey(deal.id, d.service.apiKey);
      }
      qc.setQueryData(qk.deal(deal.id), d);
    },
  });

  const receipts = usage?.receipts ?? [];
  const provisioned = deal.service.status === "provisioned";
  const fundedish = !["awaiting_funding", "funding_pending"].includes(deal.status);
  const todos: TodoItem[] = [
    { id: "sign", label: "Terms signed by both sides", status: "completed" },
    { id: "fund", label: "Escrow funded", status: fundedish ? "completed" : "in-progress", detail: deal.funding.txHash ? <ExplorerLink href={explorerTx(deal.funding.txHash)} hash={deal.funding.txHash} /> : fundedish ? (mock ? "Mock mode, no transaction" : undefined) : "Waiting for confirmation" },
    { id: "prov", label: "Service provisioned", status: provisioned ? "completed" : fundedish ? "in-progress" : "pending" },
    { id: "key", label: "API key issued", status: provisioned ? "completed" : "pending", detail: provisioned ? "Shown once below" : undefined },
    { id: "test", label: "Send a first test request", status: receipts.length > 0 ? "completed" : provisioned ? "in-progress" : "pending" },
    { id: "ack", label: "Acknowledge usage to settle", status: BigInt(deal.usage.settled) > 0n && !usage?.pendingAcceptance ? "completed" : receipts.some((r) => r.status === "delivered") ? "in-progress" : "pending" },
  ];

  const pa = usage?.pendingAcceptance;
  const walletLabel = mock ? "Sign usage (mock signature)" : "Sign usage";
  const stageIdx = fundedish ? stage : 1;
  const todoClass = (st: TodoItem["status"]) => (st === "completed" ? f.stepDone : st === "in-progress" ? f.stepActive : "");
  const stateLabel = (v: string) => statusLabel(v);
  const ackBusy = ackPhase === "approving" || ackPhase === "running";

  return (
    <div className={f.page}>
      <article className={f.doc}>
        <header className={f.head}>
          <div className={f.eyebrow}>
            <span className={`${f.badge} ${["funded", "active"].includes(deal.status) ? f.badgeOk : ""}`}>{stateLabel(deal.status)}</span>
            <span className={f.badge}>{stateLabel(deal.service.status)}</span>
            <span>Record {deal.publicId}</span>
          </div>
          <div className={f.titleRow}>
            <h1 className={f.title}>{dealTitle(deal)}</h1>
            <span className={`hide-phone ${f.steps}`} aria-label="Deal progress">
              {FLOW_STAGES.map((st, i) => (
                <span key={st} className={f.steps}>
                  {i > 0 && <i aria-hidden>/</i>}
                  {i === stageIdx ? <b>{st}</b> : <s>{st}</s>}
                </span>
              ))}
            </span>
          </div>
          <p className={f.lede}>Use the service, review every metered request, and sign usage so the seller is paid from escrow. Unused funds stay yours.</p>
        </header>

        {!fundedish && (
          <section className={f.section}>
            <FundFlow deal={deal} onFunded={(d) => { qc.setQueryData(qk.deal(d.id), d); navigate(`/app/deals/${d.id}`, { replace: true }); }} onCancel={() => navigate("/app/deals")} />
          </section>
        )}

        <dl className={d.stats} aria-label="Balances">
          <div><dt>Deposited</dt><dd><Money micro={deal.balances.deposit} /></dd></div>
          <div><dt>Used</dt><dd><Money micro={deal.usage.charged} /></dd><small>{fmtUnits(deal.usage.units)} of {fmtUnits(deal.terms.maxUnits)} units</small></div>
          <div><dt>Settled to seller</dt><dd><Money micro={deal.balances.settled} /></dd></div>
          <div><dt>Remaining</dt><dd><Money micro={deal.balances.remaining} /></dd><small>{deal.balances.source === "chain" ? "Read from chain" : "Pending chain confirmation"}</small></div>
        </dl>

        <section className={f.section} aria-labelledby="h-try">
          <div className={f.sectionHead}>
            <h2 id="h-try" className={f.h2}>Try the service</h2>
            <span className={f.h2Sub}>Only delivered answers are billable. Retries with the same request id never charge twice.</span>
          </div>
          {!provisioned ? (
            <p className={f.fine}>The service is being provisioned. This page updates automatically.</p>
          ) : !apiKey ? (
            <>
              <p className={f.fine}>The API key was shown once when the service was provisioned. Use the copy you saved, or issue a new one with a wallet signature; the old key stops working.</p>
              <div><ActionButton variant="secondary" size="sm" loading={rotate.isPending} loadingLabel="Signing" onClick={() => rotate.mutate()}>Issue a new key</ActionButton></div>
              {rotate.error && <Notice tone="danger">{errorMessage(rotate.error)}</Notice>}
            </>
          ) : (
            <form onSubmit={submitTest} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={d.formGrid}>
                <Field label="Request" placeholder="What the service should do" value={question} onChange={(e) => setQuestion(e.target.value)} error={qErr} maxLength={2000} />
                <Field label="Reference" hint="Optional. Echoed in the receipt." value={orderId} onChange={(e) => setOrderId(e.target.value)} />
              </div>
              <div className={f.actions}>
                <ActionButton type="submit" size="sm" loading={exec.isPending && exec.variables?.requestId !== lastReq?.requestId} loadingLabel="Sending" icon={<Send size={14} strokeWidth={2} />}>
                  Send request
                </ActionButton>
                {lastReq && (
                  <button type="button" className={f.textBtn} onClick={() => exec.mutate(lastReq)} disabled={exec.isPending}>Retry with the same request id</button>
                )}
              </div>
            </form>
          )}
          {exec.isError && <Notice tone="danger">{errorMessage(exec.error)}</Notice>}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-live="polite">
              <div className={d.answer}>{result.answer}</div>
              <div className={d.tags}>
                <span className={`${f.badge} ${result.status === "delivered" ? f.badgeOk : ""}`}>{stateLabel(result.status)}</span>
                <span className={f.badge}>{result.billable ? `Billable, ${result.units} unit` : "Not billable"}</span>
                {replayed && <span className={`${f.badge} ${f.badgeOk}`}>Same request id, not charged again</span>}
              </div>
              <dl className={f.kv}>
                <div><dt>Request id</dt><dd><MonoValue value={result.requestId} short copy label="request id" /></dd></div>
                <div><dt>Source</dt><dd>{result.source.store}{result.source.fields.length ? `, fields ${result.source.fields.join(", ")}` : ""}</dd></div>
                <div><dt>Receipt digest</dt><dd><MonoValue value={result.receipt.digest} short copy label="receipt digest" /></dd></div>
                <div><dt>Used so far</dt><dd><Money micro={result.deal.cumulativeCharged} /> for {fmtUnits(result.deal.cumulativeUnits)} {result.deal.cumulativeUnits === "1" ? "unit" : "units"}</dd></div>
              </dl>
            </div>
          )}
        </section>

        <section className={f.section} aria-labelledby="h-usage">
          <div className={f.sectionHead}>
            <h2 id="h-usage" className={f.h2}>Usage</h2>
            <span className={f.h2Sub}>Every request the service handled for this deal, newest first.</span>
          </div>
          {receipts.length === 0 ? (
            <p className={f.fine}>No requests yet. Send one above to see your first receipt.</p>
          ) : (
            <ul className={d.usage}>
              {receipts.map((r) => (
                <li key={r.requestId}>
                  <span className={d.uTime}>{fmtDateTime(r.createdAt)}</span>
                  <span className={d.uBody}>
                    <span className={d.uAnswer}>{r.answerPreview}</span>
                    <span className={d.uMeta}>{stateLabel(r.status)}, digest <span className="app-mono" title={r.digest}>{shortHex(r.digest)}</span></span>
                  </span>
                  <span className={d.uRight}>{r.units} {String(r.units) === "1" ? "unit" : "units"}<small><Money micro={r.chargedCumulative} /> to date</small></span>
                </li>
              ))}
            </ul>
          )}
          {usageQ.isError && <Notice tone="danger">{errorMessage(usageQ.error)}</Notice>}
          {usage && <p className={f.fine}>Settled onchain so far: <Money micro={usage.settledOnchain} unit />.</p>}
        </section>
      </article>

      <aside className={f.rail} aria-label="Deal status">
        <div className={f.railBlock}>
          <span className={f.label}>Setup</span>
          <ol className={f.stepList} style={{ borderTop: 0, paddingTop: 0 }}>
            {todos.map((t) => (
              <li key={t.id} className={`${f.step} ${todoClass(t.status)}`}>
                <span className={f.stepIcon} aria-hidden>{t.status === "completed" && <Check size={11} strokeWidth={3} />}</span>
                <span className={f.stepBody}>
                  <span>{t.label}</span>
                  {t.detail && <span className={f.stepDetail}>{t.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {pa && (
          <div className={f.railBlock}>
            <span className={f.label}>Settle</span>
            <h2 className={f.railTitle}>Sign usage to settle</h2>
            <p className={f.railText}>You confirm the delivered usage below. The escrow then pays the seller exactly this cumulative amount, minus what was already settled. No gas.</p>
            <dl className={f.summary}>
              <div><dt>Units delivered</dt><dd>{fmtUnits(pa.acceptance.cumulativeUnits)}</dd></div>
              <div className={f.big}><dt>Cumulative amount</dt><dd><Money micro={pa.acceptance.cumulativeAmount} unit /></dd></div>
              <div><dt>Already settled</dt><dd><Money micro={usage!.settledOnchain} unit /></dd></div>
              <div><dt>Receipts root</dt><dd><MonoValue value={pa.acceptance.receiptsRoot} short /></dd></div>
              {wallet && <div><dt>Signing as</dt><dd><MonoValue value={wallet.address} short /></dd></div>}
            </dl>
            {ackErr && <Notice tone="danger">{ackErr}</Notice>}
            <div className={f.actions}>
              <ActionButton onClick={signUsage} loading={ackBusy} loadingLabel={ackPhase === "approving" ? "Confirm in your wallet" : "Settling"} disabled={!wallet}>{walletLabel}</ActionButton>
            </div>
          </div>
        )}
        {settlement && (
          <div className={f.railBlock}>
            <span className={f.label}>Settled</span>
            <p className={f.railText}>
              {settlement.txHash ? <>Settlement transaction <ExplorerLink href={explorerTx(settlement.txHash)} hash={settlement.txHash} /></> : settlement.status === "mock_no_transaction" ? "Mock mode: balances updated, no transaction was sent." : `Settlement ${settlement.status}. The transaction link appears here once it is submitted.`}
            </p>
          </div>
        )}

        <div className={f.railBlock}>
          <span className={f.label}>Credentials</span>
          <dl className={f.summary}>
            <div><dt>Endpoint</dt><dd><MonoValue value={`POST ${deal.service.endpoint}`} short copy label="endpoint" /></dd></div>
            <div><dt>Docs</dt><dd><a href={deal.service.docsUrl} className={f.textBtn}>API reference</a></dd></div>
          </dl>
          {freshKey ? (
            <>
              <span className={f.label}>API key, shown once</span>
              <div className={d.secret}>
                <span style={{ flex: 1, minWidth: 0 }}>{freshKey}</span>
                <CopyButton value={freshKey} label="Copy API key" />
              </div>
              <p className={f.fine}>Store this key now. It will not be shown again after you leave this page.</p>
            </>
          ) : (
            <p className={f.fine}>{provisioned ? "Your API key was shown once at provisioning." : "Your API key appears here once, when the service is provisioned."}</p>
          )}
        </div>

        <div className={f.railBlock}>
          <span className={f.label}>Balances</span>
          <dl className={f.summary}>
            <div><dt>Deposit</dt><dd><Money micro={deal.balances.deposit} unit /></dd></div>
            <div><dt>Settled</dt><dd><Money micro={deal.balances.settled} unit /></dd></div>
            <div><dt>Refunded</dt><dd><Money micro={deal.balances.refunded} unit /></dd></div>
            <div><dt>Remaining</dt><dd><Money micro={deal.balances.remaining} unit /></dd></div>
          </dl>
          <div className={d.links}>
            {deal.explorer.escrow && <ExplorerLink href={deal.explorer.escrow}>Escrow on explorer</ExplorerLink>}
            {deal.explorer.settlements.map((u) => (
              <ExplorerLink key={u} href={u}>Settlement transaction</ExplorerLink>
            ))}
          </div>
        </div>

        <div className={f.railBlock}>
          <span className={f.label}>Refund</span>
          <p className={f.railText}>Unused balance is refundable from {fmtDate(deal.refundableAt)}.</p>
          <div className={f.actions}>
            <ActionButton variant="secondary" size="sm" onClick={() => refund.mutate()} loading={refund.isPending}>Request refund of unused balance</ActionButton>
          </div>
          {refund.data?.status === "too_early" && <p className={f.fine}>Refunds open on {fmtDateTime(refund.data.refundableAt)}, after the term and grace window end.</p>}
          {refund.data?.status === "submitted" && (
            <p className={f.fine}>Refund submitted. {refund.data.txHash ? <ExplorerLink href={explorerTx(refund.data.txHash)} hash={refund.data.txHash} /> : "The transaction link appears once it is sent."}</p>
          )}
          {refund.isError && <Notice tone="danger">{errorMessage(refund.error)}</Notice>}
        </div>
      </aside>
    </div>
  );
}

function dealTitle(deal: Deal): string {
  const x = deal as { productName?: string; productSlug?: string };
  if (x.productName) return x.productName;
  const slug = x.productSlug ?? productSlugFrom(deal);
  const pretty = slug.replace(/[-_]+/g, " ").trim();
  return pretty ? pretty[0]!.toUpperCase() + pretty.slice(1) : "Your deal";
}

/** The service route is keyed by product slug; the deal's endpoint carries it. */
function productSlugFrom(deal: Deal): string {
  const m = deal.service.endpoint.match(/\/services\/([^/]+)\/execute/);
  return m ? decodeURIComponent(m[1]!) : "";
}
