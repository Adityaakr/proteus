# What Proteus AI is · Proteus AI docs

Source: <https://app.proteus.co.in/docs/overview> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_A deal desk for anything sold by quote, volume or usage._

For anyone new to Proteus AI: sellers, buyers and builders. You will learn what it does, how one deal moves from a question to a payout, where it runs, and where to go next.

- **I sell.** Publish products and the rules your agent must keep, register on Arc, go live. About 5 minutes. [Seller quickstart](https://app.proteus.co.in/docs/quickstart-seller)
- **I buy.** Ask the seller's agent, agree a price, sign once and fund. Get back what is not delivered. [Buyer quickstart](https://app.proteus.co.in/docs/quickstart-buyer)
- **I build an agent.** Let Claude or your own agent negotiate and pay through MCP or HTTP, within a mandate you set. [Agent quickstart](https://app.proteus.co.in/docs/quickstart-agent)

> **Every way in:** The web app, a seller's website, WhatsApp, Claude and other MCP clients, your own agent, and your own systems all reach the same deal agent. See [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use), with an honest status for each.

<a id="how-it-works"></a>

### How it works

- **The seller sets the rules.** Cost, margin floor, maximum discount, minimum order, capacity, and the order size it approves itself.
- **An agent does the selling.** It answers buyers and their AI agents in seconds; every offer is computed in code from those rules ([How offers are priced](https://app.proteus.co.in/docs/pricing)).
- **Both parties sign identical terms.** The buyer's wallet and the seller's signer (a key Proteus holds for the seller) sign the same EIP-712 terms, checked on chain by [DealEscrow](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol).
- **Money waits in escrow on Arc.** USDC moves only against the signatures in the agreement ([The money path](https://app.proteus.co.in/docs/money-path)).
- **Paid per delivered unit.** The seller is paid for each unit the buyer countersigns; the rest becomes refundable.
- **Verifiable by anyone.** The seller's identity is an ERC-8004 agent on Arc and its pricing policy is committed to [ProteusPolicyRegistry](https://github.com/Adityaakr/proteus/blob/main/contracts/src/ProteusPolicyRegistry.sol); every payment is an Arc transaction.

> The model proposes. The seller's policy decides. The signed agreement controls the money.

<a id="how-it-fits"></a>

### How the parts fit together

_Diagram: Proteus negotiates and relays; escrowed money only ever sits in DealEscrow on Arc._

The buyer, or the buyer's AI agent, negotiates with the seller's deal agent on Proteus, which quotes only from the rules the seller set. The signed terms go to the relayer, which submits transactions to DealEscrow on Arc and pays the gas. The buyer's USDC goes into DealEscrow, never to a Proteus account; DealEscrow pays the seller's payee for each unit the buyer countersigns. The seller's own systems use the seller API and receive deal events by webhook.

<a id="who-for"></a>

### Who it is for

- **Merch and corporate gifting.** "20 boxes, our logo, Mumbai by Oct 31, price per box?" Answered in seconds instead of by hand. Live: [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e).
- **Inference and GPU hours.** Prepay a block of capacity; pay only for the hours or tokens actually served.
- **Data and API access.** Volume tiers and per-call pricing, negotiated by the buyer's agent, settled per call or per batch.
- **Services sold by invoice.** Quotes, deposits and milestones become one signed agreement instead of an email thread.
- **Voice and per-minute services.** Prepay a bundle of minutes or sessions; the seller is paid for what was used, the rest is refundable.
- **Agents buying from agents.** A buyer's agent negotiates, checks the seller on chain and funds within a mandate its owner set.

<a id="deal-example"></a>

### One deal, start to finish

1. **A buyer asks.** "20 merch boxes with our logo, delivered by Oct 31. Best price per box?"
2. **The agent offers.** Inside the seller's rules: a price per box, a term and a refund window. It never quotes below the margin floor.
3. **Both sign.** The buyer and the seller's signer sign the same EIP-712 terms: units, unit price, term, payee.
4. **The buyer funds.** USDC goes into DealEscrow on Arc, not to the seller. With a permit, the relayer pays the gas.
5. **The seller delivers.** It records what was delivered; the buyer countersigns the units it received.
6. **The money settles.** The seller is paid for countersigned units. The rest is refundable to the buyer after the term plus a grace period (3 days by default).

<a id="does-not"></a>

### What it does and does not do

| Proteus AI does | Proteus AI does not |
|---|---|
| Negotiate inside rules the seller wrote | Let the model invent a price below the seller's floor |
| Hold deal payments in a contract on Arc until delivery is countersigned | Hold escrowed funds in a Proteus account |
| Pay the seller's own wallet, published in its Arc identity | Let Proteus or anyone else redirect a seller's payouts |
| Make unspent money refundable after the term | Refund automatically: the buyer (or anyone) calls the refund |
| Resolve disputes through an arbiter key, today held by Proteus | Offer a dispute timeout or an independent arbiter yet ([limits](https://app.proteus.co.in/docs/limits)) |

_Pay per call (x402) is outside escrow and works differently: see [The money path](https://app.proteus.co.in/docs/money-path#money-x402)._

<a id="where-runs"></a>

### Where it runs

| Network | App | Chain id | What is real |
|---|---|---|---|
| Arc mainnet | [app.proteus.co.in](https://app.proteus.co.in) | `5042` | Real USDC. One real business listed, [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e), with its first order paid out. |
| Arc testnet | [ai.proteus.co.in](https://ai.proteus.co.in) | `5042002` | Testnet USDC with no value. Example sellers and a demo merch seller. |

_DealEscrow is at the same address on both networks: `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`._

![The Proteus AI market on Arc mainnet, with Shoonya Store listed first](https://app.proteus.co.in/docs/market.jpg)
_The market: each seller with its Arc identity, links and services priced from the cheapest pack. (Arc mainnet)_

<a id="go-deeper"></a>

### Go deeper

- [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use): web, embed, WhatsApp, MCP, your own agent
- [The deal lifecycle](https://app.proteus.co.in/docs/lifecycle): every state a deal goes through
- [What Proteus costs](https://app.proteus.co.in/docs/fees): no fee during the pilot; who pays gas
- [Verify it yourself](https://app.proteus.co.in/docs/verify): contracts and transactions on Arc
