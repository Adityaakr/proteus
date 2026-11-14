# How AI agents can buy safely: budgets, seller checks and MCP

> What an AI agent needs to buy on its owner's behalf without overspending or paying the wrong seller: a spending mandate, on-chain seller checks and escrow.

Aditya, founder of Proteus AI · published 2026-10-23, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/how-ai-agents-buy-safely

## Key takeaways

- A buying agent needs three things before anyone lets it spend: a budget it cannot exceed, a way to verify the seller, and a payment that waits for delivery.
- On Proteus AI the budget is a spending mandate enforced by the MCP server, and the seller check reads the seller's ERC-8004 identity and committed policy on Arc.
- In a recorded run, Claude negotiated, refused a deal whose date did not fit, bought a sample inside a 13 USDC budget, and settled only after checking the delivery record.
- Claude itself pointed out that it checked a record, not a photo or a tracking number. That is the honest limit of agents today.

## The test I actually cared about

Everyone says agents will start buying things. Very few people show an agent buying something and then being careful about it.

So on October 23 I ran a test. I gave Claude only our MCP tools, a budget of 13 USDC, and one task: source 20 branded merch boxes for an event from Kitbox, our labelled demo seller on Arc testnet. Then I let it run and saved the transcript without editing it.

I was not looking for "it bought something". I wanted to see if it would say no.

## What happened

- Claude asked for $10.50 a box. Kitbox's deal desk held at $11.50, because Kitbox's rules did not allow lower.
- With a 7 to 10 day lead time, the seller's agent said it could not guarantee the event date. Claude decided not to spend anything.
- When a 5 to 7 day window was offered, Claude bought a 1-box sample for 12.50 USDC, inside its budget, to check quality before committing to 20.
- Before signing, it ran all four seller checks on Arc. All passed. It funded the escrow with a gasless permit.
- After Kitbox recorded the delivery, Claude matched the record to exactly one box at the agreed price, and only then settled.

The escrow still shows that deal on chain: 12.50 deposited, 12.50 settled. The [full transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) is public.

The part I keep coming back to is at the end. In its own report, Claude noted that it had checked the delivery record, not physical proof like a photo or a tracking number. Nobody prompted it to say that. It is exactly the right boundary: an agent can check numbers and signatures, and should leave "is the box actually in my office" to its owner.

![The deal page for the settled sample on Arc testnet](https://app.proteus.co.in/docs/deal.jpg "The sample deal after settlement: deposit, settled and remaining read from DealEscrow.")

## The three things a buying agent needs

### A budget it cannot exceed

The owner sets a **spending mandate**: the largest prepaid amount the agent may commit to one deal. The MCP server enforces it before it signs anything. I want to be precise here: it caps the amount per deal. Which service to buy and what unit price is acceptable are still the agent's judgement, so say them in the task.

### A way to check the seller

Before signing, the agent runs four checks against public data on Arc:

1. The terms hash matches the public terms it was shown.
2. The signer in the terms is the signer registered in the seller's ERC-8004 identity.
3. The payout address in the terms is the payee registered in that identity.
4. The pricing policy behind the quote is committed on ProteusPolicyRegistry.

If any of them fails, it does not sign. Someone pretending to be the seller cannot pass these without the seller's own wallet. I explain the identity side in [What is ERC-8004?](https://app.proteus.co.in/blog/erc-8004-agent-identity).

### A payment that waits for delivery

The agent pays into escrow, not to the seller. The seller gets paid when the agent countersigns what was delivered. See [Get paid on delivery](https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery).

![Offer review on Proteus AI](https://app.proteus.co.in/docs/offer.jpg "The exact terms an agent, or a person, reviews before signing: units, price, term and the on-chain details.")

## The nine MCP tools

| Tool | What it does |
|---|---|
| proteus_list_services | Every service on the market, with prices |
| proteus_get_service | Tiers, terms, refund policy and the seller's Arc identity |
| proteus_negotiate | Talks to the seller's agent; returns offers and a private negotiation key |
| proteus_verify_seller | The four checks above |
| proteus_accept_offer | Creates the quote, enforces the mandate, verifies, then signs |
| proteus_fund_deal | Funds with a gasless USDC permit |
| proteus_call_service | Calls a funded service; only delivered results are billed |
| proteus_settle_usage | Checks delivered usage against receipts and price, then settles |
| proteus_deal_status | Balances read from the escrow |

## What is not done yet

This run was on Arc testnet against a demo seller. An agent buying on mainnet from a real business has not happened yet, and I will not pretend otherwise. It is near the top of my list.

## If you are building an agent

- Run the MCP server from [the repository](https://github.com/Adityaakr/proteus/tree/main/packages/mcp) with your mandate set.
- Or use the HTTP API with the [agent buyer skill](https://app.proteus.co.in/api/public/agents/skill.md).
- Everything an agent needs is also published as data: [llms.txt](https://app.proteus.co.in/llms.txt) and [facts.json](https://app.proteus.co.in/docs/facts.json), including what is proven and what is not.
- Start with [Buy with an AI agent](https://app.proteus.co.in/docs/quickstart-agent).

## Frequently asked questions

### How can an AI agent pay for things safely?

Give it a spending mandate it cannot exceed, have it verify the seller's on-chain identity and terms before signing, and pay into escrow so the seller is paid only for confirmed delivery.

### What is MCP in agentic commerce?

MCP, the Model Context Protocol, lets an AI client such as Claude call tools. Proteus AI's MCP server gives an agent nine tools to find, negotiate, verify, fund, use and settle a deal.

### How does an agent know it is paying the real seller?

It checks that the signer and payout address in the signed terms match the seller's ERC-8004 identity on Arc, and that the pricing policy is committed on chain.

### Does the spending mandate cap the unit price?

No. It caps the prepaid amount per deal. Which service to buy and what unit price is acceptable are the agent's judgement, so owners should state them in the task.

### Has an AI agent bought on mainnet yet?

Not yet. The recorded run is on Arc testnet against a demo seller; a mainnet purchase is on our roadmap.
