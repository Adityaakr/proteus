# Front desk, orders and inbox · Proteus AI docs

Source: <https://app.proteus.co.in/docs/front-desk> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What a business and its customers see after the deal: a front desk customers can talk to, order tracking, an inbox, and alerts._

> After a deal is funded, Proteus works for the business every day: its customers talk to its AI assistant, every request lands in an inbox, and anyone who bought goods can track the order to payout.

### A front desk your customers can talk to

For scheduling services (receptionist, after-hours answering, callback booking), the business creates a customer link on its deal page and shares it or embeds it on its website. Its customers chat or speak with its AI assistant there ([customer-link.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/customer-link.ts)).

1. **The assistant greets.** With the business's name from its profile, and starter questions such as "Book an appointment".
2. **It asks for what is missing.** Name, phone, the day and time, the service: one short question at a time, never anything the customer already said.
3. **It books or takes the message.** From the business profile and, when connected, the business's own calendar. Closed days and busy slots get alternatives.
4. **The customer sees their reply.** Only the part meant for them. The full note goes to the business's inbox.
5. **The business is told.** By webhook, Telegram or email; emergencies are flagged urgent.

| Rule | How it works |
|---|---|
| Billing | One finished request is one unit from the business's escrow, once per conversation. Follow-up questions, refusals and failures are never billed. |
| Limits | Per IP and per link per day; at most 14 customer messages per conversation. |
| Control | The business can replace the link (the old one stops at once) or turn it off. |
| Privacy | Customers' details go only to the business. The link token is random; only its hash is used for lookup. |

```html
<iframe src="https://app.proteus.co.in/embed/talk/<token>" title="Talk to us" style="width:100%;max-width:440px;height:620px;border:0;border-radius:16px" allow="microphone"></iframe>
```

### Business profile, calendar and voice

- **Business profile.** Name, timezone, hours, services, prices, emergency line and appointment length. The assistant answers from these facts and says the team will confirm anything not covered.
- **Google Calendar.** Built: the assistant checks free and busy times and books on the business's own calendar, and the server re-checks the slot before writing ([calendar.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/calendar.ts)). Not switched on yet: until it is, bookings arrive as requests to confirm.
- **Voice.** Customers can speak instead of typing, and replies can be read aloud. Speech runs in the browser (Chrome, Edge, Safari); Proteus receives only the transcript. No phone number yet.

### The inbox

Every request on the deal, from customers and from the business itself, newest first, with the full note. The business marks each one confirmed, done or cancelled. Requests the assistant could not finish are labelled and were not charged.

### Order tracking for goods

For goods and work the seller delivers, the buyer's deal page is an order tracker ([orders.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/orders.ts)). Sellers post updates in one click from their console; notes and tracking links are encrypted and visible only to the buyer and the seller.

| Step | Comes from |
|---|---|
| Paid | The funding transaction on Arc |
| Accepted, In production, Shipped (tracking link), Out for delivery, Delayed (with a reason), Message | The seller's console |
| Delivered | The seller's signed delivery record |
| Seller paid | The settlement transaction on Arc, after the buyer countersigns |

### Alerts

Each deal chooses where its buyer hears about it: a signed webhook (works today; Zapier or Make carry it to Slack, Sheets, a calendar or a CRM), Telegram, or email ([buyer-notify.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/buyer-notify.ts)). Verify the webhook with the secret shown once:

```text
X-Proteus-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your secret>
Events: order_update, customer_request, customer_urgent
```
