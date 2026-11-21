# Limits and known gaps · Proteus AI docs

Source: <https://app.proteus.co.in/docs/limits> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_What is not done yet. We would rather you read it here._

For anyone relying on Proteus. These are the gaps we know about today, stated plainly, so you can plan around them. Each one also appears in facts.json under `limits`.

<a id="limits-escrow-and-disputes"></a>

### Escrow and disputes

- **No audit yet.** DealEscrow is source-verified and tested, not independently audited.
- **Sellers cannot open a dispute.** Only the buyer can open a dispute through Proteus. If a buyer never countersigns, the seller is not paid, and after the term plus grace the unspent balance, undelivered and unconfirmed units alike, is refundable to the buyer.
- **Proteus decides disputes.** The arbiter key is Proteus's, and so is the seller signer, the deal's seller address on chain: Proteus could open a dispute on any funded deal and split its unspent balance between the seller's payee and the buyer. Settled funds are out of reach. There is one arbiter key and no dispute timeout yet; an independent arbiter and a timeout are Planned.
- **Buyers confirm all or nothing.** Proteus prepares each Acceptance over everything the seller has recorded as delivered, so a buyer cannot countersign part of it. If a recorded delivery is wrong, the buyer does not countersign and talks to the seller, or opens a dispute.
- **Settle before end + grace.** Settlement reverts after the term plus grace; usage not countersigned by then can no longer be paid from escrow, unless a dispute is opened before anyone claims the refund.
- **The term starts at the quote.** A deal's term runs from when the quote was created, not from funding; waiting for the seller's approval or a slow funding uses it up.
- **Refunds need a call.** `refundUnused` after the term plus grace or after the seller closes; one click on the deal page, or anyone.
- **Dates live in the chat.** Delivery dates are agreed in the conversation, not in the signed terms.
- **Delivery is seller-confirmed.** Proteus does not verify physical delivery; the seller records it, the buyer countersigns or disputes. Recording a delivery sends the buyer no alert; order updates do.
- **Revoking the seller signer.** Revoking it stops Proteus using it for anything, deliveries included. Deals it already signed name it as their seller on chain, so they can then no longer settle through Proteus.
- **Pay per call is outside escrow.** x402 calls are paid when made, with no refund path. With the exact scheme the payment lands in the seller's Proteus-held signer key until the seller sweeps it to its payee; Gateway batching pays the payee's Gateway balance directly.

<a id="limits-selling"></a>

### Selling

- **Goods listings are prepared.** The New product form asks for a service endpoint. Listings for goods and custom orders are prepared with the Proteus team and published from the seller's own wallet.
- **Capacity is a per-offer cap.** Capacity limits the units in one offer and is not counted down as orders come in; the seller updates it, by hand or through catalog sync.
- **Cost models go stale.** A product's cost model expires 30 days after its last edit, and then blocks every offer on it until the seller refreshes it.

<a id="limits-pricing-and-ai"></a>

### Pricing and AI

- **Figure check.** A model reply is discarded if it carries a dollar amount or a number of four or more digits that is not among the offers, the buyer's budget or the seller's other products. Smaller bare numbers ("20%", "500 units") and numbers written in words are not caught; the price never comes from the reply.
- **Counter limit is per window.** Counteroffers are limited to 12 per negotiation and 40 per IP in each 10-minute window, not in total; one public reason for all price rules is what slows a search for the floor.
- **Front desk details reach the model.** Contact redaction runs on the deal-desk chat only. A front desk customer's name and phone go to Claude and to the business's alerts, because the business needs them.
- **Listing check.** The import flow lists after Arc registration by step order; the listing endpoint itself does not check it (catalog sync does).

<a id="limits-privacy"></a>

### Privacy

- **Some records are not encrypted.** Chats, order-update notes and the sealed pricing basis are encrypted per seller. Service results, delivery notes and proof links, and each offer's internal economics (cost, margin) are stored unencrypted, and anyone with a deal id can read its service results and delivery notes.

<a id="limits-agents-and-apis"></a>

### Agents and APIs

- **Unregistered sellers are not checked on chain.** For a seller not registered on Arc, the MCP server has no identity or policy to check and signs without refusing.
- **Receipts are not verified for you.** Neither the web app nor the MCP server checks the seller's receipt signatures before a buyer countersigns; they check the totals. The MCP server also signs the typed data the API returns without comparing it field by field with the terms it checked.
- **Rate limits are per server.** Limits are counted in memory on each server instance and reset when it restarts.
- **No pagination yet.** The seller API returns the newest 200 deals and 300 usage records; the inbox API the newest 200 requests.

<a id="limits-channels"></a>

### Channels

- **Buyer alerts are best effort.** Alerts to buyers go out at once with two tries and no delivery log. Signed webhooks work today; Telegram and email need their keys on the server. Sellers' deal webhooks use an outbox with retries.
- **No phone line yet.** The front desk answers chat and browser voice on a link or website embed, not phone calls.
- **Calendar booking is off.** Google Calendar booking is built but not switched on; bookings arrive as requests for the business to confirm.
- **Voice depends on the browser.** Speech uses the browser's engine: Chrome, Edge and Safari work; browsers that block it (Brave, Arc) fall back to typing.
- **WhatsApp is in testing.** The channel is deployed and a number is connected, but no real customer conversation has happened yet.
- **Email sign-in is testnet only.** On Arc mainnet, sellers and buyers sign in with a browser wallet. Email sign-in with a Circle wallet runs on Arc testnet and waits for Circle production access on mainnet.

<a id="limits-ratings"></a>

### Ratings

- **One rating predates the checks.** Shoonya's first rating (Nov 11) counts although its buyer wallet is linked to a Shoonya team account in Proteus; it is listed as counted_before_checks. Every rating since Nov 12 must pass the checks.
- **Ratings are cost-to-fake, not proof.** A seller that funds a second wallet from an exchange leaves no link on Arc and can still rate itself; one vote per buyer and the neutral prior limit the effect. Proteus asks the buyer to include the deal's terms hash but does not check it, and flags are not yet written on chain.
