# Limits and known gaps · Proteus AI docs

Source: <https://app.proteus.co.in/docs/limits> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What is not done yet. We would rather you read it here._

- **No audit yet.** DealEscrow is source-verified and tested, not independently audited.
- **One arbiter key.** Disputes are resolved by a single Proteus-operated key, with no timeout yet.
- **Refunds need a call.** `refundUnused` after the term plus grace or after the seller closes; one click on the deal page, or anyone.
- **Dates live in the chat.** Delivery dates are agreed in the conversation, not in the signed terms.
- **Delivery is seller-confirmed.** Proteus does not verify physical delivery; the buyer countersigns or disputes.
- **Pay per call has no escrow.** x402 calls are paid when made, with no refund path.
- **Listing check.** The import flow lists after Arc registration by step order; the listing endpoint itself does not check it (catalog sync does).
- **Figure check.** Replies with unlisted digits are discarded; numbers written in words are not caught.
- **No phone line yet.** The front desk answers chat and browser voice on a link or website embed, not phone calls.
- **Calendar booking is off.** Google Calendar booking is built but not switched on; bookings arrive as requests for the business to confirm.
- **Voice depends on the browser.** Speech uses the browser's engine: Chrome, Edge and Safari work; browsers that block it (Brave, Arc) fall back to typing.
- **Buyer alerts by webhook today.** Telegram and email alerts need their keys on the server; signed webhooks work now.
- **One rating predates the checks.** Shoonya's first rating (Nov 11) counts although its buyer wallet is linked to a Shoonya team account in Proteus; it is listed as counted_before_checks. Every rating since Nov 12 must pass the checks.
- **Ratings are cost-to-fake, not proof.** A seller that funds a second wallet from an exchange leaves no link on Arc and can still rate itself; one vote per buyer and the neutral prior limit the effect. Flags are not yet written on chain.
