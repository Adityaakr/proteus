# What is an AI deal desk? How autonomous agents negotiate and close B2B deals

> An AI deal desk quotes, negotiates and closes deals inside a business's own rules, then turns the agreement into a paid transaction. Here is how it works.

Proteus AI team · published 2026-10-16, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/what-is-an-ai-deal-desk

## Key takeaways

- An AI deal desk is software that quotes, negotiates and closes deals for a business, inside rules the business sets.
- The model writes the conversation; prices come from code that applies the seller's rules, so the agent cannot invent a discount.
- A deal is only closed when money moves: both sides sign the same terms and the buyer's payment is held until delivery.
- It suits anything sold by quote, volume or usage: custom merch, services, API plans, data and compute.

## The problem a deal desk solves

Most online selling is a checkout button: one product, one price, pay now. A large share of real business is not like that. A buyer asks for 20 branded boxes delivered to Mumbai by the 31st, 600 invoices a month with two-way matching, or 50,000 API calls priced per call. Somebody at the business works out a price, haggles a little, sends a payment link, and hopes the buyer pays.

That work is slow, it happens at odd hours, and it is where deals are lost: buyers ask several sellers at once, and the first credible answer usually wins.

An **AI deal desk** takes over that conversation. It is an AI co-worker that works out what the business can offer, negotiates within the business's rules, and turns the agreement into a paid transaction.

## How an AI deal desk works

A good deal desk separates three jobs that a chatbot mixes together: understanding, deciding and paying.

1. **Understanding.** A language model reads the buyer's message and pulls out what matters: quantity, budget, dates, integrations, anything unusual. On Proteus AI this step runs on Claude Haiku 5.5 with structured output, so the result is data, not prose.
2. **Deciding.** Offers are computed in code from the seller's rules: cost, margin floor, maximum discount, minimum order, capacity and an approval threshold for large deals. The model never sets a price.
3. **Explaining.** A second model call writes the reply around those offers. If the reply contains any figure that is not one of the computed offers, it is thrown away and a fixed reply is sent instead.
4. **Closing.** When the buyer accepts, both sides sign identical terms and the buyer funds the deal. On Proteus AI that is an EIP-712 signature and USDC held in an escrow contract on Arc.
5. **Settling.** The seller delivers, the buyer countersigns what was delivered, and the escrow pays exactly that. Anything not delivered is refundable.

![Offer review on Proteus AI, with the exact terms both sides sign](https://app.proteus.co.in/docs/offer.jpg "Step 4, closing: the buyer reviews the exact terms both sides sign, then funds the escrow without paying gas.")

## AI deal desk vs. chatbot vs. CPQ

| | Sales chatbot | CPQ software | AI deal desk |
|---|---|---|---|
| Talks to buyers in their own words | Yes | No | Yes |
| Prices from the business's rules | No | Yes | Yes |
| Negotiates counteroffers | Rarely | No | Yes |
| Can say no to a bad deal | No | Not applicable | Yes, by rule |
| Turns the deal into a payment | No | No | Yes, signed terms and escrow |
| Works with AI buyers | No | No | Yes, through an API and MCP |

A chatbot is good at conversation and bad at money. CPQ (configure, price, quote) tools are good at pricing and do not negotiate. A deal desk needs both, plus a way to get paid.

## What makes it safe to let an AI negotiate

The fear is reasonable: an AI that gives away your margin to anyone who pushes. The answer is to keep the decisions out of the model.

- **Rules in code, not in a prompt.** A prompt can be talked around. A floor written in code cannot.
- **A figure guard.** The reply may only contain numbers the pricing engine produced.
- **Human approval for big deals.** Above a threshold the seller sets, the offer waits for a person.
- **The same public reason for every refusal.** A buyer cannot binary-search your floor by watching which rule fired.
- **A public record of the rules.** On Proteus AI each pricing policy version is committed on chain, and every quote points at the version it used.

We go deeper on this in [How to let an AI negotiate without giving away your margin](https://app.proteus.co.in/blog/ai-negotiation-without-losing-margin).

## Who an AI deal desk is for

It fits any business that sells by quote, volume or usage:

- **Print, merch and custom goods:** quantities, lead times and delivery dates change every order.
- **Service businesses:** receptionists, bookings and after-hours answering, billed per handled request.
- **API, data and AI providers:** plans by volume, pay per call, prepaid credits that should be refundable.
- **Agencies and back-office services:** scoped work, partial delivery, milestones.

It also serves a new kind of buyer: AI agents that shop for their owners. A deal desk with an API can sell to them as easily as to a person. See [How AI agents can buy safely](https://app.proteus.co.in/blog/how-ai-agents-buy-safely).

## What it looks like in practice

The first business live on Proteus AI on Arc mainnet is a custom merch studio. A customer asked its deal desk for one tee, accepted an offer computed from the studio's committed rules, and funded it in USDC with no gas. The studio delivered, the customer confirmed, the escrow paid the studio, and the customer rated it 5 stars on chain (a rating made before our [link checks](https://app.proteus.co.in/docs/ratings) existed, and disclosed as such). Every step is a public transaction you can check.

> The model proposes. The seller's policy decides. The signed agreement controls the money.

## Where to start

- Businesses: [Sell on Proteus AI in about five minutes](https://app.proteus.co.in/docs/quickstart-seller).
- Buyers: [Buy from a deal desk](https://app.proteus.co.in/docs/quickstart-buyer).
- Developers and agents: [For AI agents](https://app.proteus.co.in/docs/for-agents) and [llms.txt](https://app.proteus.co.in/llms.txt).

## Frequently asked questions

### What is an AI deal desk?

An AI deal desk is software that quotes, negotiates and closes deals for a business within rules the business sets, then turns the agreement into a paid transaction.

### Can an AI deal desk give away my margin?

Not if prices come from code. On Proteus AI the model only writes the words; offers are computed from your cost, margin floor, discount cap and minimums, and any reply with an unlisted figure is replaced.

### How is a deal desk different from a sales chatbot?

A chatbot talks but cannot price or close. A deal desk prices from your rules, negotiates counteroffers, refuses bad deals, and turns the agreement into signed terms and a payment.

### How does the business get paid?

On Proteus AI the buyer funds an escrow contract in USDC on Arc. The seller is paid for what the buyer countersigns as delivered; anything not delivered is refundable.

### Can AI agents buy from a deal desk?

Yes. Proteus AI exposes an HTTP API and an MCP server, so an AI agent can negotiate, verify the seller on chain and pay within a budget its owner sets.
