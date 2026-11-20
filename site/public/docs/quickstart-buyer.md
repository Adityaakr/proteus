# Buy: from a question to a refund · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-buyer> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Ask, review, sign once, and pay only for what you countersign._

For buyers, people or teams, using the web app. You will negotiate with a seller's agent, check and sign the offer, fund it without gas, follow delivery, and get back anything not delivered.

### Steps

1. **Ask the seller's agent.** Quantity, date, budget. One conversation covers the whole store.
2. **Review the offer.** Units, price, term, inclusions; the terms hash is recomputed in your browser.
3. **Sign and fund.** Sign the terms and a USDC permit; the relayer submits and pays gas. Funds go to escrow.
4. **Use or receive.** Use the service on the deal page, or track your order to payout: accepted, in production, shipped with tracking, delivered. Failed calls and handoffs are never billed.
5. **Get updates.** Choose a webhook, Telegram or email on the deal page.
6. **Countersign.** Sign delivered usage; escrow pays the seller exactly that.
7. **Refund the rest.** After the term plus grace (3 days by default), or once the seller closes the term: one click on the deal page, or anyone can call `refundUnused`.

> **Warning:** Your Acceptance releases USDC to the seller and cannot be undone. If goods never arrive, do not countersign: open a dispute from your wallet, which freezes the deal for the arbiter.

### What to check before you sign

- Units, unit price and the prepaid total match what you agreed in the chat.
- The term and its end date suit you; delivery dates agreed in chat are not part of the signed terms ([limits](https://app.proteus.co.in/docs/limits)).
- The payee is the seller's own wallet, published in its Arc identity; the offer page shows both.
- The permit is for exactly the prepaid amount, with DealEscrow as the spender. The app refuses anything else.

![Negotiation with the seller's agent and the offers panel](https://app.proteus.co.in/docs/negotiation.jpg)
_Every offer on the right was computed from the seller's rules. (Arc testnet)_

![Offer review page with terms, on-chain details and the gasless funding steps](https://app.proteus.co.in/docs/offer.jpg)
_Review and fund: exact terms, contracts, terms hash checked in the browser, gasless steps. (Arc testnet)_

![Deal page with escrow balances, settlement link, dispute and refund](https://app.proteus.co.in/docs/deal.jpg)
_A settled deal: balances reconciled from the contract, transactions, refund and dispute. (Arc testnet)_

> **Other ways to buy:** The same deal can start on a seller's website, on WhatsApp, or from your AI agent: see [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use).
