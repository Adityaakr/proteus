# How AI agents can buy safely: budgets, seller checks and MCP

> What an AI agent needs to buy on its owner's behalf without overspending or paying the wrong seller: a spending mandate, on-chain seller checks and escrow.

Proteus AI team · published 2026-10-23, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/how-ai-agents-buy-safely

## Key takeaways

- An agent that buys needs three things: a budget it cannot exceed, a way to verify the seller, and a payment that waits for delivery.
- On Proteus AI the budget is a spending mandate enforced by the MCP server; the seller check reads the seller's ERC-8004 identity and committed policy on Arc.
- In a recorded run, Claude negotiated, refused a deal whose delivery date did not fit, bought a sample inside a 13 USDC budget and settled after checking the delivery record.
- Agents should check delivery records before settling and remember that a record is not physical proof.

## Agents are becoming buyers

Assistants already draft emails and book meetings. The next step is spending money: restocking merch, buying API credits, booking a service. That only works if an owner can hand an agent a task and a budget, and trust it not to overspend or pay the wrong party.

A sales page is written for people. An agent needs something it can verify.

## The three things a buying agent needs

### 1. A budget it cannot exceed

On Proteus AI the owner sets a **spending mandate**: the largest prepaid amount the agent may commit to a single deal. The MCP server enforces it before it signs anything. It caps the amount per deal; which service to buy and what unit price is acceptable remain the agent's judgement, so owners should state those in the task.

### 2. A way to verify the seller

Before signing, the agent runs four checks against public data on Arc:

1. The terms hash matches the public terms it was shown.
2. The seller's signer in the terms is the signer registered in the seller's ERC-8004 identity.
3. The payout address in the terms is the payee registered in that identity.
4. The pricing policy the quote used is committed on ProteusPolicyRegistry.

If any check fails, it does not sign. An impersonator cannot pass these checks without the seller's own wallet.

### 3. A payment that waits for delivery

The agent funds an escrow, not the seller. The seller is paid only when the agent countersigns what was delivered, and anything not delivered is refundable. See [USDC escrow, pay on delivery](https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery).


## The MCP tools

Any MCP client, including Claude and Cursor, can use nine tools:

| Tool | What it does |
|---|---|
| proteus_list_services | Every service on the market, with prices |
| proteus_get_service | Tiers, terms, refund policy and the seller's Arc identity |
| proteus_negotiate | Talks to the seller's agent; returns offers and a private negotiation key |
| proteus_verify_seller | The four on-chain checks above |
| proteus_accept_offer | Creates the quote, enforces the mandate, verifies, then signs |
| proteus_fund_deal | Funds with a gasless USDC permit |
| proteus_call_service | Calls a funded service; only delivered results are billed |
| proteus_settle_usage | Checks delivered usage against receipts and price, then settles |
| proteus_deal_status | Balances read from the escrow |

## A recorded run

On Arc testnet, Claude was given only these tools and a 13 USDC budget, and asked to source 20 branded merch boxes from a demo seller.

- It asked for $10.50 a box. The seller's agent held at $11.50, because the seller's rules did not allow lower.
- The seller's agent said a 7 to 10 day lead time could not guarantee the buyer's date. Claude declined to spend.
- When a 5 to 7 day window was available, it bought a 1-box sample for 12.50 USDC, inside its budget.
- All four seller checks passed before it signed; it funded with a gasless permit.
- After the seller recorded the delivery, Claude matched the record to exactly one box at the agreed price and settled.

The escrow still shows that deal on chain: 12.50 deposited, 12.50 settled.

![The settled sample deal on Proteus AI, Arc testnet](https://app.proteus.co.in/docs/deal.jpg "The deal page after settlement: deposit, settled and remaining balances read from DealEscrow.")
 The [full transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) is public and unedited.

> Claude noted in its own report that it checked the delivery record, not physical proof such as a photo or tracking number. That is the honest boundary of an agent today: it can verify numbers and signatures, and should leave physical inspection to its owner.

## For developers

- Run the MCP server from [the repository](https://github.com/Adityaakr/proteus/tree/main/packages/mcp) with your mandate set.
- Or use the HTTP API directly with the [agent buyer skill](https://app.proteus.co.in/api/public/agents/skill.md).
- Everything an agent needs, as data: [llms.txt](https://app.proteus.co.in/llms.txt) and [facts.json](https://app.proteus.co.in/docs/facts.json), including which claims are proven and which are not yet.
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
