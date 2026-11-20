# FAQ · Proteus AI docs

Source: <https://app.proteus.co.in/docs/faq> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_Short answers to the questions people ask most, each linking to the detail._

For sellers, buyers and agent builders who want a quick answer. Each answer links to the page with the full detail.

<a id="faq-money"></a>

### Money and safety

- **Does Proteus hold my money?** Not for escrowed deals: USDC sits in DealEscrow. Pay per call is different: with the x402 exact scheme it lands in the seller's Proteus-held signer key until the seller sweeps it to its payee. Proteus also holds the arbiter key. [The money path](https://app.proteus.co.in/docs/money-path).
- **Can the AI agree to a bad price?** No. Prices come from the engine and the seller's rules; the model only writes the words. [How offers are priced](https://app.proteus.co.in/docs/pricing).
- **How do refunds work?** After the term plus grace (3 days by default), or once the seller closes the term: one click on the deal page, or anyone can call `refundUnused`. [Deal lifecycle](https://app.proteus.co.in/docs/lifecycle#lifecycle-time).
- **What if goods never arrive?** Do not countersign. Open a dispute from your wallet; the deal freezes until the arbiter splits the unspent balance. [The money path](https://app.proteus.co.in/docs/money-path#money-refund).
- **Who pays gas?** The relayer, with gasless funding and one-click refunds. Gas on Arc is paid in USDC. [Who pays gas](https://app.proteus.co.in/docs/fees#fees-gas).
- **Is the contract audited?** Not yet. Source-verified and tested; an audit is planned. [Security](https://app.proteus.co.in/docs/security).

<a id="faq-using"></a>

### Using Proteus

- **Where can I use it?** The web app, a seller's website, WhatsApp (in testing), Claude and other MCP clients, your own agent over HTTP, and the seller API. A phone app is coming. [Ways to use Proteus AI](https://app.proteus.co.in/docs/ways-to-use).
- **Is it on mainnet?** Yes: the escrow, a real business, its policies and a Shoonya order paid out (its buyer wallet was later found linked to a Shoonya team account). Most other feature proofs are on testnet. [What is live today](https://app.proteus.co.in/docs/status).
- **Can my agent buy alone?** Yes, through MCP, within a per-deal limit you set; proven on testnet. [Agent quickstart](https://app.proteus.co.in/docs/quickstart-agent).
- **Can my customers talk to it?** Yes, for scheduling services: share your customer link or embed it on your site, and customers chat or speak with your AI assistant. No phone number yet. [Front desk](https://app.proteus.co.in/docs/front-desk).
- **How do I track my order?** Open the deal: it shows paid, accepted, in production, shipped with tracking, delivered and seller paid, each with its proof. Add a webhook, Telegram or email for alerts. [Order tracking](https://app.proteus.co.in/docs/front-desk#front-desk-orders).
- **Which AI does the work?** Claude: Haiku 5.5, Sonnet 5.5 or Opus 5.5, depending on the job. Prices still come only from the seller's rules. [The AI behind it](https://app.proteus.co.in/docs/ai-models).
- **Can a seller fake its own rating?** Not from its own wallet, not without a paid order, and not with a wallet it funded on Arc: those are rejected or flagged. A wallet funded from an exchange can still get through, as one vote among the buyers shown. [How ratings work](https://app.proteus.co.in/docs/ratings).
