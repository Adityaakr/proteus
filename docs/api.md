# Proteus AI API (v0)

Base path `/api`. JSON in and out. Money crosses the wire as **strings of integer micro-USDC** (`"1440000000"` = $1,440) unless a field name ends in `Usd`, in which case it is a decimal string for display. Units are integer strings. Addresses and hashes are hex strings.

Every response carries `network: "testnet" | "sandbox" | "illustrative"` where a label applies. Buyer-facing responses NEVER include seller cost, margin or rule ids; those appear only under `/api/app/*`.

## Auth

- Buyer routes: no account. The buyer's wallet address is attached when they sign terms. Negotiation and deal routes are keyed by unguessable ids.
- Seller routes (`/api/app/*`): cookie session. `POST /api/app/session/sandbox` creates a session for the visibly labeled sandbox seller (no credentials; this is the judge path). `POST /api/app/session/siwe` (nonce + signature from the configured `OWNER_ADDRESS`) is the real owner path.
- Service execution: `Authorization: Bearer <dealApiKey>` issued once at provisioning.

## Public

```
GET  /api/health
  -> { ok, network, chainId, escrowAddress, usdcAddress, agentAdapter: "rule-based"|"anthropic", relayer: "circle"|"viem"|"none" }

GET  /api/public/sellers/:sellerSlug
  -> { slug, name, label: "sandbox"|"live", products: [PublicProduct] }

GET  /api/public/sellers/:sellerSlug/products/:productSlug
  -> PublicProduct
```

`PublicProduct = { slug, name, billableUnit, unitLabel, capabilities[], supportedIntegrations[], tiers: [{ id, name, includedUnits, unitPriceUsd, prepaidTotalUsd, includes[] }], termDays, refundPolicy, starters: string[] }`

## Negotiation (buyer)

```
POST /api/negotiations           { sellerSlug, productSlug, buyerAddress? }
  -> Negotiation

GET  /api/negotiations/:id
  -> Negotiation

POST /api/negotiations/:id/messages   { content }
  -> Negotiation            (includes the agent's reply turn(s) and any new offers)

POST /api/negotiations/:id/counter    { candidateId, targetTotal?: micro, targetUnits?: units }
  -> Negotiation            (adds a decision turn: approved | approval_required | rejected with alternative)

POST /api/negotiations/:id/quotes     { candidateId }
  -> Quote
```

```
Negotiation = {
  id, publicId, sellerSlug, productSlug, status: "open"|"quoted"|"accepted"|"closed",
  requirements: { desiredUnits?, budget?, integrations[], openQuestions[], assumptions[] },
  turns: [{ id, role: "buyer"|"agent"|"system", content, createdAt, kind?: "message"|"offers"|"decision"|"clarify",
            offers?: [Offer], decision?: { decision, reasons[], alternative?: Offer } }],
  offers: [Offer],                      // current eligible + approval_required candidates (public projection)
  activity: [{ at, label, state: "done"|"working" }],   // sanitized progress for ReasoningText/AgentActivity on the buyer side
}
Offer = PublicCandidate from @proteus/domain plus { unitPriceUsd, prepaidTotalUsd, overagePriceUsd? }
```

## Quotes and acceptance

```
GET  /api/quotes/:id
  -> Quote

POST /api/quotes/:id/accept   { buyerAddress, buyerSignature }
  -> Deal
```

```
Quote = {
  id, negotiationId, status: "draft"|"approval_required"|"approved"|"declined"|"accepted"|"expired",
  offer: Offer, expiresAt,
  chainId, escrowAddress, usdcAddress,
  terms: Terms (all bigints as strings),            // the exact EIP-712 message
  typedData: { domain, types, primaryType: "Terms", message },   // ready for wallet signTypedData
  publicTerms: { includes[], billableUnit, integrations[], refundPolicy, termDays, overage? },
  approval?: { id, status, reason, decidedAt? }
}
```

## Deals (buyer)

```
GET  /api/deals/:id
  -> Deal

POST /api/deals/:id/funding-intent   { txHash? }      // buyer submitted createAndFundDeal themselves, or asks the relayer
  -> Deal                                              // relayer path: server submits createAndFundDeal with both sigs

GET  /api/deals/:id/usage
  -> { receipts: [Receipt], cumulativeUnits, cumulativeCharged, settledOnchain, pendingAcceptance?: { typedData, acceptance } }

POST /api/deals/:id/usage-acknowledgments   UsageAckBody (see @proteus/domain)
  -> { settlement: { txHash, status } , deal: Deal }

POST /api/deals/:id/refund-request
  -> { status: "submitted"|"too_early", refundableAt, txHash? }
```

