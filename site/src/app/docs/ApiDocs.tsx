import { ReviewShell } from "../layouts/ReviewShell";
import s from "./docs.module.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://proteus.example";

/** The API reference a funded deal links to: how a buyer calls the service, what is billed, how usage settles, and the seller endpoint contract. */
export default function ApiDocs() {
  return (
    <ReviewShell>
      <article className={s.doc}>
        <header className={s.head}>
          <span className={s.label}>API reference</span>
          <h1 className={s.title}>Using a PROTEUS deal</h1>
          <p className={s.lede}>A funded deal gives you an API key and an endpoint. Every call you make is metered against the prepaid balance held in escrow. The seller is paid only for delivered units you countersign, and whatever is left comes back to you after the term.</p>
          <nav className={s.toc} aria-label="Sections">
            <a href="#service">Call the service</a>
            <a href="#responses">What you get back</a>
            <a href="#billing">What is billed</a>
            <a href="#settle">Settling usage</a>
            <a href="#paypercall">Pay per call</a>
            <a href="#seller">For sellers: your endpoint</a>
          </nav>
        </header>

        <section id="service" className={s.section}>
          <h2 className={s.h2}>Call the service</h2>
          <p>Each deal has one endpoint, shown on the deal page under Credentials, and one API key, shown once when the service is provisioned. Send a POST with the key as a bearer token. The request id is yours to choose; use a UUID or your own order id.</p>
          <pre className={s.code}>{`curl -X POST ${ORIGIN}/api/services/callback-booking/execute \\
  -H "Authorization: Bearer pk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "requestId": "order-10421",
    "input": { "question": "Book a callback for Jane Doe tomorrow at 10am", "orderId": "10421" }
  }'`}</pre>
          <p>The shape of <code>input</code> is up to the seller. The seller's product page describes what one billable unit is; that description is the contract for what a request must contain.</p>
          <p>From your own code the same call looks like this:</p>
          <pre className={s.code}>{`const res = await fetch("${ORIGIN}/api/services/callback-booking/execute", {
  method: "POST",
  headers: { Authorization: \`Bearer \${PROTEUS_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ requestId: crypto.randomUUID(), input: { question, orderId } }),
});
const r = await res.json();`}</pre>
        </section>

        <section id="responses" className={s.section}>
          <h2 className={s.h2}>What you get back</h2>
          <pre className={s.code}>{`{
  "requestId": "order-10421",
  "status": "delivered",            // delivered | handoff | failed
  "billable": true,
  "units": 1,
  "answer": "Lumen Voice booked a callback for 10421 (ticket LV-0002).",
  "source": { "store": "api.lumenvoice.example", "fields": ["answer", "status"] },
  "receipt": { "digest": "0x…", "sellerSignature": "0x…" },
  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "200000", "prepaid": "1000000" }
}`}</pre>
          <ul className={s.list}>
            <li><b>delivered</b>: the seller's service did the work. One unit is metered.</li>
            <li><b>handoff</b>: the service passed the request to a human. Nothing is billed.</li>
            <li><b>failed</b>: the service could not do it, timed out or returned an error. Nothing is billed.</li>
          </ul>
          <p>Every delivered response carries a receipt digest signed by the seller. Amounts are in micro-USDC strings: 200000 is $0.20.</p>
        </section>

        <section id="billing" className={s.section}>
          <h2 className={s.h2}>What is billed</h2>
          <ul className={s.list}>
            <li>Only <b>delivered</b> responses count, one unit each, at the unit price in your terms.</li>
            <li>A request that repeats a <b>request id</b> you already sent returns the stored receipt and is never charged twice. Retry freely.</li>
            <li>Once the deal's included units are used up, further requests return failed and are not billed. Ask the seller's agent for a larger package.</li>
            <li>The running total is on the deal page under Usage and in every response under <code>deal.cumulativeCharged</code>.</li>
          </ul>
        </section>

        <section id="settle" className={s.section}>
          <h2 className={s.h2}>Settling usage</h2>
          <p>Metering alone moves no money. When you are ready, the deal page offers "Sign usage to settle": you sign the cumulative units and amount with your wallet, no gas, and the escrow pays the seller exactly that amount minus what was already settled. You can settle as often as you like. After the term plus the grace window, or earlier if the seller closes the term, "Request refund" returns the unused balance to your wallet.</p>
          <p>Nothing in this flow is a promise. The escrow contract checks both signatures before it releases a cent, and every settlement has a transaction hash you can open on the explorer.</p>
        </section>

        <section id="paypercall" className={s.section}>
          <h2 className={s.h2}>Pay per call</h2>
          <p>If you have no deal, a product with a per-call price accepts single requests paid with USDC through x402. The first call answers 402 with the price and payment requirements; you sign one USDC authorization for exactly that amount and resend. Failed answers are not charged. The product page runs this for you.</p>
          <pre className={s.code}>{`POST ${ORIGIN}/api/pay/lumen-voice/callback-booking/execute
{ "requestId": "…", "input": { … }, "payer": "0x…", "payment": { …signed authorization… } }`}</pre>
        </section>

        <section id="seller" className={s.section}>
          <h2 className={s.h2}>For sellers: your endpoint</h2>
          <p>Your product runs on your own HTTPS endpoint. For every metered request PROTEUS sends:</p>
          <pre className={s.code}>{`POST https://api.yourcompany.com/proteus
Authorization: Bearer <your secret>      (or the header name you set)
X-Proteus-Request-Id: order-10421

{ "requestId": "order-10421", "dealId": "deal_…", "orgId": "org_…", "productSlug": "callback-booking",
  "input": { "question": "…", "orderId": "10421" } }`}</pre>
          <p>Answer with JSON. A 2xx whose <code>billable</code> is not false is one delivered unit; mark handoffs and failures so they are never charged:</p>
          <pre className={s.code}>{`{ "answer": "Booked for 10421 (ticket LV-0002).", "billable": true, "status": "delivered" }
{ "answer": "A human will call back about the cancellation.", "billable": false, "status": "handoff" }`}</pre>
          <p>Non-2xx responses, non-JSON bodies and anything slower than 20 seconds are recorded as failed and not billed. Treat <code>requestId</code> as idempotent on your side too.</p>
        </section>
      </article>
    </ReviewShell>
  );
}
