# Features · Proteus AI docs

Source: <https://app.proteus.co.in/docs/features> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What sellers and buyers get, and where each is proven._

For sellers and buyers comparing what Proteus can do today. Each feature has one line and where it is proven: on Arc mainnet, on Arc testnet, or in local tests only.

### For sellers

| Feature | In one line | Proven on |
|---|---|---|
| Agent policies | Cost, floor, discount cap, minimum, capacity, approval threshold, per product ([rules](https://app.proteus.co.in/docs/pricing#pricing-rules)). | Mainnet · testnet |
| Store and one deal desk | One conversation across every product ([storefront.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/storefront.ts#L19)). | Mainnet · testnet |
| Agent on your website | One script tag; payment opens in a new tab ([quickstart](https://app.proteus.co.in/docs/quickstart-seller#seller-embed)). | Testnet |
| WhatsApp agent | The same agent on your own WhatsApp Business number; paying stays on the web ([details](https://app.proteus.co.in/docs/ways-to-use#ways-whatsapp-how)). | Deployed, in testing |
| Catalog sync | Your endpoint keeps stock, cost and rules current; list prices are never synced. | Local test |
| Seller-confirmed delivery | Record batches with proof; escrow pays what is countersigned. | Mainnet · testnet |
| Order updates | Accepted, in production, shipped with tracking; the buyer sees each one ([orders.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/orders.ts)). | Deployed · local test |
| Front desk and inbox | Customers chat or speak with your AI assistant on a link or your website; every request lands in an inbox ([Front desk](https://app.proteus.co.in/docs/front-desk)). | Deployed · local test |
| Real AI work | Proteus-run services on Claude, model per job ([The AI behind it](https://app.proteus.co.in/docs/ai-models)). | Deployed · local test |
| Approvals and alerts | Email, Telegram, signed webhooks ([notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/notify.ts)). | Testnet |
| Seller API and webhooks | Scoped test and live keys for deals, usage, payments, prices and deliveries; signed webhooks with a delivery log ([Seller API](https://app.proteus.co.in/docs/seller-api)). | Local test · sandbox on testnet |
| Accounting export | CSV in the shape QuickBooks and Xero import, each row linked to Arc. | Testnet |
| Onboarding from your wallet | You own the account and the payouts. | Mainnet |

_"Deployed" means running on both apps but not yet shown on chain end to end; "Local test" means covered by tests only._

![Seller usage and delivery page with a signed, delivered receipt](https://app.proteus.co.in/docs/seller-usage.jpg)
_Usage and delivery: each billable unit with its outcome and signed receipt. (Arc testnet)_

### For buyers and their agents

| Feature | In one line | Proven on |
|---|---|---|
| Negotiation | Quantities, budgets, counteroffers within the seller's rules. | Mainnet · testnet |
| Gasless funding | Sign a permit; the relayer pays gas ([gasless.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/gasless.ts#L5)). | Testnet |
| Pay per call | x402: one payment per call, or Circle Gateway batching; outside escrow ([x402.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/x402.ts#L102)). | Testnet |
| MCP server | Nine tools within a per-deal mandate ([quickstart](https://app.proteus.co.in/docs/quickstart-agent)). | Testnet |
| Refunds and disputes | Refund the unspent balance; dispute from your wallet. | Refund: both · dispute: scripted |
| Fund from other chains | CCTP via Circle Bridge Kit ([bridge.ts](https://github.com/Adityaakr/proteus/blob/main/site/src/app/lib/bridge.ts)). | Mainnet |
| Order tracking and alerts | Progress to payout, tracking, and updates by webhook, Telegram or email. | Deployed · local test |
