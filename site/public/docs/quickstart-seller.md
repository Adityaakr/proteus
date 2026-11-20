# Sell: from wallet to a listed product · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-seller> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_From your own wallet to a listed product and your first payout._

For sellers setting up for the first time. You will sign in, publish products and the rules your agent must keep, register on Arc, and learn how orders, deliveries and payouts work. It takes about 5 minutes.

> **Try it on testnet first:** [ai.proteus.co.in](https://ai.proteus.co.in) runs the same app on Arc testnet with test USDC. Use [app.proteus.co.in](https://app.proteus.co.in) when you are ready for real USDC.

### Steps

1. **Sign in with your wallet.** At [app.proteus.co.in](https://app.proteus.co.in). It owns the account and receives payouts.
2. **Publish products and rules.** Tiers and list prices, plus private rules: cost, floor, discount cap, minimum, capacity, approval threshold.
3. **Register on Arc.** One transaction from your wallet registers your agent in Arc's ERC-8004 IdentityRegistry ([code](https://github.com/Adityaakr/proteus/blob/main/server/src/services/agent-registry.ts#L90)).
4. **Policies are committed.** Proteus checks owner, payee and signer on chain, then commits each policy to ProteusPolicyRegistry.
5. **Take orders.** On your store page, on your website, or from buyers' AI agents. Offers above your approval threshold wait for you.
6. **Keep the buyer posted.** For goods: Order accepted, In production, Shipped with a tracking link, Out for delivery. The buyer sees each update on its order page and in its alerts.
7. **Deliver and get paid.** API calls are metered; goods are confirmed per batch by you, not verified by Proteus. Escrow pays what the buyer countersigns.

![Shoonya Store's store page on Proteus AI](https://app.proteus.co.in/docs/store.jpg)
_A store: every product with its tiers and one deal agent for all of them. [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e) is a real business. (Arc mainnet)_

### The rules your agent keeps

Each product has a private policy and cost model. Buyers never see them; every offer is checked against them in code ([How offers are priced](https://app.proteus.co.in/docs/pricing)).

| Rule | What it does |
|---|---|
| Cost model | Your cost per unit and per deal. Offers must leave the margin you set; a cost model past its fresh-until date blocks offers until you refresh it. |
| Margin floor | The lowest contribution margin an offer may have. |
| Discount cap | The most an offer may sit below your list price. |
| Minimum prepaid | The smallest deal you accept. |
| Capacity | Units you can still commit this period; also a maximum per deal on the product. |
| Approval threshold | Deals above this prepaid total wait for you to approve in the console. |
| Quote validity | How long an offer can be signed and funded before it expires. |

![Agent policies page with the catalog sync card](https://app.proteus.co.in/docs/policies.jpg)
_Agent policies: the rules each product's agent must obey, and catalog sync from your own endpoint. (Arc testnet)_

### Put the agent on your website

```html
<script src="https://app.proteus.co.in/embed.js" data-seller="your-slug" async></script>
<!-- options: data-mode="inline", data-product="<product-slug>", data-label="Get a quote",
     data-color="#1b4dff", data-height="640" (inline mode) -->
```

- **Runs in a Proteus frame.** Signing and payment always open Proteus in a new tab, never inside the frame ([embed.js](https://github.com/Adityaakr/proteus/blob/main/site/public/embed.js)).
- **You choose the sites.** In Settings, list up to 10 https sites that may embed your agent; Proteus sends them as the page's CSP `frame-ancestors`. With no list, any site may embed it ([embed.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/embed.ts)).

![The deal agent embedded on a seller's website, showing three offers](https://app.proteus.co.in/docs/embed.jpg)
_A sample shop page with a seller's agent embedded (the Kitbox demo seller), answering a real request. (Arc testnet)_

### Next steps

- [Seller API](https://app.proteus.co.in/docs/seller-api): read deals and payments, change prices, report deliveries
- [Webhooks](https://app.proteus.co.in/docs/seller-webhooks): deal events pushed to your server
- [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use): WhatsApp, MCP and the other channels
- [The deal lifecycle](https://app.proteus.co.in/docs/lifecycle): what happens after an offer is signed
