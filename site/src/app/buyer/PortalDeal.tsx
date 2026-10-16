import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, PenLine, RotateCcw, Send } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import type { Hex } from "viem";
import { AppShell } from "../layouts/AppShell";
import { SandboxNote } from "../layouts/SandboxNote";
import { Stepper } from "../ui/Stepper";
import { useAuth } from "../auth/useAuth";
import { FundFlow } from "./FundFlow";
import { TodoList, type TodoItem } from "../agentic/TodoList";
import { ToolApproval, type ToolApprovalStatus } from "../agentic/ToolApproval";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatCard } from "../ui/StatCard";
import { StatusTag } from "../ui/StatusTag";
import { CopyButton, ExplorerLink, KeyValue, MonoValue, Notice, shortHex } from "../ui/misc";
import { api, errorMessage, isMock, newRequestId, qk, type Deal, type ExecuteResponse, type Receipt, type UsageResponse } from "../lib/api";
import { signAcceptance, walletErrorMessage } from "../lib/wallet";
import { ErrorState, FLOW_STAGES, PageHeader, fmtDate, fmtDateTime, fmtUnits } from "./common";
import s from "./buyer.module.css";

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
  const [question, setQuestion] = useState("Where is my order?");
  const [orderId, setOrderId] = useState("1042");
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

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <StatusTag state={deal.status} />
            <StatusTag state={deal.service.status} />
            <span className="body3">Record {deal.publicId}</span>
          </>
        }
        title="Your deal"
        lede="Use the service, review every metered request, and sign usage so the seller is paid from escrow. Unused funds stay yours."
        actions={<Stepper current={fundedish ? stage : 1} steps={FLOW_STAGES} />}
      />

      {!fundedish && (
        <div className={s.grid2}>
          <FundFlow deal={deal} onFunded={(d) => { qc.setQueryData(qk.deal(d.id), d); navigate(`/app/deals/${d.id}`, { replace: true }); }} onCancel={() => navigate("/app/deals")} />
        </div>
      )}

      <SandboxNote />

      <div className={s.stats}>
        <StatCard label="Deposited" value={<Money micro={deal.balances.deposit} />} />
        <StatCard label="Used" value={<Money micro={deal.usage.charged} />} hint={`${fmtUnits(deal.usage.units)} of ${fmtUnits(deal.terms.maxUnits)} units`} />
        <StatCard label="Settled to seller" value={<Money micro={deal.balances.settled} />} />
        <StatCard label="Remaining" value={<Money micro={deal.balances.remaining} />} hint={deal.balances.source === "chain" ? "Read from chain" : "Pending chain confirmation"} />
      </div>

      <div className={s.grid2}>
        <div className={s.stack}>
          <Card title="Try the service" subtitle="Send a real request to the metered endpoint. Only delivered answers are billable; retries with the same request id are never charged twice." level={2}>
            {!provisioned ? (
              <Notice tone="info">The service is being provisioned. This page updates automatically.</Notice>
            ) : !apiKey ? (
              <Notice tone="warn" title="API key not available in this browser">The key was shown once when the service was provisioned. Use the copy you saved.</Notice>
            ) : (
              <form onSubmit={submitTest} className={s.stack} noValidate>
                <div className={s.formGrid}>
                  <Field label="Customer question" value={question} onChange={(e) => setQuestion(e.target.value)} error={qErr} maxLength={2000} />
                  <Field label="Order id" hint="Try 1042, 1043, or leave empty" value={orderId} onChange={(e) => setOrderId(e.target.value)} inputMode="numeric" />
                </div>
                <div className={s.row}>
                  <ActionButton type="submit" loading={exec.isPending && exec.variables?.requestId !== lastReq?.requestId} loadingLabel="Sending" icon={<Send size={16} strokeWidth={2} />}>
                    Send test request
                  </ActionButton>
                  {lastReq && (
                    <ActionButton variant="secondary" onClick={() => exec.mutate(lastReq)} loading={exec.isPending && exec.variables?.requestId === lastReq.requestId} disabled={exec.isPending} iconLeft={<RotateCcw size={16} strokeWidth={2} />}>
                      Retry with the same request id
                    </ActionButton>
                  )}
                </div>
              </form>
            )}
            {exec.isError && <Notice tone="danger">{errorMessage(exec.error)}</Notice>}
            {result && (
              <div className={s.stack} aria-live="polite">
                <div className={s.answer}>{result.answer}</div>
                <div className={s.row}>
                  <StatusTag state={result.status} />
                  <StatusTag tone={result.billable ? "info" : "neutral"} label={result.billable ? `Billable, ${result.units} unit` : "Not billable"} />
                  {replayed && <StatusTag tone="success" label="Same request id, not charged again" />}
                </div>
                <KeyValue
                  items={[
                    { k: "Request id", v: <MonoValue value={result.requestId} short copy label="request id" /> },
                    { k: "Source", v: `${result.source.store}${result.source.fields.length ? `, fields ${result.source.fields.join(", ")}` : ""}` },
                    { k: "Receipt digest", v: <MonoValue value={result.receipt.digest} short copy label="receipt digest" /> },
                    { k: "Used so far", v: <span><Money micro={result.deal.cumulativeCharged} /> for {fmtUnits(result.deal.cumulativeUnits)} {result.deal.cumulativeUnits === "1" ? "unit" : "units"}</span> },
                  ]}
                />
              </div>
            )}
          </Card>

          {pa && (
            <ToolApproval
              tool="wallet.signTypedData"
              title="Sign usage to settle"
              description="You confirm the delivered usage below. The escrow then pays the seller exactly this cumulative amount, minus what was already settled."
              icon={<PenLine size={18} strokeWidth={2} />}
              moneyMovement
              status={ackPhase}
              parameters={[
                { label: "Units delivered", value: fmtUnits(pa.acceptance.cumulativeUnits), mono: true },
                { label: "Cumulative amount", value: <Money micro={pa.acceptance.cumulativeAmount} unit />, mono: true },
                { label: "Already settled", value: <Money micro={usage!.settledOnchain} unit />, mono: true },
                { label: "Receipts root", value: <MonoValue value={pa.acceptance.receiptsRoot} short /> },
              ]}
              approveLabel={walletLabel}
              onApprove={signUsage}
              disabled={!wallet}
              disabledReason={!wallet ? "Your wallet is still being set up." : undefined}
              error={ackErr}
            >
              {wallet && (
                <p className="body3">
                  Signing with <MonoValue value={wallet.address} short /> on Arc testnet. No gas.
                </p>
              )}
            </ToolApproval>
          )}
          {settlement && (
            <Notice tone="success" title="Usage settled">
              {settlement.txHash ? (
                <span className={s.txRow}>
                  Settlement transaction <ExplorerLink href={explorerTx(settlement.txHash)} hash={settlement.txHash} />
                </span>
              ) : settlement.status === "mock_no_transaction" ? (
                "Mock mode: balances updated, no transaction was sent."
              ) : (
                `Settlement ${settlement.status}. The transaction link appears here once it is submitted.`
              )}
            </Notice>
          )}

          <Card title="Usage" subtitle="Every request the service handled for this deal." level={2}>
            <DataTable<Receipt>
              caption="Metered requests, newest first"
              rows={receipts}
              rowKey={(r) => r.requestId}
              empty={<EmptyState title="No requests yet" description="Send a test request above to see your first receipt." />}
              columns={[
                { key: "time", header: "Time", render: (r) => fmtDateTime(r.createdAt) },
                { key: "status", header: "Status", render: (r) => <StatusTag state={r.status} /> },
                { key: "answer", header: "Answer", render: (r) => <span className="body3">{r.answerPreview}</span> },
                { key: "units", header: "Units", numeric: true, render: (r) => r.units },
                { key: "cum", header: "Charged total", numeric: true, render: (r) => <Money micro={r.chargedCumulative} /> },
                { key: "digest", header: "Digest", render: (r) => <span className="app-mono" title={r.digest}>{shortHex(r.digest)}</span> },
              ]}
            />
          </Card>
        </div>

        <div className={s.stack}>
          <Card title="Setup" level={2} padding="compact">
            <TodoList items={todos} />
          </Card>

          <Card title="Credentials" level={2} padding="compact" actions={<KeyRound size={18} strokeWidth={2} aria-hidden color="var(--c-dark-60)" />}>
            <KeyValue
              items={[
                { k: "Endpoint", v: <MonoValue value={`POST ${deal.service.endpoint}`} copy label="endpoint" /> },
                { k: "Docs", v: <a href={deal.service.docsUrl} style={{ textDecoration: "underline" }}>API reference</a> },
              ]}
            />
            {freshKey ? (
              <div className={s.stackTight}>
                <span className="label" style={{ color: "var(--c-dark-60)" }}>API key, shown once</span>
                <div className={s.secret}>
                  <span style={{ flex: 1, minWidth: 0 }}>{freshKey}</span>
                  <CopyButton value={freshKey} label="Copy API key" />
                </div>
                <Notice tone="warn">Store this key now. It will not be shown again after you leave this page.</Notice>
              </div>
            ) : (
              <p className="body3">{provisioned ? "Your API key was shown once at provisioning." : "Your API key appears here once, when the service is provisioned."}</p>
            )}
          </Card>

          <Card title="Balances" level={2} padding="compact">
            <KeyValue
              items={[
                { k: "Deposit", v: <Money micro={deal.balances.deposit} unit /> },
                { k: "Settled", v: <Money micro={deal.balances.settled} unit /> },
                { k: "Refunded", v: <Money micro={deal.balances.refunded} unit /> },
                { k: "Remaining", v: <Money micro={deal.balances.remaining} unit /> },
                { k: "Source", v: deal.balances.source === "chain" ? "Read from chain" : "Pending chain confirmation" },
              ]}
            />
            {deal.explorer.escrow && <ExplorerLink href={deal.explorer.escrow}>Escrow on explorer</ExplorerLink>}
            {deal.explorer.settlements.map((u) => (
              <ExplorerLink key={u} href={u}>Settlement transaction</ExplorerLink>
            ))}
          </Card>

          <Card title="Refund" level={2} padding="compact" subtitle={`Unused balance is refundable from ${fmtDate(deal.refundableAt)}.`}>
            <div>
              <ActionButton variant="secondary" onClick={() => refund.mutate()} loading={refund.isPending}>
                Request refund of unused balance
              </ActionButton>
            </div>
            {refund.data?.status === "too_early" && <Notice tone="info">Refunds open on {fmtDateTime(refund.data.refundableAt)}, after the term and grace window end.</Notice>}
            {refund.data?.status === "submitted" && (
              <Notice tone="success" title="Refund submitted">
                {refund.data.txHash ? <ExplorerLink href={explorerTx(refund.data.txHash)} hash={refund.data.txHash} /> : "The transaction link appears once it is sent."}
              </Notice>
            )}
            {refund.isError && <Notice tone="danger">{errorMessage(refund.error)}</Notice>}
          </Card>

          {usageQ.isError && <Notice tone="danger">{errorMessage(usageQ.error)}</Notice>}
          <UsageFootnote usage={usage} />
        </div>
      </div>
    </>
  );
}

function UsageFootnote({ usage }: { usage?: UsageResponse }) {
  if (!usage) return null;
  return (
    <p className="body3">
      Settled onchain so far: <Money micro={usage.settledOnchain} unit />.
    </p>
  );
}

/** The service route is keyed by product slug; the deal's endpoint carries it. */
function productSlugFrom(deal: Deal): string {
  const m = deal.service.endpoint.match(/\/services\/([^/]+)\/execute/);
  return m ? decodeURIComponent(m[1]!) : "";
}
