# Limits and known gaps · Proteus AI docs

Source: <https://app.proteus.co.in/docs/limits> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What is not done yet. We would rather you read it here._

For anyone relying on Proteus. These are the gaps we know about today, stated plainly, so you can plan around them. Each one also appears in facts.json under `limits`.

- **No audit yet.** DealEscrow is source-verified and tested, not independently audited.
- **One arbiter key.** Disputes are resolved by a single Proteus-operated key, with no timeout yet.
- **Settle before end + grace.** Settlement reverts after the term plus grace; usage not countersigned by then can no longer be paid from escrow.
- **Refunds need a call.** `refundUnused` after the term plus grace or after the seller closes; one click on the deal page, or anyone.
- **Dates live in the chat.** Delivery dates are agreed in the conversation, not in the signed terms.
- **Delivery is seller-confirmed.** Proteus does not verify physical delivery; the buyer countersigns or disputes.
- **Pay per call has no escrow.** x402 calls are paid when made, with no refund path.
- **Listing check.** The import flow lists after Arc registration by step order; the listing endpoint itself does not check it (catalog sync does).
- **Figure check.** A model reply is discarded if it carries a dollar amount or a number of four or more digits that is not in the offers. Smaller bare numbers ("20%", "500 units") and numbers written in words are not caught; the price never comes from the reply.
- **Unregistered sellers are not checked on chain.** For a seller not registered on Arc, the MCP server has no identity or policy to check and signs without refusing.
- **Front desk details reach the model.** Contact redaction runs on the deal-desk chat only. A front desk customer's name and phone go to Claude and to the business's alerts, because the business needs them.
- **Pay per call is held by the signer.** With the x402 exact scheme, payments land in the seller's Proteus-held signer key until the seller sweeps them to its payee; Gateway batching pays the payee directly.
- **Buyer alerts are best effort.** Alerts to buyers are sent with two tries and no delivery log; the seller's webhooks use the outbox with retries.
- **No phone line yet.** The front desk answers chat and browser voice on a link or website embed, not phone calls.
- **Calendar booking is off.** Google Calendar booking is built but not switched on; bookings arrive as requests for the business to confirm.
- **Voice depends on the browser.** Speech uses the browser's engine: Chrome, Edge and Safari work; browsers that block it (Brave, Arc) fall back to typing.
- **Buyer alerts by webhook today.** Telegram and email alerts need their keys on the server; signed webhooks work now.
- **One rating predates the checks.** Shoonya's first rating (Nov 11) counts although its buyer wallet is linked to a Shoonya team account in Proteus; it is listed as counted_before_checks. Every rating since Nov 12 must pass the checks.
- **Ratings are cost-to-fake, not proof.** A seller that funds a second wallet from an exchange leaves no link on Arc and can still rate itself; one vote per buyer and the neutral prior limit the effect. Flags are not yet written on chain.
