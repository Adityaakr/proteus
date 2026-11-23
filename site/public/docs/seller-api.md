# Seller API · Proteus AI docs

Source: <https://app.proteus.co.in/docs/seller-api> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Run your store from your own systems: read deals, usage and payments, change prices and report deliveries, with keys that can do only what you allow._

For sellers' developers connecting their own systems or agents. You will learn the environments, how keys and permissions work, how to make a first request against the sandbox, and the errors and limits to plan for.

<a id="seller-api-envs"></a>

### Environments

| Environment | Base URL | Data |
|---|---|---|
| Live `psk_live_` | `https://app.proteus.co.in/api/v1/seller` | Arc mainnet: your real deals and USDC. |
| Test `psk_test_` | `https://ai.proteus.co.in/api/v1/seller` | Arc testnet: test deals and test USDC. |
| Sandbox | `https://ai.proteus.co.in/api/v1/sandbox/seller` | A demo seller with fixed demo data and a public key. Writes are dry runs. |

_Each app creates keys for its own network. A key sent to the other network is refused with 401 and a message saying which one it belongs to._

- **JSON in and out.** Money is micro-USDC as a string: `6600000` is $6.60. Times are ISO 8601 in UTC.
- **Scoped to your seller.** Every answer covers your own seller only; another seller's deal or product is a 404 ([developers.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/routes/developers.ts)).
- **Not the buyer's service key.** A seller API key acts for your seller. The key a buyer gets when a deal is funded calls that deal's service at `/api/services/{product}/execute` ([HTTP API](https://app.proteus.co.in/docs/api)).
- **Try it now.** Every endpoint in the [reference](https://app.proteus.co.in/docs/seller-api-reference) has a Send button that calls the sandbox. No sign-in, nothing stored.

<a id="seller-api-auth"></a>

### Authentication

Send your key as a bearer token on every request. Each authenticated call updates the key's last-used time.

```http
Authorization: Bearer psk_live_<43 characters>
```

_Diagram: Every request is checked in this order; each answer covers your own seller only._

Your server sends Authorization: Bearer psk_live_… (or psk_test_…) to /api/v1/seller. Proteus first checks the key's environment against the deployment (test keys on Arc testnet, live keys on Arc mainnet), else 401 naming the right network. It then hashes the key with SHA-256 and looks it up: unknown, revoked or expired keys get 401. The route's permission must be on the key, else 403 naming it. Then the handler reads or writes only that key's seller (another seller's deal or product is 404). The public sandbox key is a separate path: /api/v1/sandbox/seller answers from fixed demo data, and its writes are dry runs.

<a id="seller-api-first-request"></a>

### Make your first request

The sandbox key is public, so this works as is. It returns the demo seller's key details:

```bash
curl https://ai.proteus.co.in/api/v1/sandbox/seller/me \
  -H "Authorization: Bearer psk_sandbox_demo_seller_testnet_read_only"
```

> **Sandbox:** Reads return the same fields as the real API, from fixed demo records. Writes run the API's own checks and answer `{ "dryRun": true, "persisted": false, "status": …, "wouldReturn": …, "wouldHappen": [...] }`: nothing is stored, signed, paid or sent. It runs on the Arc testnet deployment and never touches a real seller, the chain or a webhook.

<a id="seller-api-quickstart"></a>

### Quickstart

The same four steps as on the [Developers](https://app.proteus.co.in/app/sell/developers#quickstart) page, against Arc testnet with a test key. Keep the key in an environment variable on your server. Never commit it or embed it in client-side code you ship; testing it from the console on your own Developers page is fine.

#### 1. Check the key

Send the key as a bearer token. The answer names the key, its environment and its permissions.

```bash
export PROTEUS_SELLER_KEY=psk_test_…

curl https://ai.proteus.co.in/api/v1/seller/me \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const base = "https://ai.proteus.co.in/api/v1/seller";
const headers = { Authorization: `Bearer ${process.env.PROTEUS_SELLER_KEY}` };

const me = await fetch(`${base}/me`, { headers }).then((r) => r.json());
console.log(me.key.scopes); // ["deals:read", …]
```

#### 2. Read your deals

Needs `deals:read`. Amounts are micro-USDC strings: `6600000` is $6.60.

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { deals } = await fetch(`${base}/deals`, { headers }).then((r) => r.json());
for (const d of deals) console.log(d.publicId, d.status, d.settled, d.remaining);
```

#### 3. Report a delivery

Needs `deliveries:write`. Records delivered units as a signed receipt the buyer then countersigns. The same `requestId` never records twice, so retries are safe.

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

#### 4. Update prices

Needs `products:write`. Replaces the public tiers buyers see; deals already signed keep their prices.

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

<a id="seller-api-key"></a>

### API keys

1. **Open Developers.** In the seller console: Sell → [Developers](https://app.proteus.co.in/app/sell/developers) → API keys. Only the signed-in owner of a seller account can manage keys; the shared example seller cannot.
2. **Name it, pick permissions.** A name of 1 to 60 characters, such as "Order sync", and at least one permission.
3. **Copy it once.** The full key is shown once. Proteus stores only its SHA-256 hash and shows a masked key after that, with when it was created and last used ([api-keys.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/api-keys.ts)).

> **Warning: Keep keys on your server.** A key is a bearer credential: anyone who has it can do what its permissions allow until you revoke it. A key is `psk_live_` or `psk_test_` followed by 43 base64url characters (256 random bits).

<a id="seller-api-scopes"></a>

### Permissions

| Permission | Shown as | Allows |
|---|---|---|
| `deals:read` | Read deals | List deals and read one deal's terms, balances and status. |
| `usage:read` | Read usage | Metered requests, delivered units and receipts. |
| `payments:read` | Read payments | Funded, settled, refunded and held totals. |
| `products:write` | Write products and prices | Change public price tiers and list or unlist a product. |
| `deliveries:write` | Write delivery reports | Record delivered units with proof and post order updates. |

`GET /me` and `GET /products` work with any valid key. Every other endpoint needs the permission listed in the [reference](https://app.proteus.co.in/docs/seller-api-reference); without it the answer is 403 and `details.required` names the missing permission. A key's permissions are fixed: to add one, create a new key.

<a id="seller-api-rotate"></a>

### Rotate and revoke

| Action | Old key | Use when |
|---|---|---|
| Regenerate with overlap | Keeps working for the overlap you choose: 24 hours by default, at most 72 | Routine rotation: switch a running integration without downtime |
| Regenerate and cut off | Stops at once (overlap 0) | A key may have leaked |
| Revoke | Stops at once, even inside an overlap | You no longer use the key |

_The new key has the same name, environment and permissions. Up to 20 working keys per seller (active, or inside an overlap). A key already replaced, expired or revoked cannot be regenerated: regenerate its replacement, or create a new key._

<a id="seller-api-rupees"></a>

### Prices in rupees

Buyers pay in USDC; you can still price in rupees. Set your display currency and exchange rate in [Settings](https://app.proteus.co.in/app/sell/settings): a fixed rate with its date, or the European Central Bank's daily reference rate, which Proteus refreshes. `GET /me` returns them as `currency`.

- Price a tier with `unitPriceInr` instead of `unitPriceUsd` in `PATCH /products/:id/tiers`. The rupee price is kept as you set it; an offer's rupee total is converted to USDC once at your current rate, rounded up to the cent, so ₹1,050 at ₹92.68/$ is 11.33 USDC and 50 × ₹900 (₹45,000) is 485.55 USDC.
- Set a rupee floor with `PATCH /products/:id/floor` and `{ "floorUnitPriceInr": "850" }`. Every offer is checked at the current rate, so your agent never goes below ₹850 a unit when the rate moves.
- Buyers choose USD or INR in your embed, store and deal desk. Each offer fixes its rate and shows it; the checkout reads "You pay 485.55 USDC (₹45,000 at ₹92.68/$, rate fixed for this offer)". An offer made before the rate moved cannot be signed: the buyer asks for a fresh one.
- Without a rate, rupee prices and floors answer 409 with `details.code` `rate_required`. Payment in rupees (UPI, cards) is not offered.

<a id="seller-api-errors"></a>

### Errors

Errors are JSON with a plain-language `error` that says what to fix, and `details` when there is more to say.

| Status | Meaning |
|---|---|
| `401` | Missing, unknown, revoked or expired key, or a key from the other environment (test keys only work on testnet, live keys only on mainnet). |
| `403` | The key lacks the permission this endpoint needs. The body names it in details.required. |
| `404` | The deal or product is not yours, or does not exist. |
| `400 / 409` | The request was refused; the error field says why in plain words. |
| `500` | Something failed on our side. The message is generic and the detail stays in our logs; retry later. |

```json
{
  "error": "This key does not have the deals:read permission (read deals). Add it by creating a key with that permission.",
  "details": { "required": "deals:read", "granted": ["products:write"] }
}
```

<a id="seller-api-limits"></a>

### Limits

- No request rate limit today.
- `GET /deals` returns your newest 200 deals and `GET /usage` your newest 300 requests. There is no pagination yet.
- Delivery reports are idempotent on `requestId`: retrying with the same id returns the first receipt instead of recording twice.

<a id="seller-api-next"></a>

### Next

- [API reference](https://app.proteus.co.in/docs/seller-api-reference): every endpoint, with a Send button
- [Webhooks](https://app.proteus.co.in/docs/seller-webhooks): deal events pushed to your server
- [Developers page](https://app.proteus.co.in/app/sell/developers): keys, webhook and a console in the app
