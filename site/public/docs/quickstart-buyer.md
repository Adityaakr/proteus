# Buy: from a question to a refund · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-buyer> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Ask, review, sign once, pay only for what you countersign._

1. **Ask the seller's agent.** Quantity, date, budget. One conversation covers the whole store.
2. **Review the offer.** Units, price, term, inclusions; the terms hash is recomputed in your browser.
3. **Sign and fund.** Sign the terms and a USDC permit; the relayer submits and pays gas. Funds go to escrow.
4. **Use or receive.** Failed calls and handoffs are never billed.
5. **Countersign.** Sign delivered usage; escrow pays the seller exactly that.
6. **Refund the rest.** After the term plus grace, or once the seller closes: one click, or anyone calls `refundUnused`.

![Negotiation with the seller's agent and the offers panel](https://app.proteus.co.in/docs/negotiation.jpg)
_Every offer on the right was computed from the seller's rules. (Arc testnet)_

![Offer review page with terms, on-chain details and the gasless funding steps](https://app.proteus.co.in/docs/offer.jpg)
_Review and fund: exact terms, contracts, terms hash checked in the browser, gasless steps. (Arc testnet)_

![Deal page with escrow balances, settlement link, dispute and refund](https://app.proteus.co.in/docs/deal.jpg)
_A settled deal: balances read from the contract, transactions, refund and dispute. (Arc testnet)_
