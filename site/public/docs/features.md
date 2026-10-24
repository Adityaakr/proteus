# Features · Proteus AI docs

Source: <https://app.proteus.co.in/docs/features> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_What sellers and buyers get, and where each is proven._

### For sellers

| Feature | In one line | Proven on |
|---|---|---|
| Agent policies | Cost, floor, discount cap, minimum, capacity, approval threshold, per product. | Mainnet · testnet |
| Store and one deal desk | One conversation across every product ([storefront.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/storefront.ts#L19)). | Mainnet · testnet |
| Agent on your website | One script tag; payment opens in a new tab. | Testnet |
| Catalog sync | Your endpoint keeps stock, cost and rules current; list prices never synced. | Local test |
| Seller-confirmed delivery | Record batches with proof; escrow pays what is countersigned. | Testnet |
| Approvals and alerts | Email, Telegram, signed webhooks ([notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/notify.ts)). | Testnet |
| Accounting export | CSV in the shape QuickBooks and Xero import, each row linked to Arc. | Testnet |
| Onboarding from your wallet | You own the account and the payouts. | Mainnet |

![Seller usage and delivery page with a signed, delivered receipt](https://app.proteus.co.in/docs/seller-usage.jpg)
_Usage and delivery: each billable unit with its outcome and signed receipt. (Arc testnet)_

### For buyers and their agents

| Feature | In one line | Proven on |
|---|---|---|
| Negotiation | Quantities, budgets, counteroffers within the seller's rules. | Mainnet · testnet |
| Gasless funding | Sign a permit; the relayer pays gas ([gasless.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/gasless.ts#L5)). | Testnet |
| Pay per call | x402: one transfer per call, or Circle Gateway batching; outside escrow ([x402.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/x402.ts#L71)). | Testnet |
| MCP server | Nine tools within a per-deal mandate. | Testnet |
| Refunds and disputes | Refund the unspent balance; dispute from your wallet. | Refund: both · dispute: scripted |
| Fund from other chains | CCTP via Circle Bridge Kit ([bridge.ts](https://github.com/Adityaakr/proteus/blob/main/site/src/app/lib/bridge.ts)). | Mainnet |
