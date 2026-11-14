# How to let an AI negotiate for your business without giving away your margin

> Seven guardrails that let an AI agent negotiate prices for your business while your floor, costs and approval rules stay in your control.

Proteus AI team · published 2026-11-11, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/ai-negotiation-without-losing-margin

## Key takeaways

- Never let the model choose a price. Compute offers in code from the seller's rules, and let the model only write the words.
- Check every figure in the reply against the computed offers, and fall back to a fixed reply if anything else appears.
- Give every price refusal the same public reason and limit counteroffers, so buyers cannot probe for your floor.
- Keep costs and margins out of the model's context entirely, and send big deals to a person.

## Why AI negotiation scares business owners

Letting software talk money with your customers sounds like a fast way to lose margin. A language model wants to be helpful, buyers are persuasive, and "can you do a bit better?" works on people, so why not on a model?

It works on models too, if the model is in charge of the price. The fix is architectural, not a better prompt: **the model never decides a number.**

## The seven guardrails

### 1. Prices come from code

The seller sets the rules once: cost per unit, margin floor, maximum discount, minimum order, capacity, and a threshold above which a person approves. A pricing engine turns a buyer's request into a short list of offers that satisfy every rule. On Proteus AI this engine is ordinary, open code in the domain package; the model is never asked what to charge.

![A negotiation on Proteus AI with offers computed from the seller's rules](https://app.proteus.co.in/docs/negotiation.jpg "What the buyer sees: offers with units, totals and inclusions. The seller's cost and floor never appear.")

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

**What about my data?** Costs, margins and policy never enter the model's context, and contact details are removed from the conversation before each model call. See our [privacy page](https://app.proteus.co.in/docs/privacy).

## Try it

Set up a product and its rules in the [seller quickstart](https://app.proteus.co.in/docs/quickstart-seller), then negotiate with your own agent on the [market](https://app.proteus.co.in/app/market). The full pricing rules are documented under [Pricing](https://app.proteus.co.in/docs/pricing).

## Frequently asked questions

### Can an AI negotiate prices without going below my floor?

Yes, if the floor is enforced in code. On Proteus AI offers are computed by a pricing engine from your rules and the model only writes the reply, so it cannot quote below the floor.

### What stops a buyer from probing for my lowest price?

Every price refusal returns the same public reason, and counteroffers are limited per negotiation and per IP address, so a buyer cannot learn which rule fired.

### Does the AI model see my costs?

No. Costs, margins and policy stay in the pricing engine. The model receives only the buyer's message and the offers the buyer is allowed to see.

### What happens with very large deals?

Above an approval threshold you set, the offer waits for a person. The agent tells the buyer the seller will confirm.
