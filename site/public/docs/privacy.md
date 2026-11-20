# Privacy · Proteus AI docs

Source: <https://app.proteus.co.in/docs/privacy> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What each party can see when a buyer talks to a seller's agent, on the web, on WhatsApp or at a front desk._

For sellers deciding what to share and buyers deciding what to say. You will learn what each party can see, how that is enforced, and the limits you should know about.

> A seller's costs and margins never leave the pricing engine. In the deal-desk chat, emails, phone and card numbers are removed before the model sees the text, and buyer contact details never go on chain or into the seller's deal alerts.

### Who sees what

| Party | Sees | Never sees |
|---|---|---|
| Buyer | Its own offers, totals, public reasons and order | The seller's costs, margin floor, policy or other buyers |
| Seller | Its buyers' chats and order details, its own economics | Other sellers' data |
| AI model provider (Anthropic) | Deal desk: the conversation with emails, phone and card numbers removed, plus the public offers. Front desk: the customer's messages as written, name and phone included | Costs, margin floors, policy |
| Meta (WhatsApp chats only) | Message text, phone number and profile name, as for any WhatsApp Business chat | Costs, policy, wallet addresses, deal ids |
| Google (voice in Chrome and Edge) | The audio, when a customer speaks to a front desk in Chrome or Edge (Safari recognises speech on the device) | Anything typed |
| Arc (public chain) | Wallet addresses, amounts and a terms hash for funded deals | Names, phone numbers, chats, order details |
| Proteus operators | Encrypted data at rest; plaintext only in server memory while the agent runs | Plaintext in logs or database backups |

### How it is enforced

- Prices are computed in code from the seller's rules. The model receives only the offers a buyer may see.
- Chats, order details, the private pricing basis and agent notes are encrypted with a key that belongs to the seller (AES-256, bound to the seller so a value cannot be moved to another seller's rows).
- A negotiation can be read only with the key returned when it started (`X-Negotiation-Key`), or by the signed-in owner of the buyer wallet.
- On WhatsApp, a buyer is known by a one-way pseudonym of Meta's user id. Links in chat are opaque and expire after 30 minutes; paying always happens on the web.
- Every WhatsApp chat starts by saying the buyer is talking to the seller's AI agent. HUMAN reaches the seller's team; STOP ends messages.
- Chats and order details can be deleted automatically after a retention period the operator sets (at least 7 days); a live deal is never purged.

### Limits

- WhatsApp Business chats are not end-to-end encrypted to the seller: Meta's Cloud API decrypts them and keeps messages for up to 30 days.
- The server decrypts data in memory to run the agent, so this is protection at rest and in logs, not from an operator with production access.
- Names and street addresses typed into a chat are not detected before the model call.
- Front desk requests are not redacted: the business needs the customer's name and phone, so they go to Claude and to the business's alerts.
- Records written before per-seller encryption existed are still stored as they were.
- Payments on a public chain are public: a funded deal shows the buyer's and seller's wallets and the amount.
