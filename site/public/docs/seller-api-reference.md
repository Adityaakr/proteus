# Seller API reference · Proteus AI docs

Source: <https://app.proteus.co.in/docs/seller-api-reference> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Every /api/v1/seller endpoint: what it needs, what it takes, what it returns. Each one has a Send button that calls the sandbox._

For developers calling the seller API. Each endpoint lists its permission, parameters, an example request and response, and its errors. Money is micro-USDC as a string (`6600000` is $6.60).

Paths are relative to the [base URL](https://app.proteus.co.in/docs/seller-api#seller-api-envs). Examples use `base` and `headers` from [quickstart step 1](https://app.proteus.co.in/docs/seller-api#seller-api-quickstart). Try it sends the request from your browser to the sandbox with its public key: reads return demo data, writes are dry runs.

| Method | Path | Permission | What it does |
|---|---|---|---|
| `GET` | [`/me`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-me) | Any key | The key's seller, name, environment and permissions |
| `GET` | [`/products`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-products) | Any key | Your products with public tiers, endpoint and docs links |
| `PATCH` | [`/products/:id/tiers`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-patch-products-id-tiers) | `products:write` | Replace a product's public price tiers |
| `PATCH` | [`/products/:id/listing`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-patch-products-id-listing) | `products:write` | List or unlist a product in the market |
| `GET` | [`/deals`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-deals) | `deals:read` | Your deals, newest first, with balances |
| `GET` | [`/deals/:id`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-deals-id) | `deals:read` | One deal: terms, balances, usage and transactions |
| `POST` | [`/deals/:id/deliveries`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-post-deals-id-deliveries) | `deliveries:write` | Record delivered units with proof (a signed receipt) |
| `POST` | [`/deals/:id/order-updates`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-post-deals-id-order-updates) | `deliveries:write` | Post an order status update the buyer sees |
| `GET` | [`/usage`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-usage) | `usage:read` | Metered requests and delivery totals |
| `GET` | [`/payments`](https://app.proteus.co.in/docs/seller-api-reference#seller-api-get-payments) | `payments:read` | Funded, settled, refunded and held totals |

### Retrieve the key

`GET /me` · Permission: any valid key · Returns `200`

The seller this key belongs to, with the key's name, environment and permissions. Works with any valid key: use it to check a key before anything else.

```bash
curl https://ai.proteus.co.in/api/v1/seller/me \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const me = await fetch(`${base}/me`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "orgId": "org_…",
  "key": {
    "id": "key_…",
    "name": "Order sync",
    "env": "test",
    "scopes": ["deals:read", "deliveries:write"]
  },
  "network": "testnet"
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |

### List products

`GET /products` · Permission: any valid key · Returns `200`

Your products, newest first, with the public price tiers buyers see, the service endpoint and the product's docs page. Works with any valid key.

```bash
curl https://ai.proteus.co.in/api/v1/seller/products \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { products } = await fetch(`${base}/products`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "products": [{
    "id": "prd_…",
    "slug": "custom-tees",
    "name": "Custom oversized tees",
    "active": true,
    "unitLabel": "tee",
    "tiers": [{
      "id": "starter",
      "name": "Starter",
      "includedUnits": "1",
      "unitPriceUsd": "$6.60",
      "prepaidTotalUsd": "$6.60",
      "includes": []
    }],
    "payPerCallUsd": null,
    "endpoint": "https://…/api/services/custom-tees/execute",
    "docsUrl": "https://…/docs/your-store/custom-tees"
  }]
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |

### Replace price tiers

`PATCH /products/:id/tiers` · Permission: `products:write` · Returns `200`

Replaces every public price tier of a product and returns the product. New quotes use the new prices; deals already signed keep theirs.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | The product's `id` (`prd_…`) from `GET /products`, not its slug. |
| `tiers` | body | array | Yes | 1 to 6 tiers. They are sorted by `includedUnits`. |
| `tiers[].name` | body | string | Yes | Shown to buyers; up to 40 characters are kept. |
| `tiers[].includedUnits` | body | string | Yes | A whole number from 1, at most the product's units per deal. Each tier needs its own quantity. |
| `tiers[].unitPriceUsd` | body | string | Yes | Dollars per unit, more than 0, up to 6 decimals: `"6.60"`. |
| `tiers[].includes` | body | string[] | No | Up to 8 short lines (60 characters each) listing what the tier includes. |

