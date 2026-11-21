# What Proteus AI is · Proteus AI docs

Source: <https://app.proteus.co.in/docs/overview> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_The deal network for small businesses and AI agents on Arc._

For business owners first, and for buyers and builders. You will learn what Proteus AI does for a seller, how one order moves from a question to a payout, what is live today, and where to go next.

- **I sell.** Set your prices and limits once. Your deal agent answers buyers and their AI agents, and you are paid in USDC when an order is delivered. [Seller quickstart](https://app.proteus.co.in/docs/quickstart-seller)
- **I buy.** Ask for a price, sign once and pay into escrow. The seller is paid when you confirm delivery; what is not delivered comes back. [Buyer quickstart](https://app.proteus.co.in/docs/quickstart-buyer)
- **I build an agent.** Let Claude or your own agent negotiate and pay through MCP or HTTP, within a limit you set. [Agent quickstart](https://app.proteus.co.in/docs/quickstart-agent)

> **What the labels mean:** Live means in use on Arc mainnet with real USDC. Testnet means proven on Arc testnet. In testing means built but not yet used by a real customer. Planned means not built yet. Every capability and its proof: [What is live today](https://app.proteus.co.in/docs/status).

<a id="how-it-works"></a>

### How it works

1. **Set your rules once.** Price tiers for each product, plus private limits only your agent sees: your costs, the lowest margin you accept, the largest discount, the smallest order, and the order size above which you approve it yourself.
2. **Your deal agent wins the order.** It answers buyers, and buyers' AI agents, in seconds: on your store page, on your website, or from their agent. Every offer is computed in code from your rules; the AI writes the words, never the price ([How offers are priced](https://app.proteus.co.in/docs/pricing)).
3. **You are paid when it's delivered.** Both sides sign the same terms and the buyer pays upfront into USDC escrow on Arc. You record what you delivered; when the buyer confirms it, the contract pays your wallet. What is not delivered becomes refundable to the buyer ([How payment protection works](https://app.proteus.co.in/docs/protection)).

> The model proposes. The seller's rules decide. Signatures move the money.

<a id="how-it-fits"></a>

### How the parts fit together

_Diagram: Proteus negotiates and relays; escrowed money only ever sits in DealEscrow on Arc._

The buyer, or the buyer's AI agent, negotiates with the seller's deal agent on Proteus, which quotes only from the rules the seller set. The signed terms go to the relayer, which submits transactions to DealEscrow on Arc and pays the gas. The buyer's USDC goes into DealEscrow, never to a Proteus account; DealEscrow pays the seller's payee for each unit the buyer countersigns. The seller's own systems use the seller API and receive deal events by webhook.

<a id="who-for"></a>

### Who it is for

Businesses that answer "it depends" when asked the price, and the buyers, people or AI agents, who order from them.

- **Custom merch and apparel.** "200 tees with our logo by the 30th, price per tee?" answered in seconds instead of the next morning. Live: [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e).
- **Print, packaging and gifting.** Quotes that depend on quantity and finish, priced from your tiers instead of by hand, with big orders waiting for your approval.
- **Event supply and creative services.** A deposit, a quote and an invoice become one signed order, paid out as each delivery is confirmed.
- **Wholesale.** Volume tiers and a margin floor the agent never goes below, for buyers you have never met.
- **Services sold by usage.** API calls, AI work or bookings, prepaid as a bundle and billed per delivered unit ([Buyer HTTP API](https://app.proteus.co.in/docs/api)).
- **Buyers' AI agents.** An agent negotiates, checks the seller on Arc and funds within a limit its owner set. Proven on Arc testnet.

<a id="deal-example"></a>

### One order, start to finish

1. **A buyer asks.** "200 tees with our logo, delivered by the 30th. Best price per tee?"
2. **The agent offers.** Inside the seller's rules: a price per tee, a term and a refund window. It never quotes below the margin floor, and an order above the seller's approval limit waits for the seller.
3. **Both sign.** The buyer and the seller's signer key sign the same terms: units, unit price, term, payee.
4. **The buyer pays upfront.** USDC goes into the DealEscrow contract on Arc, not to the seller or to Proteus. With a permit, Proteus pays the network fee.
5. **The seller delivers.** It posts order updates (accepted, in production, shipped with tracking) and records each batch it delivers, with proof.
6. **The buyer confirms, the seller is paid.** The buyer countersigns what was recorded and the contract pays the seller for it. What was not delivered is refundable to the buyer after the term plus a grace period (3 days by default).

<a id="does-not"></a>

### What it does and does not do

| Proteus AI does | Proteus AI does not |
|---|---|
| Negotiate inside rules the seller wrote | Let the model invent a price below the seller's floor |
| Hold order payments in a contract on Arc until the buyer confirms delivery | Hold escrowed funds in a Proteus account |
| Pay the seller's own wallet, fixed when it first publishes and, for a seller registered on Arc, published in its ERC-8004 identity | Let an order's money go anywhere but the seller's payee or back to the buyer |
| Make undelivered money refundable after the term | Refund automatically: the buyer (or anyone) asks for it |
| Let the buyer open a dispute that an arbiter, today Proteus, decides | Offer a dispute timeout, an independent arbiter, or a way for sellers to open a dispute yet ([limits](https://app.proteus.co.in/docs/limits)) |

_Pay per call (x402) is outside escrow and works differently: see [The money path](https://app.proteus.co.in/docs/money-path#money-x402)._

<a id="where-runs"></a>

### Where it runs

| Network | App | Chain id | What is real |
|---|---|---|---|
| Arc mainnet | [app.proteus.co.in](https://app.proteus.co.in) | `5042` | Real USDC. Sign in with a browser wallet. One real business listed, [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e), with its first order paid out. |
| Arc testnet | [ai.proteus.co.in](https://ai.proteus.co.in) | `5042002` | Test USDC with no value. Sign in with email (Proteus creates a Circle wallet for you) or a browser wallet. Example sellers and a demo merch seller. |

_DealEscrow is at the same address on both networks: `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`._

![The Proteus AI market on Arc mainnet, with Shoonya Store listed first](https://app.proteus.co.in/docs/market.jpg)
_The market: each seller with its Arc identity, links and services priced from the cheapest pack. (Arc mainnet)_

<a id="go-deeper"></a>

### Go deeper

- [How payment protection works](https://app.proteus.co.in/docs/protection): escrow, refunds and disputes, for both sides
- [Orders, delivery and payouts](https://app.proteus.co.in/docs/orders): what a seller does after the buyer pays
- [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use): store page, website, WhatsApp, MCP, your own agent
- [What Proteus costs](https://app.proteus.co.in/docs/fees): no fee during the pilot; who pays network fees
- [Verify it yourself](https://app.proteus.co.in/docs/verify): contracts and transactions on Arc
