# How payment protection works · Proteus AI docs

Source: <https://app.proteus.co.in/docs/protection> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Escrow, delivery, refunds and disputes, in plain words, for both sides of an order._

For sellers and buyers deciding whether to trust an order with someone they have not worked with before. You will learn where the money is at each step, what releases it, what happens when something goes wrong, and what Proteus itself can and cannot do.

> **Nobody goes first on trust:** The buyer pays before the seller starts, but the money waits in a public contract, DealEscrow on Arc. It moves to the seller only when the buyer confirms delivery, and back to the buyer only when refunds open after the term.

<a id="protection-steps"></a>

### Where the money is

| Moment | Where the USDC is | What moves it |
|---|---|---|
| Agreed | The buyer's wallet | Nothing yet. Both sides sign the same terms: units, unit price, term, payee. |
| Paid upfront | DealEscrow on Arc, held for this order | Only the buyer's confirmation, a refund after the term, or a dispute decision. |
| Delivered | Still in escrow | The seller records each delivery with proof. Recording alone moves no money. |
| Confirmed | Escrow → the seller's wallet | The buyer countersigns everything recorded so far, and the contract pays exactly that. |
| After the term | Escrow → the buyer | Whatever was not paid out is refundable after the term plus a grace period (3 days by default), or at once if the seller closes the term early. |

_Every step is a transaction on Arc you can open on the explorer. The detail, for developers: [The money path](https://app.proteus.co.in/docs/money-path)._

<a id="protection-sellers"></a>

### What it means for sellers

- **You never start unpaid.** The whole order is in escrow before you start. The deal page shows the balance, reconciled from the contract, and links the funding transaction on Arc.
- **Get confirmed batch by batch.** Record each batch as it ships and ask the buyer to countersign. Each confirmation pays you for everything recorded so far. Recording a delivery does not alert the buyer, so post an update too ([Orders, delivery and payouts](https://app.proteus.co.in/docs/orders)).
- **Confirm before the deadline.** Payment is possible until the term ends plus the grace period. After that, anything the buyer has not confirmed can only go back to the buyer.
- **If a buyer never confirms.** You are not paid, and today you cannot open a dispute yourself: only the buyer can. Keep delivery records with proof and order updates with tracking, and remind the buyer before the deadline.
- **Your payout wallet.** Payouts go to the wallet that owned your account when you published your first product. No setting changes it, and on each order it is fixed in the terms both sides sign.

<a id="protection-buyers"></a>

### What it means for buyers

- **Pay into escrow, not to a stranger.** Your USDC goes into DealEscrow on Arc, never to the seller or to a Proteus account. With a permit, Proteus pays the network fee.
- **Confirm only what arrived.** Your countersignature pays the seller and cannot be undone. It covers everything the seller has recorded so far; you cannot confirm part of it. If something is wrong, do not countersign: ask the seller, or open a dispute.
- **Get back what was not delivered.** From `refundableAt` (the term's end plus grace, or at once after the seller closes the term), one click on the deal page returns the rest to your wallet.

<a id="protection-disputes"></a>

### Disputes

1. **The buyer opens it.** From the deal page, with a transaction from the buyer's own wallet, which pays a small network fee. Possible while the money is in escrow and before anyone has claimed the refund.
2. **The order freezes.** No payout and no refund until the dispute is decided.
3. **The arbiter splits what is left.** It sends the money still in escrow to the seller, the buyer, or both. It cannot touch what was already paid out. A partial split puts the order back in progress.

> **Warning: Disputes are In testing.** Today Proteus holds the arbiter key, there is no deadline for a decision, and sellers cannot open a dispute through Proteus. An independent arbiter and a dispute timeout are Planned. See [Limits and known gaps](https://app.proteus.co.in/docs/limits#limits-escrow-and-disputes).

<a id="protection-proteus"></a>

### What Proteus can and cannot do

- **Cannot take the money.** DealEscrow pays only an order's payee and its buyer. There is no owner withdrawal, and the contract cannot be upgraded ([DealEscrow.sol](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol)).
- **Cannot pay the seller without the buyer.** Every payout needs the buyer's signed confirmation and the seller signer's delivery record over the same units.
- **Can end a term early.** Through the seller's signer key, which makes the unspent balance refundable to the buyer at once.
- **Can freeze and split an order.** Proteus holds the seller's signer key and the arbiter key, so on chain it could open a dispute on any funded order and split what is left between the seller and the buyer. No Proteus route opens one for a seller today.

<a id="protection-erc8183"></a>

### ERC-8183 (Planned)

[ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) is a draft Ethereum standard for paid jobs between agents: a client funds a job, a provider submits the work, and an evaluator completes it, which pays the provider, or rejects it, which refunds the client. A Proteus order already has that shape, with the buyer's signed confirmation as the evaluator. DealEscrow does not implement the ERC-8183 interface today. Supporting it, so that agents built for the standard can order from Proteus sellers without a custom integration, is Planned.

| ERC-8183 | A Proteus order today |
|---|---|
| Client, provider, evaluator | The buyer or its AI agent, the seller, and the buyer's signed confirmation |
| Fund | The buyer pays the order into DealEscrow |
| Submit | The seller records each delivery with a signed receipt |
| Complete | The buyer countersigns; DealEscrow pays the seller |
| Reject or expire | Refundable to the buyer after the term plus grace |

_What Proteus adds that the standard leaves open: a price negotiated inside the seller's rules, payment per delivered unit, a dispute path, and reviews only from paid orders ([Ratings](https://app.proteus.co.in/docs/ratings))._
