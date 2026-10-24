# What Proteus AI is · Proteus AI docs

Source: <https://app.proteus.co.in/docs/overview> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_A deal desk for anything sold by quote, volume or usage. The seller's agent negotiates with people and their AI agents inside rules the seller sets, both sides sign the same terms, and USDC waits in escrow on Arc until delivery: the seller is paid for what was delivered and the rest goes back to the buyer._

- **The seller sets the rules.** Cost, margin floor, maximum discount, minimum order, capacity, and the order size it approves itself.
- **An agent does the selling.** It answers buyers and their AI agents in seconds; offers come only from those rules ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L198)).
- **Both sides sign identical terms.** EIP-712 terms, checked on chain by [DealEscrow](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol).
- **Money waits in escrow on Arc.** USDC moves only against the signatures in the agreement.
- **Paid per delivered unit.** The seller is paid for each unit the buyer countersigns; the rest becomes refundable.
- **Verifiable by anyone.** The seller's identity is an ERC-8004 agent on Arc and its pricing policy is committed to [ProteusPolicyRegistry](https://github.com/Adityaakr/proteus/blob/main/contracts/src/ProteusPolicyRegistry.sol); every payment is an Arc transaction.

> The model proposes. The seller's policy decides. The signed agreement controls the money.

### Who it is for

- **Merch and corporate gifting.** "20 boxes, our logo, Mumbai by Oct 31, price per box?" Answered in seconds instead of by hand. Live: [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e).
- **Inference and GPU hours.** Prepay a block of capacity; pay only for the hours or tokens actually served.
- **Data and API access.** Volume tiers and per-call pricing, negotiated by the buyer's agent, settled per call or per batch.
- **Services sold by invoice.** Quotes, deposits and milestones become one signed agreement instead of an email thread.
- **Voice and per-minute services.** Prepay a bundle of minutes or sessions; the seller is paid for what was used, the rest is refundable.
- **Agents buying from agents.** A buyer's agent negotiates, checks the seller on chain and funds within a mandate its owner set.

### One deal, start to finish

1. **A buyer asks.** "20 merch boxes with our logo, delivered by Oct 31. Best price per box?"
2. **The agent offers.** Inside the seller's rules: a price per box, a delivery term and a refund window. It never quotes below the margin floor.
3. **Both sign.** Buyer and seller sign the same EIP-712 terms: units, unit price, term, payee.
4. **The buyer funds.** USDC goes into DealEscrow on Arc, not to the seller. A relayer pays the gas.
5. **The seller delivers.** It records what was delivered; the buyer countersigns the units it received.
6. **The money settles.** The seller is paid for countersigned units. The rest is refundable to the buyer after the term plus a 3-day grace.

### What it does and does not do

| Proteus AI does | Proteus AI does not |
|---|---|
| Negotiate inside rules the seller wrote | Let the model invent a price below the seller's floor |
| Hold payment in a contract on Arc until delivery is signed | Hold buyer funds in a Proteus account |
| Pay the seller's own wallet, published in its Arc identity | Let anyone change where a seller is paid |
| Make unspent money refundable after the term | Refund automatically: the buyer (or anyone) calls the refund |
| Resolve disputes through an arbiter key, today held by Proteus | Offer a dispute timeout yet ([limits](https://app.proteus.co.in/docs/limits)) |

### Where it runs

| Network | App | Chain id | What is real |
|---|---|---|---|
| Arc mainnet | [app.proteus.co.in](https://app.proteus.co.in) | `5042` | Real USDC. One real business listed: [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e). |
| Arc testnet | [ai.proteus.co.in](https://ai.proteus.co.in) | `5042002` | Testnet USDC with no value. Example sellers and a demo merch seller. |

_DealEscrow is at the same address on both networks: `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`._

![The Proteus AI market on Arc mainnet, with Shoonya Store listed first](https://app.proteus.co.in/docs/market.jpg)
_The market: each seller with its Arc identity, links and services priced from the cheapest pack. (Arc mainnet)_

### Start here

- [Sell with Proteus](https://app.proteus.co.in/docs/quickstart-seller): publish products, register on Arc, go live in about 5 minutes
- [Buy from a seller](https://app.proteus.co.in/docs/quickstart-buyer): negotiate, sign, fund and settle
- [Connect an AI agent](https://app.proteus.co.in/docs/quickstart-agent): MCP tools with a per-deal mandate
- [See the deal lifecycle](https://app.proteus.co.in/docs/lifecycle): every state a deal goes through
- [Verify it yourself](https://app.proteus.co.in/docs/verify): contracts and transactions on Arc
