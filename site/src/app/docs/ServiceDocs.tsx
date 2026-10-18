import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Bot, Coins, Download, ExternalLink, FileJson, Server, Zap } from "lucide-react";
import { ReviewShell } from "../layouts/ReviewShell";
import { LoadingCard } from "../ui/Skeleton";
import { CopyButton } from "../ui/misc";
import { ErrorState } from "../buyer/common";
import { api, qk, type PublicProduct, type RequestField, type RequestSpec } from "../lib/api";
import { DEFAULT_SPEC } from "../buyer/RequestForm";
import { Code } from "./Code";
import s from "./docs.module.css";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://proteus.example";

/** "$0.3500" -> "$0.35". */
const money = (v?: string | null) => (v ? v.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") : v);
const sentences = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).map((x) => String(x).trim().replace(/\.+$/, "")).join(". ");
const typeWord = (t: RequestField["type"]) => (t === "file" ? "file object" : t === "number" ? "number" : t === "textarea" ? "string (long)" : "string");
function exampleValue(f: RequestField): unknown {
  if (f.type === "file") return { name: `${f.key}.pdf`, type: "application/pdf", size: 48213, dataBase64: "<base64>" };
  if (f.type === "number") return Number(f.placeholder) || 2;
  return f.placeholder ?? `<${f.label.toLowerCase()}>`;
}

/** One service's API reference, generated from the product: its own request fields, prices, examples and skill file. */
export default function ServiceDocs() {
  const { sellerSlug = "", productSlug = "" } = useParams();
  const q = useQuery({ queryKey: qk.product(sellerSlug, productSlug), queryFn: () => api.product(sellerSlug, productSlug) });
  const sq = useQuery({ queryKey: qk.seller(sellerSlug), queryFn: () => api.seller(sellerSlug) });
  return (
    <ReviewShell>
      {q.isLoading ? (
        <div className={s.page}><LoadingCard label="Loading the reference" lines={6} /></div>
      ) : q.error || !q.data ? (
        <div className={s.page}><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
      ) : (
        <Reference product={q.data} sellerSlug={sellerSlug} sellerName={sq.data?.name ?? sellerSlug} />
      )}
    </ReviewShell>
  );
}

