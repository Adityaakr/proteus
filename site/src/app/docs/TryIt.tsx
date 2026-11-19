/**
 * "Try it": send a seller API request from the page and see the status, latency and JSON response.
 *
 * - Sandbox (the default, and the only target in the public docs): the published sandbox key, a demo seller with fixed
 *   demo data on Arc testnet. Reads return demo records; writes are dry runs that store nothing.
 * - Your key (Developers page only): the signed-in seller pastes one of their own keys, since full keys are shown once
 *   and stored hashed. The key lives in React state for this page visit only: never written to storage, never logged.
 *   Only reads are sent with it; writes stay dry runs in the sandbox, because a real delivery report moves money.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Loader2, Play } from "lucide-react";
import { CodeBlock } from "./Code";
import { SANDBOX, type ApiRoute } from "../sell/developers/reference";
import t from "./tryit.module.css";

/** Where the sandbox lives for this page: same origin on the testnet app and in local dev, else the testnet app. */
export function sandboxBase(): string {
  if (typeof window === "undefined") return SANDBOX.baseUrl;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || origin === new URL(SANDBOX.baseUrl).origin) return `${origin}${SANDBOX.path}`;
  return SANDBOX.baseUrl;
}

/* ---------------------------------------------------------------- the pasted key, shared by every console on a page */

type KeyState = { key: string; setKey: (k: string) => void };
const KeyContext = createContext<KeyState | null>(null);

/** Holds a pasted key in memory for this page only, so it is entered once for all the consoles on the page. */
export function TryItKeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState("");
  const value = useMemo(() => ({ key, setKey }), [key]);
  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

/* ---------------------------------------------------------------- the console */

export interface OwnTarget {
  /** This deployment's seller API base, e.g. https://app.proteus.co.in/api/v1/seller. */
  base: string;
  env: "test" | "live";
  /** Ids from the signed-in seller's own data, to pre-fill :id. */
  ids: { product?: string; deal?: string };
}

interface Result { status: number; statusText: string; ms: number; body: string; dryRun: boolean; target: "sandbox" | "own" }

const methodClass = (m: string) => (m === "GET" ? t.get : m === "POST" ? t.post : t.patch);
const statusClass = (s: number) => (s >= 200 && s < 300 ? t.ok : s >= 500 || s === 0 ? t.bad : t.warn);

