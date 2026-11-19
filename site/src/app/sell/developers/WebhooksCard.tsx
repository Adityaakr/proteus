import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Webhook } from "lucide-react";
import { ActionButton, Card, DataTable, Field, LoadingCard, Notice, StatusTag, type DataColumn } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { dateTime, relTime } from "../../seller/format";
import { Code } from "../../docs/Code";
import { v1 } from "../v1";
import { SELLER_API_DOCS, WEBHOOK_VERIFY_TS } from "./reference";
import { SecretReveal } from "./ApiKeysCard";
import type { WebhookDelivery, WebhookSettings } from "./types";
import d from "./developers.module.css";

const WEBHOOK_KEY = ["sell", "developers", "webhook"] as const;

export function WebhooksCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: WEBHOOK_KEY, queryFn: () => v1.app.webhook(), retry: false });
  const [draft, setDraft] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const store = (w: WebhookSettings) => {
    const { secret: once, ...rest } = w;
    qc.setQueryData(WEBHOOK_KEY, rest);
    if (once) setSecret(once);
  };
  const save = useMutation({ mutationFn: (url: string | null) => v1.app.setWebhookUrl(url), onSuccess: (w) => { store(w); setDraft(null); } });
  const rotate = useMutation({ mutationFn: () => v1.app.rotateWebhookSecret(), onSuccess: (w) => { store(w); setConfirmRotate(false); } });
  const test = useMutation({ mutationFn: () => v1.app.testWebhook(), onSettled: () => void qc.invalidateQueries({ queryKey: WEBHOOK_KEY }) });

  if (q.isPending) return <LoadingCard label="Loading webhook" />;
  if (q.isError) return <Notice tone="danger">{errorMessage(q.error)}</Notice>;
  const w = q.data;
  const url = draft ?? w.url ?? "";
  const on = Boolean(w.url);

  const columns: DataColumn<WebhookDelivery>[] = [
    { key: "at", header: "Time", render: (x) => <span className={d.when} title={new Date(x.at).toLocaleString()}>{relTime(x.at)}<span className={d.whenSub}>{dateTime(x.at)}</span></span> },
    { key: "event", header: "Event", render: (x) => <span className={d.scope}>{x.event}</span> },
    {
      key: "status",
      header: "Result",
      render: (x) => (
        <span className={d.when}>
          <StatusTag tone={x.ok ? "success" : "danger"} label={x.ok ? "Delivered" : "Failed"} />
          {x.error && <span className={d.errText}>{x.error}</span>}
        </span>
      ),
    },
    { key: "code", header: "HTTP", numeric: true, render: (x) => <span className={d.statusCode}>{x.statusCode ?? "—"}</span> },
    { key: "ms", header: "Latency", numeric: true, render: (x) => `${x.latencyMs.toLocaleString()} ms` },
  ];

  return (
    <Card
      title="Webhooks"
      subtitle={<>Proteus AI POSTs a signed JSON event to your URL when a deal is funded, usage settles, a refund or dispute happens, or an offer needs approval. The chain stays the record; events are informational. <Link to={SELLER_API_DOCS.webhooks} className={d.inlineLink}>Events, payloads and retries</Link></>}
      actions={<StatusTag tone={on ? "success" : "neutral"} label={on ? "Sending" : "Off"} icon={<Webhook size={12} />} />}
    >
      <div className={d.urlRow}>
        <Field label="Endpoint URL (https)" value={url} onChange={(e) => setDraft(e.target.value)} placeholder="https://yourshop.com/hooks/proteus" inputMode="url" autoComplete="off" />
        <ActionButton onClick={() => save.mutate(url.trim() || null)} loading={save.isPending} loadingLabel="Saving" disabled={draft === null || draft.trim() === (w.url ?? "")}>
          {url.trim() || !w.url ? "Save URL" : "Remove webhook"}
        </ActionButton>
      </div>
      {save.isError && <Notice tone="danger">{errorMessage(save.error)}</Notice>}

      {secret && (
        <SecretReveal
          title="Signing secret. Copy it now"
          secret={secret}
          note="Your receiver uses it to check X-Proteus-Signature on every event. It is stored encrypted and never shown again; regenerate it if it is lost."
          onDone={() => setSecret(null)}
        />
      )}

      {on && (
        <>
          <div className={d.panel}>
            <div className={d.panelHead}>
              <div>
                <p className={d.panelTitle}>Signing secret</p>
                <p className="body3">{w.hasSecret ? "Set. Every event carries X-Proteus-Signature: t=<unix>,v1=<HMAC-SHA256 of \"t.body\">." : "Missing. Regenerate one so events can be signed."}</p>
              </div>
              <div className={d.rowActions}>
                <ActionButton size="sm" variant="secondary" onClick={() => setShowVerify((v) => !v)} aria-controls="wh-verify">{showVerify ? "Hide verification code" : "How to verify"}</ActionButton>
                {!confirmRotate && <ActionButton size="sm" variant="secondary" onClick={() => setConfirmRotate(true)}>Regenerate secret</ActionButton>}
              </div>
            </div>
            {confirmRotate && (
              <div className={`${d.panel} ${d.danger}`} role="group" aria-label="Confirm secret regeneration">
                <p className="body3">Events are signed with the new secret immediately, so your receiver rejects them until it has the new one. Update it right after.</p>
                {rotate.isError && <Notice tone="danger">{errorMessage(rotate.error)}</Notice>}
                <div className={d.rowActions} style={{ justifyContent: "flex-start" }}>
                  <ActionButton size="sm" variant="danger" onClick={() => rotate.mutate()} loading={rotate.isPending} loadingLabel="Regenerating">Regenerate secret</ActionButton>
                  <ActionButton size="sm" variant="ghost" onClick={() => setConfirmRotate(false)} disabled={rotate.isPending}>Cancel</ActionButton>
                </div>
              </div>
            )}
            {showVerify && <div id="wh-verify"><Code lang="ts">{WEBHOOK_VERIFY_TS}</Code></div>}
          </div>

          <div className={d.sectionHead}>
            <span className="body3">Events sent to this URL</span>
            <ul className={d.eventList} aria-label="Events">
              {w.events.map((e) => <li key={e.event} className={d.scope} title={e.title}>{e.event}</li>)}
            </ul>
          </div>

          <div className={d.panelHead}>
            <div>
              <p className={d.panelTitle}>Recent deliveries</p>
              <p className="body3">The last {w.deliveries.length || "few"} attempts, newest first. Failed events retry up to 5 times.</p>
            </div>
            <ActionButton size="sm" iconLeft={<Send size={14} aria-hidden />} onClick={() => test.mutate()} loading={test.isPending} loadingLabel="Sending" disabled={draft !== null}>
              Send test event
            </ActionButton>
          </div>
          {test.data && (test.data.ok ? <Notice tone="success">Test event delivered: HTTP {test.data.statusCode} in {test.data.latencyMs} ms.</Notice> : <Notice tone="danger" title="Test event failed">{test.data.error}{test.data.statusCode ? ` (HTTP ${test.data.statusCode})` : ""}</Notice>)}
          {test.isError && <Notice tone="danger">{errorMessage(test.error)}</Notice>}
          <DataTable
            caption="Webhook deliveries"
            columns={columns}
            rows={w.deliveries}
            rowKey={(x) => x.id}
            empty={<p className="body3">No deliveries yet. Send a test event to check your receiver.</p>}
          />
        </>
      )}
    </Card>
  );
}
