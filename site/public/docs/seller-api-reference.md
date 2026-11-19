# Seller API reference · Proteus AI docs

Source: <https://app.proteus.co.in/docs/seller-api-reference> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Every /api/v1/seller endpoint, the permission it needs, and a curl and TypeScript example._

Paths are relative to the base URL, `https://app.proteus.co.in/api/v1/seller` on Arc mainnet or `https://ai.proteus.co.in/api/v1/seller` on Arc testnet. The TypeScript examples use `base` and `headers` from [quickstart step 1](https://app.proteus.co.in/docs/seller-api#seller-api-quickstart). `:id` is the `id` field of a product or deal (`prd_…`, `deal_…`), not its public id or slug.

| Method | Path | Permission | What it does |
|---|---|---|---|
| `GET` | `/me` | Any key | The key's seller, name, environment and permissions |
| `GET` | `/products` | Any key | Your products with public tiers, endpoint and docs links |
| `PATCH` | `/products/:id/tiers` | `products:write` | Replace a product's public price tiers |
| `PATCH` | `/products/:id/listing` | `products:write` | List or unlist a product in the market |
| `GET` | `/deals` | `deals:read` | Your deals, newest first, with balances |
| `GET` | `/deals/:id` | `deals:read` | One deal: terms, balances, usage and transactions |
| `POST` | `/deals/:id/deliveries` | `deliveries:write` | Record delivered units with proof (a signed receipt) |
| `POST` | `/deals/:id/order-updates` | `deliveries:write` | Post an order status update the buyer sees |
| `GET` | `/usage` | `usage:read` | Metered requests and delivery totals |
| `GET` | `/payments` | `payments:read` | Funded, settled, refunded and held totals |

### GET /me

The key's seller, name, environment and permissions. Needs any valid key.

```bash
curl https://ai.proteus.co.in/api/v1/seller/me \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const me = await fetch(`${base}/me`, { headers }).then((r) => r.json());
```

```json
{
  "orgId": "org_…",
  "key": { "id": "key_…", "name": "Order sync", "env": "test", "scopes": ["deals:read", "deliveries:write"] },
  "network": "testnet"
}
```

### GET /products

Your products with public tiers, endpoint and docs links. Needs any valid key.

```bash
curl https://ai.proteus.co.in/api/v1/seller/products \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { products } = await fetch(`${base}/products`, { headers }).then((r) => r.json());
```

```json
{
  "products": [{
    "id": "prd_…", "slug": "custom-tees", "name": "Custom oversized tees", "active": true, "unitLabel": "tee",
    "tiers": [{ "id": "starter", "name": "Starter", "includedUnits": "1", "unitPriceUsd": "$6.60", "prepaidTotalUsd": "$6.60", "includes": [] }],
    "payPerCallUsd": null,
    "endpoint": "https://…/api/services/custom-tees/execute",
    "docsUrl": "https://…/docs/your-store/custom-tees"
  }]
}
```

### PATCH /products/:id/tiers

Replace a product's public price tiers. Needs `products:write`. Body: tiers: 1 to 6 of { name, includedUnits (whole number, each tier its own, at most the product's units per deal), unitPriceUsd (dollars as a string, up to 6 decimals, more than 0), includes? (up to 8 short strings) }. Replaces every tier.

```bash
curl -X PATCH https://ai.proteus.co.in/api/v1/seller/products/PRODUCT_ID/tiers \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tiers":[{"name":"Starter","includedUnits":"1","unitPriceUsd":"6.60"},{"name":"Bulk","includedUnits":"100","unitPriceUsd":"6.50"}]}'
```

```ts
await fetch(`${base}/products/${productId}/tiers`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }, { name: "Bulk", includedUnits: "100", unitPriceUsd: "6.50" }] }),
}).then((r) => r.json());
```

```json
{ "id": "prd_…", "slug": "custom-tees", "active": true, "tiers": [{ "name": "Starter", "includedUnits": "1", "unitPriceUsd": "$6.60", … }, { "name": "Bulk", "includedUnits": "100", "unitPriceUsd": "$6.50", … }], … }
```

### PATCH /products/:id/listing

List or unlist a product in the market. Needs `products:write`. Body: active: true to list the product in the market, false to hide it. Existing deals keep working.

```bash
curl -X PATCH https://ai.proteus.co.in/api/v1/seller/products/PRODUCT_ID/listing \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'
```

```ts
await fetch(`${base}/products/${productId}/listing`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ active: false }),
}).then((r) => r.json());
```

```json
{ "id": "prd_…", "slug": "custom-tees", "active": false, … }
```