function Reference({ product: p, sellerSlug, sellerName }: { product: PublicProduct; sellerSlug: string; sellerName: string }) {
  const spec: RequestSpec = p.request && p.request.fields.length ? p.request : DEFAULT_SPEC;
  const example = Object.fromEntries(spec.fields.map((f) => [f.key, exampleValue(f)]));
  const endpoint = `${ORIGIN}/api/services/${p.slug}/execute`;
  const skillUrl = `${ORIGIN}/api/public/sellers/${sellerSlug}/products/${p.slug}/skill.md`;
  const openapiUrl = `${ORIGIN}/api/public/sellers/${sellerSlug}/products/${p.slug}/openapi.json`;
  const bestUnit = [...p.tiers].map((t) => t.unitPriceUsd).sort((a, b) => Number(a.replace("$", "")) - Number(b.replace("$", "")))[0];
  const toc = [["request", "Request fields"], ["example", "Example"], ["response", "Response"], ["billing", "Billing"], ...(p.payPerCallUsd ? [["paypercall", "Pay per call"]] : []), ["agents", "For agents"]] as const;
  return (
    <div className={s.page}>
      <aside className={s.side} aria-label="Sections">
        <span className={s.sideLabel}>On this page</span>
        <nav className={s.toc}>
          {toc.map(([id, label]) => (<a key={id} href={`#${id}`}>{label}</a>))}
          <Link to="/docs" className={s.tocBack}>All of the API</Link>
        </nav>
      </aside>

      <article className={s.doc}>
        <header className={s.head}>
          <span className={s.label}>API reference · <Link to={`/s/${sellerSlug}/${p.slug}`}>{sellerName}</Link></span>
          <h1 className={s.title}>{p.name}</h1>
          <p className={s.lede}>{p.summary ?? p.billableUnit}</p>
          <ul className={s.facts}>
            <li><Server size={14} strokeWidth={1.9} /><span>One {p.unitLabel}: {p.billableUnit}</span></li>
            <li><Coins size={14} strokeWidth={1.9} /><span>From {money(bestUnit)} per {p.unitLabel} on a deal{p.payPerCallUsd ? `, ${money(p.payPerCallUsd)} per call without one` : ""}. {p.termDays}-day term.</span></li>
            <li><BadgeCheck size={14} strokeWidth={1.9} /><span>{p.capabilities.join(" · ")}</span></li>
          </ul>
          <div className={s.btnRow}>
            <a className={s.btn} href={skillUrl} target="_blank" rel="noreferrer"><Bot size={15} strokeWidth={1.9} /> SKILL.md for agents <ExternalLink size={12} aria-hidden /></a>
            <a className={s.btn} href={openapiUrl} target="_blank" rel="noreferrer"><FileJson size={15} strokeWidth={1.9} /> OpenAPI <ExternalLink size={12} aria-hidden /></a>
            <a className={s.btn} href={skillUrl} download="SKILL.md"><Download size={15} strokeWidth={1.9} /> Download skill</a>
          </div>
        </header>

        <section id="request" className={s.section}>
          <h2 className={s.h2}><span className={s.num}>01</span>Request fields</h2>
          <p>Send a <span className={s.method}>POST</span> to <code>{endpoint}</code> with the deal's API key as a bearer token. <code>input</code> carries these fields{spec.intro ? `. ${spec.intro}` : "."}</p>
          <table className={s.fieldTable}>
            <thead><tr><th>key</th><th>type</th><th>required</th><th>notes</th></tr></thead>
            <tbody>
              {spec.fields.map((f) => (
                <tr key={f.key}>
                  <td><code>{f.key}</code></td>
                  <td>{typeWord(f.type)}</td>
                  <td>{f.required ? "yes" : "no"}</td>
                  <td>{sentences(f.label, f.hint, f.placeholder ? `e.g. ${f.placeholder}` : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {spec.fields.some((f) => f.type === "file") && (
            <p>A file is an object with <code>name</code>, <code>type</code> (MIME), <code>size</code> and <code>dataBase64</code>, up to 512 KB per file and 700 KB per request. Text, markdown, CSV, JSON, PDF and images are read in full.</p>
          )}
        </section>

        <section id="example" className={s.section}>
          <h2 className={s.h2}><span className={s.num}>02</span>Example</h2>
          <Code lang="bash">{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer $PROTEUS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ requestId: "req-0001", input: example })}'`}</Code>
          <Code lang="ts">{`const res = await fetch("${endpoint}", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.PROTEUS_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ requestId: crypto.randomUUID(), input: ${JSON.stringify(example, null, 2).replace(/\n/g, "\n  ")} }),
});
const r = await res.json(); // r.status, r.answer, r.deal.cumulativeCharged`}</Code>
          <Code lang="py">{`import requests, uuid
r = requests.post("${endpoint}",
    headers={"Authorization": f"Bearer {PROTEUS_KEY}"},
    json={"requestId": str(uuid.uuid4()), "input": ${JSON.stringify(example)}}).json()
print(r["status"], r["answer"])`}</Code>
        </section>

        <section id="response" className={s.section}>
          <h2 className={s.h2}><span className={s.num}>03</span>Response</h2>
          <Code lang="json">{`{
  "requestId": "req-0001",
  "status": "delivered",            // delivered | handoff | failed
  "billable": true,
  "units": "1",
  "answer": "…the ${p.unitLabel}, as plain text…",
  "source": { "store": "…who did the work…", "fields": [${spec.fields.map((f) => `"${f.key}"`).join(", ")}] },
  "receipt": { "digest": "0x…", "sellerSignature": "0x…" },
  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "250000", "prepaid": "1500000" }
}`}</Code>
          <ul className={s.states}>
            <li><span className={`${s.chip} ${s.chipOk}`}>delivered</span><span>One {p.unitLabel} done. Billed at the deal's unit price.</span></li>
            <li><span className={`${s.chip} ${s.chipWarn}`}>handoff</span><span>The service could not do it from what was sent and passed it to a human. Not billed.</span></li>
            <li><span className={`${s.chip} ${s.chipBad}`}>failed</span><span>Error, timeout or a used-up allowance. Not billed.</span></li>
          </ul>
        </section>

        <section id="billing" className={s.section}>
          <h2 className={s.h2}><span className={s.num}>04</span>Billing</h2>
          <ul className={s.rules}>
            <li><Coins size={15} strokeWidth={1.9} /><span>Only <b>delivered</b> responses are billed, one {p.unitLabel} each. Amounts are micro-USDC strings: <code>250000</code> is $0.25.</span></li>
            <li><BadgeCheck size={15} strokeWidth={1.9} /><span><code>requestId</code> is idempotent. Repeating it returns the stored result and never charges twice; retry a timeout with the same id.</span></li>
            <li><Zap size={15} strokeWidth={1.9} /><span>Settle from the deal page whenever you like; the seller is paid only what you countersign. {p.refundPolicy}</span></li>
          </ul>
        </section>

        {p.payPerCallUsd && (
          <section id="paypercall" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>05</span>Pay per call</h2>
            <p>Without a deal, one request costs {money(p.payPerCallUsd)} in USDC on {ARC_NETWORK_NAMES[defaultNetwork()]} through x402. The first call answers <code>402</code> with the exact amount; sign one USDC authorization and resend the same body with <code>payment</code>. Failed answers are not charged.</p>
            <Code lang="http">{`POST ${ORIGIN}/api/pay/${sellerSlug}/${p.slug}/execute
{ "requestId": "…", "input": ${JSON.stringify(example)}, "payer": "0x…", "payment": { "signature": "0x…", "authorization": { … } } }`}</Code>
          </section>
        )}

        <section id="agents" className={s.section}>
          <h2 className={s.h2}><span className={s.num}>{p.payPerCallUsd ? "06" : "05"}</span>For agents</h2>
          <p>This service ships a skill file generated from the fields above, so an agent knows exactly what to send and what the answer means. Add it to your agent and set <code>PROTEUS_KEY</code> from a funded deal.</p>
          <div className={s.installGrid}>
            <div>
              <b>Claude Code or any skills-aware agent</b>
              <Code lang="bash">{`mkdir -p .claude/skills/proteus-${sellerSlug}-${p.slug}
curl -s ${skillUrl} \\
  -o .claude/skills/proteus-${sellerSlug}-${p.slug}/SKILL.md`}</Code>
            </div>
            <div>
              <b>OpenAI, LangChain, CrewAI and others</b>
              <p className={s.small}>Paste the file into the system prompt or register the OpenAPI document as a tool. The endpoint, auth and schema are in both.</p>
              <Code lang="bash">{`curl -s ${openapiUrl}`}</Code>
            </div>
          </div>
          <div className={s.btnRow}>
            <CopyButton value={skillUrl} label="Copy skill URL" />
            <span className={s.small}>Skill URL: <code>{skillUrl}</code></span>
          </div>
          <div className={s.callout}>
            To let an agent find, negotiate, fund and settle deals on its own, give it the <Link to="/docs#agents">Proteus AI buyer skill</Link> as well. This skill only covers calling this service.
          </div>
        </section>
      </article>
    </div>
  );
}
