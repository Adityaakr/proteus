# Front desk, orders and inbox · Proteus AI docs

Source: <https://app.proteus.co.in/docs/front-desk> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_What a business and its customers see after the deal: a front desk customers can talk to, order tracking, an inbox, and alerts._

For businesses running a scheduling service on Proteus (receptionist, after-hours answering, callback booking), and for sellers of goods and their buyers. You will learn how customers reach the front desk, how requests reach the inbox and alerts, how billing works, and how an order is tracked to payout.

_Diagram: A customer's request, from the first message to the business's inbox._

A customer chats or speaks on the business's customer link or website embed. The AI assistant answers from the business profile and asks for one missing detail at a time; follow-up questions are never billed. When the request is complete it is metered once as one unit on the business's deal. The customer sees only the reply meant for them; the full note goes to the business's inbox, and an alert goes out by webhook, Telegram or email, flagged urgent for emergencies.

<a id="front-desk-how"></a>

### A front desk your customers can talk to

For scheduling services, the business creates a customer link on its deal page and shares it or embeds it on its website. Its customers chat or speak with its AI assistant there ([customer-link.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/customer-link.ts)).

1. **The assistant greets.** With the business's name from its profile, and starter questions such as "Book an appointment".
2. **It asks for what is missing.** Name, phone, the day and time, the service: one short question at a time, never anything the customer already said.
3. **It books or takes the message.** From the business profile and, when connected, the business's own calendar. Closed days and busy slots get alternatives.
4. **The customer sees their reply.** Only the part meant for them. The full note goes to the business's inbox.
5. **The business is told.** By webhook, Telegram or email, whichever it set on the deal; emergencies and handoffs to a person are flagged urgent.

| Rule | How it works |
|---|---|
| Billing | One finished request is one unit from the business's escrow, once per conversation. Follow-up questions, refusals and failures are never billed. |
| Limits | 40 customer messages per IP per 10 minutes, 400 per customer link per day, and at most 14 customer messages in one conversation. |
| Model | The assistant runs on its service's model: Claude Sonnet 5.5 for the AI receptionist, Claude Haiku 5.5 for callback booking and after-hours answering. |
| Control | The business can replace the link (the old one stops at once) or turn it off. |
| Privacy | The customer's details go to the business, and to Claude to understand the request. The link token is random; only its hash is used for lookup. |

**Website embed:**

```html
<iframe src="https://app.proteus.co.in/embed/talk/<token>" title="Talk to us"
  style="width:100%;max-width:440px;height:620px;border:0;border-radius:16px"
  allow="microphone"></iframe>
```

On testnet the page lives at `https://ai.proteus.co.in/embed/talk/<token>`. The customer page may be framed by any site. The API behind it is `GET /api/public/talk/{token}` and `POST /api/public/talk/{token}/messages`.

<a id="front-desk-profile"></a>

### Business profile, calendar and voice

- **Business profile.** Name, timezone, hours, services, prices, emergency line and appointment length (`PUT /api/services/{product}/profile`). The assistant answers from these facts and says the team will confirm anything not covered.
- **Google Calendar.** Built: the assistant checks free and busy times and books on the business's own calendar, and the server re-checks the slot before writing ([calendar.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/calendar.ts)). Not switched on yet: until it is, bookings arrive as requests to confirm.
- **Voice.** Customers can speak instead of typing, and replies can be read aloud. Speech runs in the browser: Chrome and Edge use Google's speech service, Safari the device. Proteus receives only the transcript. No phone number yet.

<a id="front-desk-inbox"></a>

### The inbox

Every request on the deal, from customers and from the business itself, newest first, with the full note. The business marks each one confirmed, done or cancelled (`POST /api/deals/{id}/requests/{requestId}/status`). Requests the assistant could not finish are labelled and were not charged. Through the API, `GET /api/services/{product}/inbox` returns the newest 200, for scheduling services only.

<a id="front-desk-orders"></a>

### Order tracking for goods

For goods and work the seller delivers, the buyer's deal page is an order tracker ([orders.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/orders.ts)). Sellers post updates in one click from their console; notes and tracking links are encrypted and visible only to the buyer and the seller. Agents read the same history at `GET /api/deals/{id}/timeline`.

| Step | Comes from |
|---|---|
| Paid | The funding transaction on Arc |
| Accepted, In production, Shipped (tracking link), Out for delivery, Delayed (with a reason), Message | The seller's console |
| Delivered | The seller's signed delivery record |
| Seller paid | The settlement transaction on Arc, after the buyer countersigns |

<a id="front-desk-alerts"></a>

### Alerts

Each deal chooses where its buyer hears about it: a signed webhook, Telegram, or email (`PUT /api/deals/{id}/notifications`, [buyer-notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/buyer-notify.ts)). A shopper hears about each order update the seller posts; a business hears about each new customer request. A webhook into Zapier or Make reaches Slack, Sheets, a calendar or a CRM.

| Event | Sent when |
|---|---|
| `order_update` | The seller posts an order update |
| `customer_request` | A front desk request is complete |
| `customer_urgent` | A request mentions an emergency, or needs a person |

**A buyer alert webhook:**

```http
POST /your/webhook HTTP/1.1
Content-Type: application/json
X-Proteus-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your secret>

{
  "event": "customer_request",
  "subject": "New request from a customer",
  "product": "ai-receptionist",
  "note": "…",
  "url": "https://app.proteus.co.in/app/deals/…",
  "at": "2026-11-20T10:00:00.000Z"
}
```

Buyer alerts carry no event id, unlike [seller webhooks](https://app.proteus.co.in/docs/seller-webhooks): use `at` and the content if you need to spot a repeat. Verify the signature the same way as a seller webhook.

> **Warning: Best effort.** Buyer alerts are sent at once with two tries and no delivery log; nothing is retried later. Signed webhooks work today; Telegram and email need their keys on the server. Sellers' own deal events use [webhooks](https://app.proteus.co.in/docs/seller-webhooks) with an outbox and retries.
