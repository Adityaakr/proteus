# Usage-based pricing for APIs and AI services: prepaid, metered and refundable

> How to sell an API or AI service by usage without chasing invoices: a prepaid balance in escrow, every call metered with a signed receipt, and unused credit refundable.

Aditya, founder of Proteus AI · published 2026-11-09 · 4 min read · https://app.proteus.co.in/blog/usage-based-pricing-for-apis

## Key takeaways

- Usage pricing is fair to buyers and painful to collect. A prepaid balance held in escrow flips that: the money exists before the first call, and unused credit can go back.
- On Proteus AI every delivered call returns a signed receipt. Failed calls and calls handed to a person are never billed, and retrying the same request id never charges twice.
- The buyer countersigns usage against the receipts, and the escrow pays the seller for exactly that.
- For one-off calls with no deal, x402 lets a client pay per request in USDC. That works on Arc testnet today, with no refund path.

## Why I did not want to build another billing dashboard

Usage-based pricing is the fairest way to sell an API: pay for what you use. It is also miserable to collect. You meter the calls, send an invoice at the end of the month, and wait. Prepaid credits fix the waiting, but buyers hate prepaying a vendor they met last week, because unused credit is usually just gone.

When we put services on Proteus AI, I wanted a third option that is fair to both sides. The money is committed before the first call, so the seller is safe. Whatever is not used comes back, so the buyer is safe. And every call that gets billed has a receipt the buyer can check.

That is what a prepaid balance in escrow gives you.

## Four ways to sell by usage, compared

| | Monthly invoice | Prepaid credits | Prepaid in escrow (Proteus AI) | x402 pay per call |
|---|---|---|---|---|
| Money committed before use | No | Yes | Yes | Yes, per call |
| Unused balance returned | Not applicable | Rarely | Yes, after the term | Not applicable |
| Proof of each call | Your logs | Your logs | A signed receipt per call | The payment itself |
| Buyer checks before paying | After the invoice | No | Yes, countersigns usage | Per call |
| Needs a negotiated deal | Usually | No | Yes | No |

## How metered escrow works

1. **Agree the plan.** The buyer, or the buyer's agent, negotiates a volume tier with the seller's deal desk, for example a block of calls at a per-call price, prepaid for 30 days.
2. **Fund it.** Both sides sign the terms and the buyer's USDC moves into DealEscrow on Arc. The buyer gets a service key.
3. **Call the service.** Each call goes to `POST /api/services/{product}/execute` with that key and a `requestId`. Send the same `requestId` again and you are not charged twice.
4. **Get a receipt.** The seller's signer signs a receipt for every delivered result. Calls that fail, or that get handed to a person, are recorded but never billed.
5. **Countersign.** `GET /api/deals/{id}/usage` returns the receipts and the acceptance to sign. The buyer, or its agent, checks the count and the price, then signs.
6. **Get paid.** DealEscrow pays the seller for everything newly accepted since the last settlement.
7. **Get the rest back.** After the term plus a grace period (3 days by default), whatever was not used is refundable to the buyer.

![The seller's usage and delivery page](https://app.proteus.co.in/docs/seller-usage.jpg "Kitbox's usage page on Arc testnet: one request delivered and billed, with the signed receipt behind it. Failed and handed-off calls show as never billed.")

That screenshot is from the sample Claude bought in our agent test: one request, one delivered result, one signed receipt, $12.50 charged. Small, but every number on it can be checked against the escrow.

## Pay per call with x402

Some buyers do not want a plan. They want one answer, now. For them we support x402: the client calls `POST /api/pay/{seller}/{product}/execute`, gets an HTTP 402 back with the payment options, pays in USDC, and gets the result.

- **Exact payments** go through Circle's facilitator, one per call.
- **Circle Gateway batching** turns each call into a signature instead of a transfer, and settles them in batches.

Both have run on Arc testnet. One difference matters: x402 is paid when the call is made, outside escrow, so there is no refund. For anything more than a handful of calls, a prepaid deal is the better deal for the buyer, and I will tell them that.

## Who this is for

- **AI and API companies** selling inference, embeddings, data or tools by volume.
- **Back-office services** priced per document, per invoice or per handled request.
- **Agents buying from agents,** where nobody reads invoices but anyone can check a receipt.

## Get started

- [Sell on Proteus AI](https://app.proteus.co.in/docs/quickstart-seller) and point a product at your endpoint.
- [For AI agents](https://app.proteus.co.in/docs/for-agents): every route above, with request and response shapes.
- [How the money moves](https://app.proteus.co.in/docs/money-path), including grace periods and refunds.

## Frequently asked questions

### What is usage-based pricing for an API?

Charging buyers for what they actually use, such as calls, documents or tokens, instead of a flat subscription.

### How do you get paid for API usage without invoices?

Have the buyer prepay into escrow. On Proteus AI each delivered call gets a signed receipt, the buyer countersigns usage, and the escrow pays the seller for exactly that.

### What happens to unused prepaid credit?

On Proteus AI the unspent balance is refundable to the buyer after the term plus a grace period, three days by default, or as soon as the seller closes early.

### Are failed API calls billed?

No. Only delivered results are billable. Failed or handed-off requests are recorded without a charge, and retrying the same requestId never bills twice.

### What is x402?

x402 is a protocol where a server answers HTTP 402 with payment options and the client pays per request in USDC. On Proteus AI it works through Circle's facilitator or Circle Gateway batching, proven on Arc testnet.
