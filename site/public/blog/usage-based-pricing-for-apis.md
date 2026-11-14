# Usage-based pricing for APIs and AI services: prepaid, metered and refundable

> How to sell an API or AI service by usage without chasing invoices: a prepaid balance in escrow, every call metered with a signed receipt, and unused credit refundable.

Proteus AI team · published 2026-11-09 · 3 min read · https://app.proteus.co.in/blog/usage-based-pricing-for-apis

## Key takeaways

- Usage-based pricing usually means billing after the fact and chasing the invoice. A prepaid balance in escrow flips that: the money is committed before the first call.
- On Proteus AI every delivered call returns a signed receipt; failed or handed-off requests are not billed.
- The buyer countersigns usage against the receipts, the escrow pays the seller for exactly that, and unused credit is refundable after the term.
- For one-off calls with no deal, x402 lets a client pay per request in USDC, proven on Arc testnet.

## Why usage pricing is hard to collect

Usage-based pricing is fair to buyers: pay for what you use. It is hard on sellers. You meter the calls, send an invoice at the end of the month, and hope it gets paid. Prepaid credits fix the collection problem but create a new one: buyers hesitate to prepay a vendor they just met, because unused credit is usually gone.

A prepaid balance held in escrow gives both sides what they want. The seller knows the money exists before serving the first call. The buyer knows anything not used comes back.

## Three ways to sell by usage

| | Monthly invoice | Prepaid credits | Prepaid in escrow (Proteus AI) | x402 pay per call |
|---|---|---|---|---|
| Money committed before use | No | Yes | Yes | Yes, per call |
| Unused balance returned | Not applicable | Rarely | Yes, after the term | Not applicable |
| Proof of each call | Your logs | Your logs | Signed receipt per call | The payment itself |
| Buyer checks before paying | After the invoice | No | Yes, countersigns usage | Per call |
| Needs a negotiated deal | Usually | No | Yes | No |

## How metered escrow works

1. **Negotiate the plan.** The buyer, or the buyer's AI agent, negotiates a volume tier with the seller's deal desk: for example 50,000 calls at a per-call price, prepaid for 30 days.
2. **Fund it.** Both sides sign the terms and the buyer's USDC moves into DealEscrow on Arc. The buyer receives a service key.
3. **Call the service.** Each call goes to `POST /api/services/{product}/execute` with that key and a `requestId`. Retrying the same `requestId` never bills twice.
4. **Every delivered result comes with a receipt.** The seller's signer signs a receipt for each billable unit. Requests that fail, or that are handed off to a person, are recorded but not billed.
5. **The buyer countersigns usage.** `GET /api/deals/{id}/usage` returns the receipts and the acceptance to sign. The buyer (or its agent) checks the count and the unit price, then signs.
6. **The escrow pays the difference.** DealEscrow pays the seller for the newly accepted usage since the last settlement.
7. **Unused credit comes back.** After the term plus a grace period (3 days by default), the remaining balance is refundable to the buyer.

![The seller's usage and delivery page](https://app.proteus.co.in/docs/seller-usage.jpg "Every request with its outcome, the units billed, and the signed receipt behind each one.")

## Pay per call with x402

Some buyers do not want a plan. They want one answer, now. For them, Proteus AI supports x402: the client calls `POST /api/pay/{seller}/{product}/execute`, gets a 402 response listing payment options, pays in USDC, and receives the result.

- **Exact payments** settle each call through Circle's facilitator.
- **Circle Gateway batching** lets each call be a signature rather than a transfer, with settlement in batches.

Both are proven on Arc testnet. One honest difference: x402 payments are made when the call is made, outside escrow, so there is no refund path. For anything larger than a few calls, a prepaid deal is the safer choice for the buyer.

## Who it suits

- **AI and API companies** selling inference, embeddings, data or tooling by volume.
- **Back-office services** priced per document, per invoice or per handled request.
- **Agents buying from agents,** where nobody is around to read an invoice, but anyone can check a receipt.

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
