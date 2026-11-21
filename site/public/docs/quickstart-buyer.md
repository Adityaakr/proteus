# Buy: pay into escrow, pay for what arrives · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-buyer> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Ask, review, sign once, and pay only for what you confirm._

For buyers, people or teams, using the web app. You will sign in, negotiate with a seller's agent, check and sign the offer, fund it without a network fee, follow delivery, and get back anything not delivered.

> **You need a wallet and USDC on Arc:** On [app.proteus.co.in](https://app.proteus.co.in) (Arc mainnet) you sign in with a browser wallet. On [ai.proteus.co.in](https://ai.proteus.co.in) (Arc testnet) you can sign in with your email, which creates a Circle wallet, and take test USDC from [Circle's faucet](https://faucet.circle.com). USDC on another chain can be bridged to Arc inside the app with CCTP, from a browser wallet that holds it there; Circle charges a small fee for that.

<a id="buyer-steps"></a>

### Steps

1. **Ask the seller's agent.** Quantity, date, budget. One conversation covers the whole store.
2. **Review the offer.** Units, price, term and inclusions. The page recomputes the hash of the public terms in your browser and shows the escrow and USDC contracts.
3. **Sign and fund.** Sign the terms (the seller's signer then countersigns) and a USDC permit; Proteus submits it and pays the network fee. You can turn gasless funding off and send the approve and fund transactions yourself. The money goes to escrow.
4. **Use or receive.** Use the service from the deal page, or follow your order: accepted, in production, shipped with tracking, delivered. Failed calls and handoffs are never billed.
5. **Get updates.** For goods and scheduling services, choose a webhook, Telegram or email on the deal page.
6. **Confirm what arrived.** Countersign the delivered units; escrow pays the seller exactly that. Your confirmation covers everything the seller has recorded so far.
7. **Refund the rest.** From `refundableAt` (the term's end plus grace, 3 days by default, or at once if the seller closes the term): one click on the deal page, or anyone can call `refundUnused`.

> **Warning: Confirm only what you received.** Your Acceptance releases USDC to the seller and cannot be undone, and it covers every delivery the seller has recorded so far. If goods never arrive or a recorded delivery is wrong, do not countersign: ask the seller, or open a dispute from your wallet, which freezes the order for the arbiter ([Disputes](https://app.proteus.co.in/docs/protection#protection-disputes)).

<a id="buyer-check"></a>

### What to check before you sign

- Units, unit price and the prepaid total match what you agreed in the chat.
- The term suits you. It runs from when the quote was made, and delivery dates agreed in chat are not part of the signed terms ([limits](https://app.proteus.co.in/docs/limits)).
- The seller's identity. A seller registered on Arc shows an Agent badge on its store, and its ERC-8004 record publishes its payout wallet and signer ([check them](https://app.proteus.co.in/docs/verify#verify-seller), or let your AI agent do it).
- The permit is for exactly the prepaid amount, with DealEscrow as the spender. The app refuses anything else.

![Negotiation with the seller's agent and the offers panel](https://app.proteus.co.in/docs/negotiation.jpg)
_Every offer on the right was computed from the seller's rules. (Arc testnet)_

![Offer review page with terms, on-chain details and the gasless funding steps](https://app.proteus.co.in/docs/offer.jpg)
_Review and fund: exact terms, contracts, the public terms hash checked in the browser, gasless steps. (Arc testnet)_

![Deal page with escrow balances, settlement link, dispute and refund](https://app.proteus.co.in/docs/deal.jpg)
_A settled deal: balances reconciled from the contract, transactions, refund and dispute. (Arc testnet)_

> **Other ways to buy:** The same order can start on a seller's website, on WhatsApp, or from your AI agent: see [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use).