```
Deal = {
  id, publicId, status: "awaiting_funding"|"funding_pending"|"funded"|"active"|"closed"|"disputed",
  chainId, escrowAddress, usdcAddress, dealIdOnchain (uint string), terms, publicTerms,
  signatures: { buyer, seller }, buyerAddress, sellerPayee,
  funding: { txHash?, confirmedAt?, explorerUrl? },
  balances: { deposit, settled, refunded, remaining, source: "chain"|"pending" },
  service: { status: "pending"|"provisioned"|"suspended", endpoint, apiKey?: string /* only on the response that provisions */, docsUrl },
  usage: { units, charged, settled },
  refundableAt, explorer: { escrow, funding?, settlements[] , refund? },
  labels: { network: "testnet", seller: "sandbox"|"live" }
}
Receipt = { requestId, status: "delivered"|"failed"|"handoff", units, chargedCumulative, digest, createdAt, answerPreview }
```

## Service (metered endpoint)

```
POST /api/services/:productSlug/execute     Authorization: Bearer <dealApiKey>
  { requestId, input: { ...the fields the seller defined under "What buyers send" } }
  Text and numbers are JSON values. A file is { name, type, size, dataBase64 }, at most 512 KB per file and 700 KB per request (413 otherwise).
  Products without a request spec accept { question, orderId? }.
  -> { requestId, status: "delivered"|"failed"|"handoff", billable: boolean, units, answer, source: { store, orderId?, fields[] }, receipt: { digest, sellerSignature }, deal: { cumulativeUnits, cumulativeCharged, remaining } }
```
Retrying the same `requestId` returns the original result and never charges twice. Failed or handoff requests are not billable.

## Seller console (`/api/app/*`, session required)

```
POST /api/app/session/sandbox            -> { org: { slug, name, label: "sandbox" } }
GET  /api/app/overview                   -> { quotes, approvalsPending, dealsFunded, fundedValue, earnedSettled, pendingLiability, refunded, usageUnits, labels }
GET  /api/app/products                   -> [ProductWithPrivate]
GET  /api/app/products/:id               -> ProductWithPrivate   // includes cost model + policy + preview test cases
PATCH /api/app/products/:id/policy       PolicyUpdateBody -> ProductWithPrivate (new policy version)
PATCH /api/app/products/:id/cost         CostUpdateBody   -> ProductWithPrivate (new cost version; existing deals untouched)
POST /api/app/products/:id/preview       { desiredUnits?, budget? } -> { candidates: [Candidate with economics] }
GET  /api/app/negotiations               -> [NegotiationSummary]
GET  /api/app/negotiations/:id           -> Negotiation + { candidates: [Candidate with economics], decisions: [DecisionLog], agentRuns: [AgentRun] }
GET  /api/app/approvals                  -> [Approval]
POST /api/app/approvals/:id/decision     ApprovalDecisionBody -> Approval
GET  /api/app/deals                      -> [DealSummary]
GET  /api/app/deals/:id                  -> Deal + { economics, journal: [JournalEntry], chainTxs[] }
POST /api/app/deals/:id/close-term       -> { txHash }
GET  /api/app/finance                    -> { funded, earned, settled, liability, refunded, journal: [JournalEntry], reconciliation: { lastRunAt, discrepancies[] } }
```

`DecisionLog = { id, at, kind: "candidates"|"counter"|"quote"|"approval"|"injection_blocked", ruleIds[], candidateId?, summary, privateBasis: {...economics}, publicExplanation }`
`AgentRun = { id, at, adapter, steps: [{ at, label, state: "done"|"working"|"blocked", detail? }], durationMs }`

## Review (public, redacted)

```
GET /api/review                 -> [{ publicId, sellerLabel, productName, status, fundedUsd, settledUsd, refundedUsd, network, createdAt }]
GET /api/review/:publicId       -> { timeline: [{ at, kind: "quote"|"accept"|"fund"|"service"|"usage_accept"|"settle"|"refund", summary, txHash?, explorerUrl? }], termsHash, publicTerms, balances, labels }
```
No buyer PII, no seller cost or policy values, no transcripts.