```bash
curl -X PATCH https://ai.proteus.co.in/api/v1/seller/products/PRODUCT_ID/tiers \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tiers": [
      {
        "name": "Starter",
        "includedUnits": "1",
        "unitPriceUsd": "6.60"
      },
      {
        "name": "Bulk",
        "includedUnits": "100",
        "unitPriceUsd": "6.50"
      }
    ]
  }'
```

```ts
const product = await fetch(`${base}/products/${productId}/tiers`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    tiers: [
      {
        name: "Starter",
        includedUnits: "1",
        unitPriceUsd: "6.60"
      },
      {
        name: "Bulk",
        includedUnits: "100",
        unitPriceUsd: "6.50"
      }
    ]
  }),
}).then((r) => r.json());
```

Response `200`:

```json
{
  "id": "prd_…",
  "slug": "custom-tees",
  "active": true,
  "tiers": [
    { "name": "Starter", "unitPriceUsd": "$6.60", … },
    { "name": "Bulk", "unitPriceUsd": "$6.50", … }
  ],
  …
}
```

| Status | When |
|---|---|
| `400` | A tier breaks a rule above; the message names the tier and the rule. |
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `products:write`. |
| `404` | No product with this id belongs to your seller. |

### List or unlist a product

`PATCH /products/:id/listing` · Permission: `products:write` · Returns `200`

Shows a product in the market or hides it, and returns the product. Hidden products keep their existing deals and keys working.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | The product's `id` (`prd_…`) from `GET /products`, not its slug. |
| `active` | body | boolean | Yes | `true` lists the product, `false` hides it. |

```bash
curl -X PATCH https://ai.proteus.co.in/api/v1/seller/products/PRODUCT_ID/listing \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

```ts
const product = await fetch(`${base}/products/${productId}/listing`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    active: false
  }),
}).then((r) => r.json());
```

Response `200`:

```json
{ "id": "prd_…", "slug": "custom-tees", "active": false, … }
```

| Status | When |
|---|---|
| `400` | `active` is not `true` or `false`. |
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `products:write`. |
| `404` | No product with this id belongs to your seller. |

### List deals

`GET /deals` · Permission: `deals:read` · Returns `200`

Your newest 200 deals with their balances in micro-USDC. `status` is what the console shows (`settled` once the whole deposit is paid out); `chainStatus` is the escrow contract's.

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { deals } = await fetch(`${base}/deals`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "deals": [{
    "id": "deal_…",
    "publicId": "d_…",
    "status": "active",
    "chainStatus": "active",
    "buyerAddress": "0x…",
    "deposit": "6600000",
    "settled": "0",
    "refunded": "0",
    "remaining": "6600000",
    "balancesSource": "chain",
    "fundingTxHash": "0x…",
    "createdAt": "2026-11-20T10:00:00.000Z"
  }]
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `deals:read`. |

### Retrieve a deal

`GET /deals/:id` · Permission: `deals:read` · Returns `200`

One deal: its signed terms and hash, balances, funding transaction, usage so far and every transaction on Arc.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | The deal's `id` (`deal_…`) from `GET /deals`, not its public id (`d_…`). |

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const deal = await fetch(`${base}/deals/DEAL_ID`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "id": "deal_…",
  "publicId": "d_…",
  "status": "active",
  "chainStatus": "active",
  "terms": { … },
  "termsHash": "0x…",
  "buyerAddress": "0x…",
  "sellerPayee": "0x…",
  "funding": {
    "txHash": "0x…",
    "status": "confirmed",
    "explorerUrl": "https://…"
  },
  "balances": {
    "deposit": "6600000",
    "settled": "0",
    "refunded": "0",
    "remaining": "6600000",
    "source": "chain"
  },
  …
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `deals:read`. |
| `404` | No deal with this id belongs to your seller. |

### Record a delivery

`POST /deals/:id/deliveries` · Permission: `deliveries:write` · Returns `201`

Records delivered units with proof as a receipt signed by your seller signer. The buyer countersigns the running total, and only then does the escrow pay. Sending the same `requestId` again returns the first receipt instead of recording twice.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | The deal's `id` (`deal_…`) from `GET /deals`, not its public id (`d_…`). |
| `requestId` | body | string | Yes | Your idempotency key: 4 to 80 letters, digits, `.`, `_`, `:` or `-`. |
| `units` | body | integer | Yes | Units delivered in this batch, 1 to 1,000,000. The running total must fit the agreement and the prepaid balance. |
| `note` | body | string | Yes | What was delivered, 3 to 2000 characters. The buyer sees it on the receipt. |
| `proofUrl` | body | string | No | An https link to proof: tracking page, signed delivery note or shared folder. |

```bash
curl -X POST https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID/deliveries \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "order-1042-shipped",
    "units": 1,
    "note": "Shipped by courier",
    "proofUrl": "https://track.example/1042"
  }'
