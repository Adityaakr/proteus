import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { ActionButton, Card, DataTable, EmptyState, Field, Notice, StatusTag, type DataColumn } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { dateTime, relTime } from "../../seller/format";
import { v1 } from "../v1";
import type { ApiKey, ApiScope, DevelopersOverview, KeyEnv, KeyReveal } from "./types";
import d from "./developers.module.css";

export const DEVELOPERS_KEY = ["sell", "developers"] as const;

const ENV_LABEL: Record<KeyEnv, string> = { live: "Live keys", test: "Test keys" };
const ENV_NET: Record<KeyEnv, string> = { live: "Arc mainnet", test: "Arc testnet" };
const STATE_TAG: Record<ApiKey["state"], { label: string; tone: "success" | "warn" | "neutral" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  expiring: { label: "Replaced", tone: "warn" },
  expired: { label: "Expired", tone: "neutral" },
  revoked: { label: "Revoked", tone: "danger" },
};

/** Copies the full key, with the confirmation announced. */
function CopySecret({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={d.copyBtn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: the key is still selectable */
        }
      }}
    >
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {done ? "Copied" : label}
      <span className="sr-only" aria-live="polite">{done ? "Copied to the clipboard" : ""}</span>
    </button>
  );
}

/** The full key, once. Shown after create or regenerate and gone when dismissed or the page reloads. */
export function SecretReveal({ title, secret, note, onDone }: { title: string; secret: string; note: string; onDone: () => void }) {
  return (
    <div className={d.reveal} role="status">
      <div className={d.panelHead}>
        <p className={d.panelTitle}>{title}</p>
        <StatusTag tone="warn" label="Shown once" />
      </div>
      <div className={d.secretRow}>
        <code>{secret}</code>
        <CopySecret value={secret} label="Copy" />
      </div>
      <p className="body3">{note}</p>
      <div>
        <ActionButton size="sm" variant="secondary" onClick={onDone}>I have stored it</ActionButton>
      </div>
    </div>
  );
}

function ScopeChecks({ scopes, value, onChange }: { scopes: DevelopersOverview["scopes"]; value: ApiScope[]; onChange: (v: ApiScope[]) => void }) {
  const groups: [string, DevelopersOverview["scopes"]][] = [
    ["Read", scopes.filter((x) => x.id.endsWith(":read"))],
    ["Write", scopes.filter((x) => x.id.endsWith(":write"))],
  ];
  return (
    <fieldset className={d.scopeGrid} style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="sr-only">Permissions</legend>
      {groups.map(([label, list]) => (
        <div key={label} style={{ display: "contents" }}>
          <span className={d.scopeGroupLabel}>{label}</span>
          {list.map((sc) => {
            const on = value.includes(sc.id);
            return (
              <label key={sc.id} className={`${d.check} ${on ? d.checkOn : ""}`}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== sc.id) : [...value, sc.id])} />
                <span>
                  <strong>{sc.label}</strong>
                  <code>{sc.id}</code>
                  <small>{sc.description}</small>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </fieldset>
  );
}

function CreateKey({ data, onCreated, onCancel }: { data: DevelopersOverview; onCreated: (r: KeyReveal) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(["deals:read"]);
  const create = useMutation({
    mutationFn: () => v1.app.createApiKey({ name: name.trim(), scopes }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: DEVELOPERS_KEY });
      onCreated(r);
    },
  });
  return (
    <form
      className={d.panel}
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className={d.panelHead}>
        <p className={d.panelTitle}>New {data.env} key</p>
        <StatusTag network={data.network} label={ENV_NET[data.env]} />
      </div>
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Order sync" maxLength={60} hint="Something that says where the key is used, so you know which one to rotate." autoFocus />
      <ScopeChecks scopes={data.scopes} value={scopes} onChange={setScopes} />
      {create.isError && <Notice tone="danger">{errorMessage(create.error)}</Notice>}
      <div className={d.rowActions} style={{ justifyContent: "flex-start" }}>
        <ActionButton type="submit" loading={create.isPending} loadingLabel="Creating" disabled={!name.trim() || scopes.length === 0}>Create key</ActionButton>
        <ActionButton variant="ghost" onClick={onCancel} disabled={create.isPending}>Cancel</ActionButton>
      </div>
    </form>
  );
}

function Regenerate({ k, overlapHours, onDone, onCancel }: { k: ApiKey; overlapHours: number; onDone: (r: KeyReveal) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"overlap" | "now">("overlap");
  const regen = useMutation({
    mutationFn: () => v1.app.regenerateApiKey(k.id, mode === "overlap" ? overlapHours : 0),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: DEVELOPERS_KEY });
      onDone(r);
    },
  });
  return (
    <div className={d.panel} role="group" aria-label={`Regenerate ${k.name}`}>
      <p className={d.panelTitle}>Regenerate “{k.name}”</p>
      <p className="body3">You get a new key with the same name and permissions. Choose what happens to the old one.</p>
      <div className={d.choices} role="radiogroup" aria-label="Old key">
        <label className={`${d.check} ${mode === "overlap" ? d.checkOn : ""}`}>
          <input type="radio" name={`regen-${k.id}`} checked={mode === "overlap"} onChange={() => setMode("overlap")} />
          <span>
            <strong>Keep it working for {overlapHours} hours</strong>
            <small>Recommended for live integrations: deploy the new key, and the old one stops by itself.</small>
          </span>
        </label>
        <label className={`${d.check} ${mode === "now" ? d.checkOn : ""}`}>
          <input type="radio" name={`regen-${k.id}`} checked={mode === "now"} onChange={() => setMode("now")} />
          <span>
            <strong>Cut it off now</strong>
            <small>For a leaked key. Anything still using it fails from this moment.</small>
          </span>
        </label>
      </div>
      {regen.isError && <Notice tone="danger">{errorMessage(regen.error)}</Notice>}
      <div className={d.rowActions} style={{ justifyContent: "flex-start" }}>
        <ActionButton variant={mode === "now" ? "danger" : "primary"} onClick={() => regen.mutate()} loading={regen.isPending} loadingLabel="Regenerating">Regenerate key</ActionButton>
        <ActionButton variant="ghost" onClick={onCancel} disabled={regen.isPending}>Cancel</ActionButton>
      </div>
    </div>
  );
}

function Revoke({ k, onDone, onCancel }: { k: ApiKey; onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => v1.app.revokeApiKey(k.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DEVELOPERS_KEY });
      onDone();
    },
  });
  return (
    <div className={`${d.panel} ${d.danger}`} role="group" aria-label={`Revoke ${k.name}`}>
      <p className={d.panelTitle}>Revoke “{k.name}”?</p>
      <p className="body3">It stops working immediately, for every request. This cannot be undone; create a new key if you need access again.</p>
      {revoke.isError && <Notice tone="danger">{errorMessage(revoke.error)}</Notice>}
      <div className={d.rowActions} style={{ justifyContent: "flex-start" }}>
        <ActionButton variant="danger" onClick={() => revoke.mutate()} loading={revoke.isPending} loadingLabel="Revoking">Revoke key</ActionButton>
        <ActionButton variant="ghost" onClick={onCancel} disabled={revoke.isPending}>Keep it</ActionButton>
      </div>
    </div>
  );
}

