# Orders, delivery and payouts · Proteus AI docs

Source: <https://app.proteus.co.in/docs/orders> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_What happens after the buyer pays: updates, delivery records, the buyer's confirmation and your payout._

For sellers of goods and custom work, and for their buyers. You will learn how to keep a buyer posted, how to record a delivery, how a confirmation becomes a payout, the deadlines that apply, and what to do when an order goes wrong.

<a id="orders-after"></a>

### After the buyer pays

1. **The order appears in Deals.** Sell → Deals lists each funded order with its escrow balance, as last reconciled from the contract.
2. **Keep the buyer posted.** From the deal page, post Accepted, In production, Shipped (with a tracking link), Out for delivery, Delayed (with a reason) or a message. The buyer sees each one on its order page and gets an alert if it chose one. Every post is a new update and a new alert.
3. **Record each delivery.** Under "Record a delivery", enter how many units were delivered, what was delivered (3 to 2,000 characters) and, if you have one, an https proof link. Proteus signs a receipt for it with your signer key. A recorded delivery cannot be edited or withdrawn.
4. **Ask the buyer to confirm.** Recording a delivery sends the buyer no alert, so post an update or a message. The buyer countersigns everything recorded so far, in one signature.
5. **Get paid.** DealEscrow pays your wallet the confirmed amount, minus what it already paid you on this order. Payments shows funded, settled, refunded and held totals, and exports CSVs of deals, receipts and a journal in the column shape QuickBooks Online and Xero import.

![Seller usage and delivery page with a signed, delivered receipt](https://app.proteus.co.in/docs/seller-usage.jpg)
_Usage and delivery: each delivered unit with its outcome and signed receipt. (Arc testnet)_

<a id="orders-batches"></a>

### Batches and short deliveries

Record what actually went out, batch by batch. If 200 tees were ordered and 180 shipped, record 180: the buyer can confirm those and you are paid for 180. A buyer confirms all recorded units at once and cannot confirm part of a recorded batch, so record only what you stand behind. The 20 that were never delivered stay in escrow and become refundable to the buyer after the term.

<a id="orders-deadlines"></a>

### Deadlines

| Deadline | Rule |
|---|---|
| Quote | An offer must be signed and funded within the quote validity you set. An order waiting for your approval uses the same window. |
| Term | Runs for the product's term in days, counted from when the quote was made, not from funding. |
| Payment | Possible until the term ends plus the grace period (3 days by default). After that, deliveries the buyer has not confirmed can only be refunded to the buyer. |
| Refund | Opens at the end of the term plus grace, or at once if you close the term early. |

<a id="orders-wrong"></a>

### When an order goes wrong

- **The buyer does not confirm.** You are not paid until it does, and today only the buyer can open a dispute through Proteus. Keep delivery records and order updates complete, and remind the buyer well before the deadline.
- **You cannot deliver.** Close the term early from the deal page. The unspent balance becomes refundable to the buyer at once, and the buyer can take it back in one click.
- **The buyer disputes.** The order freezes. The arbiter, today Proteus, splits what is left in escrow between you and the buyer; what was already paid to you stays yours ([Disputes](https://app.proteus.co.in/docs/protection#protection-disputes)).

<a id="orders-tracking"></a>

### What the buyer sees

For goods and work the seller delivers, the buyer's deal page is an order tracker ([orders.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/orders.ts)). Notes and tracking links in order updates are encrypted and visible only to the buyer and the seller. Agents read the same history at `GET /api/deals/{id}/timeline`, with the buyer's session or the deal's service key.

| Step | Comes from |
|---|---|
| Paid | The funding transaction on Arc |
| Accepted, In production, Shipped (tracking link), Out for delivery, Delayed (with a reason), Message | The seller's updates |
| Delivered | The seller's signed delivery record |
| Seller paid | The settlement transaction on Arc, after the buyer countersigns (shown once it is submitted) |

> **Warning: Keep private details out of delivery notes.** Delivery notes and proof links are part of the deal's usage record, which anyone holding the deal's id can read (`GET /api/deals/{id}/usage`). Put addresses and contact details in encrypted order updates, or in the chat, instead.

<a id="orders-api"></a>

### From your own systems

Record deliveries and post order updates with the [seller API](https://app.proteus.co.in/docs/seller-api-reference): `POST /deals/:id/deliveries` and `POST /deals/:id/order-updates`, with a key that has the `deliveries:write` permission. Deal events such as funded, settled and refunded reach your server as signed [webhooks](https://app.proteus.co.in/docs/seller-webhooks).
