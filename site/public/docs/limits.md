# Limits and known gaps · Proteus AI docs

Source: <https://app.proteus.co.in/docs/limits> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_What is not done yet. We would rather you read it here._

For anyone relying on Proteus. These are the gaps we know about today, stated plainly, so you can plan around them. Each one also appears in facts.json under `limits`.

<a id="limits-escrow-and-disputes"></a>

### Escrow and disputes

- **No audit yet.** DealEscrow is source-verified and tested, not independently audited.
- **Proteus can open and decide a dispute.** The seller signer is the deal's seller on chain and Proteus holds it, so it can open a dispute; the arbiter key, also Proteus's, then splits the unspent balance. Settled funds are out of reach. There is one arbiter key and no dispute timeout yet.
- **Settle before end + grace.** Settlement reverts after the term plus grace; usage not countersigned by then can no longer be paid from escrow.
- **Refunds need a call.** `refundUnused` after the term plus grace or after the seller closes; one click on the deal page, or anyone.
- **Dates live in the chat.** Delivery dates are agreed in the conversation, not in the signed terms.
- **Delivery is seller-confirmed.** Proteus does not verify physical delivery; the buyer countersigns or disputes.
- **Pay per call is outside escrow.** x402 calls are paid when made, with no refund path. With the exact scheme the payment lands in the seller's Proteus-held signer key until the seller sweeps it to its payee; Gateway batching pays the payee directly.

<a id="limits-pricing-and-ai"></a>

### Pricing and AI

- **Figure check.** A model reply is discarded if it carries a dollar amount or a number of four or more digits that is not in the offers. Smaller bare numbers ("20%", "500 units") and numbers written in words are not caught; the price never comes from the reply.
- **Counter limit is per window.** Counteroffers are limited to 12 per negotiation and 40 per IP in each 10-minute window, not in total; one public reason for all price rules is what slows a search for the floor.
- **Front desk details reach the model.** Contact redaction runs on the deal-desk chat only. A front desk customer's name and phone go to Claude and to the business's alerts, because the business needs them.
- **Listing check.** The import flow lists after Arc registration by step order; the listing endpoint itself does not check it (catalog sync does).

<a id="limits-agents-and-apis"></a>

### Agents and APIs

- **Unregistered sellers are not checked on chain.** For a seller not registered on Arc, the MCP server has no identity or policy to check and signs without refusing.
- **Rate limits are per server.** Limits are counted in memory on each server instance and reset when it restarts.
- **No pagination yet.** The seller API returns the newest 200 deals and 300 usage records; the inbox API the newest 200 requests.

<a id="limits-channels"></a>

### Channels

- **Buyer alerts are best effort.** Alerts to buyers go out at once with two tries and no delivery log. Signed webhooks work today; Telegram and email need their keys on the server. Sellers' deal webhooks use an outbox with retries.
- **No phone line yet.** The front desk answers chat and browser voice on a link or website embed, not phone calls.
- **Calendar booking is off.** Google Calendar booking is built but not switched on; bookings arrive as requests for the business to confirm.
- **Voice depends on the browser.** Speech uses the browser's engine: Chrome, Edge and Safari work; browsers that block it (Brave, Arc) fall back to typing.
- **WhatsApp is in testing.** The channel is deployed and a number is connected, but no real customer conversation has happened yet.

<a id="limits-ratings"></a>

### Ratings

- **One rating predates the checks.** Shoonya's first rating (Nov 11) counts although its buyer wallet is linked to a Shoonya team account in Proteus; it is listed as counted_before_checks. Every rating since Nov 12 must pass the checks.
- **Ratings are cost-to-fake, not proof.** A seller that funds a second wallet from an exchange leaves no link on Arc and can still rate itself; one vote per buyer and the neutral prior limit the effect. Flags are not yet written on chain.
