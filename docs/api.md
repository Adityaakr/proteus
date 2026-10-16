# PROTEUS API (v0)

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
  { requestId, input: { orderId?, email?, question } }
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