## v1 additions: accounts, dashboard, pay-per-call (2026-10-16)

Auth: every route below (and every `/api/app/*` route) accepts `Authorization: Bearer <privy access token>`; the server verifies it with Privy and resolves the user. The sandbox cookie session remains only for the credential-free demo seller.

```
GET  /api/me
  -> { userId, email?, wallets: [{ address, type: "embedded"|"external", primary: boolean }], org?: { id, slug, name, label, role: "owner" }, labels: { network: "testnet" } }

GET  /api/me/wallet
  -> { address, usdc: micro, native: wei-string, faucetUrl, chainId, explorerUrl }

GET  /api/me/negotiations      -> [NegotiationSummary]   (negotiations started by this user)
GET  /api/me/deals             -> [DealSummary]          (deals where buyerAddress is one of the user's wallets)
GET  /api/me/activity          -> { negotiations, deals, payPerCall: { calls, spent } }

POST /api/orgs                 { name, slug? }             -> org (creates the user's seller org; one per user; issues the org's seller signer)
GET  /api/app/signer           -> { address, scope: "terms+delivery", createdAt, revokedAt? }
POST /api/app/signer/revoke    -> { revokedAt }  (stops future signing; funded deals keep accepting it, stated in the response)
POST /api/app/products         ProductCreateBody -> ProductWithPrivate   (first product publishes cost v1 and policy v1 together)

GET  /api/market               -> [{ sellerSlug, sellerName, sellerLabel, productSlug, name, unitLabel, startingTierUsd, perCallUsd? }]
```

`ProductCreateBody = { name, slug?, unitLabel, billableUnit, capabilities[], supportedIntegrations[], tiers: [{ name, includedUnits, unitPriceUsd, includes[] }], maxUnitsPerDeal, termDays, refundPolicy, cost: { variableCostPerUnitUsd, directCostPerDealUsd, txCostBps }, policy: { minMarginBps, maxDiscountBps, approvalThresholdUsd, prepaidMinimumUsd, availableCapacityUnits, quoteTtlSeconds }, payPerCall?: { priceUsd } }`

Negotiations and quotes started by a logged-in user carry `buyerAddress` = the user's primary wallet; `POST /api/quotes/:id/accept` verifies the signature against a wallet that belongs to the caller.

### Pay per call (x402, Circle facilitator, Arc testnet)

```
POST /api/pay/:sellerSlug/:productSlug/execute   { requestId, input }        (no payment header yet)
  -> 402 { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:5042002", asset: USDC, payTo, amount: micro, maxTimeoutSeconds: 120, resource, extra: { name: "USDC", version: "2" } }], requestId, nonce }
      nonce = keccak256(payer, requestId, resource, amount) computed server-side once the payer is known (buyer passes `payer` in the body)

POST /api/pay/:sellerSlug/:productSlug/execute   { requestId, input, payment: { signature, authorization: { from, to, value, validAfter, validBefore, nonce } } }
  -> 200 ServiceExecute response plus { payment: { paymentId, settleTxHash?, status: "settled"|"pending" } }
```
Server flow: recompute requirements, check `authorization` equals them exactly, `POST facilitator/verify`, execute the service, `POST facilitator/settle`, store `(payer, requestId)` with state. A retry returns the stored response and never settles twice. Failed or handoff responses are not settled (the authorization simply expires).

Note (2026-10-16): Circle's facilitator requires the seller proof to be signed by the `payTo` key, so pay-per-call `payTo` is the org's server-held collection signer, not the owner's wallet. `POST /api/app/signer/sweep` transfers collected USDC (minus a small gas reserve) to the owner's payee and returns the tx hash. Negotiated deals are unaffected: escrow pays the owner's payee directly.

### Chain reads: `POST /api/rpc` (public, read-only)

Same-origin JSON-RPC relay to Arc testnet for the browser. The web app reads balances, allowances and receipts from `https://rpc.testnet.arc.io` first and falls back to this route when the direct request fails (CORS preflight, bot challenge, corporate proxy). Only read methods are forwarded (`eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_call`, `eth_estimateGas`, `eth_gasPrice`, `eth_feeHistory`, `eth_getTransactionCount`, `eth_getTransaction*`, `eth_getBlockBy*`, `eth_getLogs`, `eth_getCode`, `net_version`); anything else answers `-32601 method not relayed`. Batches of up to 20. Upstream failures answer `502` with a JSON-RPC error. Transactions never pass through here: they are signed and sent by the user's wallet.

