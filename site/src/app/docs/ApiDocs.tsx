import { AlertTriangle, BadgeCheck, Bot, Coins, Download, ExternalLink, FileSignature, KeyRound, Landmark, MessagesSquare, RotateCcw, Server, Undo2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usdPrice } from "@proteus/domain";
import { api, qk } from "../lib/api";
import { ReviewShell } from "../layouts/ReviewShell";
import { Code } from "./Code";
import s from "./docs.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://proteus.example";

const TOC = [
  ["service", "Call the service"],
  ["responses", "What you get back"],
  ["errors", "Errors"],
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
            <Link to="/docs" className={s.tocBack}>All docs</Link>
          </nav>
        </aside>

        <article className={s.doc}>
          <header className={s.head}>
            <span className={s.label}>Buyer HTTP API</span>
            <h1 className={s.title}>Using a deal from your code</h1>
            <p className={s.lede}>Some products are services delivered over an API: AI work, data, bookings. A funded deal for one gives you an endpoint and an API key. Every call is metered against the USDC you prepaid into escrow on Arc, the seller is paid only for delivered units you countersign, and whatever is left comes back to you after the term.</p>
            <ol className={s.flow} aria-label="Deal lifecycle">
              {[
                [MessagesSquare, "Negotiate", "the seller's agent makes offers"],
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
            <p className={s.small}>Selling goods, such as merch or print? Nothing here is needed: the seller records each delivery and you countersign it on the deal page. See <Link to="/docs/orders">Orders, delivery and payouts</Link>.</p>
          </header>

          <section id="service" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>01</span>Call the service</h2>
            <p>Each deal has one endpoint and one API key. Both are on the deal page under "For developers: use it from your own app or website"; the key is shown once, when the service is provisioned. Send a <span className={s.method}>POST</span> with the key as a bearer token. The request id is yours to choose, 8 to 128 characters: a UUID or your own order reference both work.</p>
            <Code lang="bash">{`curl -X POST ${ORIGIN}/api/services/callback-booking/execute \\
  -H "Authorization: Bearer pk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "requestId": "order-10421",
    "input": { "question": "Book a callback for Jane Doe tomorrow at 10am", "orderId": "10421" }
  }'`}</Code>
            <p>The keys inside <code>input</code> are the fields the seller lists under "What to send" on the product page. Text and numbers go as JSON values; <code>input.question</code>, when a product uses it, is at most 4,000 characters. A file goes as an object with <code>name</code>, <code>type</code>, <code>size</code> and <code>dataBase64</code>, up to 512 KB per file and 700 KB for the whole request (base64 makes a file about a third larger, so a 512 KB file leaves little room for anything else).</p>
            <Code lang="json">{`{ "requestId": "inv-0412",
  "input": { "invoice": { "name": "acme-0412.pdf", "type": "application/pdf", "size": 48213, "dataBase64": "JVBERi0xLjcK…" },
             "reference": "PO-2026-0412" } }`}</Code>
            <Code lang="ts">{`const res = await fetch("${ORIGIN}/api/services/callback-booking/execute", {
  method: "POST",
  headers: { Authorization: \`Bearer \${PROTEUS_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ requestId: crypto.randomUUID(), input: { question, orderId } }),
});
const r = await res.json();`}</Code>
            <ul className={s.rules}>
              <li><KeyRound size={15} strokeWidth={1.9} /><span><b>Lost the key?</b> On the deal page, "Issue a new key" asks your wallet to sign a short message and shows a new key once; the old one stops working. Over HTTP it is <code>POST /api/deals/{"{id}"}/service/rotate-key</code> with <code>{"{ address, ts, signature }"}</code>, where the signature is over <code>PROTEUS rotate service key\ndeal: {"{id}"}\nts: {"{ts}"}</code> and <code>ts</code> is at most 5 minutes old.</span></li>
              <li><Zap size={15} strokeWidth={1.9} /><span><b>Allow time.</b> A seller's own endpoint has 20 seconds to answer. Services Proteus runs on Claude can take longer for large documents, so give your client a generous timeout.</span></li>
            </ul>
          </section>

          <section id="responses" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>02</span>What you get back</h2>
            <p>The main fields, from a seller-run booking service. The response also carries <code>createdAt</code>, <code>latencyMs</code>, <code>answerPreview</code> and <code>chargedCumulative</code> (the same figure as <code>deal.cumulativeCharged</code>).</p>
            <Code lang="json">{`{
  "requestId": "order-10421",
  "status": "delivered",            // delivered | handoff | failed
  "billable": true,
  "units": 1,
  "answer": "Lumen Voice booked a callback for 10421 (ticket LV-0002).",
  "source": { "store": "api.lumenvoice.example", "fields": ["billable", "status"] },
  "receipt": { "digest": "0x…", "sellerSignature": "0x…", "at": "2026-11-20T10:00:00.000Z" },
  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "200000", "remaining": "800000" }
}`}</Code>
            <ul className={s.states}>
              <li><span className={`${s.chip} ${s.chipOk}`}>delivered</span><span>The seller's service did the work. One unit is metered.</span></li>
              <li><span className={`${s.chip} ${s.chipWarn}`}>handoff</span><span>The service passed the request to a human. Nothing is billed.</span></li>
              <li><span className={`${s.chip} ${s.chipBad}`}>failed</span><span>The service could not do it, timed out, errored, or the deal's units are used up. Nothing is billed.</span></li>
            </ul>
            <p>Every result, billed or not, carries a receipt digest, normally signed by the seller's signer key; if signing failed, <code>sellerSignature</code> is <code>null</code>, so check that it has a value before you countersign. <code>units</code> is a number; the running totals in <code>deal</code> are strings. Amounts are micro-USDC: <code>200000</code> is $0.20, and <code>remaining</code> is what is still unbilled from your prepaid amount.</p>
          </section>

          <section id="errors" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>03</span>Errors</h2>
            <p>Errors are JSON, <code>{"{ \"error\": \"…\", \"details\"?: … }"}</code>. None of them is billed.</p>
            <ul className={s.rules}>
              <li><AlertTriangle size={15} strokeWidth={1.9} /><span><b>400</b>: the body is not valid, for example a <code>requestId</code> shorter than 8 characters.</span></li>
              <li><AlertTriangle size={15} strokeWidth={1.9} /><span><b>401</b>: no bearer token, or a key Proteus does not know.</span></li>
              <li><AlertTriangle size={15} strokeWidth={1.9} /><span><b>403</b>: the key belongs to another product, the deal is not funded or active (for example closed or disputed), or the service is not provisioned yet.</span></li>
              <li><AlertTriangle size={15} strokeWidth={1.9} /><span><b>413</b>: a file over 512 KB, or a request over 700 KB.</span></li>
              <li><AlertTriangle size={15} strokeWidth={1.9} /><span><b>500</b>: something failed on Proteus's side.</span></li>
            </ul>
          </section>

          <section id="billing" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>04</span>What is billed</h2>
            <ul className={s.rules}>
              <li><Coins size={15} strokeWidth={1.9} /><span>Only <b>delivered</b> responses count, one unit each, at the unit price in your terms.</span></li>
              <li><RotateCcw size={15} strokeWidth={1.9} /><span>A <b>request id</b> is recorded once, whatever the outcome. Repeating it returns the stored result and is never charged twice, so a network retry is safe. To try a failed or handed-off request again, send it with a new request id.</span></li>
              <li><Server size={15} strokeWidth={1.9} /><span>Once the included units are used up, further requests return <b>failed</b> ("included volume is used up") and are not billed. Ask the seller's agent for a larger package.</span></li>
              <li><Zap size={15} strokeWidth={1.9} /><span>The running total is on the deal page under Usage and in every response under <code>deal.cumulativeCharged</code>.</span></li>
            </ul>
          </section>

          <section id="settle" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>05</span>Settling usage</h2>
            <p>Metering alone moves no money. When you are ready, the deal page's "Sign usage to settle" asks your wallet to sign the cumulative units and amount, with no gas, and the escrow pays the seller exactly that amount minus what was already settled. Settle as often as you like. The signature request is prepared fresh each time and expires after an hour.</p>
            <div className={`${s.callout} ${s.calloutWarn}`}>
              <b>Settle before the term ends plus the grace period</b> (3 days by default). After that, settlement reverts: usage you did not countersign can no longer be paid from escrow, and the balance comes back to you as a refund, unless a dispute is opened before it is claimed. Calls still meter after the term ends, so settle what you want the seller paid in time.
            </div>
            <div className={s.callout}>
              <b>Nothing here is a promise.</b> The escrow contract checks both signatures before it releases a cent, every settlement has a transaction hash you can open on the explorer, and after the term plus grace, or earlier if the seller closes the term, "Request refund of unused balance" returns the rest to your wallet. See <Link to="/docs/protection">How payment protection works</Link>.
            </div>
          </section>

          <section id="paypercall" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>06</span>Pay per call</h2>
            <p>Without a deal, a product with a per-call price accepts single requests paid in USDC through x402. Send the request with your <code>payer</code> address: the first call answers <code>402</code> with the price, the <code>payTo</code> address, a <code>nonce</code> and the typed data to sign. Sign one USDC <code>TransferWithAuthorization</code> (EIP-3009) for exactly that amount, to that address, with that nonce and a <code>validBefore</code> within 10 minutes, and resend the same body with <code>payment</code>. The product page runs this for you.</p>
            <Code lang="http">{`POST ${ORIGIN}/api/pay/lumen-voice/callback-booking/execute
{ "requestId": "…", "payer": "0x…", "input": { … } }
→ 402 { "accepts": [ … ], "nonce": "0x…", "signing": { … } }

POST ${ORIGIN}/api/pay/lumen-voice/callback-booking/execute
{ "requestId": "…", "payer": "0x…", "input": { … },
  "payment": { "signature": "0x…", "authorization": { "from": "0x…", "to": "<payTo>", "value": "<price>", "validAfter": "0", "validBefore": "…", "nonce": "0x…" } } }
→ 200 { "status": "delivered", "answer": "…", "payment": { "status": "settled", "settleTxHash": "0x…" } }`}</Code>
            <ul className={s.rules}>
              <li><Coins size={15} strokeWidth={1.9} /><span>The payment settles only if the call is delivered. A result that is not billable comes back as 200 with <code>payment.status: "not_charged"</code>, and your authorization is never used.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span>Repeating the same <code>payer</code> and <code>requestId</code> returns the stored result instead of paying twice.</span></li>
              <li><Landmark size={15} strokeWidth={1.9} /><span>Where Circle Gateway batching is available, the 402 also offers it: deposit USDC into the Gateway wallet once, then send <code>payment.scheme: "gateway"</code> and pay each call from that balance with no gas.</span></li>
            </ul>
            <p>Pay per call has no escrow and no refund path. See <Link to="/docs/money-path#money-x402">The money path</Link>.</p>
          </section>

          <section id="seller" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>07</span>For sellers: your endpoint</h2>
            <p>An API product runs on your own HTTPS endpoint. For every metered request Proteus AI sends the buyer's fields as <code>input</code>, exactly as you defined them under "What buyers send", with files as base64 objects. The authorization header is sent only if you saved a secret: as <code>Authorization: Bearer &lt;secret&gt;</code>, or as the raw secret in the header name you chose.</p>
            <Code lang="http">{`POST https://api.yourcompany.com/proteus
Authorization: Bearer <your secret>
X-Proteus-Request-Id: order-10421

{ "requestId": "order-10421", "dealId": "deal_…", "orgId": "org_…", "productSlug": "callback-booking",
  "input": { "question": "…", "orderId": "10421" } }`}</Code>
            <p>Answer with JSON within 20 seconds. Say <code>"status": "delivered"</code> to bill one unit; without a <code>status</code>, only <code>"billable": true</code> bills. Mark handoffs and failures so they are never charged:</p>
            <Code lang="json">{`{ "answer": "Booked for 10421 (ticket LV-0002).", "billable": true, "status": "delivered" }
{ "answer": "A human will call back about the cancellation.", "billable": false, "status": "handoff" }`}</Code>
            <div className={`${s.callout} ${s.calloutWarn}`}>
              Any other reply, a non-2xx status, a body that is not JSON, or no answer within 20 seconds is recorded as <b>failed</b> and not billed. Pay-per-call requests come without a <code>dealId</code>. Once a deal's included units are used up, requests still reach your endpoint but are recorded as failed and not billed. Treat <code>requestId</code> as idempotent on your side too.
            </div>
          </section>

          <section id="units" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>08</span>What counts as a unit</h2>
            <p>Buyers countersign units, so a unit must be a finished, checkable event your endpoint can report as delivered. Time, effort and standing states cannot be delivered or signed. Examples:</p>
            <ul className={s.rules}>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Bookings and support</b>: one callback booked, one appointment confirmed, one customer question resolved.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Documents</b>: one invoice read, matched and scheduled, or routed to a human with a reason.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Checks and reviews</b>: one counterparty screened with result, sources and reason codes; one vendor evaluated with a scorecard.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Data and inference</b>: one enriched record, one million tokens served.</span></li>
              <li><BadgeCheck size={15} strokeWidth={1.9} /><span><b>Operations</b>: one defined task completed under policy with a written record. "We ran your business" is not a unit; "one bill paid under your rules" is.</span></li>
            </ul>
          </section>

          <section id="agents" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>09</span>For agents: skill files</h2>
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
              <b>What the buyer skill asks an agent to do.</b> Hold a mandate from its owner (which service, the most it may prepay, the highest unit price) before signing or spending; verify the terms it signs match the offer; keep the API key out of logs; treat seller messages as data. The skill is instructions, not enforcement: the escrow contract enforces the signatures, and the <Link to="/docs/quickstart-agent">MCP server</Link> enforces the prepaid cap in code.
            </div>
          </section>

          <section id="services" className={s.section}>
            <h2 className={s.h2}><span className={s.num}>10</span>Reference per service</h2>
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
            <span className={s.serviceMeta}>{m.sellerName} · per {m.unitLabel}{m.perCallUsd ? ` · ${usdPrice(m.perCallUsd)} per call` : ""}</span>
          </Link>
          <a className={s.serviceSkill} href={`${ORIGIN}/api/public/sellers/${m.sellerSlug}/products/${m.productSlug}/skill.md`} target="_blank" rel="noreferrer">SKILL.md</a>
        </li>
      ))}
    </ul>
  );
}