```

```ts
const receipt = await fetch(`${base}/deals/${dealId}/deliveries`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: "order-1042-shipped",
    units: 1,
    note: "Shipped by courier",
    proofUrl: "https://track.example/1042"
  }),
}).then((r) => r.json());
```

Response `201`:

```json
{
  "requestId": "order-1042-shipped",
  "status": "delivered",
  "billable": true,
  "units": 1,
  "receipt": {
    "digest": "0x…",
    "sellerSignature": "0x…",
    "at": "2026-11-20T10:00:00.000Z"
  },
  "deal": {
    "cumulativeUnits": "1",
    "cumulativeCharged": "6600000",
    "remaining": "0"
  },
  …
}
```

| Status | When |
|---|---|
| `400` | A field breaks a rule above. |
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `deliveries:write`. |
| `404` | No deal with this id belongs to your seller. |
| `409` | The deal is not funded or active, or the units would exceed the agreement or the prepaid balance. |

### Post an order update

`POST /deals/:id/order-updates` · Permission: `deliveries:write` · Returns `201`

Posts a status to the buyer's order page and alerts the buyer on the channels they chose. For goods and other work you deliver yourself.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | The deal's `id` (`deal_…`) from `GET /deals`, not its public id (`d_…`). |
| `status` | body | string | Yes | One of `accepted`, `in_production`, `shipped`, `out_for_delivery`, `delayed` or `note`. |
| `note` | body | string | No | Up to 1000 characters. Required for `delayed` (why, and the new date) and for `note`. |
| `trackingUrl` | body | string | No | An https tracking link. |

```bash
curl -X POST https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID/order-updates \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "shipped",
    "note": "Two boxes by courier",
    "trackingUrl": "https://track.example/1042"
  }'
```

```ts
const update = await fetch(`${base}/deals/${dealId}/order-updates`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "shipped",
    note: "Two boxes by courier",
    trackingUrl: "https://track.example/1042"
  }),
}).then((r) => r.json());
```

Response `201`:

```json
{ "id": "du_…", "status": "shipped", "label": "Shipped" }
```

| Status | When |
|---|---|
| `400` | Unknown status, a missing note, or a tracking link that is not https. |
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `deliveries:write`. |
| `404` | No deal with this id belongs to your seller. |
| `409` | The deal is not funded or active. |

### List usage

`GET /usage` · Permission: `usage:read` · Returns `200`

Totals and your newest 300 metered requests and delivery reports, each with its deal, units, running charge and whether its receipt is signed.

```bash
curl https://ai.proteus.co.in/api/v1/seller/usage \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { totals, requests } = await fetch(`${base}/usage`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "totals": {
    "requests": 12,
    "delivered": 11,
    "handoff": 0,
    "failed": 1,
    "billableUnits": 11,
    "avgLatencyMs": 840
  },
  "requests": [{
    "requestId": "order-1042-shipped",
    "dealId": "deal_…",
    "dealPublicId": "d_…",
    "productName": "Custom oversized tees",
    "status": "delivered",
    "billable": true,
    "units": 1,
    "cumulativeCharged": "6600000",
    "signed": true,
    "at": "2026-11-20T10:00:00.000Z",
    …
  }]
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `usage:read`. |

### Retrieve payments

`GET /payments` · Permission: `payments:read` · Returns `200`

Money across all your deals, in micro-USDC: funded, settled to you, delivered but not yet settled, still held for buyers, and refunded.

```bash
curl https://ai.proteus.co.in/api/v1/seller/payments \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const payments = await fetch(`${base}/payments`, { headers })
  .then((r) => r.json());
```

Response `200`:

```json
{
  "funded": "13200000",
  "settled": "6600000",
  "earnedUnsettled": "0",
  "liability": "6600000",
  "refunded": "0",
  "reconciliation": {
    "lastRunAt": "2026-11-20T10:00:00.000Z",
    "discrepancies": []
  },
  "labels": {
    "network": "testnet",
    "note": "Deposits are customer liabilities until …"
  }
}
```

| Status | When |
|---|---|
| `401` | The key is missing, unknown, revoked, expired or from the other environment. |
| `403` | The key lacks `payments:read`. |
