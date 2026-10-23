/**
 * Catalog sync on the Agent policies page: the seller's own endpoint keeps stock, cost and order rules current.
 * Every change it makes is a new policy or cost version, exactly like editing a product here.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { ActionButton, Card, Field, Notice, StatusTag } from "../kit";
import { api, errorMessage, type CatalogSyncResult } from "../../lib/api";
import { relTime } from "../format";
import s from "../seller.module.css";

const EXAMPLE = `{
  "products": [
    {
      "slug": "event-merch-box",
      "available": true,
      "capacityUnits": 500,
      "costPerUnitUsd": "12.00",
      "prepaidMinimumUsd": "10",
      "approvalThresholdUsd": "1000",
      "maxDiscountPct": 0,
      "minMarginPct": 10
    }
  ]
}`;

export function CatalogSyncCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sell", "catalog-sync"], queryFn: () => api.app.catalogSync(), retry: false });
  const [draft, setDraft] = useState<{ url: string; authHeader: string; secret: string } | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const save = useMutation({
    mutationFn: (b: { url: string; authHeader: string; secret: string }) => api.app.setCatalogSync({ url: b.url.trim() || null, authHeader: b.authHeader.trim() || null, ...(b.secret ? { secret: b.secret } : {}) }),
    onSuccess: (d) => {
      qc.setQueryData(["sell", "catalog-sync"], d);
      setDraft(null);
    },
  });
  const run = useMutation({
    mutationFn: () => api.app.runCatalogSync(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sell", "catalog-sync"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
      qc.invalidateQueries({ queryKey: ["sell"] });
    },
  });
  if (!q.data) return null;
  const d = q.data;
  const cur = draft ?? { url: d.url ?? "", authHeader: d.authHeader ?? "", secret: "" };
  const set = (k: keyof typeof cur) => (e: { target: { value: string } }) => setDraft({ ...cur, [k]: e.target.value });
  const last = run.data ?? d.lastResult;
  const on = Boolean(d.url && d.enabled);

  return (
    <Card
      title="Sync from your own system"
      subtitle={`Point Proteus at a catalog endpoint on your side and your agent always quotes from current stock, cost and order rules. Checked every ${d.everyMinutes} minutes, or now. You can keep editing products here by hand as well.`}
      actions={<StatusTag tone={on ? (d.lastStatus === "error" ? "warn" : "success") : "neutral"} label={on ? (d.lastStatus === "error" ? "Needs attention" : "On") : "Off"} icon={<RefreshCw size={12} />} />}
    >
      <div className={s.fields}>
        <Field label="Catalog endpoint (https, returns JSON)" value={cur.url} onChange={set("url")} placeholder="https://yourshop.com/api/proteus/catalog" />
        <div className={s.row} style={{ gap: 12, alignItems: "flex-end" }}>
          <Field label="Auth header (optional)" value={cur.authHeader} onChange={set("authHeader")} placeholder="x-api-key" />
          <Field label={d.hasSecret ? "Header value (saved, enter to replace)" : "Header value (optional)"} type="password" value={cur.secret} onChange={set("secret")} placeholder={d.hasSecret ? "••••••••" : ""} autoComplete="off" />
        </div>
        <p className={s.hint}>
          Sync can change, per product: listed or not, capacity, cost per unit, prepaid minimum, approval threshold, maximum discount and margin floor. Each change becomes a new policy or cost version, committed on Arc at its next quote. List prices and product text stay as published, because buyers sign them. Products missing from the feed are left alone.{" "}
          <button type="button" className={s.link} onClick={() => setShowFormat((v) => !v)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}>{showFormat ? "Hide the format" : "See the format"}</button>
        </p>
        {showFormat && <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: "var(--c-dark-5)", fontSize: 12.5, overflowX: "auto" }}>{EXAMPLE}</pre>}
        {save.isError && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {run.isError && <Notice tone="danger">{errorMessage(run.error)}</Notice>}
        {last && <SyncSummary r={last} />}
        <div className={s.row}>
          <ActionButton onClick={() => save.mutate(cur)} loading={save.isPending} loadingLabel="Saving" disabled={draft === null}>Save</ActionButton>
          <ActionButton variant="secondary" onClick={() => run.mutate()} loading={run.isPending} loadingLabel="Syncing" disabled={!d.url || draft !== null}>Sync now</ActionButton>
          {d.lastRunAt && <span className={s.sub}>Last checked {relTime(d.lastRunAt)}</span>}
        </div>
      </div>
    </Card>
  );
}

function SyncSummary({ r }: { r: CatalogSyncResult }) {
  if (r.status === "error") return <Notice tone="danger">Sync failed: {r.errors.join("; ")}</Notice>;
  return (
    <Notice tone={r.errors.length ? "warn" : "success"} title={r.updated.length ? `Updated ${r.updated.length} ${r.updated.length === 1 ? "product" : "products"}` : "Everything already current"}>
      {r.updated.map((u) => (
        <div key={u.slug}>
          <strong>{u.slug}</strong>: {u.changes.join(", ")}
        </div>
      ))}
      {r.unchanged.length > 0 && <div>Already current: {r.unchanged.join(", ")}</div>}
      {r.notOnProteus.length > 0 && <div>Not on Proteus (skipped): {r.notOnProteus.join(", ")}</div>}
      {r.errors.map((e) => <div key={e}>{e}</div>)}
    </Notice>
  );
}
