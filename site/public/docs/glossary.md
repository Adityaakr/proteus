# Glossary · Proteus AI docs

Source: <https://app.proteus.co.in/docs/glossary> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_The terms these docs use, in one line each._

For anyone meeting a term for the first time. Terms are grouped by where they come up; each one is used with exactly this meaning across the docs and the API.

<a id="glossary-deals"></a>

### Deals and money

| Term | Meaning |
|---|---|
| Terms | The EIP-712 agreement both sides sign: units, unit price, prepaid, term, grace, payee. |
| Acceptance | The buyer's signature over the cumulative delivered units and amount, and the receipts root. |
| Delivery | The seller signer's signature over the cumulative delivered units and the receipts root (not the amount). |
| Receipt | The seller signer's signed record (EIP-191) of one delivered unit or batch; the buyer checks receipts before countersigning. |
| Payee | Where the seller is paid: its own wallet, published in its ERC-8004 identity. |
| Terms hash | The EIP-712 digest of the terms both parties sign; DealEscrow stores it per deal. `publicTermsHash` inside the terms is the hash of the human-readable public terms. |
| Receipts root | One hash over the seller's receipts for delivered units, carried by the Acceptance and the Delivery. |
| Permit | An EIP-2612 USDC signature that lets DealEscrow take exactly the prepaid amount, so the buyer sends no transaction. |
| Refundable at | When `refundUnused` opens for a deal: end + grace, or at once after the seller closes the term (`refundableAt`). |
| Grace | Extra time after the term ends (3 days by default, in each deal's terms) when settlement is still possible; refunds open after it. |
| micro-USDC | USDC's 6-decimal base unit; 1 USDC = 1,000,000. The public API and the seller API use micro-USDC integer strings ("6600000"); seller webhooks send USDC with six decimals ("6.600000"). |
| x402 | Pay per call over HTTP: the server answers 402 with payment options and the client pays with a signed USDC authorization (EIP-3009). |
| Sweep | Moving pay-per-call payments from the seller signer key to the seller's payee. |

<a id="glossary-keys"></a>

### Keys and identity

| Term | Meaning |
|---|---|
| Seller signer | A per-seller key held by Proteus that countersigns; on chain it is the deal's seller address. |
| Relayer | The Proteus key that submits transactions and pays gas. |
| Arbiter | The key, held by Proteus, that resolves disputes over the unspent balance; it is also DealEscrow's owner. |
| Mandate | The largest prepaid amount an AI agent may commit per deal. |
| Policy commitment | A salted hash of a pricing policy on ProteusPolicyRegistry. |
| ERC-8004 | An Ethereum standard for agent identity and reputation (Trustless Agents), deployed on Arc. Proteus publishes each seller's payee and signer as metadata on its identity. |
| Seller API key | A bearer key (`psk_live_…` or `psk_test_…`) from the Developers page, with permissions such as `deals:read`. |
| Sandbox | A public demo seller on Arc testnet for trying the seller API: fixed data for reads, dry runs for writes. |

<a id="glossary-product"></a>

### Product

| Term | Meaning |
|---|---|
| Deal agent | The seller's AI agent that negotiates with buyers; every price it offers comes from the seller's rules. |
| Channel | A way to reach the deal agent: web, website embed, WhatsApp, MCP, HTTP. See [Ways to use](https://app.proteus.co.in/docs/ways-to-use). |
| Front desk | A scheduling service's public chat (customer link or website embed) where a business's customers talk to its AI assistant. |
| Customer link | The business's link to its front desk; replacing it stops the old one at once. |
| Inbox | Every request on a deal with its full note, marked confirmed, done or cancelled by the business. |
| Order update | A status the seller posts for goods: accepted, in production, shipped (with tracking), out for delivery, delayed, or a message. |
| Order timeline | The buyer's view of a goods order, from paid to seller paid (`GET /api/deals/{id}/timeline`). |
| Outbox | The queue that holds a seller's deal events until they are delivered, with up to 5 attempts. |
| Deal ids | `deal_…` is a deal's id in the API and console; `d_…` is its public id on public records and in webhooks; `dealIdOnchain` is its id in DealEscrow. |
| Status words | Live, Testnet, In testing and Coming soon: see [Ways to use](https://app.proteus.co.in/docs/ways-to-use#ways-status). |
| Business profile | Hours, services, prices, timezone and emergency line the front desk answers from. |

<a id="glossary-ratings"></a>

### Ratings

| Term | Meaning |
|---|---|
| Verified buyer | A buyer who reached the seller through WhatsApp or holds a Proteus account with an email; their rating weighs 1, others 0.5. |
| Linked rating | A rating whose buyer is tied to the seller (a seller wallet, funded by one, or the same bridge source); listed, not counted. |
| Trusted reviewers | The buyers whose ratings count for a seller; pass them to ERC-8004 getSummary to read their feedback on chain. |
