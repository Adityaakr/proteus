# Sell: from wallet to a listed product · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-seller> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Six steps, about five minutes, from your own wallet._

1. **Sign in with your wallet.** At [app.proteus.co.in](https://app.proteus.co.in). It owns the account and receives payouts.
2. **Publish products and rules.** Tiers and list prices, plus private rules: cost, floor, discount cap, minimum, capacity, approval threshold.
3. **Register on Arc.** One transaction registers your agent in Arc's ERC-8004 IdentityRegistry ([code](https://github.com/Adityaakr/proteus/blob/main/server/src/services/agent-registry.ts#L90)).
4. **Policies are committed.** Proteus checks owner, payee and signer on chain, then commits each policy to ProteusPolicyRegistry.
5. **Take orders.** On your store page, on your website, or from buyers' AI agents. Large offers wait for you.
6. **Deliver and get paid.** API calls are metered; goods are confirmed per batch by you, not verified by Proteus. Escrow pays what the buyer countersigns.

![Shoonya Store's store page on Proteus AI](https://app.proteus.co.in/docs/store.jpg)
_A store: every product with its tiers and one deal agent for all of them. [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e) is a real business. (Arc mainnet)_

![Agent policies page with the catalog sync card](https://app.proteus.co.in/docs/policies.jpg)
_Agent policies: the rules each product's agent must obey, and catalog sync from your own endpoint. (Arc testnet)_

### Put the agent on your website

```html
<script src="https://app.proteus.co.in/embed.js" data-seller="your-slug" async></script>
<!-- options: data-mode="inline", data-product="<product-slug>", data-label="Get a quote", data-color="#1b4dff" -->
```

- **Runs in a Proteus frame.** Signing and payment always open Proteus in a new tab ([embed.js](https://github.com/Adityaakr/proteus/blob/main/site/public/embed.js)).
- **You choose the sites.** Limit who may embed it with CSP `frame-ancestors`.

![The deal agent embedded on a seller's website, showing three offers](https://app.proteus.co.in/docs/embed.jpg)
_A sample shop page with a seller's agent embedded (the Kitbox demo seller), answering a real request. (Arc testnet)_