export function TryIt({ route, example, own, compact }: { route: ApiRoute; example: Record<string, unknown> | null; own?: OwnTarget; compact?: boolean }) {
  const shared = useContext(KeyContext);
  const [target, setTarget] = useState<"sandbox" | "own">("sandbox");
  const writes = route.method !== "GET";
  const isProduct = route.path.includes("/products/");
  const hasId = route.path.includes(":id");
  const sandboxId = isProduct ? SANDBOX.ids.product : SANDBOX.ids.deal;
  const ownId = (isProduct ? own?.ids.product : own?.ids.deal) ?? "";
  const [ids, setIds] = useState<{ sandbox: string; own: string }>({ sandbox: sandboxId, own: ownId });
  const id = target === "sandbox" ? ids.sandbox : ids.own || ownId;
  const [body, setBody] = useState(example ? JSON.stringify(example, null, 2) : "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const ownKey = shared?.key ?? "";
  const base = target === "sandbox" ? sandboxBase() : own!.base;
  const rel = route.path.replace("/v1/seller", "");
  const [before, after] = rel.split(":id");
  const url = `${base}${hasId ? `${before}${encodeURIComponent(id)}${after}` : rel}`;
  const ownBlocked = target === "own" && writes;
  const keyMissing = target === "own" && !ownKey.trim();
  const wrongEnv = target === "own" && own && ownKey.trim() && !ownKey.trim().startsWith(`psk_${own.env}_`);

  const send = async () => {
    setProblem(null);
    let payload: string | undefined;
    if (writes) {
      try {
        payload = JSON.stringify(JSON.parse(body || "{}"));
      } catch {
        setProblem("The body is not valid JSON.");
        return;
      }
    }
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch(url, {
        method: route.method,
        credentials: "omit",
        cache: "no-store",
        headers: { Authorization: `Bearer ${target === "sandbox" ? SANDBOX.key : ownKey.trim()}`, ...(payload ? { "Content-Type": "application/json" } : {}) },
        body: payload,
      });
      const ms = Math.round(performance.now() - started);
      const text = await res.text();
      let pretty = text;
      let dryRun = false;
      try {
        const parsed = JSON.parse(text) as { dryRun?: boolean };
        dryRun = parsed?.dryRun === true;
        pretty = JSON.stringify(parsed, null, 2);
      } catch {
        /* not JSON: show as is */
      }
      setResult({ status: res.status, statusText: res.statusText, ms, body: pretty, dryRun, target });
    } catch {
      setResult(null);
      setProblem(`Could not reach ${new URL(url).host}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || ownBlocked || keyMissing || (hasId && !id.trim());

  return (
    <section className={`${t.console} ${compact ? t.compact : ""}`} aria-label={`Try ${route.method} ${rel}`}>
      <div className={t.bar}>
        <span className={t.label}>Try it</span>
        {own ? (
          <span className={t.targets} role="radiogroup" aria-label="Send with">
            {(["sandbox", "own"] as const).map((x) => (
              <button key={x} type="button" role="radio" aria-checked={target === x} className={`${t.target} ${target === x ? t.targetOn : ""}`} onClick={() => setTarget(x)}>
                {x === "sandbox" ? "Sandbox key" : "Your key"}
              </button>
            ))}
          </span>
        ) : (
          <span className={t.badge}>Sandbox · demo data</span>
        )}
      </div>

      <div className={t.request}>
        <span className={`${t.method} ${methodClass(route.method)}`}>{route.method}</span>
        <span className={t.url}>
          <span className={t.urlBase}>{base.replace(/^https?:\/\//, "")}</span>
          {hasId ? (
            <>
              {before}
              <input className={t.idInput} value={id} size={Math.max(8, id.length)} aria-label="id" spellCheck={false} onChange={(e) => setIds((v) => ({ ...v, [target]: e.target.value }))} placeholder={isProduct ? "prd_…" : "deal_…"} />
              {after}
            </>
          ) : (
            rel
          )}
        </span>
        <button type="button" className={t.send} onClick={send} disabled={disabled}>
          {busy ? <Loader2 size={14} className={t.spin} aria-hidden /> : <Play size={13} aria-hidden />}
          {busy ? "Sending" : writes && target === "sandbox" ? "Dry run" : "Send"}
        </button>
      </div>

      <div className={t.auth}>
        <span className={t.authName}>Authorization</span>
        {target === "sandbox" ? (
          <code className={t.authValue} title="The public sandbox key: demo data only">Bearer {SANDBOX.key}</code>
        ) : (
          <input
            className={t.keyInput}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`Paste a psk_${own?.env ?? "live"}_… key (kept on this page only)`}
            value={ownKey}
            onChange={(e) => shared?.setKey(e.target.value)}
            aria-label="Your seller API key"
          />
        )}
      </div>

      {writes && (
        <label className={t.bodyWrap}>
          <span className={t.authName}>Body</span>
          <textarea className={t.body} wrap="off" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} rows={Math.min(12, body.split("\n").length + 1)} />
        </label>
      )}

      <p className={t.hint}>
        {target === "sandbox"
          ? writes
            ? "Dry run: the sandbox runs the API's own checks and answers what would happen. Nothing is stored, signed or sent."
            : "Sandbox: a demo seller with fixed demo data on Arc testnet. The key is public and opens nothing else."
          : ownBlocked
            ? "Writes are not sent with your key from this page: a delivery report or price change acts on real deals. Try it as a dry run with the sandbox key, then send it from your server."
            : wrongEnv
              ? `This page's API takes ${own!.env} keys (psk_${own!.env}_…); that key will be refused with 401.`
              : "Sent from your Developers page to your own seller API. The key stays in this page's memory and is cleared when you leave; never embed it in client-side code you ship."}
      </p>

      {problem && <p className={t.problem} role="alert">{problem}</p>}
      {result && (
        <div className={t.result} aria-live="polite">
          <CodeBlock
            code={result.body}
            lang="json"
            title={
              <span className={t.resultHead}>
                <span className={`${t.status} ${statusClass(result.status)}`}>{result.status} {result.statusText || ""}</span>
                <span className={t.ms}>{result.ms} ms</span>
                {result.dryRun && <span className={t.dry}>dry run</span>}
                {result.target === "sandbox" && !result.dryRun && <span className={t.dry}>sandbox</span>}
              </span>
            }
          />
        </div>
      )}
    </section>
  );
}