/** One line: relative time, with the exact time on hover and for screen readers. */
function When({ iso, empty }: { iso: string | null; empty: string }) {
  if (!iso) return <span className={d.whenSub}>{empty}</span>;
  return (
    <time dateTime={iso} title={dateTime(iso)} className={d.when}>
      {relTime(iso)}
    </time>
  );
}

export function ApiKeysCard({ data }: { data: DevelopersOverview }) {
  const [tab, setTab] = useState<KeyEnv>(data.env);
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<{ title: string; secret: string; note: string } | null>(null);
  const [action, setAction] = useState<{ id: string; kind: "regenerate" | "revoke" } | null>(null);
  const [showOld, setShowOld] = useState(false);

  const here = tab === data.env;
  const keys = data.keys.filter((k) => k.env === tab);
  const current = keys.filter((k) => k.state === "active" || k.state === "expiring");
  const old = keys.filter((k) => k.state === "revoked" || k.state === "expired");
  const rows = showOld ? [...current, ...old] : current;
  const acting = action ? data.keys.find((k) => k.id === action.id) : undefined;

  const columns: DataColumn<ApiKey>[] = [
    {
      key: "name",
      header: "Name",
      render: (k) => (
        <span className={d.keyName}>
          <strong>{k.name}</strong>
          <span className={d.mask}>{k.masked}</span>
          <span className={d.whenSub}>Created <When iso={k.createdAt} empty="" /></span>
        </span>
      ),
    },
    {
      key: "scopes",
      header: "Permissions",
      render: (k) => (
        <span className={d.scopeList}>
          {k.scopes.map((sc) => <span key={sc} className={`${d.scope} ${sc.endsWith(":write") ? d.scopeWrite : ""}`}>{sc}</span>)}
        </span>
      ),
    },
    { key: "used", header: "Last used", render: (k) => <When iso={k.lastUsedAt} empty="Never used" /> },
    {
      key: "state",
      header: "Status",
      render: (k) => (
        <span className={d.when}>
          <StatusTag tone={STATE_TAG[k.state].tone} label={STATE_TAG[k.state].label} />
          {k.state === "expiring" && k.expiresAt && <span className={d.untilSub}>Works until {dateTime(k.expiresAt)}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      // No visually hidden header text: an absolutely positioned label would escape the table scroller on phones.
      header: "",
      render: (k) =>
        k.state === "active" ? (
          <span className={d.rowActions}>
            <ActionButton size="sm" variant="secondary" aria-label={`Regenerate ${k.name}`} onClick={() => { setReveal(null); setAction({ id: k.id, kind: "regenerate" }); }}>Regenerate</ActionButton>
            <ActionButton size="sm" variant="ghost" aria-label={`Revoke ${k.name}`} onClick={() => { setReveal(null); setAction({ id: k.id, kind: "revoke" }); }}>Revoke</ActionButton>
          </span>
        ) : k.state === "expiring" ? (
          <span className={d.rowActions}>
            <ActionButton size="sm" variant="ghost" aria-label={`Revoke ${k.name} now`} onClick={() => setAction({ id: k.id, kind: "revoke" })}>Revoke now</ActionButton>
          </span>
        ) : null,
    },
  ];

  return (
    <Card
      title="API keys"
      subtitle="Keys let your own systems read deals, usage and payments, and report deliveries or change prices. Each key carries only the permissions you give it, and is stored hashed: you see the full key once."
      actions={
        here && !creating ? (
          <ActionButton iconLeft={<Plus size={15} aria-hidden />} onClick={() => { setCreating(true); setReveal(null); setAction(null); }}>Create key</ActionButton>
        ) : undefined
      }
    >
      <div className={d.envTabs} role="tablist" aria-label="Environment">
        {(["live", "test"] as const).map((e) => (
          <button key={e} type="button" role="tab" aria-selected={tab === e} className={`${d.envTab} ${tab === e ? d.envTabOn : ""}`} onClick={() => { setTab(e); setCreating(false); setAction(null); }}>
            <span className={`${d.envDot} ${e === "live" ? d.envDotLive : d.envDotTest}`} aria-hidden />
            {ENV_LABEL[e]}
            <span className="sr-only">, {ENV_NET[e]}</span>
          </button>
        ))}
      </div>

      {!here ? (
        <Notice tone="info" title={`${ENV_LABEL[tab]} are managed on ${ENV_NET[tab]}`}>
          <span>
            {tab === "test" ? "Test keys only read and write testnet data, so they live on the testnet dashboard. " : "Live keys only read and write mainnet data, so they live on the mainnet dashboard. "}
            {data.peer ? <a href={`${data.peer.url.replace(/\/$/, "")}/app/sell/developers`} className={d.inlineLink}>Open {ENV_NET[tab]} Developers</a> : "That deployment is not linked from here."}
          </span>
        </Notice>
      ) : (
        <>
          {reveal && <SecretReveal title={reveal.title} secret={reveal.secret} note={reveal.note} onDone={() => setReveal(null)} />}
          {creating && (
            <CreateKey
              data={data}
              onCancel={() => setCreating(false)}
              onCreated={(r) => {
                setCreating(false);
                setReveal({ title: `“${r.key.name}” is ready. Copy the key now`, secret: r.secret, note: "This is the only time the full key is shown. Store it in your secret manager; after this the dashboard only shows its first and last characters." });
              }}
            />
          )}
          {acting && action?.kind === "regenerate" && (
            <Regenerate
              k={acting}
              overlapHours={data.overlap.defaultHours}
              onCancel={() => setAction(null)}
              onDone={(r) => {
                setAction(null);
                setReveal({
                  title: `New key for “${r.key.name}”. Copy it now`,
                  secret: r.secret,
                  note: r.previous?.state === "expiring" && r.previous.expiresAt ? `The old key keeps working until ${dateTime(r.previous.expiresAt)}, then stops by itself. This is the only time the new key is shown.` : "The old key has stopped working. This is the only time the new key is shown.",
                });
              }}
            />
          )}
          {acting && action?.kind === "revoke" && <Revoke k={acting} onCancel={() => setAction(null)} onDone={() => setAction(null)} />}

          <DataTable
            caption={`${ENV_LABEL[tab]} for ${ENV_NET[tab]} data`}
            columns={columns}
            rows={rows}
            rowKey={(k) => k.id}
            empty={
              <EmptyState
                icon={<KeyRound size={20} />}
                title={`No ${tab} keys yet`}
                description="Create one for each system that talks to Proteus AI, such as your order backend or a fulfilment script, so you can rotate them separately."
                action={!creating ? <ActionButton onClick={() => setCreating(true)} iconLeft={<Plus size={15} aria-hidden />}>Create key</ActionButton> : undefined}
              />
            }
          />
          {old.length > 0 && (
            <div>
              <button type="button" className={d.inlineLink} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setShowOld((v) => !v)}>
                {showOld ? "Hide revoked and expired keys" : `Show ${old.length} revoked or expired ${old.length === 1 ? "key" : "keys"}`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
