# How to let an AI negotiate for your business without giving away your margin

> Seven guardrails that let an AI agent negotiate prices for your business while your floor, costs and approval rules stay in your control.

Aditya, founder of Proteus AI · published 2026-11-11, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/ai-negotiation-without-losing-margin

## Key takeaways

- Never let the model pick a price. Compute offers in code from the seller's rules, and let the model only write the words around them.
- Check every number in the reply against the offers you computed. If anything else shows up, send a fixed reply instead.
- Give every price refusal the same public reason and cap counteroffers. Different reasons let a buyer find your floor in about 20 tries. We learned that from our own audit.
- Keep costs and margins out of the model's context entirely, and send big deals to a person.

## The question every seller asks first

If you run a business, the first thing you should ask about Proteus AI is not about features. It is: "So the AI is going to negotiate with my customers. What stops it from giving my margin away?"

That is the right question. A model wants to be helpful. A buyer says "come on, can you do a bit better?" and helpful things say yes. If the model is the one deciding the price, you will lose money, slowly, one nice conversation at a time.

So the answer is not a better prompt. The answer is that the model never decides a number.

## Seven guardrails, and why each one exists

### 1. Prices come from code

The seller sets the rules once: cost per unit, margin floor, maximum discount, minimum order, capacity, and an approval threshold. A pricing engine, which is ordinary open code, turns the buyer's request into a short list of offers that pass every rule. The model is never asked what to charge.

![The agent policies page on Proteus AI](https://app.proteus.co.in/docs/policies.jpg "The rules each product's agent has to obey, shown on Kitbox's seller console on Arc testnet.")

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

**What about my data?** Costs, margins and policy never go to the model. Emails and phone numbers typed into the chat are removed before every model call. The details are on our [privacy page](https://app.proteus.co.in/docs/privacy).

## Try it on yourself

Set up a product and its rules in the [seller quickstart](https://app.proteus.co.in/docs/quickstart-seller), then go and haggle with your own agent on the [market](https://app.proteus.co.in/app/market). Try to get it below your floor. That is the fastest way to trust it. The full rules are under [Pricing](https://app.proteus.co.in/docs/pricing).

## Frequently asked questions

### Can an AI negotiate prices without going below my floor?

Yes, if the floor is enforced in code. On Proteus AI offers are computed by a pricing engine from your rules and the model only writes the reply, so it cannot quote below the floor.

### What stops a buyer from probing for my lowest price?

Every price refusal returns the same public reason, and counteroffers are limited per negotiation and per IP address, so a buyer cannot learn which rule fired.

### Does the AI model see my costs?

No. Costs, margins and policy stay in the pricing engine. The model receives only the buyer's message and the offers the buyer is allowed to see.

### What happens with very large deals?

Above an approval threshold you set, the offer waits for a person. The agent tells the buyer the seller will confirm.
