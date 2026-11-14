/**
 * Proteus AI blog. Each post answers one question businesses and AI answer engines ask, with the answer first (key
 * takeaways), the detail after, and an FAQ that maps to schema.org FAQPage. Facts match the docs and the chain; when
 * something is not done yet, the post says so.
 */

export interface Post {
  slug: string;
  title: string;
  /** Meta description, about 150 characters. */
  description: string;
  date: string;
  updated?: string;
  author: string;
  tags: string[];
  /** Hero image (a real product screenshot) and its alt text. */
  hero: { src: string; alt: string };
  takeaways: string[];
  body: string;
  faq: { q: string; a: string }[];
  related: string[];
}

const AUTHOR = "Proteus AI team";

export const POSTS: Post[] = [
  {
    slug: "what-is-an-ai-deal-desk",
    title: "What is an AI deal desk? How autonomous agents negotiate and close B2B deals",
    description: "An AI deal desk quotes, negotiates and closes deals inside a business's own rules, then turns the agreement into a paid transaction. Here is how it works.",
    date: "2026-10-16",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["AI deal desk", "B2B sales", "Autonomous agents"],
    hero: { src: "/docs/negotiation.jpg", alt: "A buyer negotiating with a seller's AI deal desk on Proteus AI, with offers computed from the seller's rules" },
    takeaways: [
      "An AI deal desk is software that quotes, negotiates and closes deals for a business, inside rules the business sets.",
      "The model writes the conversation; prices come from code that applies the seller's rules, so the agent cannot invent a discount.",
      "A deal is only closed when money moves: both sides sign the same terms and the buyer's payment is held until delivery.",
      "It suits anything sold by quote, volume or usage: custom merch, services, API plans, data and compute.",
    ],
    body: `
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

![Offer review on Proteus AI, with the exact terms both sides sign](/docs/offer.jpg "Step 4, closing: the buyer reviews the exact terms both sides sign, then funds the escrow without paying gas.")

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

We go deeper on this in [How to let an AI negotiate without giving away your margin](/blog/ai-negotiation-without-losing-margin).

## Who an AI deal desk is for

It fits any business that sells by quote, volume or usage:

- **Print, merch and custom goods:** quantities, lead times and delivery dates change every order.
- **Service businesses:** receptionists, bookings and after-hours answering, billed per handled request.
- **API, data and AI providers:** plans by volume, pay per call, prepaid credits that should be refundable.
- **Agencies and back-office services:** scoped work, partial delivery, milestones.

It also serves a new kind of buyer: AI agents that shop for their owners. A deal desk with an API can sell to them as easily as to a person. See [How AI agents can buy safely](/blog/how-ai-agents-buy-safely).

## What it looks like in practice

The first business live on Proteus AI on Arc mainnet is a custom merch studio. A customer asked its deal desk for one tee, accepted an offer computed from the studio's committed rules, and funded it in USDC with no gas. The studio delivered, the customer confirmed, the escrow paid the studio, and the customer rated it 5 stars on chain. Every step is a public transaction you can check.

> The model proposes. The seller's policy decides. The signed agreement controls the money.

## Where to start

- Businesses: [Sell on Proteus AI in about five minutes](/docs/quickstart-seller).
- Buyers: [Buy from a deal desk](/docs/quickstart-buyer).
- Developers and agents: [For AI agents](/docs/for-agents) and [llms.txt](/llms.txt).
`,
    faq: [
      { q: "What is an AI deal desk?", a: "An AI deal desk is software that quotes, negotiates and closes deals for a business within rules the business sets, then turns the agreement into a paid transaction." },
      { q: "Can an AI deal desk give away my margin?", a: "Not if prices come from code. On Proteus AI the model only writes the words; offers are computed from your cost, margin floor, discount cap and minimums, and any reply with an unlisted figure is replaced." },
      { q: "How is a deal desk different from a sales chatbot?", a: "A chatbot talks but cannot price or close. A deal desk prices from your rules, negotiates counteroffers, refuses bad deals, and turns the agreement into signed terms and a payment." },
      { q: "How does the business get paid?", a: "On Proteus AI the buyer funds an escrow contract in USDC on Arc. The seller is paid for what the buyer countersigns as delivered; anything not delivered is refundable." },
      { q: "Can AI agents buy from a deal desk?", a: "Yes. Proteus AI exposes an HTTP API and an MCP server, so an AI agent can negotiate, verify the seller on chain and pay within a budget its owner sets." },
    ],
    related: ["ai-negotiation-without-losing-margin", "usdc-escrow-pay-on-delivery", "how-ai-agents-buy-safely"],
  },

  {
    slug: "ai-negotiation-without-losing-margin",
    title: "How to let an AI negotiate for your business without giving away your margin",
    description: "Seven guardrails that let an AI agent negotiate prices for your business while your floor, costs and approval rules stay in your control.",
    date: "2026-11-11",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["AI negotiation", "Pricing", "Guardrails"],
    hero: { src: "/docs/policies.jpg", alt: "Agent policies page on Proteus AI where a seller sets cost, margin floor, discount cap and approval threshold" },
    takeaways: [
      "Never let the model choose a price. Compute offers in code from the seller's rules, and let the model only write the words.",
      "Check every figure in the reply against the computed offers, and fall back to a fixed reply if anything else appears.",
      "Give every price refusal the same public reason and limit counteroffers, so buyers cannot probe for your floor.",
      "Keep costs and margins out of the model's context entirely, and send big deals to a person.",
    ],
    body: `
## Why AI negotiation scares business owners

Letting software talk money with your customers sounds like a fast way to lose margin. A language model wants to be helpful, buyers are persuasive, and "can you do a bit better?" works on people, so why not on a model?

It works on models too, if the model is in charge of the price. The fix is architectural, not a better prompt: **the model never decides a number.**

## The seven guardrails

### 1. Prices come from code

The seller sets the rules once: cost per unit, margin floor, maximum discount, minimum order, capacity, and a threshold above which a person approves. A pricing engine turns a buyer's request into a short list of offers that satisfy every rule. On Proteus AI this engine is ordinary, open code in the domain package; the model is never asked what to charge.

![A negotiation on Proteus AI with offers computed from the seller's rules](/docs/negotiation.jpg "What the buyer sees: offers with units, totals and inclusions. The seller's cost and floor never appear.")

### 2. The model only writes the words

The model receives the buyer's message and the public offers, and writes a reply that presents them. It does not see your cost or your floor, so it cannot leak them and cannot be argued into going below them.

### 3. A figure guard on every reply

Before a reply is sent, every price and quantity in it is compared with the figures the engine produced. If the model wrote a number that is not on the list, the reply is discarded and a fixed, rule-based reply goes out instead. Models are good writers and unreliable accountants; the guard turns that into a non-issue.

### 4. One public reason for every refusal

If a counteroffer is below your floor, the buyer is told it is outside what the seller can offer. If it breaks the discount cap, the minimum or capacity, the buyer hears the **same** reason. Different messages for different rules let a buyer binary-search your floor by watching which one fires.

### 5. A limit on counteroffers

Probing works by asking many times. On Proteus AI a negotiation allows 12 counteroffers, and each IP address 40 per 10 minutes. Real buyers rarely need more than three.

### 6. A person approves the big ones

Above the approval threshold, the offer is not sent; it waits for the seller. The agent tells the buyer the seller will confirm. Automation handles the many small deals, and a person handles the few that matter most.

### 7. The rules are public commitments

On Proteus AI each version of a seller's pricing policy is committed on chain as a salted hash, and every quote's terms point at the version that produced it. Your actual numbers stay private, but anyone can check later that a quote came from the rules you committed to at that time.

## What the buyer sees

The buyer sees offers, totals and a plain reason when a request does not fit. Never the cost, never the floor, never which rule said no. If they ask for something you do not sell, the agent points them to the right product instead of improvising.

| The buyer can see | The buyer never sees |
|---|---|
| Offers, units, totals, inclusions | Your cost and margin floor |
| One public reason for a refusal | Which rule refused |
| Your list prices and products | Your discount cap and approval threshold |

## Common questions from sellers

**Can the agent still be persuasive?** Yes. It can explain value, suggest a larger tier, or offer a sample. It just cannot change the numbers the engine allows.

**What if the model makes a mistake?** The figure guard catches invented numbers, and the buyer still has to sign terms that show the exact price before any money moves.

**What about my data?** Costs, margins and policy never enter the model's context, and contact details are removed from the conversation before each model call. See our [privacy page](/docs/privacy).

## Try it

Set up a product and its rules in the [seller quickstart](/docs/quickstart-seller), then negotiate with your own agent on the [market](/app/market). The full pricing rules are documented under [Pricing](/docs/pricing).
`,
    faq: [
      { q: "Can an AI negotiate prices without going below my floor?", a: "Yes, if the floor is enforced in code. On Proteus AI offers are computed by a pricing engine from your rules and the model only writes the reply, so it cannot quote below the floor." },
      { q: "What stops a buyer from probing for my lowest price?", a: "Every price refusal returns the same public reason, and counteroffers are limited per negotiation and per IP address, so a buyer cannot learn which rule fired." },
      { q: "Does the AI model see my costs?", a: "No. Costs, margins and policy stay in the pricing engine. The model receives only the buyer's message and the offers the buyer is allowed to see." },
      { q: "What happens with very large deals?", a: "Above an approval threshold you set, the offer waits for a person. The agent tells the buyer the seller will confirm." },
    ],
    related: ["what-is-an-ai-deal-desk", "usdc-escrow-pay-on-delivery", "whatsapp-ai-sales-agent"],
  },

  {
    slug: "usdc-escrow-pay-on-delivery",
    title: "Get paid on delivery: USDC escrow for small business orders",
    description: "How USDC escrow lets a buyer pay up front and a business get paid only for what it delivers, with automatic refunds, no gas for buyers and funding from 25 chains.",
    date: "2026-11-11",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["USDC", "Escrow", "Payments", "Arc"],
    hero: { src: "/docs/deal.jpg", alt: "A deal page on Proteus AI showing escrow balances read from the chain, the settlement transaction and the refund option" },
    takeaways: [
      "Escrow removes the one-way trust problem: the buyer's money is committed up front, and the seller is paid only for what the buyer confirms as delivered.",
      "With USDC on Arc, the same escrow works for a business in any country, settles in seconds and charges gas in USDC.",
      "Anything not delivered by the end of the term is refundable to the buyer, and that refund cannot be paused by anyone.",
      "Buyers can fund from 25 chains through Circle CCTP and pay no gas, because a relayer submits the transaction.",
    ],
    body: `
## The trust problem in every custom order

Every order that is not paid at a checkout has the same problem. Either the buyer pays first and hopes the seller delivers, or the seller delivers first and hopes the buyer pays. Small businesses live with this every day, and it shows up as deposits, chasing invoices, refunds by goodwill and disputes settled with screenshots.

**Escrow** fixes it by putting the money somewhere neither side controls alone. The buyer commits the full amount up front. The seller is paid as delivery is confirmed. Whatever is not delivered goes back to the buyer.

## How USDC escrow works on Proteus AI

1. **Both sides sign the same terms.** Units, price, term and the seller's payout address are signed by the buyer and by the seller as EIP-712 typed data. Neither side can change them later.
2. **The buyer funds the escrow.** The prepaid amount in USDC moves into DealEscrow on Arc. With a USDC permit, the buyer signs once and our relayer submits the transaction and pays the gas.
3. **The seller delivers.** For an API, each call is metered. For goods, the seller records each delivered batch with a note and an optional proof link.
4. **The buyer countersigns.** The buyer signs the cumulative units and amount delivered. Nothing moves without this signature.
5. **The escrow pays the seller.** DealEscrow checks the buyer's acceptance against the seller's signed delivery record and pays the difference since the last settlement, straight to the seller's own wallet.
6. **The rest is refundable.** After the term plus a grace period, or as soon as the seller closes early, the unspent balance goes back to the buyer. Anyone can trigger it, and it cannot be paused.

![The seller's usage and delivery page on Proteus AI](/docs/seller-usage.jpg "The seller's side: each delivered unit, what was billed, and the signed receipt behind it.")

## Why USDC, and why Arc

- **One currency for every country.** A merch studio and its customer do not need to agree on a currency or a bank. USDC is a dollar that moves like a message.
- **Fast, cheap settlement.** Arc settles in seconds and charges gas in USDC, so nobody needs a second token.
- **Money from where it already is.** Circle CCTP brings native USDC to Arc from 25 chains, burned on the source chain and minted on Arc, never wrapped. Our first live business brought its USDC in from Solana this way.
- **Readable by anyone.** Escrow balances, settlements and refunds are public. A buyer, a seller or an auditor can check them without asking us.

## What the escrow cannot do

Being precise about limits is part of trust.

- **It does not verify delivery.** For physical goods the seller confirms delivery; the buyer's countersignature is the real check. A buyer who disagrees does not sign and can open a dispute.
- **Disputes have one arbiter.** A dispute freezes the deal, and an arbiter can only split the unspent balance between buyer and seller. It can never take money for itself, and it cannot touch payments the buyer already confirmed.
- **The owner's power is narrow.** The contract owner can pause new deals and set the arbiter. Settlement and refunds cannot be paused, and there is no function that sweeps funds.

## A real order, start to finish

On Arc mainnet, a custom merch studio's customer bought one tee for $6.60. The customer bridged USDC from Solana, accepted the agent's offer, and funded the escrow with no gas. The studio delivered, the customer countersigned, and the escrow paid the studio 6.60 USDC in a single transaction. You can read the escrow's balances for that deal on chain today: 6.60 deposited, 6.60 settled, nothing left.

| Step | Who acts | On chain |
|---|---|---|
| Terms signed | Buyer and seller | Terms hash in the funding transaction |
| Escrow funded | Relayer, for the buyer | USDC into DealEscrow |
| Delivery recorded | Seller | Signed receipt |
| Delivery accepted | Buyer | Settlement transaction |
| Seller paid | DealEscrow | USDC to the seller's wallet |

## Get started

- [How the money moves](/docs/money-path), step by step.
- [Signatures](/docs/signatures): exactly what each side signs.
- [Verify it yourself](/docs/verify): contracts and transactions.
`,
    faq: [
      { q: "What is USDC escrow?", a: "USDC escrow holds a buyer's payment in a smart contract until the agreed conditions are met. On Proteus AI the seller is paid for what the buyer confirms as delivered, and the rest is refundable." },
      { q: "Do buyers need ETH or another token for gas?", a: "No. Arc charges gas in USDC, and on Proteus AI the buyer signs a USDC permit while a relayer submits the transaction and pays the gas." },
      { q: "Can I pay with USDC from another chain?", a: "Yes. Circle CCTP brings native USDC to Arc from 25 chains, including Solana, without wrapping." },
      { q: "What happens if the seller never delivers?", a: "Nothing is paid without the buyer's countersignature. After the term plus a grace period, the unspent balance is refundable to the buyer, and that refund cannot be paused." },
      { q: "Who resolves disputes?", a: "An arbiter key that can only split the unspent balance between buyer and seller. It cannot take funds or reverse payments the buyer already confirmed." },
    ],
    related: ["what-is-an-ai-deal-desk", "how-ai-agents-buy-safely", "ai-negotiation-without-losing-margin"],
  },

  {
    slug: "how-ai-agents-buy-safely",
    title: "How AI agents can buy safely: budgets, seller checks and MCP",
    description: "What an AI agent needs to buy on its owner's behalf without overspending or paying the wrong seller: a spending mandate, on-chain seller checks and escrow.",
    date: "2026-10-23",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["Agentic commerce", "MCP", "ERC-8004", "AI agents"],
    hero: { src: "/docs/offer.jpg", alt: "Offer review page on Proteus AI with the exact terms, on-chain details and gasless funding steps an agent verifies before signing" },
    takeaways: [
      "An agent that buys needs three things: a budget it cannot exceed, a way to verify the seller, and a payment that waits for delivery.",
      "On Proteus AI the budget is a spending mandate enforced by the MCP server; the seller check reads the seller's ERC-8004 identity and committed policy on Arc.",
      "In a recorded run, Claude negotiated, refused a deal whose delivery date did not fit, bought a sample inside a 13 USDC budget and settled after checking the delivery record.",
      "Agents should check delivery records before settling and remember that a record is not physical proof.",
    ],
    body: `
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

The agent funds an escrow, not the seller. The seller is paid only when the agent countersigns what was delivered, and anything not delivered is refundable. See [USDC escrow, pay on delivery](/blog/usdc-escrow-pay-on-delivery).


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

![The settled sample deal on Proteus AI, Arc testnet](/docs/deal.jpg "The deal page after settlement: deposit, settled and remaining balances read from DealEscrow.")
 The [full transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) is public and unedited.

> Claude noted in its own report that it checked the delivery record, not physical proof such as a photo or tracking number. That is the honest boundary of an agent today: it can verify numbers and signatures, and should leave physical inspection to its owner.

## For developers

- Run the MCP server from [the repository](https://github.com/Adityaakr/proteus/tree/main/packages/mcp) with your mandate set.
- Or use the HTTP API directly with the [agent buyer skill](/api/public/agents/skill.md).
- Everything an agent needs, as data: [llms.txt](/llms.txt) and [facts.json](/docs/facts.json), including which claims are proven and which are not yet.
- Start with [Buy with an AI agent](/docs/quickstart-agent).
`,
    faq: [
      { q: "How can an AI agent pay for things safely?", a: "Give it a spending mandate it cannot exceed, have it verify the seller's on-chain identity and terms before signing, and pay into escrow so the seller is paid only for confirmed delivery." },
      { q: "What is MCP in agentic commerce?", a: "MCP, the Model Context Protocol, lets an AI client such as Claude call tools. Proteus AI's MCP server gives an agent nine tools to find, negotiate, verify, fund, use and settle a deal." },
      { q: "How does an agent know it is paying the real seller?", a: "It checks that the signer and payout address in the signed terms match the seller's ERC-8004 identity on Arc, and that the pricing policy is committed on chain." },
      { q: "Does the spending mandate cap the unit price?", a: "No. It caps the prepaid amount per deal. Which service to buy and what unit price is acceptable are the agent's judgement, so owners should state them in the task." },
      { q: "Has an AI agent bought on mainnet yet?", a: "Not yet. The recorded run is on Arc testnet against a demo seller; a mainnet purchase is on our roadmap." },
    ],
    related: ["what-is-an-ai-deal-desk", "usdc-escrow-pay-on-delivery", "ai-negotiation-without-losing-margin"],
  },

  {
    slug: "whatsapp-ai-sales-agent",
    title: "Selling on WhatsApp with an AI agent: five rules for trust, privacy and payment",
    description: "How to put an AI sales agent on a business's WhatsApp without taking payments in chat, exposing customers' numbers or breaking Meta's rules.",
    date: "2026-11-11",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["WhatsApp", "AI sales agent", "Privacy"],
    hero: { src: "/blog/whatsapp-chat.jpg", alt: "Illustration of the WhatsApp flow with a demo seller: the agent says it is an AI, sends offers as tap-to-accept buttons, then a pay link that works for 30 minutes" },
    takeaways: [
      "Let the chat negotiate, never take money: offers as buttons, then a short-lived link to a signed checkout on the web.",
      "Tell the customer it is an AI from the first message, and give them HUMAN and STOP.",
      "Treat a phone number as personal data: identify buyers by a one-way pseudonym and keep numbers away from the AI model.",
      "Verify every webhook signature before reading it, and be honest that WhatsApp Business chats are visible to Meta.",
    ],
    body: `
## Why WhatsApp

For many small businesses, WhatsApp is the shop. Quotes, haggling, photos of samples and "is it ready?" all happen in one chat thread. The first real business we worked with runs this way. A deal desk that lives only on a website misses where the buying actually happens.

So the same deal desk, under the same rules, answers on a seller's WhatsApp Business number through Meta's official Cloud API. Building it meant deciding what an AI should and should not do inside a chat. These are the five rules we landed on.

## Rule 1: the chat negotiates, it never takes money

Offers arrive as tap-to-accept buttons. Accepting sends a secure pay link that works for 30 minutes. Signing the terms and paying in USDC happen on the web, never inside the chat.

Payments inside a chat are hard to verify and easy to fake: a screenshot is not a receipt. A signed checkout on Arc leaves a record both sides can check, and the money waits in escrow until delivery.

## Rule 2: the customer always knows it is an AI

The first reply says the customer is talking to the business's AI agent and how to reach a person.

- **HUMAN** pauses the agent and alerts the seller's team, whose replies come back into the same chat.
- **STOP** opts the customer out at once, and is never rate limited.
- **START** opts back in.

This is also what Meta requires: AI on WhatsApp is allowed when it is scoped to one business, not as a general assistant.

## Rule 3: a phone number is not a profile

A WhatsApp number is personal data, and a sales tool does not need it in plain sight.

- Each buyer is known by a one-way pseudonym derived from Meta's user id.
- The id needed to reply is encrypted with the seller's own key.
- The seller's console never shows the buyer's number, and the AI model never receives it.
- Emails and phone numbers typed into the chat are removed before every model call.

## Rule 4: nothing is trusted until it is verified

Every webhook from Meta is checked against its HMAC signature over the raw body before anything is read. Unsigned or wrongly signed calls are refused with 401, bodies over 1 MB are refused, and each message is handled once. Limits per buyer and per seller cap abuse and AI spend, while STOP always goes through.

## Rule 5: be honest about what WhatsApp sees

WhatsApp Business chats are not end-to-end encrypted to the business the way personal chats are. Meta's Cloud API decrypts them and keeps messages for up to 30 days. We say so on our [privacy page](/docs/privacy) rather than imply otherwise, and we keep costs, margins and policy out of the chat entirely, so the most sensitive business data never travels through it.

## Where it stands

The WhatsApp channel is built and deployed on Arc mainnet and testnet, a number is connected, and Meta's webhook reaches our server and passes signature checks. It is in testing: the next step is the first real conversation on a phone, then a business's own number.

| Question | Answer |
|---|---|
| Does payment happen in the chat? | No. A 30-minute link opens a signed checkout on the web. |
| Does the business see my number? | No. Buyers are a pseudonym in the seller's console. |
| Does the AI see my number? | No, and numbers or emails typed in are removed first. |
| Can I reach a person? | Yes. Type HUMAN. |
| Can I stop messages? | Yes. Type STOP at any time. |

## Learn more

- [Privacy on Proteus AI](/docs/privacy), including WhatsApp.
- [What is an AI deal desk?](/blog/what-is-an-ai-deal-desk)
- [Front desk, orders and inbox](/docs/front-desk) for businesses whose customers talk to them.
`,
    faq: [
      { q: "Can an AI agent sell on WhatsApp?", a: "Yes, through Meta's WhatsApp Cloud API, if it is scoped to one business, discloses that it is an AI, and lets the customer reach a person and opt out." },
      { q: "Should payments happen inside WhatsApp?", a: "We recommend not. On Proteus AI the chat negotiates and sends a 30-minute link to a signed USDC checkout on the web, so the payment can be verified on chain." },
      { q: "Does the seller see the buyer's phone number?", a: "No. On Proteus AI buyers are identified by a one-way pseudonym; the number needed to reply is encrypted with the seller's own key and never shown." },
      { q: "Are WhatsApp Business chats end-to-end encrypted?", a: "Not to the business. Meta's Cloud API decrypts them and keeps messages for up to 30 days, which is why costs, margins and policy never enter the chat." },
      { q: "Is the Proteus AI WhatsApp channel live?", a: "It is built and deployed on Arc mainnet and testnet and is in testing; the first real conversation on a phone is the next step." },
    ],
    related: ["what-is-an-ai-deal-desk", "ai-negotiation-without-losing-margin", "usdc-escrow-pay-on-delivery"],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

/** Reading time at 220 words a minute. */
export const readMinutes = (p: Post) => Math.max(3, Math.round((p.body.split(/\s+/).length + p.takeaways.join(" ").split(/\s+/).length) / 220));
