# Webhooks · Proteus AI docs

Source: <https://app.proteus.co.in/docs/seller-webhooks> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Deal events POSTed to your server as they happen, signed so you can prove they came from Proteus._

For developers who want deal events pushed to their server. You will set up a webhook, learn the events and their payload, verify the signature, and handle retries and duplicates.

_Diagram: From a deal event to your server, and the check your server makes._

A deal event (funded, settled, refunded, dispute, approval needed, order details, WhatsApp handoff) is queued once in the outbox. After each reconciler tick the outbox is drained: Proteus resolves your host (private, loopback, link-local and metadata addresses are refused), signs t.body with HMAC-SHA256 and your secret, and POSTs it with X-Proteus-Signature: t=…,v1=…. Any 2xx within 5 seconds is a success. A failure is tried again on later runs, up to 5 attempts. Your receiver checks the timestamp, recomputes the HMAC over the raw body and compares in constant time, then deduplicates on the event id.

> Events tell you something happened; the Arc chain is the record. Read balances from the [seller API](https://app.proteus.co.in/docs/seller-api-reference) or the chain before you act on money.

### Set up

1. **Add your URL.** Sell → [Developers](https://app.proteus.co.in/app/sell/developers#webhooks) → Webhooks. It must be https, with no credentials in it, and resolve to a public address ([notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/notify.ts)).
2. **Copy the signing secret.** Your first URL gets a secret, `whsec_` and 48 hex characters, shown once and stored encrypted. Changing the URL keeps it; removing the URL deletes it.
3. **Send a test.** Send test POSTs one signed `test` event at once, logs it and shows the HTTP status and latency. It is tried once, with no retries.

### Events

| Event | When | Fields in data |
|---|---|---|
| `deal_funded` | A buyer funded a deal | deal, amountUsdc (the deposit), txHash, explorer, link |
| `usage_settled` | Delivered usage was settled to you | deal, amountUsdc (paid to you), txHash, explorer, link |
| `refund_issued` | Unused balance was refunded to a buyer | deal, amountUsdc (refunded), txHash, explorer, link |
| `dispute_opened` | A buyer opened a dispute | deal, txHash, explorer, link |
| `dispute_resolved` | A dispute was resolved | deal, toSellerUsdc, toBuyerUsdc, txHash, explorer, link |
| `approval_required` | An offer needs your approval | product, tier, units, amountUsdc, link |
| `order_details` | A buyer sent order details | deal, product, link |
| `whatsapp_human` | A WhatsApp buyer asked for a person | channel, link |

Amounts in events are USDC with six decimals, as a string (`"6.600000"`), unlike the micro-USDC of the API. `deal` is the deal's public id (`d_…`); `link` opens it in your console, and `GET /deals` gives both ids. Events are queued only while you have a webhook, email or Telegram set up.

### Payload

```http
POST /your/webhook HTTP/1.1
Content-Type: application/json
User-Agent: ProteusAI-Webhooks/1
X-Proteus-Signature: t=1795122246,v1=5f2c…

{
  "id": "ntf_…",
  "event": "usage_settled",
  "createdAt": "2026-11-20T10:00:00.000Z",
  "data": {
    "deal": "d_…",
    "amountUsdc": "6.600000",
    "txHash": "0x…",
    "explorer": "https://explorer.arc.io/tx/0x…",
    "link": "https://app.proteus.co.in/app/sell/deals/deal_…"
  }
}
```

A test event has the same envelope with `"event": "test"`, `"test": true` and an id starting `evt_test_`.

### Verify the signature

1. **Read the header.** `X-Proteus-Signature` is `t=<unix seconds>,v1=<hex>`.
2. **Check the time.** Reject a `t` more than a few minutes from now, so an old request cannot be replayed.
3. **Recompute and compare.** HMAC-SHA256 of `<t>.<raw body>` with your secret, compared in constant time with `v1`. Use the body exactly as received, before parsing.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

// header: the X-Proteus-Signature value, "t=<unix>,v1=<hex>"; rawBody: the request body exactly as received.
export function verifyProteus(header: string, rawBody: string, secret: string, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return parts.v1?.length === expected.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}
```

> **Warning:** Regenerating the secret takes effect at once, with no overlap. Update your receiver right after.

### Delivery and retries

| Rule | Behaviour |
|---|---|
| Success | Any 2xx within 5 seconds. Redirects are not followed and the response body is ignored. |
| Retries | A failed event is tried again on later delivery runs, up to 5 attempts in all. |
| Duplicates | If your email or Telegram fails, the webhook can receive the same event again. Deduplicate on `id`. |
| Address check | The host is resolved at send time and refused if it points at a private, loopback, link-local or metadata address. |
| Delivery log | The Developers page lists your last 50 attempts, newest first: time, event, result, HTTP status, latency and error. |
