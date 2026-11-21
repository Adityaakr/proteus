# How offers are priced · Proteus AI docs

Source: <https://app.proteus.co.in/docs/pricing> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Code decides the price; the model only writes the words._

For sellers setting their rules, and buyers wondering how an offer was made. You will learn how offers are built from your price tiers, which rules every offer must pass, what happens to counteroffers and large orders, and what the AI may and may not do.

_Diagram: From a buyer's message to the offers on screen. Only the green box reaches the buyer as a price._

The buyer's message is read by Claude Haiku into fields (units, budget, integrations, open questions). The pricing engine, which is code, builds candidates from the seller's tiers and checks each against the seller's rules. A candidate that passes is an offer; one above the approval threshold waits for the seller; one that breaks a rule is refused with a public reason. Claude Sonnet writes the reply from the offers only, and a figure check replaces any reply with an unlisted figure by a fixed reply before the buyer sees it.

<a id="pricing-candidates"></a>

### Where offers come from

- Every tier at its list price.
- The units the buyer asked for, at the price of the largest tier that quantity qualifies for.
- A budget fit: the most units the buyer's budget buys at the best tier it qualifies for, rounded down to a step of 100 when it is 100 or more.
- Offers that pass come first, then those that need approval; within each, the one sized to the request comes first ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L251)).

<a id="pricing-rules"></a>

### The rules every offer must pass

| Rule | Breaks when | Result |
|---|---|---|
| Margin floor | The expected contribution margin is below the seller's floor | Refused |
| Positive contribution | The offer would not cover its cost (unless the product is labelled as a test) | Refused |
| Discount cap | The unit price is further below list than the cap allows | Refused |
| Minimum prepaid | The prepaid total is below the seller's minimum | Refused |
| Capacity | More units than the capacity the seller set (it is not counted down as orders come in) | Refused |
| Units per deal | More units than the product's maximum for one agreement | Refused |
| Fresh cost model | The seller's cost inputs are past their fresh-until date | Refused |
| Approval threshold | The prepaid total is above the threshold | Waits for the seller |
| Integrations | A requested integration is not supported | Offered, with it excluded from the terms |

_The price rules (floor, contribution, discount, minimum) share one public reason, so a buyer cannot tell which private limit it hit ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L196))._

<a id="pricing-counter"></a>

### Counteroffers

A buyer can propose a total for the same units, or more units for the same total (`POST /api/negotiations/{id}/counter`). The engine evaluates it like any candidate: within the rules, the agent agrees and the offer can be accepted at once; above the approval threshold, the agent says it will go to the seller, and the seller is asked to approve once the buyer turns it into a quote; otherwise it is refused with the public reason and, when one exists, the most the budget buys. Each negotiation allows 12 counters and each IP 40 in every 10-minute window. That slows a search for the seller's floor rather than stopping it; the single public reason for all price rules is what hides which limit was hit.

<a id="pricing-example"></a>

### A worked example

A tee seller lists Starter (from 1 tee at $6.60) and Bulk (from 100 tees at $6.50). Its private rules: cost $3.00 per tee, margin floor 35%, discount cap 5%, minimum prepaid $5, approval above $500. A buyer writes "40 tees, budget $250".

| Candidate | Units × price | Prepaid | Result |
|---|---|---|---|
| The 40 tees asked for (Starter, the largest tier 40 qualifies for) | 40 × $6.60 | $264.00 | Offer, listed first |
| Budget fit: Bulk needs 100 tees, so Starter: $250 buys 37 | 37 × $6.60 | $244.20 | Offer |
| Starter tier as listed | 1 × $6.60 | $6.60 | Offer |
| Bulk tier as listed | 100 × $6.50 | $650.00 | Waits for the seller (above $500) |

_Every offer clears the 35% floor: at $6.60 a tee the margin is ($6.60 − $3.00) / $6.60 = 54.5%._

The buyer then counters "40 tees for $230", $5.75 a tee. That is 12.9% below the list price, over the 5% cap, so the agent refuses with the shared reason ("That price is outside what the seller can offer for this package.") and offers what $230 buys at list price: 34 tees for $224.40.

<a id="pricing-model"></a>

### What the model may do

- **Read the request.** Claude Haiku turns the conversation into fields: units, budget, integrations, open questions.
- **Write the words.** Claude Sonnet writes the reply from the public offers, the product's public terms and the seller's other products. It never sees costs, floors or the policy.
- **Figure check.** A reply carrying a dollar amount or a number of four or more digits that is not among the offers, the buyer's own budget or the seller's other products is replaced by a fixed reply ([anthropic.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/agent/anthropic.ts#L94)). Smaller numbers and numbers in words are not caught, but the price never comes from the reply.
- **Injection attempts.** Buyer text that tries to override the policy is logged as blocked and evaluated normally; prices do not change.
- **Whole catalog.** The agent can point the buyer to the seller's product that fits better, with its list price, without making an offer on it.
- **No model, still priced.** Without a model key, replies are rule-based; the offers are the same because they never came from the model.

<a id="pricing-commit"></a>

### Policy commitments on Arc

For sellers registered on Arc, each policy version is committed as a salted hash to ProteusPolicyRegistry, and every quote names the version it used. A commitment proves what was published and when, not how the engine ran. List them with `GET /api/public/sellers/{seller}/policies`, each with its transaction.
