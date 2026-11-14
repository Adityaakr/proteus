/**
 * Proteus AI blog, written by the founder. Each post answers one question businesses and AI answer engines ask, with the answer first (key
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

const AUTHOR = "Aditya, founder of Proteus AI";

export const POSTS: Post[] = [
  {
    slug: "what-is-an-ai-deal-desk",
    title: "What is an AI deal desk? How autonomous agents negotiate and close B2B deals",
    description: "An AI deal desk quotes, negotiates and closes deals inside a business's own rules, then turns the agreement into a paid transaction. Here is how it works.",
    date: "2026-10-16",
    updated: "2026-11-14",
    author: AUTHOR,
    tags: ["AI deal desk", "B2B sales", "Autonomous agents"],
    hero: { src: "/blog/covers/what-is-an-ai-deal-desk.jpg", alt: "A buyer asks Kitbox's deal agent for 20 branded boxes; the agent answers with two offers computed from the seller's rules, a $230 team pack and a $12.50 sample" },
    takeaways: [
      "An AI deal desk quotes, negotiates and closes deals for a business, inside rules the business sets. That is the whole idea.",
      "The model writes the conversation. The prices come from plain code that reads the seller's rules, so there is nothing to talk it out of.",
      "A deal is not closed when someone says yes. It is closed when both sides sign the same terms and the money is waiting in escrow.",
      "It fits anything sold by quote, volume or usage: custom merch, services, API plans, data, compute.",
    ],
    body: `
## The person who answers at 11pm

Most small businesses have one. Someone who replies to "how much for 50?" late at night, works out a price in their head, haggles a little, sends a payment link and then waits to see if the money shows up.

That conversation is where most of the selling actually happens, and it runs on copy-paste and trust. When that person is asleep, the buyer asks the next shop. When they are tired, they give away a discount they did not need to.

I started Proteus AI to give that person a co-worker. Not a chatbot that is polite and useless, but something that knows what the business can offer, negotiates only inside its rules, and turns a yes into a paid transaction.

That is what I mean by an **AI deal desk**.

## What it actually does

Most "AI sales" tools mix three jobs together. We split them on purpose.

1. **Understanding.** A model reads the buyer's message and pulls out what matters: quantity, budget, dates, anything unusual. On Proteus AI this runs on Claude Haiku 5.5 with structured output, so what comes back is data, not a paragraph.
2. **Deciding.** Offers are computed in ordinary code from the seller's rules: cost, margin floor, maximum discount, minimum order, capacity, and a threshold above which a person has to approve. The model is never asked what to charge.
3. **Explaining.** A second model call writes the reply around those offers. If it mentions any number the pricing code did not produce, we throw the reply away and send a plain fixed one instead.

Then the two parts that make it a desk and not a chat:

4. **Closing.** When the buyer accepts, both sides sign identical terms (EIP-712), and the buyer's USDC goes into an escrow contract on Arc.
5. **Settling.** The seller delivers, the buyer countersigns what arrived, and the escrow pays exactly that. Anything not delivered can go back to the buyer.

![A buyer negotiating with a demo seller's deal desk on Proteus AI](/docs/negotiation.jpg "A negotiation with Kitbox, our labelled demo seller on Arc testnet. Every offer on the right came from the seller's rules.")

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

It is a fair worry. Models want to be helpful, and "can you do a bit better?" works on helpful things. So we took the decision away from the model completely. The floor lives in code, not in a prompt. The reply is checked for invented numbers. Big deals wait for a human. And every refusal gives the same public reason, which we only got right after our own audit found a leak on November 11. I wrote that story up in [How to let an AI negotiate without giving away your margin](/blog/ai-negotiation-without-losing-margin).

> The model proposes. The seller's policy decides. The signed agreement controls the money.

## Who it is for

Anyone who sells by quote, volume or usage:

- **Print, merch and custom goods.** Quantities, artwork and delivery dates change every order.
- **Service businesses.** Bookings, receptionists, after-hours requests, billed per handled request.
- **API, data and AI providers.** Volume plans, pay per call, prepaid credit that should be refundable.
- **Agencies and back-office services.** Scoped work, partial delivery, milestones.

And a buyer most businesses are not ready for yet: other people's AI agents. A deal desk with an API can sell to them the same way it sells to a person. More on that in [How AI agents can buy safely](/blog/how-ai-agents-buy-safely).

## What it looks like with a real business

The first business live on Proteus AI on Arc mainnet is a custom merch studio. On November 7, one of its customers asked the studio's deal desk for a single custom tee, accepted the offer, and funded it in USDC without paying gas. On November 11 the studio delivered, the customer confirmed, and the escrow paid the studio 6.60 USDC in one transaction. The customer then rated the studio 5 stars on chain (that rating was made before our [link checks](/docs/ratings) existed, and we say so publicly).

It is one order. It is also the first time the whole loop ran with someone else's money, and every step is a public transaction anyone can check.

## If you want to try it

- Sell: [the seller quickstart](/docs/quickstart-seller) takes about five minutes.
- Buy: [buy from a deal desk](/docs/quickstart-buyer).
- Build: [for AI agents](/docs/for-agents) and [llms.txt](/llms.txt).
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
    hero: { src: "/blog/covers/ai-negotiation-without-losing-margin.jpg", alt: "A product's enforced pricing policy (15% margin floor, 8% max discount, $500 approval threshold) beside a buyer's lowball counteroffer being refused" },
    takeaways: [
      "Never let the model pick a price. Compute offers in code from the seller's rules, and let the model only write the words around them.",
      "Check every number in the reply against the offers you computed. If anything else shows up, send a fixed reply instead.",
      "Give every price refusal the same public reason and cap counteroffers. Different reasons let a buyer find your floor in about 20 tries. We learned that from our own audit.",
      "Keep costs and margins out of the model's context entirely, and send big deals to a person.",
    ],
    body: `
## The question every seller asks first

If you run a business, the first thing you should ask about Proteus AI is not about features. It is: "So the AI is going to negotiate with my customers. What stops it from giving my margin away?"

That is the right question. A model wants to be helpful. A buyer says "come on, can you do a bit better?" and helpful things say yes. If the model is the one deciding the price, you will lose money, slowly, one nice conversation at a time.

So the answer is not a better prompt. The answer is that the model never decides a number.

## Seven guardrails, and why each one exists

### 1. Prices come from code

The seller sets the rules once: cost per unit, margin floor, maximum discount, minimum order, capacity, and an approval threshold. A pricing engine, which is ordinary open code, turns the buyer's request into a short list of offers that pass every rule. The model is never asked what to charge.

![The agent policies page on Proteus AI](/docs/policies.jpg "The rules each product's agent has to obey, shown on Kitbox's seller console on Arc testnet.")

### 2. The model only writes the words

The model gets the buyer's message and the offers the buyer is allowed to see. That is it. It never sees your cost or your floor, which means it cannot leak them and cannot be argued below them.

### 3. A figure guard on every reply

Before a reply goes out, every price and quantity in it is compared with the numbers the engine produced. If the model wrote a number that is not on the list, we drop the reply and send a plain one built from the rules. Models are good writers and bad accountants. This makes that a non-issue.

### 4. One reason for every refusal

This one we got wrong at first, and I want to be honest about it.

On November 11 we ran a privacy audit on our own code. One finding: when a counteroffer was rejected, the reason text was different depending on which rule fired. Below the margin floor said one thing, past the discount cap said another. Our engine is deterministic, so a patient buyer could binary-search the floor in about 20 tries just by reading which message came back.

We fixed it the same day. Now every price rule returns the same public reason, on purpose. The comment in the code says it plainly: distinct texts would tell a buyer which private limit it hit.

### 5. A cap on counteroffers

Probing works by asking again and again. Since that same fix, a negotiation allows 12 counteroffers, and each IP address gets 40 per 10 minutes. A real buyer rarely needs more than a few.

### 6. A person approves the big ones

Above the threshold the seller sets, the offer is not sent. It waits for a human, and the agent tells the buyer the seller will confirm. Automation takes the many small deals. You keep the few that matter.

### 7. The rules are committed in public

Each version of a seller's pricing policy is committed on Arc as a salted hash, and every quote points at the version that produced it. Your numbers stay private. But anyone can check later that a quote came from rules you committed to at the time, and not from something we changed quietly.

## What the buyer sees, and what they never do

| The buyer can see | The buyer never sees |
|---|---|
| Offers, units, totals, inclusions | Your cost and margin floor |
| One public reason for a refusal | Which rule said no |
| Your list prices and products | Your discount cap and approval threshold |

If they ask for something you do not sell, the agent points them at the right product instead of making something up.

## Three things sellers ask after that

**Can it still sell?** Yes. It can explain value, suggest a bigger tier, offer a sample. It just cannot move the numbers.

**What if the model makes a mistake anyway?** The figure guard catches invented numbers, and the buyer still has to sign terms that show the exact price before any money moves. A typo in a chat cannot become a contract.

**What about my data?** Costs, margins and policy never go to the model. Emails and phone numbers typed into the chat are removed before every model call. The details are on our [privacy page](/docs/privacy).

## Try it on yourself

Set up a product and its rules in the [seller quickstart](/docs/quickstart-seller), then go and haggle with your own agent on the [market](/app/market). Try to get it below your floor. That is the fastest way to trust it. The full rules are under [Pricing](/docs/pricing).
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
    hero: { src: "/blog/covers/usdc-escrow-pay-on-delivery.jpg", alt: "A settled deal on Arc mainnet: $6.60 deposited and $6.60 paid to the seller after the buyer countersigned delivery" },
    takeaways: [
      "Escrow fixes the oldest problem in custom orders: who goes first. The buyer commits the money up front, and the seller is paid only for what the buyer confirms arrived.",
      "With USDC on Arc, the same escrow works for a business in any country, settles in seconds and charges gas in USDC.",
      "Anything not delivered by the end of the term can go back to the buyer, and nobody, including us, can pause that refund.",
      "Buyers can fund from 25 chains through Circle CCTP and pay no gas, because a relayer submits the transaction for them.",
    ],
    body: `
## Somebody always has to go first

Every order that is not a checkout button has the same problem. Either the buyer pays first and hopes the seller delivers, or the seller ships first and hopes the buyer pays.

Small businesses live with this every day. It shows up as 50% deposits, invoices chased on WhatsApp, refunds that depend on goodwill, and disputes settled with screenshots.

**Escrow** fixes it by putting the money somewhere neither side controls alone. The buyer commits the full amount up front. The seller is paid as delivery is confirmed. Whatever was not delivered goes back.

## How it works on Proteus AI

1. **Both sides sign the same terms.** Units, price, term and the seller's payout address, signed by the buyer and by the seller as EIP-712 typed data. Neither side can change them after.
2. **The buyer funds the escrow.** The USDC moves into our DealEscrow contract on Arc. With a USDC permit the buyer signs once, and our relayer submits it and pays the gas.
3. **The seller delivers.** For an API, every call is metered. For physical goods, the seller records each delivered batch with a note and, if they want, a proof link.
4. **The buyer countersigns.** The buyer signs the total delivered so far. Nothing moves without this signature.
5. **The escrow pays the seller.** DealEscrow checks the buyer's acceptance against the seller's signed delivery record and pays the difference since the last settlement, straight to the seller's own wallet.
6. **The rest can go back.** After the term plus a grace period (3 days by default), or as soon as the seller closes early, the unspent balance is refundable to the buyer. Anyone can trigger it, and it cannot be paused.

![A deal page on Proteus AI with balances read from the escrow contract](/docs/deal.jpg "A settled sample deal on Arc testnet: deposit, settled and remaining read straight from DealEscrow, with the settlement transaction linked.")

## Why USDC, and why Arc

I did not pick these because they are fashionable. I picked them for the businesses we wanted to serve first.

- **One currency for every country.** A studio and its customer should not have to agree on a bank or a currency. USDC is a dollar that moves like a message.
- **Fast and cheap.** Arc settles in seconds and charges gas in USDC, so nobody has to buy a second token just to pay.
- **Money from where it already is.** Circle CCTP brings native USDC to Arc from 25 chains. Our first real customer brought theirs from Solana. I wrote up how that went in [How to accept USDC from any chain](/blog/accept-usdc-from-any-chain).
- **Anyone can read it.** Balances, settlements and refunds are public. A buyer, a seller or an accountant can check them without asking us.

## What the escrow cannot do

I would rather you hear the limits from me.

- **It does not check delivery.** For physical goods the seller says what was delivered. The buyer's countersignature is the real check. If they disagree, they do not sign, and they can open a dispute.
- **Disputes have one arbiter, and it is us for now.** A dispute freezes the deal, and the arbiter can only split the unspent balance between buyer and seller. It cannot take money for itself, and it cannot touch payments the buyer already confirmed. No live deal has been disputed yet.
- **The owner's power is narrow.** The contract owner can pause new deals and set the arbiter. Settlement and refunds cannot be paused, and there is no function that sweeps funds.

## A real order, start to finish

On November 7, a customer of a custom merch studio bridged USDC from Solana, agreed one custom tee for $6.60 with the studio's deal desk, and funded the escrow without paying gas. I was on a call with them while they did it.

On November 11 the studio delivered, the customer countersigned, and the escrow paid the studio 6.60 USDC in a single transaction. If you call balances on DealEscrow for that deal today you get 6.60 deposited, 6.60 settled, nothing refunded, nothing left.

| Step | Who acts | What happens on chain |
|---|---|---|
| Terms signed | Buyer and seller | Terms hash recorded with the funding |
| Escrow funded | Relayer, for the buyer | USDC into DealEscrow |
| Delivery recorded | Seller | Signed receipt |
| Delivery accepted | Buyer | Settlement transaction |
| Seller paid | DealEscrow | USDC to the seller's wallet |

## Read the details

- [How the money moves](/docs/money-path), step by step.
- [Signatures](/docs/signatures): exactly what each side signs.
- [Verify it yourself](/docs/verify): every contract and transaction we cite.
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
    hero: { src: "/blog/covers/how-ai-agents-buy-safely.jpg", alt: "Claude's tool calls through the Proteus MCP server, from negotiating and declining to verifying, funding and settling, within a 13 USDC spending mandate" },
    takeaways: [
      "A buying agent needs three things before anyone lets it spend: a budget it cannot exceed, a way to verify the seller, and a payment that waits for delivery.",
      "On Proteus AI the budget is a spending mandate enforced by the MCP server, and the seller check reads the seller's ERC-8004 identity and committed policy on Arc.",
      "In a recorded run, Claude negotiated, refused a deal whose date did not fit, bought a sample inside a 13 USDC budget, and settled only after checking the delivery record.",
      "Claude itself pointed out that it checked a record, not a photo or a tracking number. That is the honest limit of agents today.",
    ],
    body: `
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

![The deal page for the settled sample on Arc testnet](/docs/deal.jpg "The sample deal after settlement: deposit, settled and remaining read from DealEscrow.")

## The three things a buying agent needs

### A budget it cannot exceed

The owner sets a **spending mandate**: the largest prepaid amount the agent may commit to one deal. The MCP server enforces it before it signs anything. I want to be precise here: it caps the amount per deal. Which service to buy and what unit price is acceptable are still the agent's judgement, so say them in the task.

### A way to check the seller

Before signing, the agent runs four checks against public data on Arc:

1. The terms hash matches the public terms it was shown.
2. The signer in the terms is the signer registered in the seller's ERC-8004 identity.
3. The payout address in the terms is the payee registered in that identity.
4. The pricing policy behind the quote is committed on ProteusPolicyRegistry.

If any of them fails, it does not sign. Someone pretending to be the seller cannot pass these without the seller's own wallet. I explain the identity side in [What is ERC-8004?](/blog/erc-8004-agent-identity).

### A payment that waits for delivery

The agent pays into escrow, not to the seller. The seller gets paid when the agent countersigns what was delivered. See [Get paid on delivery](/blog/usdc-escrow-pay-on-delivery).

![Offer review on Proteus AI](/docs/offer.jpg "The exact terms an agent, or a person, reviews before signing: units, price, term and the on-chain details.")

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
- Or use the HTTP API with the [agent buyer skill](/api/public/agents/skill.md).
- Everything an agent needs is also published as data: [llms.txt](/llms.txt) and [facts.json](/docs/facts.json), including what is proven and what is not.
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
    hero: { src: "/blog/covers/whatsapp-ai-sales-agent.jpg", alt: "Illustration of the WhatsApp flow with a demo seller: the agent says it is an AI, sends offers as buttons, then a pay link that works for 30 minutes" },
    takeaways: [
      "Let the chat negotiate, but never take money in it. Offers go out as buttons, then a 30-minute link to a signed checkout on the web.",
      "Say it is an AI in the first message, and give the customer HUMAN and STOP from the start.",
      "Treat a phone number as personal data. Buyers are a one-way pseudonym, and the AI model never sees the number.",
      "Check every webhook signature before reading anything, and be honest that WhatsApp Business chats are visible to Meta.",
    ],
    body: `
## Why we built this at all

I did not plan a WhatsApp channel. The first real business on Proteus AI made the decision for me.

Their whole business runs on WhatsApp. Quotes, haggling, photos of samples, "is it ready yet?", all in one chat thread. Our deal desk lived on a web page they would have to send customers to, and that is exactly where the buying was not happening.

So the same deal desk, under the same rules, now answers on a seller's WhatsApp Business number through Meta's official Cloud API. Building it meant deciding, line by line, what an AI should and should not do inside someone's chat. These are the five rules we ended up with.

## Rule 1: the chat negotiates, it never takes money

Offers arrive as tap-to-accept buttons. Accepting sends a pay link that works for 30 minutes. Signing the terms and paying in USDC happen on the web, never inside the chat.

Payments inside a chat are easy to fake. A screenshot is not a receipt. A signed checkout on Arc leaves a record both sides can check, and the money waits in escrow until the order arrives.

![The WhatsApp flow on Proteus AI, step by step](/blog/whatsapp-chat.jpg "Illustration with our demo seller. Every message from the business is the exact text our server sends.")

## Rule 2: the customer always knows it is an AI

The very first reply says it: "Hi, I am Kitbox's AI sales agent. My prices come from Kitbox's own rules. Reply HUMAN to reach the team, or STOP to stop messages."

- **HUMAN** pauses the agent and alerts the seller's team, and their replies come back into the same chat.
- **STOP** opts the customer out immediately. We made sure it is never rate limited, even when everything else is.
- **START** opts back in.

This is also how Meta wants it. AI on WhatsApp is allowed when it is one business's assistant, not a general chatbot.

## Rule 3: a phone number is not a profile

A WhatsApp number is personal data, and a sales tool does not need to see it.

- Each buyer is known by a one-way pseudonym derived from Meta's user id.
- The id we need to reply is encrypted with the seller's own key.
- The seller's console never shows the buyer's number, and the AI model never receives it.
- Emails and phone numbers typed into the chat are stripped out before every model call.

## Rule 4: nothing is trusted until it is checked

Every webhook from Meta is checked against its HMAC signature over the raw body before we read a single field. Unsigned or wrongly signed calls get a 401. Bodies over 1 MB are refused, each message is handled once, and there are limits per buyer and per seller so nobody can run up AI costs. STOP still always goes through.

A smaller, very real lesson from the day we launched it: when you copy a phone number id and token from Meta's dashboard, invisible characters can come along and break the connection, even though the strings look identical on screen. We now strip those characters before connecting, and verify the token with Meta first.

## Rule 5: be honest about what WhatsApp sees

WhatsApp Business chats are not end-to-end encrypted to the business the way personal chats are. Meta's Cloud API decrypts them and keeps messages for up to 30 days. Our [privacy page](/docs/privacy) says so plainly. We would rather you know than assume. It is also why costs, margins and pricing rules never go into the chat at all.

## Where it stands today

The WhatsApp channel is built and deployed on Arc mainnet and testnet. A number is connected, and Meta's webhook reaches our server and passes the signature checks. It is in testing. The next step is the first real conversation on someone's phone, then a business connecting its own number.

| Question | Answer |
|---|---|
| Does payment happen in the chat? | No. A 30-minute link opens a signed checkout on the web. |
| Does the business see my number? | No. Buyers are a pseudonym in the seller's console. |
| Does the AI see my number? | No, and numbers or emails typed in are removed first. |
| Can I reach a person? | Yes. Type HUMAN. |
| Can I stop the messages? | Yes. Type STOP at any time. |

## Read more

- [Privacy on Proteus AI](/docs/privacy), including WhatsApp.
- [What is an AI deal desk?](/blog/what-is-an-ai-deal-desk)
- [Front desk, orders and inbox](/docs/front-desk), for businesses whose customers talk to them.
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
  {
    slug: "erc-8004-agent-identity",
    title: "What is ERC-8004? Verifiable identity for AI agents that sell",
    description: "ERC-8004 gives an AI agent an on-chain identity: who owns it, where it gets paid and which key signs for it. Here is how sellers use it and how buyers check it.",
    date: "2026-11-05",
    author: AUTHOR,
    tags: ["ERC-8004", "Agent identity", "Arc"],
    hero: { src: "/blog/covers/erc-8004-agent-identity.jpg", alt: "A demo seller's ERC-8004 identity on Arc beside the four checks a buyer runs before signing" },
    takeaways: [
      "ERC-8004 is a proposed standard for AI agent identity: an identity registry, plus registries for reputation and validation.",
      "On Arc, a seller registers its agent from its own wallet in one transaction and publishes where it gets paid (payee) and which key signs its deals (signer).",
      "A buyer, or the buyer's agent, checks that the signer and payee in the terms match that identity before paying. Someone pretending to be the seller cannot pass without the seller's wallet.",
      "Identity tells you who you are dealing with. It does not tell you they will deliver. That is what escrow is for.",
    ],
    body: `
## The problem I ran into first

When we started letting AI agents buy from sellers on Proteus AI, I hit a question I did not have a good answer to: how does an agent know it is paying the real business?

People lean on signals built for people. A domain they recognise, a padlock, a few reviews, a logo they have seen before. An agent cannot use most of that. And when the seller is also an agent, anyone can spin one up with the same name, the same logo and a different payout address.

The question an agent needs to answer before it pays is simple. **Is this really the business it says it is, and is the money going to that business?** ERC-8004 lets it answer that from public data instead of from a sales page.

## What ERC-8004 is

ERC-8004, "Trustless Agents", is a proposed Ethereum standard for finding and trusting AI agents. It defines three registries:

- **Identity:** each agent gets an on-chain identity, owned by a wallet, with metadata the owner publishes.
- **Reputation:** clients can leave feedback about an agent. The registry rejects feedback from the agent's own owner or operators.
- **Validation:** for independent checks of an agent's work.

Arc runs these registries on mainnet and testnet. The identity registry is at \`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\` on Arc mainnet and \`0x8004A818BFB912233c491871b3d84c89A494BD9e\` on testnet. The full proposal is on [Ethereum EIPs](https://eips.ethereum.org/EIPS/eip-8004).

## How a seller registers on Proteus AI

1. **The seller's own wallet registers the agent.** One transaction on Arc's identity registry, signed by the seller, not by us. The seller owns the identity.
2. **It publishes a payee and a signer.** The payee is the wallet that receives payouts. The signer is the key that signs the seller's deal terms and delivery records.
3. **Every pricing policy is committed.** The signer commits a salted hash of each policy version to ProteusPolicyRegistry. The numbers stay private, but the commitment is public and dated.

One thing I want to be upfront about: on Proteus AI the seller's signer key is held encrypted by us, so the deal desk can sign offers while the seller is asleep. The payee is the seller's own wallet, and settlement pays it directly. Payouts never pass through a Proteus wallet.

## How a buyer checks a seller

![An ERC-8004 identity and the four checks](/blog/erc-8004-identity.jpg "Our demo seller Kitbox: its identity on Arc testnet, and the checks a buyer runs against it.")

| Check | What it compares | What it stops |
|---|---|---|
| Terms hash | The hash in the signed terms vs. the public terms shown | Terms changed after you read them |
| Signer | The signer in the terms vs. the signer in the seller's identity | A copycat signing as the seller |
| Payee | The payout address in the terms vs. the registered payee | Money going to the wrong wallet |
| Policy | The quote's policy version vs. ProteusPolicyRegistry | Prices from rules the seller never committed |

If any check fails, the agent does not sign. On Proteus AI this is one MCP tool, \`proteus_verify_seller\`.

> Identity answers "who is this?". Escrow answers "what if they do not deliver?". You need both.

## Registrations you can check yourself

- **A real business on Arc mainnet.** On October 24, 2026, a custom merch studio registered its selling agent from its own wallet as Agent #2695. Here is the [registration transaction](https://explorer.arc.io/tx/0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55).
- **Our demo seller on Arc testnet.** Kitbox is Agent #897439 ([registration](https://explorer.testnet.arc.io/tx/0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f)). Claude ran all four checks against it before buying a sample. That story is in [How AI agents can buy safely](/blog/how-ai-agents-buy-safely).

## What identity does not prove

- **It does not prove delivery.** A registered seller can still fail to ship. That is why the buyer pays into escrow and the seller is paid for what the buyer countersigns. See [Get paid on delivery](/blog/usdc-escrow-pay-on-delivery).
- **It does not prove the business is good.** It proves it is the same seller every time. Reputation and your own judgement do the rest.
- **It is only as safe as the seller's wallet.** Whoever holds the wallet that owns the identity controls it.

## Get started

- Sellers: the [seller quickstart](/docs/quickstart-seller) walks you through the one registration transaction from your own wallet.
- Agents: [Buy with an AI agent](/docs/quickstart-agent) shows the checks in order.
- Everyone: [Verify it yourself](/docs/verify) lists every contract and transaction.
`,
    faq: [
      { q: "What is ERC-8004?", a: "ERC-8004, Trustless Agents, is a proposed Ethereum standard that gives AI agents an on-chain identity, with registries for identity, reputation and validation." },
      { q: "How does a seller get an ERC-8004 identity on Arc?", a: "On Proteus AI the seller's own wallet sends one transaction to Arc's identity registry and publishes its payee and signer. The seller, not Proteus, owns the identity." },
      { q: "How can an AI agent verify a seller?", a: "It checks that the signer and payout address in the terms match the seller's ERC-8004 identity, that the terms hash matches what it was shown, and that the pricing policy is committed on chain." },
      { q: "Does an ERC-8004 identity prove a seller will deliver?", a: "No. It proves who the seller is and where the money goes. Escrow, where the seller is paid only for countersigned delivery, covers the delivery risk." },
      { q: "Who holds the seller's signing key on Proteus AI?", a: "The seller's signer key is held encrypted by Proteus so the deal desk can sign offers around the clock. Payouts go to the seller's own payee wallet." },
    ],
    related: ["how-ai-agents-buy-safely", "usdc-escrow-pay-on-delivery", "what-is-an-ai-deal-desk"],
  },

  {
    slug: "accept-usdc-from-any-chain",
    title: "How to accept USDC from any chain: Circle CCTP into Arc",
    description: "Your customers hold USDC on Solana, Base or Ethereum. Here is how Circle CCTP brings it to Arc as native USDC, so they can pay you without a wrapped token or a bridge they have to trust.",
    date: "2026-11-07",
    author: AUTHOR,
    tags: ["USDC", "Circle CCTP", "Cross-chain"],
    hero: { src: "/blog/covers/accept-usdc-from-any-chain.jpg", alt: "USDC from 25 chains, including Solana, Ethereum and Base, burned at the source and minted as native USDC on Arc through Circle CCTP" },
    takeaways: [
      "Your customers almost never hold USDC on the chain you settle on. Circle CCTP moves it by burning it on their chain and minting the same amount of native USDC on Arc.",
      "Proteus AI brings USDC into Arc from 25 chains, Solana included, straight to the buyer's account wallet, and sends it back out to 19.",
      "There is no wrapped token and no pool in the middle. What arrives is the same USDC every Arc app accepts.",
      "On November 7, 2026, our first real customer bridged from Solana and funded an order the same day. We shipped six fixes to the bridge that day too.",
    ],
    body: `
## The day the bridge met a real customer

On November 7, the first customer of the first real business on Proteus AI tried to pay. Their USDC was on Solana. Our escrow is on Arc.

That day the bridge was used by someone who just wanted to buy a tee. Here is what we shipped to it that same day, straight from the git log:

- Phantom kept opening when people wanted MetaMask, so we added a proper wallet picker.
- The public Solana RPC refuses requests from browsers, so we added a relay on our own domain.
- We added a check that the Solana wallet has enough SOL for the network fee before it signs, instead of failing halfway.
- Errors now show the real reason, not a generic "something went wrong".
- If a burn has already been sent, you can resume instead of starting over.
- And bridging now works both ways: out of Arc to the 19 chains Circle's Forwarder mints on.

The customer's USDC landed on Arc ([the mint](https://explorer.arc.io/tx/0x3e7f549108d377aa340c8a2d93b75322ac4a7454d4f54f2011d4b22357460862)), and they funded their order in escrow the same day without paying any gas.

That is the whole lesson of this post, really. Your customer's money is on some other chain. Getting it to you has to be boring.

## How CCTP works, in plain words

CCTP is Circle's Cross-Chain Transfer Protocol. It does not lock your tokens in a pool and hand you an IOU. It **burns** USDC on the source chain and **mints** the same amount on the destination, after Circle confirms the burn happened.

1. **Burn.** The customer signs one transaction on their chain. It burns their USDC and names the wallet on Arc that should receive it.
2. **Attest.** Circle sees the burn and signs an attestation.
3. **Mint.** That attestation is presented on Arc, and native USDC is minted to the customer's wallet.

Because Circle's own contracts mint it, the USDC on Arc is the real thing. Nothing to unwrap later. No pool that can run dry.

## What it looks like in the app

![The Proteus AI deposit panel, bridging USDC into Arc](/blog/bridge.jpg "The real deposit panel on Arc testnet. Left: from Ethereum to the buyer's Arc wallet. Right: picking the source chain from 25.")

The buyer picks the chain their USDC is on, enters an amount, and signs once in their own wallet. The panel shows where the money will land (their account wallet on Arc), roughly how long it takes, and that no Arc gas is needed. The small print under the button is the whole design: native USDC, burned there, minted here, nothing wrapped.

## What we built around it

- **25 chains in.** Through Circle's Bridge Kit, buyers bring USDC into Arc from 25 chains, Solana included, straight to the wallet tied to their account.
- **19 chains out.** Sellers and buyers can move USDC back out of Arc. That direction is tested on Arc testnet to Base and Solana. It has not run on mainnet yet.
- **Then no gas at all.** Arc charges gas in USDC. When a buyer funds a deal, they sign a permit and our relayer submits it, so they never need a second token on Arc.

## What the customer actually pays

- **The source chain's network fee,** in that chain's own token. SOL on Solana, for example.
- **Any fee Circle charges for the transfer.** That is Circle's, not ours.
- **Nothing to Proteus AI** for bridging. And no gas when funding a deal, because during the pilot we pay it.

## The two real mints on mainnet

| Who | From | To | Proof |
|---|---|---|---|
| The merch studio, for its own wallet | Solana | Arc mainnet | [mint](https://explorer.arc.io/tx/0x7357c72f92224eafbfed0c664e7b346966ca175bcd835d95ae09eb76165fe7a5) |
| Its first customer | Solana | Arc mainnet | [mint](https://explorer.arc.io/tx/0x3e7f549108d377aa340c8a2d93b75322ac4a7454d4f54f2011d4b22357460862) |

## Next steps

- [How the money moves](/docs/money-path), from bridge to settlement.
- [Get paid on delivery with USDC escrow](/blog/usdc-escrow-pay-on-delivery), which is what happens right after the bridge.
- [Verify it yourself](/docs/verify): every mainnet transaction we cite.
`,
    faq: [
      { q: "What is Circle CCTP?", a: "Circle's Cross-Chain Transfer Protocol moves USDC between chains by burning it on the source chain and minting the same amount of native USDC on the destination, after Circle attests the burn." },
      { q: "Is USDC bridged with CCTP a wrapped token?", a: "No. It is native USDC minted by Circle's contracts on the destination chain, the same asset as any other USDC there." },
      { q: "Which chains can customers pay from on Proteus AI?", a: "USDC comes into Arc from 25 chains through CCTP, including Solana, Ethereum and Base. Sending out of Arc reaches the 19 chains Circle's Forwarder mints on." },
      { q: "What fees does the customer pay to bridge?", a: "The source chain's network fee in its own token, such as SOL on Solana, plus any fee Circle charges for the transfer. Proteus AI charges nothing for bridging." },
      { q: "Do buyers need gas on Arc after bridging?", a: "No. Arc charges gas in USDC, and when a buyer funds a deal on Proteus AI a relayer submits the transaction and pays the gas." },
    ],
    related: ["usdc-escrow-pay-on-delivery", "what-is-an-ai-deal-desk", "erc-8004-agent-identity"],
  },

  {
    slug: "usage-based-pricing-for-apis",
    title: "Usage-based pricing for APIs and AI services: prepaid, metered and refundable",
    description: "How to sell an API or AI service by usage without chasing invoices: a prepaid balance in escrow, every call metered with a signed receipt, and unused credit refundable.",
    date: "2026-11-09",
    author: AUTHOR,
    tags: ["Usage-based pricing", "API monetization", "x402"],
    hero: { src: "/blog/covers/usage-based-pricing-for-apis.jpg", alt: "A seller's usage page: one request delivered and billed with a signed receipt, nothing billed for failed or handed-off requests" },
    takeaways: [
      "Usage pricing is fair to buyers and painful to collect. A prepaid balance held in escrow flips that: the money exists before the first call, and unused credit can go back.",
      "On Proteus AI every delivered call returns a signed receipt. Failed calls and calls handed to a person are never billed, and retrying the same request id never charges twice.",
      "The buyer countersigns usage against the receipts, and the escrow pays the seller for exactly that.",
      "For one-off calls with no deal, x402 lets a client pay per request in USDC. That works on Arc testnet today, with no refund path.",
    ],
    body: `
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
3. **Call the service.** Each call goes to \`POST /api/services/{product}/execute\` with that key and a \`requestId\`. Send the same \`requestId\` again and you are not charged twice.
4. **Get a receipt.** The seller's signer signs a receipt for every delivered result. Calls that fail, or that get handed to a person, are recorded but never billed.
5. **Countersign.** \`GET /api/deals/{id}/usage\` returns the receipts and the acceptance to sign. The buyer, or its agent, checks the count and the price, then signs.
6. **Get paid.** DealEscrow pays the seller for everything newly accepted since the last settlement.
7. **Get the rest back.** After the term plus a grace period (3 days by default), whatever was not used is refundable to the buyer.

![The seller's usage and delivery page](/docs/seller-usage.jpg "Kitbox's usage page on Arc testnet: one request delivered and billed, with the signed receipt behind it. Failed and handed-off calls show as never billed.")

That screenshot is from the sample Claude bought in our agent test: one request, one delivered result, one signed receipt, $12.50 charged. Small, but every number on it can be checked against the escrow.

## Pay per call with x402

Some buyers do not want a plan. They want one answer, now. For them we support x402: the client calls \`POST /api/pay/{seller}/{product}/execute\`, gets an HTTP 402 back with the payment options, pays in USDC, and gets the result.

- **Exact payments** go through Circle's facilitator, one per call.
- **Circle Gateway batching** turns each call into a signature instead of a transfer, and settles them in batches.

Both have run on Arc testnet. One difference matters: x402 is paid when the call is made, outside escrow, so there is no refund. For anything more than a handful of calls, a prepaid deal is the better deal for the buyer, and I will tell them that.

## Who this is for

- **AI and API companies** selling inference, embeddings, data or tools by volume.
- **Back-office services** priced per document, per invoice or per handled request.
- **Agents buying from agents,** where nobody reads invoices but anyone can check a receipt.

## Get started

- [Sell on Proteus AI](/docs/quickstart-seller) and point a product at your endpoint.
- [For AI agents](/docs/for-agents): every route above, with request and response shapes.
- [How the money moves](/docs/money-path), including grace periods and refunds.
`,
    faq: [
      { q: "What is usage-based pricing for an API?", a: "Charging buyers for what they actually use, such as calls, documents or tokens, instead of a flat subscription." },
      { q: "How do you get paid for API usage without invoices?", a: "Have the buyer prepay into escrow. On Proteus AI each delivered call gets a signed receipt, the buyer countersigns usage, and the escrow pays the seller for exactly that." },
      { q: "What happens to unused prepaid credit?", a: "On Proteus AI the unspent balance is refundable to the buyer after the term plus a grace period, three days by default, or as soon as the seller closes early." },
      { q: "Are failed API calls billed?", a: "No. Only delivered results are billable. Failed or handed-off requests are recorded without a charge, and retrying the same requestId never bills twice." },
      { q: "What is x402?", a: "x402 is a protocol where a server answers HTTP 402 with payment options and the client pays per request in USDC. On Proteus AI it works through Circle's facilitator or Circle Gateway batching, proven on Arc testnet." },
    ],
    related: ["how-ai-agents-buy-safely", "usdc-escrow-pay-on-delivery", "accept-usdc-from-any-chain"],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

/** Reading time at 220 words a minute. */
export const readMinutes = (p: Post) => Math.max(3, Math.round((p.body.split(/\s+/).length + p.takeaways.join(" ").split(/\s+/).length) / 220));