### GET /deals

Your deals, newest first, with balances. Needs `deals:read`.

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { deals } = await fetch(`${base}/deals`, { headers }).then((r) => r.json());
```

```json
{
  "deals": [{
    "id": "deal_…", "publicId": "d_…", "status": "active", "chainStatus": "active", "buyerAddress": "0x…",
    "deposit": "6600000", "settled": "0", "refunded": "0", "remaining": "6600000",
    "balancesSource": "chain", "fundingTxHash": "0x…", "createdAt": "2026-11-20T10:00:00.000Z"
  }]
}
```

### GET /deals/:id

One deal: terms, balances, usage and transactions. Needs `deals:read`.

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const deal = await fetch(`${base}/deals/${dealId}`, { headers }).then((r) => r.json());
```

```json
{
  "id": "deal_…", "publicId": "d_…", "status": "active", "chainStatus": "active",
  "terms": { … }, "termsHash": "0x…", "buyerAddress": "0x…", "sellerPayee": "0x…",
  "funding": { "txHash": "0x…", "status": "confirmed", "explorerUrl": "https://…" },
  "balances": { "deposit": "6600000", "settled": "0", "refunded": "0", "remaining": "6600000", "source": "chain" },
  …
}
```

### POST /deals/:id/deliveries

Record delivered units with proof (a signed receipt). Needs `deliveries:write`. Body: requestId (4 to 80 of letters, digits . _ : -; the same id again returns the first receipt), units (whole number from 1), note (3 to 2000 characters: what was delivered), proofUrl? (https link). The deal must be funded or active, and the units must fit the agreement and the prepaid balance.

```bash
curl -X POST https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID/deliveries \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"order-1042-shipped","units":1,"note":"Shipped by courier","proofUrl":"https://track.example/1042"}'
```

```ts
await fetch(`${base}/deals/${dealId}/deliveries`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ requestId: "order-1042-shipped", units: 1, note: "Shipped by courier", proofUrl: "https://track.example/1042" }),
}).then((r) => r.json());
```

```json
{
  "requestId": "order-1042-shipped", "status": "delivered", "billable": true, "units": 1,
  "receipt": { "digest": "0x…", "sellerSignature": "0x…", "at": "2026-11-20T10:00:00.000Z" },
  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "6600000", "remaining": "0" },
  …
}
```

### POST /deals/:id/order-updates

Post an order status update the buyer sees. Needs `deliveries:write`. Body: status: accepted, in_production, shipped, out_for_delivery, delayed (note required: why and the new date) or note (note required); note? (up to 1000 characters); trackingUrl? (https link). The deal must be funded or active.

```bash
curl -X POST https://ai.proteus.co.in/api/v1/seller/deals/DEAL_ID/order-updates \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"shipped","note":"Two boxes by courier","trackingUrl":"https://track.example/1042"}'
```

```ts
await fetch(`${base}/deals/${dealId}/order-updates`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ status: "shipped", note: "Two boxes by courier", trackingUrl: "https://track.example/1042" }),
}).then((r) => r.json());
```

```json
{ "id": "du_…", "status": "shipped", "label": "Shipped" }
```

### GET /usage

Metered requests and delivery totals. Needs `usage:read`.

```bash
curl https://ai.proteus.co.in/api/v1/seller/usage \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { totals, requests } = await fetch(`${base}/usage`, { headers }).then((r) => r.json());
```

```json
{
  "totals": { "requests": 12, "delivered": 11, "handoff": 0, "failed": 1, "billableUnits": 11, "avgLatencyMs": 840 },
  "requests": [{ "requestId": "order-1042-shipped", "dealId": "deal_…", "dealPublicId": "d_…", "productName": "Custom oversized tees", "status": "delivered", "billable": true, "units": 1, "cumulativeCharged": "6600000", "signed": true, "at": "2026-11-20T10:00:00.000Z", … }]
}
```

### GET /payments

Funded, settled, refunded and held totals. Needs `payments:read`.

```bash
curl https://ai.proteus.co.in/api/v1/seller/payments \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const payments = await fetch(`${base}/payments`, { headers }).then((r) => r.json());
```

```json
{
  "funded": "13200000", "settled": "6600000", "earnedUnsettled": "0", "liability": "6600000", "refunded": "0",
  "reconciliation": { "lastRunAt": "2026-11-20T10:00:00.000Z", "discrepancies": [] },
  "labels": { "network": "testnet", "note": "Deposits are customer liabilities until usage is accepted and settled. Unused balances are never seller revenue." }
}
```
