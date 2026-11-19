# Seller API: keys and quickstart · Proteus AI docs

Source: <https://app.proteus.co.in/docs/seller-api> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Read your deals, usage and payments and report deliveries from your own systems, with a key that can do only what you allow._

> Keys, the webhook and this quickstart live on the [Developers](https://app.proteus.co.in/app/sell/developers) page of the seller console. The full endpoint list is in the [reference](https://app.proteus.co.in/docs/seller-api-reference); events pushed to your server are in [Webhooks](https://app.proteus.co.in/docs/seller-webhooks).

- **Base URL.** `https://app.proteus.co.in/api/v1/seller` (Arc mainnet, live keys) or `https://ai.proteus.co.in/api/v1/seller` (Arc testnet, test keys). The Developers page shows the one for the app you are signed in to.
- **JSON in and out.** Money is micro-USDC as a string: `6600000` is $6.60. Every response covers your own seller only ([developers.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/routes/developers.ts)).
- **Separate from buyer service keys.** A seller API key acts for your seller. The key a buyer gets when a deal is funded calls that deal's service at `/api/services/{product}/execute` ([API reference](https://app.proteus.co.in/docs/api)).

### Get a key

1. **Open Developers.** In the seller console, Sell → [Developers](https://app.proteus.co.in/app/sell/developers) → API keys. Only the signed-in owner of the seller account can manage keys; the shared example seller cannot.
2. **Name it and choose permissions.** A name of 1 to 60 characters, such as "Order sync", and at least one permission.
3. **Copy it once.** The full key is shown once, in the create response. Proteus stores only its SHA-256 hash; after that the page shows a masked key (`psk_test_AbCd••••••••wXyZ`), when it was created and when it was last used ([api-keys.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/api-keys.ts)).
4. **Keep it on your server.** Send it from your backend only. It is a bearer key: anyone who has it can do what its permissions allow until you revoke it.

### Test and live keys

| Key | Starts with | Works on | Data |
|---|---|---|---|
| Test | `psk_test_` | Arc testnet ([ai.proteus.co.in](https://ai.proteus.co.in)) | Testnet deals, test USDC |
| Live | `psk_live_` | Arc mainnet ([app.proteus.co.in](https://app.proteus.co.in)) | Mainnet deals, real USDC |

_Each app creates keys for its own network: create a test key on the testnet app and a live key on the mainnet app. A key sent to the other network is refused with 401 and a message saying which one it belongs to._

### Permissions

| Permission | Shown as | Allows |
|---|---|---|
| `deals:read` | Read deals | List deals and read one deal's terms, balances and status. |
| `usage:read` | Read usage | Metered requests, delivered units and receipts. |
| `payments:read` | Read payments | Funded, settled, refunded and held totals. |
| `products:write` | Write products and prices | Change public price tiers and list or unlist a product. |
| `deliveries:write` | Write delivery reports | Record delivered units with proof and post order updates. |

`GET /me` and `GET /products` work with any valid key. Every other endpoint needs the permission listed for it in the [reference](https://app.proteus.co.in/docs/seller-api-reference); without it the answer is 403 and `details.required` names the missing permission. A key's permissions are fixed: to add one, create a new key.

### Authenticate

```text
Authorization: Bearer psk_test_<43 characters>
```

A key is `psk_test_` or `psk_live_` followed by 43 base64url characters (256 random bits). Each authenticated call updates the key's last-used time.

### Regenerate and revoke

- **Regenerate with overlap.** Makes a new key with the same name, environment and permissions. The old key keeps working for an overlap you choose, 24 hours by default and at most 72, so a running integration can switch without downtime.
- **Regenerate and cut off.** An overlap of 0 stops the old key at once. Use it when a key may have leaked.
- **Revoke.** Stops a key immediately, including an old key still inside its overlap.
- **Limits.** Up to 20 working keys per seller (active, or still inside an overlap). A key already replaced, expired or revoked cannot be regenerated: regenerate its replacement, or create a new key.

### Quickstart

The same four steps as on the Developers page, against Arc testnet with a test key. Put your key in `PROTEUS_SELLER_KEY`; never commit it.

1. Check the key. Every request sends the key as a bearer token. This answers with the key's name, environment and permissions.

```bash
export PROTEUS_SELLER_KEY=psk_test_…

curl https://ai.proteus.co.in/api/v1/seller/me \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const base = "https://ai.proteus.co.in/api/v1/seller";
const headers = { Authorization: `Bearer ${process.env.PROTEUS_SELLER_KEY}` };

const me = await fetch(`${base}/me`, { headers }).then((r) => r.json());
console.log(me.key.scopes); // ["deals:read", ...]
```

2. Read your deals. Needs deals:read. Amounts are micro-USDC strings: 6600000 is $6.60.

```bash
curl https://ai.proteus.co.in/api/v1/seller/deals \
  -H "Authorization: Bearer $PROTEUS_SELLER_KEY"
```

```ts
const { deals } = await fetch(`${base}/deals`, { headers }).then((r) => r.json());
for (const d of deals) console.log(d.publicId, d.status, d.settled, d.remaining);
```

3. Report a delivery. Needs deliveries:write. Records delivered units with proof as a signed receipt the buyer then accepts; requestId makes retries safe.

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
});
```

4. Update prices. Needs products:write. Replaces the public tiers buyers see; deals already signed keep their prices.

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
  body: JSON.stringify({ tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }] }),
});
```

### Errors and limits

Errors are JSON `{ "error": string, "details": unknown | null }`. The error text says what to fix in plain words.

| Status | Meaning |
|---|---|
| 401 | Missing, unknown, revoked or expired key, or a key from the other environment (test keys only work on testnet, live keys only on mainnet). |
| 403 | The key lacks the permission this endpoint needs. The body names it in details.required. |
| 404 | The deal or product is not yours, or does not exist. |
| 400 / 409 | The request was refused; the error field says why in plain words. |
| 500 | Something failed on our side; the message is generic and the detail stays in our logs. Retry later. |

```json
{
  "error": "This key does not have the deals:read permission (read deals). Add it by creating a key with that permission.",
  "details": { "required": "deals:read", "granted": ["products:write"] }
}
```

- The seller API has no request rate limit today.
- `GET /deals` returns your newest 200 deals and `GET /usage` your newest 300 requests; there is no pagination yet.
- Delivery reports are idempotent on `requestId`: retrying with the same id returns the first receipt instead of recording twice.
