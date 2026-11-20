# Features · Proteus AI docs

Source: <https://app.proteus.co.in/docs/features> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_What sellers and buyers get, and where each is proven._

For sellers and buyers comparing what Proteus can do today. Each feature has one line and a status.

> Status words mean the same as on [Ways to use](https://app.proteus.co.in/docs/ways-to-use#ways-status): Live (used on Arc mainnet), Testnet (proven on Arc testnet), In testing (built and deployed or covered by tests, not yet used end to end by a real customer).

<a id="for-sellers"></a>

### For sellers

| Feature | In one line | Status |
|---|---|---|
| Agent policies | Cost, floor, discount cap, minimum, capacity, approval threshold, per product ([rules](https://app.proteus.co.in/docs/pricing#pricing-rules)). | Live |
| Store and one deal desk | One conversation across every product ([storefront.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/storefront.ts#L19)). | Live |
| Seller-confirmed delivery | Record batches with proof; escrow pays what is countersigned. | Live |
| Onboarding from your wallet | You own the account and the payouts. | Live |
| Agent on your website | One script tag; payment opens in a new tab ([quickstart](https://app.proteus.co.in/docs/quickstart-seller#seller-embed)). | Testnet |
| Approvals | Offers above your threshold wait for you in the console. | Testnet |
| Accounting export | CSV in the shape QuickBooks and Xero import, each row linked to Arc. | Testnet |
| WhatsApp agent | The same agent on your own WhatsApp Business number; paying stays on the web ([details](https://app.proteus.co.in/docs/ways-to-use#ways-whatsapp-how)). | In testing |
| Seller API and webhooks | Scoped test and live keys for deals, usage, payments, prices and deliveries; signed webhooks with a delivery log; a public sandbox ([Seller API](https://app.proteus.co.in/docs/seller-api)). | In testing |
| Alerts | Email, Telegram, signed webhooks ([notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/notify.ts)). | In testing |
| Order updates | Accepted, in production, shipped with tracking; the buyer sees each one ([orders.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/orders.ts)). | In testing |
| Front desk and inbox | Customers chat or speak with your AI assistant on a link or your website; every request lands in an inbox ([Front desk](https://app.proteus.co.in/docs/front-desk)). | In testing |
| Real AI work | Proteus-run services on Claude, model per job ([The AI behind it](https://app.proteus.co.in/docs/ai-models)). | In testing |
| Catalog sync | Your endpoint keeps stock, cost and rules current; list prices are never synced. | In testing |

![Seller usage and delivery page with a signed, delivered receipt](https://app.proteus.co.in/docs/seller-usage.jpg)
_Usage and delivery: each billable unit with its outcome and signed receipt. (Arc testnet)_

<a id="for-buyers"></a>

### For buyers and their agents

| Feature | In one line | Status |
|---|---|---|
| Negotiation | Quantities, budgets, counteroffers within the seller's rules. | Live |
| Gasless funding | Sign a permit; the relayer pays gas ([gasless.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/gasless.ts#L5)). | Live |
| Refunds | Refund the unspent balance after the term ([mainnet refund](https://explorer.arc.io/tx/0x70d68aa16db7588b90f172ccb68d20bb4f95ca099650a2755ee1a3436481c94d)). | Live |
| Fund from other chains | CCTP via Circle Bridge Kit ([bridge.ts](https://github.com/Adityaakr/proteus/blob/main/site/src/app/lib/bridge.ts)). | Live |
| Pay per call | x402: one payment per call, or Circle Gateway batching; outside escrow ([x402.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/x402.ts#L102)). | Testnet |
| MCP server | Nine tools within a per-deal mandate ([quickstart](https://app.proteus.co.in/docs/quickstart-agent)). | Testnet |
| Disputes | Open from your wallet; the arbiter splits the unspent balance ([disputes.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/disputes.ts)). | In testing |
| Order tracking and alerts | Progress to payout, tracking, and updates by webhook, Telegram or email. | In testing |