### Bring your own endpoint (seller-owned service, adapter `http`)

A seller can back a product with its own HTTPS endpoint instead of the first-party sample store. Set `adapter: "http"` and `upstream: { url, authHeader?, secret? }` when publishing (`POST /api/app/products`). The URL must be `https://` (loopback `http://` is allowed for local development); the secret is AES-256-GCM encrypted at rest and never returned by the API.

For every metered request (prepaid deal or pay-per-call) Proteus AI sends:

```
POST <url>
content-type: application/json
authorization: Bearer <secret>            (or <authHeader>: <secret> when a header name is set)
x-proteus-request-id: <requestId>

{ "requestId": "...", "dealId": "deal_... | null", "orgId": "org_...", "productSlug": "...", "input": { ...the buyer's fields as defined by the seller, files as { name, type, size, dataBase64 } } }
```

The endpoint answers with JSON: `{ "answer": "...", "billable": true | false, "status": "delivered" | "failed" | "handoff" }`. A 2xx with `billable` not `false` is one delivered unit and is metered against the deal (or settled through x402 for pay per call). `handoff`, `failed`, any non-2xx status, non-JSON bodies and timeouts (20 s) are never charged. Retries with the same `requestId` return the stored receipt. Products on the sample store carry a "Demo seller" label to buyers; endpoint-backed products on a live org do not.

### Seller identity and the seller-centric market (2026-10-16)

- `GET /api/market/sellers`: every seller with published products, live sellers first. Each entry: `{ slug, name, label, brand: { logoUrl?, tagline?, category?, website?, accent? }, stats: { dealsFunded, settled, inEscrow, since }, products: [{ slug, name, summary, category, unitLabel, capabilities, termDays, tiers, startingTierUsd, bestUnitPriceUsd, perCallUsd, service }] }`. Stats are real sums over the deals table (never estimated); demo sellers get the same math and the label says what they are.
- `GET /api/market/categories`: the category ids buyers can filter by.
- `GET /api/public/sellers/:slug` now carries `brand` and `stats`; public products carry `summary`, `category`, `maxUnitsPerDeal`, `payPerCallUsd` and `service` (`seller-endpoint` | `sample-store` | `demo`).
- `POST /api/orgs` accepts `brand`; `PATCH /api/app/org` (owner session) updates `name` and `brand`. Logos: an https URL, a `/assets/...` path, or a PNG/JPEG/WebP/SVG data URL under 96 KB (SVGs with scripts are rejected). Empty strings clear a field.
- Negotiation views carry `sellerName`, `sellerBrand`, `productName`, `productSummary`, `termDays`; `/api/me/negotiations` and `/api/me/deals` carry `sellerBrand`.
- Demo sellers were removed on 2026-10-16 (`pnpm --filter @proteus/server db:remove-demo`). Every listed product runs on its seller's own endpoint (`service: "seller-endpoint"`); `sample-store` remains only for hidden legacy rows.

### Seller console v2 (owner session)

- `GET /api/app/dashboard`: `revenueEarned` (settled), `fulfilledDeals`, `activeNegotiations`, `needsAttention` (pending approvals), `marginBps` (revenue-weighted contribution margin over accepted quotes, falling back to all quotes; `marginBasis` says which), `fundsHeld` (deposit minus settled minus refunded on funded or active deals), `attention[]` (pending approvals with buyer, product, tier, units, prepaid total, margin and rule ids), `recentDeals[]`.
- `GET /api/app/customers`: one row per buyer wallet with negotiation and deal counts, funded, settled, in escrow, products and first/last activity.
- `GET /api/app/usage`: totals plus the latest 300 service requests with outcome, billed units, cumulative charge, latency and whether the seller receipt is signed.
- `GET /api/app/insights`: a 30-day daily series (negotiations, deals funded, USDC funded, USDC settled from confirmed usage acceptances, requests, billable units) plus conversion and delivery counts. Counts and sums only.

## Deal desk additions (2026-10-22)

All amounts are micro-USDC strings. Seller routes need the owner session.

