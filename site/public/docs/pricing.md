# How offers are priced · Proteus AI docs

Source: <https://app.proteus.co.in/docs/pricing> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Code decides the price; the model only writes the words._

For sellers setting rules and buyers wondering how an offer was made. You will learn how candidates are built from tiers, which rules every offer must pass, what happens to counteroffers and large orders, and what the model may and may not do.

_Diagram: From a buyer's message to the offers on screen. Only the green box reaches the buyer as a price._

The buyer's message is read by Claude Haiku into fields (units, budget, integrations). The pricing engine, which is code, builds candidates from the seller's tiers and checks each against the seller's rules. A candidate that passes is an offer; one above the approval threshold waits for the seller; one that breaks a rule is refused with a public reason. Claude Sonnet writes the reply from the offers only, and a figure check replaces any reply with an unlisted figure by a fixed reply before the buyer sees it.

### Where offers come from

- Every tier at its list price.
- The units the buyer asked for, at the price of the largest tier that quantity qualifies for.
- A budget fit: the most units the buyer's budget buys at the best tier it qualifies for, rounded down to a step of 100 when it is 100 or more.
- Offers that pass come first, then those that need approval; within each, the one sized to the request comes first ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L251)).

### The rules every offer must pass

| Rule | Breaks when | Result |
|---|---|---|
| Margin floor | The expected contribution margin is below the seller's floor | Refused |
| Positive contribution | The offer would not cover its cost (unless the product is labelled as a test) | Refused |
| Discount cap | The unit price is further below list than the cap allows | Refused |
| Minimum prepaid | The prepaid total is below the seller's minimum | Refused |
| Capacity | More units than the seller can still commit this period | Refused |
| Units per deal | More units than the product's maximum for one agreement | Refused |
| Fresh cost model | The seller's cost inputs are past their fresh-until date | Refused |
| Approval threshold | The prepaid total is above the threshold | Waits for the seller |
| Integrations | A requested integration is not supported | Offered, with it excluded from the terms |

_The price rules (floor, contribution, discount, minimum) share one public reason, so a buyer cannot tell which private limit it hit ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L196))._

### Counteroffers

A buyer can propose a total for the same units, or more units for the same total (`POST /api/negotiations/{id}/counter`). The engine evaluates it like any candidate: within the rules, the agent agrees and the offer can be accepted at once; above the approval threshold, it goes to the seller; otherwise it is refused with the public reason and, when one exists, the most the budget buys. A negotiation allows 12 counters, and each IP 40 per 10 minutes.

### What the model may do

- **Read the request.** Claude Haiku turns the conversation into fields: units, budget, integrations, open questions.
- **Write the words.** Claude Sonnet writes the reply from the public offers, the product's public terms and the seller's other products. It never sees costs, floors or the policy.
- **Figure check.** A reply carrying a dollar amount or a number of four or more digits that is not in the offers is replaced by a fixed reply ([anthropic.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/agent/anthropic.ts#L94)). Smaller numbers and numbers in words are not caught, but the price never comes from the reply.
- **Injection attempts.** Buyer text that tries to override the policy is logged as blocked and evaluated normally; prices do not change.
- **Whole catalog.** The agent can point the buyer to the seller's product that fits better, with its list price, without making an offer on it.
- **No model, still priced.** Without a model key, replies are rule-based; the offers are the same because they never came from the model.

### Policy commitments on Arc

For sellers registered on Arc, each policy version is committed as a salted hash to ProteusPolicyRegistry, and every quote names the version it used. A commitment proves what was published and when, not how the engine ran. List them with `GET /api/public/sellers/{seller}/policies`, each with its transaction.
