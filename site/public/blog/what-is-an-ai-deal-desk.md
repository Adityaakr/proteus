# What is an AI deal desk? How autonomous agents negotiate and close B2B deals

> An AI deal desk quotes, negotiates and closes deals inside a business's own rules, then turns the agreement into a paid transaction. Here is how it works.

Aditya, founder of Proteus AI · published 2026-10-16, updated 2026-11-22 · 5 min read · https://app.proteus.co.in/blog/what-is-an-ai-deal-desk

## Key takeaways

- An AI deal desk quotes, negotiates and closes deals for a business, inside rules the business sets. That is the whole idea.
- The model writes the conversation. The prices come from plain code that reads the seller's rules, so there is nothing to talk it out of.
- A deal is not closed when someone says yes. It is closed when both sides sign the same terms and the money is waiting in escrow.
- It fits small businesses that quote every order, such as custom merch, print, gifting and wholesale, and anything sold by volume or usage.

## The person who answers at 11pm

Most small businesses have one. Someone who replies to "how much for 50?" late at night, works out a price in their head, haggles a little, sends a payment link and then waits to see if the money shows up.

That conversation is where most of the selling actually happens, and it runs on copy-paste and trust. When that person is asleep, the buyer asks the next shop. When they are tired, they give away a discount they did not need to.

I started Proteus AI to give that person a co-worker. Not a chatbot that is polite and useless, but something that knows what the business can offer, negotiates only inside its rules, and turns a yes into a paid transaction.

That is what I mean by an **AI deal desk**. On Proteus AI every seller gets one, and buyers, or their AI agents, can deal with any of them under the same rules and the same escrow. We call that the deal network for small businesses and AI agents on Arc.

## What it actually does

Most "AI sales" tools mix three jobs together. We split them on purpose.

1. **Understanding.** A model reads the buyer's message and pulls out what matters: quantity, budget, integrations, open questions. On Proteus AI this runs on Claude Haiku 5.5 with structured output, so what comes back is data, not a paragraph.
2. **Deciding.** Offers are computed in ordinary code from the seller's rules: cost, margin floor, maximum discount, minimum order, capacity, and a threshold above which a person has to approve. The model is never asked what to charge.
3. **Explaining.** A second model call writes the reply around those offers. If it mentions a price, or any large number, that is not among the offers, the buyer's own budget or the seller's other products, we throw the reply away and send a plain fixed one instead.

Then the two parts that make it a desk and not a chat:

4. **Closing.** When the buyer accepts, both sides sign identical terms (EIP-712), and the buyer's USDC goes into an escrow contract on Arc.
5. **Settling.** The seller records what it delivered, the buyer countersigns it, and the escrow pays exactly that. Anything not delivered can go back to the buyer.

![A buyer negotiating with a demo seller's deal desk on Proteus AI](https://app.proteus.co.in/docs/negotiation.jpg "A negotiation with Kitbox, our labelled demo seller on Arc testnet. Every offer on the right came from the seller's rules.")

## Why not just a chatbot, or quoting software?

Here is the honest comparison.

| | Sales chatbot | CPQ software | AI deal desk |
|---|---|---|---|
| Talks to buyers in their own words | Yes | No | Yes |
| Prices from the business's rules | No | Yes | Yes |
| Negotiates counteroffers | Rarely | No | Yes |
| Can say no to a bad deal | No | Not applicable | Yes, by rule |
| Turns the deal into a payment | No | No | Yes, signed terms and escrow |
| Works with AI buyers | No | No | Yes, through an API and MCP |

A chatbot is good with words and bad with money. CPQ (configure, price, quote) tools are good with money and do not talk. A deal desk needs both, and it needs a way to get paid at the end, or it is just a nicer quote form.

## The part I worried about most

The first question a seller should ask is some version of "what stops it from giving my margin away?"

It is a fair worry. Models want to be helpful, and "can you do a bit better?" works on helpful things. So we took the decision away from the model completely. The floor lives in code, not in a prompt. The reply is checked for invented numbers. Big deals wait for a human. And every refusal gives the same public reason, which we only got right after our own audit found a leak on November 11. I wrote that story up in [How to let an AI negotiate without giving away your margin](https://app.proteus.co.in/blog/ai-negotiation-without-losing-margin).

> The model proposes. The seller's policy decides. The signed agreement controls the money.

## Who it is for

Anyone who sells by quote, volume or usage:

- **Custom merch, print and gifting.** Quantities, artwork and delivery dates change every order.
- **Event supply, creative services and wholesale.** Volume tiers, batches and buyers you have never met.
- **Service businesses.** Bookings, receptionists, after-hours requests, billed per handled request.
- **API, data and AI providers.** Volume plans, pay per call, prepaid credit that should be refundable.

And a buyer most businesses are not ready for yet: other people's AI agents. A deal desk with an API can sell to them the same way it sells to a person. More on that in [How AI agents can buy safely](https://app.proteus.co.in/blog/how-ai-agents-buy-safely).

## What it looks like with a real business

The first business live on Proteus AI on Arc mainnet is a custom merch studio. On November 7, one of its customers asked the studio's deal desk for a single custom tee, accepted the offer, and funded it in USDC without paying gas. On November 11 the studio delivered, the customer confirmed, and the escrow paid the studio 6.60 USDC in one transaction. The customer then rated the studio 5 stars on chain (that rating was made before our [link checks](https://app.proteus.co.in/docs/ratings) existed, and we say so publicly).

It is one order, and our own link check later found the buyer's wallet tied to an account on the studio's team, so it proves the mechanism more than independent demand. Every step is a public transaction anyone can check.

## If you want to try it

- Sell: [the seller quickstart](https://app.proteus.co.in/docs/quickstart-seller) takes about five minutes.
- Buy: [buy from a deal desk](https://app.proteus.co.in/docs/quickstart-buyer).
- Build: [for AI agents](https://app.proteus.co.in/docs/for-agents) and [llms.txt](https://app.proteus.co.in/llms.txt).

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