### Gasless funding (buyer, no transaction)
- `GET /api/deals/:id/permit` returns the EIP-2612 USDC permit to sign: `{ domain: { name, version, chainId, verifyingContract: USDC }, types: { Permit }, primaryType: "Permit", message: { owner, spender: escrow, value: prepaid, nonce, deadline } }`. Check that `owner` is your wallet, `spender` is `deal.escrowAddress`, and `value` equals `terms.prepaid` before signing.
- `POST /api/deals/:id/fund-gasless { deadline, signature }`: the relayer submits `permit` and `createAndFundDeal` in one Multicall3 transaction. 409 if the deal is not awaiting funding, the balance is short, or the simulation reverts. Returns the deal with `status: "funding_pending"` and `funding.txHash`.

### Disputes
- `GET /api/deals/:id/dispute`: the dispute (if any) and the escrow's arbiter.
- `POST /api/deals/:id/dispute { txHash, reason }`: record a dispute that the buyer opened on chain with `openDispute(dealId, keccak256(reason))`. The server checks the DisputeOpened event and the reason hash.

### Pay per call: second x402 option
The 402 body's `accepts` lists `exact` (Circle facilitator, `extra.name = "USDC"`) and, when Gateway supports the network, Circle Gateway batched (`extra.name = "GatewayWalletBatched"`, `extra.verifyingContract` = GatewayWallet). A `gateway` object gives the signing domain, `minValiditySeconds` and `payTo`. To pay with it, deposit USDC into the GatewayWallet once, sign `TransferWithAuthorization` under that domain with `validBefore` at least `minValiditySeconds` ahead and the `nonce` from the 402 body, and send `payment: { scheme: "gateway", signature, authorization }`. The response carries `payment.gatewayTransferId`; there is no per-call transaction hash.

### Seller console
- `POST /api/app/deals/:id/deliveries { units, note?, proofUrl?, requestId }`: record a seller-confirmed delivery batch. It is idempotent per `requestId` and refused beyond the agreement.
- `GET /api/app/export.csv?kind=deals|receipts|journal`: CSV download. Journal columns: Date, Journal No, Account, Debit, Credit, Description, Reference (Arc tx), Explorer.
- `GET /api/app/notifications`, `PUT /api/app/notifications { email?, telegramChatId?, webhookUrl? }` (returns `webhookSecret` once, when a webhook is created), `POST /api/app/notifications/test` (returns `{ ok, errors }`).
- Webhook request: `POST <url>`, JSON `{ id, event, createdAt, data }`. `event` is one of `deal_funded`, `usage_settled`, `refund_issued`, `dispute_opened`, `dispute_resolved`, `approval_required`, `test`. Header `X-Proteus-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`.
- `GET /api/app/embed`, `PUT /api/app/embed { domains: ["https://shop.example"] }`: sites allowed to frame `/embed/:seller`. An empty list allows any site.

## Store, catalog sync and onboarding (2026-10-24)

- `GET /api/public/sellers/:s`: the seller card and its **listed** products only.
- `POST /api/public/sellers/:s/route { message, current? }`: returns `{ productSlug, productName, matched, switched, reason }`, the product a buyer message is about. The store deal desk starts or continues that product's negotiation. With no product named (`matched: false`), the desk answers with a store overview.
- `GET /api/app/catalog-sync`: returns `{ url, authHeader, hasSecret, enabled, everyMinutes, lastRunAt, lastStatus, lastResult }`.
- `PUT /api/app/catalog-sync { url, authHeader?, secret?, enabled? }`: `url: null` removes the sync. The owner session is required.
- `POST /api/app/catalog-sync/run`: syncs now. Returns `{ at, status, updated: [{ slug, changes }], unchanged, notOnProteus, errors }`.
- Catalog feed: the seller's endpoint answers `GET` with JSON `{ "products": [{ "slug", "available"?, "capacityUnits"?, "costPerUnitUsd"?, "prepaidMinimumUsd"?, "approvalThresholdUsd"?, "maxDiscountPct"?, "minMarginPct"? }] }`.
  - Percentages run from 0 to 90.
  - Only fields that differ are written, each as a new policy or cost version.
  - List prices are not part of the feed.
- `DELETE /api/app/org`: discards a seller account with no history and no ERC-8004 identity (for example, a draft published from the wrong wallet). Otherwise it returns 409.
