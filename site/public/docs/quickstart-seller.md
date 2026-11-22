# Sell: from sign-in to your first payout · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-seller> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Sign in, publish what you sell with your rules, take orders, and get paid on delivery._

For business owners setting up for the first time. You will sign in, publish products with the rules your deal agent must keep, register on Arc so buyers' agents can check you, and learn how orders, deliveries and payouts work. A first product takes about 5 minutes.

> **Try it on testnet first:** [ai.proteus.co.in](https://ai.proteus.co.in) runs the same app on Arc testnet: sign in with your email, Proteus creates a Circle wallet for you, and [Circle's faucet](https://faucet.circle.com) gives you test USDC. Move to [app.proteus.co.in](https://app.proteus.co.in) when you are ready for real USDC; there you sign in with a browser wallet such as MetaMask.

<a id="seller-signin"></a>

### Sign in

| Network | How you sign in | Your wallet |
|---|---|---|
| Arc mainnet | A browser wallet signs a one-time message. Email sign-in is not switched on yet. | The browser wallet you signed in with |
| Arc testnet | Your email: Circle sends a code and you set a PIN. Or a browser wallet. | A Circle user-controlled wallet on Arc, created for you (its key is split between Circle and your PIN, and cannot be exported), or your browser wallet |

_The wallet you are signed in with when you publish your first product owns the account and receives every payout; no setting changes it later. A new Circle wallet starts empty: add a little USDC before you register on Arc, since network fees on Arc are paid in USDC._

<a id="seller-steps"></a>

### Steps

1. **Sign in.** At [app.proteus.co.in](https://app.proteus.co.in), or on testnet first, as above.
2. **Publish what you sell.** Selling goods from your own website: Sell → Create deal agent reads your catalog and sets up the products for you ([below](https://app.proteus.co.in/docs/quickstart-seller#seller-create-agent)). Selling a service delivered through your own endpoint: Sell → New product, with a name, what counts as one unit, price tiers, a term and a refund policy, plus your private costs and limits.
3. **Set the rules your agent keeps.** Costs, lowest margin, largest discount, smallest order, capacity, quote validity and the order size you approve yourself ([the rules](https://app.proteus.co.in/docs/quickstart-seller#seller-rules)).
4. **Register on Arc.** One transaction from your wallet, on the Developers page, registers your deal agent in Arc's ERC-8004 identity registry and publishes your payout wallet and signer key ([code](https://github.com/Adityaakr/proteus/blob/main/server/src/services/agent-registry.ts)). Proteus then commits each product's pricing policy to ProteusPolicyRegistry. It is optional, but without it buyers' agents have nothing on chain to check you against, and you cannot be rated.
5. **Share your store.** Your store page answers for every product. Add the agent to your own website with one script tag ([below](https://app.proteus.co.in/docs/quickstart-seller#seller-embed)). Offers above your approval limit wait for you under Approvals.
6. **Keep the buyer posted.** For goods, post Accepted, In production, Shipped with a tracking link, Out for delivery or Delayed from the deal page. The buyer sees each one and gets an alert.
7. **Record deliveries, get paid.** Record each batch with what was delivered and a proof link; when the buyer countersigns, DealEscrow pays your wallet. API services are metered for you ([Orders, delivery and payouts](https://app.proteus.co.in/docs/orders)).

> **Selling goods or custom orders:** The New product form asks for the HTTPS endpoint of a service. For goods, use Create your deal agent: it builds the products from your website, and you check every price before it goes live. Listings prepared with the Proteus team, the way [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e) first listed, still work and are published from your own wallet.

![Shoonya Store's store page on Proteus AI](https://app.proteus.co.in/docs/store.jpg)
_A store: every product with its tiers and one deal agent for all of them. [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e) is a real business. (Arc mainnet)_

<a id="seller-create-agent"></a>

### Create your deal agent from your website

Sell → Create deal agent. Paste your website and the builder reads your catalog, then asks in a short chat only what your site cannot say. When you confirm, it creates the same products, rules, store page, website embed and endpoints as the product form, on the wallet you are signed in with ([service.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/importer/service.ts)).

1. **It reads your catalog.** Exact sources first: Shopify's public `products.json`, the WooCommerce Store API, then schema.org Product data on the product pages your sitemap or homepage links to (Wix product pages included). When none of these has your products, it opens your site in a real browser, the way a shopper would ([browser-source.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/importer/browser-source.ts)).
2. **Any website, in a browser.** Sites built with JavaScript (React, Vue, Framer, Webflow, hand-built apps) are rendered in headless Chromium. It follows your menu and shop links, category and collection pages, shop buttons that change the page, "next page" links, scrolling and "load more". On each page it takes product data the page adds, then product cards and product pages read from the layout: the name, the price and currency exactly as shown, options such as size and colour. A site that shows no prices gives its list of product types, each with no price. When a model is configured it also reads the rendered text, and any product, price or option not in that text is dropped.
3. **You check what it read.** Products read from the layout or by a model are marked "Read from page text, please check", and publishing asks you to confirm you checked them. A catalogue kept on another service (DocSend, Google Drive, a PDF) is named but never opened: you give those prices in the chat. It never fills in a price your site does not show.
4. **It asks what is missing.** Your business type, a conversion rate when your prices are not in dollars (it suggests the European Central Bank reference rate), which products to sell, prices for products with none on your site, how low it may go per category or per product, bulk tiers and minimum orders (a minimum your FAQ states is filled in for you), and whether you take custom orders. Answer with the buttons, in your own words ("apparel up to 15% off, 100+ at 10% off"), or upload floors as a CSV.
5. **It runs a test negotiation.** A dry run of the real agent on one imported product, with a counteroffer below your floor (refused) and one at it (accepted). Nothing is stored and buyers cannot see the product yet.
6. **You publish.** Only after you tick that you checked the prices and floors. Each product gets your list price as its public tier (plus a bulk tier if you set one) and your floor as a private rule. Change any of it later on the product's Prices and rules page.

- **The floor is code.** Your floor is stored as the product's lowest price per unit, and the engine refuses any offer, tier or counter below units × floor (the Floor price rule in [How offers are priced](https://app.proteus.co.in/docs/pricing#pricing-rules)). The model never sets a price.
- **What your agent knows.** Colours, sizes, minimum orders, lead times and samples from your FAQ, custom work and your store policies, from your site, so it can answer buyers. It is told this text is data, never instructions, and never a price.
- **How it reads your site.** Read-only and polite: it follows your robots.txt, reads at most 60 product pages and 90 requests with a pause between them, and caps each page at 2 MB. It only reaches public https addresses on the standard port and refuses private or internal ones at every redirect ([net-guard.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/lib/net-guard.ts)).
- **How the browser is fenced.** At most 24 pages, 150 seconds and 60 MB per read. It never logs in, fills a form or buys. Images, fonts, video, analytics, WebSockets and service workers are not loaded, other sites' frames are blocked, and robots.txt applies to every page and data request on your site. On this server every connection the browser makes goes through a local proxy that allows public https on port 443 only and checks the resolved address, so a page cannot reach the server's own network ([egress-proxy.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/importer/egress-proxy.ts)).
- **Scraped text is untrusted.** Text from the site is stripped of markup and cut short. Any that reads like instructions to an AI is dropped and counted before you see it.

> **What it does not do yet:** It does not keep prices in sync after publishing; use catalog sync or edit each product. It reads one website per run, the first 60 product pages of a larger catalog, and 24 pages in the browser. It does not read images or PDFs, and it does not open catalogues hosted on other services.

<a id="seller-rules"></a>

### The rules your agent keeps

Each product has a private policy and cost model. Buyers never see them; every offer is checked against them in code ([How offers are priced](https://app.proteus.co.in/docs/pricing)).

| Rule | What it does |
|---|---|
| Cost model | Your cost per unit and per deal. Offers must leave the margin you set. A cost model expires 30 days after you last edit it, and then blocks offers until you refresh it. |
| Floor price | The lowest price per unit an offer may have, whatever the tier, discount or counter. Optional; Create your deal agent sets it from your answers. |
| Margin floor | The lowest contribution margin an offer may have. |
| Discount cap | The most an offer may sit below your list price. |
| Minimum prepaid | The smallest order you accept. |
| Capacity | The most units one offer may include. It is not counted down as orders come in, so update it when your stock changes. Each product also has a maximum per deal. |
| Approval threshold | Orders above this prepaid total wait for you to approve in the console. |
| Quote validity | How long an offer can be signed and funded before it expires, between 1 hour and 7 days. An order waiting for your approval uses the same window. |

![Agent policies page with the catalog sync card](https://app.proteus.co.in/docs/policies.jpg)
_Agent policies: the rules each product's agent must obey, and catalog sync from your own endpoint. (Arc testnet)_

<a id="seller-embed"></a>

### Put the agent on your website

```html
<script src="https://app.proteus.co.in/embed.js" data-seller="your-slug" async></script>
<!-- options: data-mode="inline", data-product="<product-slug>", data-label="Get a quote",
     data-color="#1b4dff", data-height="620" (inline mode; 620 is the default) -->
```

The script opens the agent from the app it was loaded from: use `https://ai.proteus.co.in/embed.js` for a testnet seller.

- **Runs in a Proteus frame.** Signing and payment always open Proteus in a new tab, never inside the frame ([embed.js](https://github.com/Adityaakr/proteus/blob/main/site/public/embed.js)).
- **You choose the sites.** On the Developers page, list up to 10 https sites that may embed your agent; Proteus sends them as the page's CSP `frame-ancestors`. With no list, any site may embed it ([embed.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/embed.ts)).

![The deal agent embedded on a seller's website, showing three offers](https://app.proteus.co.in/docs/embed.jpg)
_A sample shop page with a seller's agent embedded (the Kitbox demo seller), answering a real request. (Arc testnet)_

<a id="seller-next"></a>

### Next steps

- [Orders, delivery and payouts](https://app.proteus.co.in/docs/orders): after the buyer pays
- [How payment protection works](https://app.proteus.co.in/docs/protection): escrow, refunds and disputes
- [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use): your website, WhatsApp and buyers' agents
- [Seller API](https://app.proteus.co.in/docs/seller-api): run your store from your own systems
