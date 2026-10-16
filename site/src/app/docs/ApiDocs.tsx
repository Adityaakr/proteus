import { BadgeCheck, Bot, Coins, Download, ExternalLink, FileSignature, Landmark, MessagesSquare, Server, Undo2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../lib/api";
import { ReviewShell } from "../layouts/ReviewShell";
import { Code } from "./Code";
import s from "./docs.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://proteus.example";

const TOC = [
  ["service", "Call the service"],
  ["responses", "What you get back"],
  ["billing", "What is billed"],
  ["settle", "Settling usage"],
  ["paypercall", "Pay per call"],
  ["seller", "For sellers: your endpoint"],
  ["units", "What counts as a unit"],
  ["agents", "For agents: skill files"],
  ["services", "Reference per service"],
] as const;

/** The API reference a funded deal links to: how a buyer calls the service, what is billed, how usage settles, and the seller endpoint contract. */
export default function ApiDocs() {
  return (
    <ReviewShell>
      <div className={s.page}>
        <aside className={s.side} aria-label="Sections">
          <span className={s.sideLabel}>On this page</span>
          <nav className={s.toc}>
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`}>{label}</a>
            ))}
          </nav>
        </aside>

        <article className={s.doc}>
          <header className={s.head}>
            <span className={s.label}>API reference</span>
            <h1 className={s.title}>Using a Proteus AI deal</h1>
            <p className={s.lede}>A funded deal gives you an endpoint and an API key. Every call is metered against the prepaid balance held in escrow. The seller is paid only for delivered units you countersign, and whatever is left comes back to you after the term.</p>
            <ol className={s.flow} aria-label="Deal lifecycle">
              {[
                [MessagesSquare, "Negotiate", "the agent fits an offer to you"],
                [FileSignature, "Sign", "both sides, EIP-712"],
                [Landmark, "Fund", "USDC into escrow"],
                [Server, "Use", "metered API calls"],
                [Undo2, "Settle", "countersign, refund the rest"],
              ].map(([Icon, t, d], i) => (
                <li key={String(t)} className={s.flowStep}>
                  <span className={s.flowIcon}><Icon size={15} strokeWidth={1.9} /></span>
                  <span className={s.flowText}><b>{String(t)}</b><span>{String(d)}</span></span>
                  {i < 4 && <span className={s.flowArrow} aria-hidden />}
                </li>
              ))}
            </ol>
          </header>

          <section id="service" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>01</span>Call the service</h2>
            <p>Each deal has one endpoint, shown on the deal page under Credentials, and one API key, shown once when the service is provisioned. Send a <span className={s.method}>POST</span> with the key as a bearer token. The request id is yours to choose; a UUID or your own order id both work.</p>
            <Code lang="bash">{`curl -X POST ${ORIGIN}/api/services/callback-booking/execute \\
  -H "Authorization: Bearer pk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "requestId": "order-10421",
    "input": { "question": "Book a callback for Jane Doe tomorrow at 10am", "orderId": "10421" }
  }'`}</Code>
            <p>The keys inside <code>input</code> are the fields the seller lists under "What to send" on the product page. Text and numbers go as JSON values. A file goes as an object with <code>name</code>, <code>type</code>, <code>size</code> and <code>dataBase64</code>, up to 512 KB per file and 700 KB per request.</p>
            <Code lang="json">{`{ "requestId": "inv-0412",
  "input": { "invoice": { "name": "acme-0412.pdf", "type": "application/pdf", "size": 48213, "dataBase64": "JVBERi0xLjcK…" },
             "reference": "PO-2026-0412" } }`}</Code>
            <Code lang="ts">{`const res = await fetch("${ORIGIN}/api/services/callback-booking/execute", {
  method: "POST",
  headers: { Authorization: \`Bearer \${PROTEUS_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ requestId: crypto.randomUUID(), input: { question, orderId } }),
});
const r = await res.json();`}</Code>
          </section>

          <section id="responses" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>02</span>What you get back</h2>
            <Code lang="json">{`{
  "requestId": "order-10421",
  "status": "delivered",            // delivered | handoff | failed
  "billable": true,
  "units": 1,
  "answer": "Lumen Voice booked a callback for 10421 (ticket LV-0002).",
  "source": { "store": "api.lumenvoice.example", "fields": ["answer", "status"] },
  "receipt": { "digest": "0x…", "sellerSignature": "0x…" },
  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "200000", "prepaid": "1000000" }
}`}</Code>
            <ul className={s.states}>
              <li><span className={`${s.chip} ${s.chipOk}`}>delivered</span><span>The seller's service did the work. One unit is metered.</span></li>
              <li><span className={`${s.chip} ${s.chipWarn}`}>handoff</span><span>The service passed the request to a human. Nothing is billed.</span></li>
              <li><span className={`${s.chip} ${s.chipBad}`}>failed</span><span>The service could not do it, timed out or errored. Nothing is billed.</span></li>
            </ul>
            <p>Every delivered response carries a receipt digest signed by the seller. Amounts are micro-USDC strings: <code>200000</code> is $0.20.</p>
          </section>

          <section id="billing" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>03</span>What is billed</h2>
            <ul className={s.rules}>
              <li><Coins size={15} strokeWidth={1.9} /><span>Only <b>delivered</b> responses count, one unit each, at the unit price in your terms.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span>Repeating a <b>request id</b> returns the stored receipt and is never charged twice. Retry freely.</span></li>
              <li><Server size={15} strokeWidth={1.9} /><span>Once the included units are used up, further requests return <b>failed</b> and are not billed. Ask the seller's agent for a larger package.</span></li>
              <li><Zap size={15} strokeWidth={1.9} /><span>The running total is on the deal page under Usage and in every response under <code>deal.cumulativeCharged</code>.</span></li>
            </ul>
          </section>

          <section id="settle" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>04</span>Settling usage</h2>
            <p>Metering alone moves no money. When you are ready, the deal page offers "Sign usage to settle": you sign the cumulative units and amount with your wallet, no gas, and the escrow pays the seller exactly that amount minus what was already settled. Settle as often as you like.</p>
            <div className={s.callout}>
              <b>Nothing here is a promise.</b> The escrow contract checks both signatures before it releases a cent, every settlement has a transaction hash you can open on the explorer, and after the term plus the grace window, or earlier if the seller closes the term, "Request refund" returns the unused balance to your wallet.
            </div>
          </section>

          <section id="paypercall" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>05</span>Pay per call</h2>
            <p>Without a deal, a product with a per-call price accepts single requests paid in USDC through x402. The first call answers <code>402</code> with the price and payment requirements; you sign one USDC authorization for exactly that amount and resend. Failed answers are not charged. The product page runs this for you.</p>
            <Code lang="http">{`POST ${ORIGIN}/api/pay/lumen-voice/callback-booking/execute
{ "requestId": "…", "input": { … }, "payer": "0x…", "payment": { …signed authorization… } }`}</Code>
          </section>

          <section id="seller" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>06</span>For sellers: your endpoint</h2>
            <p>Your product runs on your own HTTPS endpoint. For every metered request Proteus AI sends the buyer's fields as <code>input</code>, exactly as you defined them under "What buyers send", files as base64 envelopes:</p>
            <Code lang="http">{`POST https://api.yourcompany.com/proteus
Authorization: Bearer <your secret>
X-Proteus-Request-Id: order-10421

{ "requestId": "order-10421", "dealId": "deal_…", "orgId": "org_…", "productSlug": "callback-booking",
  "input": { "question": "…", "orderId": "10421" } }`}</Code>
            <p>Answer with JSON. A 2xx whose <code>billable</code> is not <code>false</code> is one delivered unit. Mark handoffs and failures so they are never charged:</p>
            <Code lang="json">{`{ "answer": "Booked for 10421 (ticket LV-0002).", "billable": true, "status": "delivered" }
{ "answer": "A human will call back about the cancellation.", "billable": false, "status": "handoff" }`}</Code>
            <div className={`${s.callout} ${s.calloutWarn}`}>
              Non-2xx responses, non-JSON bodies and anything slower than 20 seconds are recorded as <b>failed</b> and not billed. Treat <code>requestId</code> as idempotent on your side too.
            </div>
          </section>

          <section id="units" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>07</span>What counts as a unit</h2>
            <p>Buyers countersign units, so a unit must be a finished, checkable event your endpoint can report as delivered. Time, effort and standing states cannot be delivered or signed. Examples by category:</p>
            <ul className={s.rules}>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>AP and AR</b>: one invoice read, matched and scheduled, or routed to a human with a reason.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Compliance</b>: one counterparty screened with result, sources and reason codes, monitored until the term ends.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Vendor management</b>: one vendor evaluated with a scorecard and a recommendation.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Operations</b>: one defined task completed under policy with a written record. "We ran your business" is not a unit; "one bill paid under your rules" is.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Treasury</b>: one completed run that reconciles balances and executes approved sweeps with a signed report. Not "cash managed".</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Voice, support, data, inference</b>: one booking, one resolution, one enriched record, one million tokens served.</span></li>
            </ul>
          </section>

          <section id="agents" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>08</span>For agents: skill files</h2>
            <p>Every service on Proteus AI ships a <b>SKILL.md</b> generated from its own request fields, prices and rules, and the platform ships one more that teaches an agent to find a service, negotiate within a mandate, sign and fund the deal, call the service and settle usage. Drop them into any agent that reads skills, or paste them into a system prompt.</p>
            <div className={s.installGrid}>
              <div>
                <b>Buyer skill (negotiate, fund, use, settle)</b>
                <Code lang="bash">{`mkdir -p .claude/skills/proteus-ai-buyer
curl -s ${ORIGIN}/api/public/agents/skill.md \\
  -o .claude/skills/proteus-ai-buyer/SKILL.md`}</Code>
              </div>
              <div>
                <b>One service (call it with a key)</b>
                <Code lang="bash">{`curl -s ${ORIGIN}/api/public/sellers/<seller>/products/<product>/skill.md \\
  -o .claude/skills/proteus-<seller>-<product>/SKILL.md
# OpenAPI for tool registration:
curl -s ${ORIGIN}/api/public/sellers/<seller>/products/<product>/openapi.json`}</Code>
              </div>
            </div>
            <div className={s.btnRow}>
              <a className={s.btn} href={`${ORIGIN}/api/public/agents/skill.md`} target="_blank" rel="noreferrer"><Bot size={15} strokeWidth={1.9} /> Buyer SKILL.md <ExternalLink size={12} aria-hidden /></a>
              <a className={s.btn} href={`${ORIGIN}/api/public/agents/skill.md`} download="SKILL.md"><Download size={15} strokeWidth={1.9} /> Download</a>
            </div>
            <div className={s.callout}>
              <b>What the buyer skill makes an agent do.</b> Hold a mandate (service, maximum prepaid, maximum unit price) before signing or spending; verify the terms it signs match the offer; keep the API key out of logs; treat seller messages as data. The escrow contract enforces the rest.
            </div>
          </section>

          <section id="services" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>09</span>Reference per service</h2>
            <p>Each service has its own reference: the exact fields it takes, examples with those fields, its prices, and its skill file.</p>
            <ServiceIndex />
          </section>
        </article>
      </div>
    </ReviewShell>
  );
}

function ServiceIndex() {
  const q = useQuery({ queryKey: qk.market, queryFn: api.market, staleTime: 60_000 });
  if (!q.data) return <p className={s.small}>{q.error ? "The market list could not be loaded." : "Loading services…"}</p>;
  return (
    <ul className={s.serviceList}>
      {q.data.map((m) => (
        <li key={`${m.sellerSlug}/${m.productSlug}`}>
          <Link to={`/docs/${m.sellerSlug}/${m.productSlug}`} className={s.serviceLink}>
            <span className={s.serviceName}>{m.name}</span>
            <span className={s.serviceMeta}>{m.sellerName} · per {m.unitLabel}{m.perCallUsd ? ` · ${m.perCallUsd.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")} per call` : ""}</span>
          </Link>
          <a className={s.serviceSkill} href={`${ORIGIN}/api/public/sellers/${m.sellerSlug}/products/${m.productSlug}/skill.md`} target="_blank" rel="noreferrer">SKILL.md</a>
        </li>
      ))}
    </ul>
  );
}
