# FAQ · Proteus AI docs

Source: <https://app.proteus.co.in/docs/faq> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Short answers to the questions people ask most, each linking to the detail._

For sellers, buyers and agent builders who want a quick answer. Each answer links to the page with the full detail.

<a id="faq-sellers"></a>

### For sellers

- **What is Proteus AI?** An AI sales agent with payment protection, built on Arc. Your deal agent answers buyers, and their AI agents, inside your prices and limits; every order is paid upfront into USDC escrow and released to you when the buyer confirms delivery. [What Proteus AI is](https://app.proteus.co.in/docs/overview).
- **How is it different from a payment link or an escrow service?** A payment link charges a fixed price and pays at once. An escrow service holds money but leaves the quoting to you. Proteus negotiates the price inside your rules, holds the payment in a public contract, and pays you on the buyer's signed confirmation. [How Proteus AI compares](https://app.proteus.co.in/docs/competitors).
- **What does the AI decide?** It reads each request, decides which offers to make, sizes them to the buyer's budget and explains the terms. It does not set prices, which are computed in code from your rules, and it never moves money: only signatures do. [How offers are priced](https://app.proteus.co.in/docs/pricing).
- **Can the AI agree to a bad price?** No. Prices come from the pricing engine and your rules, and orders above your approval limit wait for you. A reply with a price figure that is not among the offers, the buyer's own budget or your listed products is replaced before the buyer sees it. [How offers are priced](https://app.proteus.co.in/docs/pricing#pricing-model).
- **How do I get paid?** In USDC, to the wallet that owns your account, each time the buyer countersigns what you recorded as delivered. Rules for receiving stablecoins differ by country, so check yours, including tax. [Orders, delivery and payouts](https://app.proteus.co.in/docs/orders).
- **What if a buyer never confirms delivery?** You are not paid, and today only the buyer can open a dispute through Proteus. Record every delivery with proof, post order updates, and ask the buyer to confirm each batch. If nothing happens, the unconfirmed amount becomes refundable to the buyer after the term plus grace. [Payment protection](https://app.proteus.co.in/docs/protection#protection-sellers).
- **What does it cost?** Nothing during the pilot: no subscription, no listing fee and no cut of orders. [What Proteus costs](https://app.proteus.co.in/docs/fees).
- **How do I start?** Sign in, publish a product with its price tiers and private limits, and register on Arc. Goods listings are prepared with the Proteus team. [Seller quickstart](https://app.proteus.co.in/docs/quickstart-seller).

<a id="faq-buyers"></a>

### For buyers

- **Do I need crypto?** You need USDC on Arc and a wallet to sign with. On Arc testnet, email sign-in creates a Circle wallet for you; on mainnet you sign in with a browser wallet. USDC on another chain can be bridged in inside the app. Funding with a permit costs you no network fee. [Buyer quickstart](https://app.proteus.co.in/docs/quickstart-buyer).
- **What if goods never arrive?** Do not countersign. Open a dispute from your wallet; the order freezes until the arbiter splits the money still in escrow. [Disputes](https://app.proteus.co.in/docs/protection#protection-disputes).
- **How do refunds work?** After the term plus grace (3 days by default), or once the seller closes the term: one click on the deal page, or anyone can call `refundUnused`. [Deal lifecycle](https://app.proteus.co.in/docs/lifecycle#lifecycle-time).
- **How do I track my order?** Open the deal: it shows paid, accepted, in production, shipped with tracking, delivered and seller paid, each with its proof. Add a webhook, Telegram or email for alerts. [What the buyer sees](https://app.proteus.co.in/docs/orders#orders-tracking).
- **Can my AI agent buy for me?** Yes, through MCP or HTTP, within a per-deal limit you set; proven on Arc testnet, not yet on mainnet. [Agent quickstart](https://app.proteus.co.in/docs/quickstart-agent).

<a id="faq-money"></a>

### Money and safety

- **Does Proteus hold my money?** Not for escrowed orders: USDC sits in DealEscrow. Pay per call is different: with the x402 exact scheme it lands in the seller's Proteus-held signer key until the seller sweeps it to its payee. Proteus also holds the arbiter key. [The money path](https://app.proteus.co.in/docs/money-path).
- **Who holds the keys?** Your wallet owns your account and receives payouts. Proteus holds an encrypted signer key that countersigns offers for each seller, the relayer key that pays network fees, and the arbiter key for disputes. [Security](https://app.proteus.co.in/docs/security).
- **Who pays network fees?** Proteus, for gasless funding, settlement and one-click refunds. Fees on Arc are paid in USDC. [Who pays gas](https://app.proteus.co.in/docs/fees#fees-gas).
- **Is the contract audited?** Not yet. It is source-verified, not upgradeable and tested; an audit is planned. [Security](https://app.proteus.co.in/docs/security).
- **Can a seller fake its own rating?** Not from its own wallet, not without a paid order, and not with a wallet it funded on Arc: those are rejected or flagged. A wallet funded from an exchange can still get through, as one vote among the buyers shown. [How ratings work](https://app.proteus.co.in/docs/ratings).

<a id="faq-using"></a>

### Using Proteus

- **Is it live?** Yes, on Arc mainnet: the escrow, a real business and a Shoonya Store order paid out (its buyer wallet was later found linked to a Shoonya team account). Most other proofs are on testnet. [What is live today](https://app.proteus.co.in/docs/status).
- **Where can I use it?** The web app, a seller's website, WhatsApp (in testing), Claude and other MCP clients, your own agent over HTTP, and the seller API. A phone app is Planned. [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use).
- **Can my customers talk to it?** For scheduling services, yes: share your customer link or embed it on your site, and customers chat or speak with your AI assistant. No phone number yet. [Front desk](https://app.proteus.co.in/docs/front-desk).
- **Which AI does the work?** Claude: Haiku 5.5, Sonnet 5.5 or Opus 5.5, depending on the job. Prices still come only from the seller's rules. [The AI behind it](https://app.proteus.co.in/docs/ai-models).
- **How does Proteus relate to ERC-8183?** ERC-8183 is a draft standard for paid jobs between agents. A Proteus order follows the same lifecycle, with the buyer's confirmation as the evaluator, and adds a negotiated price, payment per unit, disputes and reviews. Implementing its interface is Planned. [ERC-8183](https://app.proteus.co.in/docs/protection#protection-erc8183).
- **How do I get help?** These docs cover setup, fees, security and limits. For anything else, open an issue on [GitHub](https://github.com/Adityaakr/proteus/issues), where the code is public.
