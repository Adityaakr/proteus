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
  -> Negotiation & { buyerKey }   (returned once; send it as X-Negotiation-Key on every /api/negotiations/:id call,
                                   or be signed in as the owner of buyerAddress; otherwise 403 negotiation_key_required)

GET  /api/negotiations/:id
  -> Negotiation

POST /api/negotiations/:id/messages   { content }
  -> Negotiation            (includes the agent's reply turn(s) and any new offers)

POST /api/negotiations/:id/consult    { content, current? }
  -> Negotiation            (store conversations: an open question that names no product. Adds a "consult" turn whose
                             payload `consult` holds { intro, picks: [{ slug, name, unitLabel, reason, fromPrice }],
                             questions, needs }; picks come from the seller's listed products and prices from their
                             tiers. No offers are priced and requirements are unchanged.)

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
  // An agent turn with customRequest: { items } answered a request for something the seller does not list (below).
  activity: [{ at, label, state: "done"|"working" }],   // sanitized progress for ReasoningText/AgentActivity on the buyer side
}
Offer = PublicCandidate from @proteus/domain plus { unitPriceUsd, prepaidTotalUsd, overagePriceUsd? }
```

A buyer who asks for a kind of product the seller does not list ("i want caps" at a store with no caps) gets no offers for it. The server checks every kind the message asks for (read by rule, and by the model when one is configured) against every listed product ([`agent/unlisted.ts`](../server/src/agent/unlisted.ts)): a kind counts as listed when a listed product's name ends with that kind (ignoring trailing colour, size or variant words, so "Classic Tee - Black" is a tee) or its unit is that kind. A word only in a product's summary or the middle of its name ("Loop Cap Bottle") does not make the kind listed. When none is listed, the reply says so plainly, names the closest listed products (the same kind, then the same family, such as other apparel) or what the seller lists, and offers to send the seller a custom request. The product's requirements and offers stay as they were. When the buyer's next message answers that offer (a yes, a quantity, a date or contact details, naming no listed product; asking for the item again with nothing more, or asking about a listed product such as "how much for 20 t-shirts?", is not the request), the agent records a `custom_request` decision, keeps the message in the conversation for the seller, and notifies the seller (`custom_request` event, without the buyer's text). A message that also asks for something listed gets that product's offers and a plain note that the rest is not listed, with no custom request offer. On the store's own deal desk before any product is chosen, the same ask gets a recommendation (a `consult` turn) whose intro says the item is not listed, whose picks are the closest listed products, and whose question is the custom request offer; the turn's payload carries `customRequest: { items }` and the buyer's answer is sent to the seller the same way. When the seller lists several products of the kind asked for ("i want caps" at a store with fourteen caps), routing names those products by their names before any product sold per that unit (a "Bucket Hat" sold per cap) and recommends among them; once on one of them, the reply names the others with their smallest list pack so the buyer can choose.

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

The endpoint answers with JSON: `{ "answer": "...", "billable": true | false, "status": "delivered" | "failed" | "handoff" }`. A 2xx with `status: "delivered"` (and `billable` not `false`), or with no `status` and `billable: true`, is one delivered unit and is metered against the deal (or settled through x402 for pay per call). `handoff`, `failed`, any other reply, any non-2xx status, non-JSON bodies and timeouts (20 s) are never charged. Every outcome is stored under its `requestId`: retries with the same id return the stored result, failures included, and a deal whose included units are used up still calls the endpoint but records the request as failed. The buyer-facing contract is in the docs at `/docs/api`. Products on the sample store carry a "Demo seller" label to buyers; endpoint-backed products on a live org do not.

### Seller identity and the seller-centric market (2026-10-16)

- `GET /api/market/sellers`: every seller with published products, live sellers first. Each entry: `{ slug, name, label, brand: { logoUrl?, tagline?, category?, website?, accent? }, stats: { dealsFunded, settled, inEscrow, since }, products: [{ slug, name, summary, category, unitLabel, capabilities, termDays, tiers, startingTierUsd, bestUnitPriceUsd, perCallUsd, service }] }`. Stats are real sums over the deals table (never estimated); demo sellers get the same math and the label says what they are.
- `GET /api/market/categories`: the category ids buyers can filter by.
- `GET /api/public/sellers/:slug` now carries `brand` and `stats`; public products carry `summary`, `category`, `maxUnitsPerDeal`, `payPerCallUsd` and `service` (`seller-endpoint` | `sample-store` | `demo`).
- `POST /api/orgs` accepts `brand`; `PATCH /api/app/org` (owner session) updates `name` and `brand`. Logos: an https URL, a `/assets/...` path, or a PNG/JPEG/WebP/SVG data URL under 96 KB (SVGs with scripts are rejected). Empty strings clear a field.
- Negotiation views carry `sellerName`, `sellerBrand`, `productName`, `productSummary`, `termDays`; `/api/me/negotiations` and `/api/me/deals` carry `sellerBrand`.
- Demo sellers were removed on 2026-10-16 (`pnpm --filter @proteus/server db:remove-demo`). Every listed product runs on its seller's own endpoint (`service: "seller-endpoint"`); `sample-store` remains only for hidden legacy rows.

### Seller console v2 (owner session)

- `GET /api/app/dashboard`: `revenueEarned` (USDC the escrow paid out; never money still held), `fulfilledDeals` (deals whose deposit is fully paid out, including those the contract still lists as funded), `settledDeals` (deals that paid out anything), `activeNegotiations`, `needsAttention` (pending approvals), `marginBps` (revenue-weighted contribution margin over accepted quotes, falling back to all quotes; `marginBasis` says which), `fundsHeld` (deposit minus settled minus refunded on funded, active or disputed deals), `recentDeals[].status` ("settled" once nothing is left in escrow), `attention[]` (pending approvals with buyer, product, tier, units, prepaid total, margin and rule ids).
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
- `POST /api/public/sellers/:s/route { message, current? }`: returns `{ mode, productSlug, productName, matched, switched, reason, suggested, exclude? }`. `mode: "product"`: the message names exactly one product (not right after "besides", "instead of", "other than" or "except", which leaves it out of a recommendation instead), and the store deal desk starts or continues that product's negotiation. `mode: "consult"` (`matched: false`): an open question ("suggest me some good merch") or several products named (unless the current product is one of them, which stays on it), so the conversation stays on all products and the client calls `POST /api/negotiations/:id/consult`; `suggested` lists products the message pointed at and `exclude` the ones to leave out. A follow-up that names nothing while on a product stays on it unless it asks for something else ("what else do you have?", "other merch"), even when its words appear in another product's summary ("is it available in any other colour?").
- `GET /api/app/catalog-sync`: returns `{ url, authHeader, hasSecret, enabled, everyMinutes, lastRunAt, lastStatus, lastResult }`.
- `PUT /api/app/catalog-sync { url, authHeader?, secret?, enabled? }`: `url: null` removes the sync. The owner session is required.
- `POST /api/app/catalog-sync/run`: syncs now. Returns `{ at, status, updated: [{ slug, changes }], unchanged, notOnProteus, errors }`.
- Catalog feed: the seller's endpoint answers `GET` with JSON `{ "products": [{ "slug", "available"?, "capacityUnits"?, "costPerUnitUsd"?, "prepaidMinimumUsd"?, "approvalThresholdUsd"?, "maxDiscountPct"?, "minMarginPct"? }] }`.
  - Percentages run from 0 to 90.
  - Only fields that differ are written, each as a new policy or cost version.
  - List prices are not part of the feed.
- `DELETE /api/app/org`: discards a seller account with no history and no ERC-8004 identity (for example, a draft published from the wrong wallet). Otherwise it returns 409.

## Developers: seller API keys, webhooks and the seller API (2026-11-20)

Managed on the dashboard's **Developers** page (`/app/sell/developers`, owner session only; the shared example seller cannot).

- `GET /api/app/developers` → `{ env, network, peer, apiBase, scopes, overlap, keys[] }`. Keys are listed masked (`psk_live_Ab3x••••••••9fQz`) with `createdAt`, `lastUsedAt`, `state` (`active | expiring | expired | revoked`).
- `POST /api/app/developers/keys` `{ name, scopes[] }` → `{ key, secret }`. `secret` is the full key, returned **once**; only its SHA-256 is stored.
- `POST /api/app/developers/keys/{id}/regenerate` `{ overlapHours }` → `{ key, secret, previous }`. `overlapHours` 1 to 72 keeps the old key working until then (default 24); `0` cuts it off immediately.
- `POST /api/app/developers/keys/{id}/revoke` → the key, revoked at once.
- `GET /api/app/developers/webhook` → `{ url, hasSecret, events, deliveries[] }` (the newest 50 deliveries: time, event, HTTP status, latency, error).
- `PUT /api/app/developers/webhook` `{ url | null }` → a first URL also returns its signing `secret` once. `POST …/webhook/secret` regenerates it (returned once). `POST …/webhook/test` sends one signed sample event and logs it.
- Events carry `X-Proteus-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`.

Keys are environment-bound: a deployment on Arc testnet issues and accepts only `psk_test_…` keys (testnet data); Arc mainnet only `psk_live_…` keys (mainnet data). A key from the other environment answers 401.

### Seller API (`/api/v1/seller/*`, `Authorization: Bearer psk_…`)

| Method | Path | Permission |
|---|---|---|
| GET | `/v1/seller/me` | any key |
| GET | `/v1/seller/products` | any key |
| PATCH | `/v1/seller/products/{id}/tiers` | `products:write` |
| PATCH | `/v1/seller/products/{id}/listing` | `products:write` |
| GET | `/v1/seller/deals` | `deals:read` |
| GET | `/v1/seller/deals/{id}` | `deals:read` |
| POST | `/v1/seller/deals/{id}/deliveries` | `deliveries:write` |
| POST | `/v1/seller/deals/{id}/order-updates` | `deliveries:write` |
| GET | `/v1/seller/usage` | `usage:read` |
| GET | `/v1/seller/payments` | `payments:read` |

401: missing, unknown, revoked, expired or wrong-environment key. 403: the key lacks the permission (`details.required` names it). Every call records the key's `lastUsedAt`.

### Seller API sandbox (`/api/v1/sandbox/seller/*`, Arc testnet deployment only)

The same routes as `/api/v1/seller/*`, answered from a fixed demo seller held in memory ([`services/sandbox.ts`](../server/src/services/sandbox.ts)), with a published key: `Authorization: Bearer psk_sandbox_demo_seller_testnet_read_only`. The docs reference and the Developers page call it from their Send buttons (any origin, no cookies).

- Reads return demo records in the real response shapes; `GET /me` lists the read scopes and `sandbox.dryRunScopes`.
- Writes are dry runs: the real endpoint's checks run ([`seller-api-rules.ts`](../server/src/services/seller-api-rules.ts), shared with the real handlers), and the answer is `200 { dryRun: true, persisted: false, status, wouldReturn, wouldHappen[] }`. Nothing is stored, signed, paid or sent; refusals use the real status and message.
- The module imports no database, chain or notification code; the real seller API refuses the sandbox key and the sandbox refuses real keys.

```bash
curl https://app.proteus.co.in/api/v1/seller/deals -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const r = await fetch("https://app.proteus.co.in/api/v1/seller/deals", { headers: { Authorization: `Bearer ${process.env.PROTEUS_SELLER_KEY}` } });
const { deals } = await r.json();
```

## Create your deal agent: website import (2026-11-22)

Signed-in account (`requireAuth`); a seller org is not needed yet. Code: [`services/importer/`](../server/src/services/importer/), routes in [`routes/builder.ts`](../server/src/routes/builder.ts).

```
POST  /api/builder/imports                { url }             -> BuilderImport (201, status "running"; the read continues in the background)
GET   /api/builder/imports/latest                              -> BuilderImport | null
GET   /api/builder/imports/:id                                 -> BuilderImport (poll while status is "running")
PATCH /api/builder/imports/:id/answers    AnswersPatch         -> BuilderImport
POST  /api/builder/imports/:id/messages   { text }             -> { understood: string[], view: BuilderImport }
POST  /api/builder/imports/:id/floors     { csv }              -> { applied, unmatched[], errors[], view }
POST  /api/builder/imports/:id/test       { productKey?, message?, counterUsd? } -> TestNegotiation (dry run, nothing stored)
POST  /api/builder/imports/:id/publish    { confirm: true }    -> BuilderImport (status "published", published: { orgSlug, products[] })
POST  /api/builder/imports/:id/continue                        -> BuilderImport (status "running"; reads the product pages in result.unread, from where the read stopped)
```

- `BuilderImport`:
  - `{ id, url, status: "running"|"ready"|"failed"|"published", progress[], error, transcript[], org, network, helpers: { model, browser: "local"|"cloud"|"off", firecrawl } }`.
  - Once read: `result` (the scraped catalog: brand, products, policies, hints, sources tried, suggested FX rate, `elsewhere` catalogues on other services, `browser: { engine, pages }` when pages were rendered; `brand.logoUrl` is the site's logo copied as a PNG, JPEG, WebP or script-free SVG data URL under 96 KB, chosen from the header logo image, the JSON-LD Organization logo, the apple-touch-icon, a PNG or SVG icon, then any other page image that says "logo", so a site that refuses hotlinking still shows its logo), `answers` (the seller's own, including private floors), `draft` (`{ included, ready, next[], items[] }`, each item with `check: true` when it was read from page text) and `published`.
  - Each product carries its `source`: `shopify`, `woocommerce`, `json-ld` and `browser` (structured data on a rendered page) are exact; `page-layout`, `firecrawl` and `page-text` were read from what the page shows and are marked for the seller to check.
- Only the account that started an import can read it. Answers are stored encrypted (`catalog_imports.answers_enc`).
- Source chain, first that yields products:
  1. Shopify `/products.json`.
  2. WooCommerce `/wp-json/wc/store/v1/products`.
  3. schema.org Product/Offer JSON-LD on product pages from the sitemap or the homepage's links (`/products/`, `/product-page/` and similar paths).
  4. A real browser ([`importer/browser-source.ts`](../server/src/services/importer/browser-source.ts)), unless `IMPORTER_BROWSER=off`:
     - It opens the homepage, then the most promising pages: menu and shop links, category and collection pages, routes behind shop buttons, and next-page links. It skips account, cart, blog and policy pages.
     - On each page it scrolls, presses "load more", and takes, in order: structured data the rendered page carries; product cards and a product's own page read from the layout (name, price and currency as shown, options); with no prices anywhere, the site's list of product types.
     - When nothing has a price and a model is configured, the model reads the rendered text.
     - Engine: the browser at `BROWSER_CDP_URL`: the browser service in [`browser/`](../browser/service.ts), a separate service with no application secrets, or a provider. In production the API never starts a browser itself; without `BROWSER_CDP_URL` it reads only the exact sources and says no browser is available. In development, headless Chromium on the machine.
  5. Without a working browser: Firecrawl when `FIRECRAWL_API_KEY` is set, then the static page text read by the deployment's model.

  Model output is kept only when the product name, its price and each option value appear in the page text. No source invents a price: a product without one shown stays priceless until the seller sets it.
- Catalogues on another service (DocSend, Google Drive, Dropbox, Notion, Canva, or a linked PDF) are listed in `result.elsewhere` and never opened.
- Limits:
  - robots.txt is honoured.
  - Product pages: the whole catalogue, up to 400 pages, 180 s and 160 MB in one read, and 480 requests per import, with a 400 ms pause between them. Progress counts against every product page the site lists ("Reading product pages (140 of 200)"). When a budget stops the read, `result.unread` is `{ urls[], total, stoppedBy }`, `result.limited` says how many pages were not read, and `POST .../continue` reads the rest with fresh budgets; the products read so far, and the seller's answers about them, stay.
  - Each response is capped at 2 MB, and each request times out after 12 s.
  - https on port 443 only. Private, loopback and link-local addresses are refused inside the socket's DNS lookup, at every redirect ([`lib/net-guard.ts`](../server/src/lib/net-guard.ts)).
  - The browser: at most 24 pages, 150 s, 4,000 requests and 60 MB per import, two browsers per server at once.
    - It does not load images, fonts, media, analytics or other sites' frames. WebSockets and service workers are blocked, and robots.txt applies to every page and data request on the seller's site. It never logs in, fills a form or buys.
    - The browser service, and a local development browser, reach the network only through [`importer/egress-proxy.ts`](../server/src/services/importer/egress-proxy.ts), one proxy and one fresh Chromium per read. The proxy allows CONNECT to port 443 only, resolves the host itself, refuses private, loopback, link-local and `*.internal` (so `*.railway.internal`) addresses, connects to the address it checked, and cuts the read at its byte budget. Loopback is forced through the proxy too. The service accepts a connection only with its `BROWSER_TOKEN`. The API applies the rules above to every request of the remote browser over the DevTools connection.
  - 8 imports per account per hour.
- `AnswersPatch`:
  - `{ businessName?, businessType?, usdRate?, include?: { [productKey]: boolean }, products?/categories?: { [key]: PriceRule }, defaults?: PriceRule & { maxUnitsPerDeal?, approvalThresholdUsd?, termDays? }, floorsSet?, bulkAnswered?, customOrders? }`.
  - `PriceRule = { priceUsd?, floorUsd?, maxDiscountPct?, moq?, bulkMinUnits?, bulkDiscountPct? }`, all decimal strings.
- Publish refuses until every question is answered and each included product has a list price and a floor; at most 400 products per publish (every product one import can keep).
- Publish creates the org when needed (`createOrg`, the signed-in wallet as owner and payee) and each product through `createProduct`:
  - Seller-delivered (no endpoint).
  - Tiers at the list price, plus a bulk tier if one was set.
  - Cost model with `floorUnitPrice`.
  - Policy with no margin floor and a discount cap set just wide enough never to refuse a price at or above the floor.
  - Public `knowledge` (variants, options, notes, store policies) that the deal agent answers from. A colour the site gives only as a swatch code (`#273a6b`) is stored and shown as the nearest plain colour name (`navy`); products imported before this are named when read.

`CostUpdateBody` (`PATCH /api/app/products/:id/cost`) also takes `floorUnitPrice` (micro-USDC string, or `null` to remove it). The engine's `FLOOR_PRICE` rule refuses any candidate whose prepaid total is below `units × floorUnitPrice` and gives buyers the shared price reason.
