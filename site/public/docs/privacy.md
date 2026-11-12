# Privacy · Proteus AI docs

Source: <https://app.proteus.co.in/docs/privacy> · facts as of 2026-11-13 · all docs: <https://app.proteus.co.in/docs.md>



_What each party can see when a buyer talks to a seller's agent, on the web or on WhatsApp._

> A seller's costs and margins never leave the pricing engine. Buyer contact details are never sent to the AI model, the chain or seller notifications.

### Who sees what

| Party | Sees | Never sees |
|---|---|---|
| Buyer | Its own offers, totals, public reasons and order | The seller's costs, margin floor, policy or other buyers |
| Seller | Its buyers' chats and order details, its own economics | Other sellers' data |
| AI model provider | The conversation with emails, phone and card numbers removed, plus the public offers | Costs, margin floors, policy, contact details |
| Meta (WhatsApp chats only) | Message text, phone number and profile name, as for any WhatsApp Business chat | Costs, policy, wallet addresses, deal ids |
| Arc (public chain) | Wallet addresses, amounts and a terms hash for funded deals | Names, phone numbers, chats, order details |
| Proteus operators | Encrypted data at rest; plaintext only in server memory while the agent runs | Plaintext in logs or database backups |

### How it is enforced

- Prices are computed in code from the seller's rules. The model receives only the offers a buyer may see.
- Chats, order details, the private pricing basis and agent notes are encrypted with a key that belongs to the seller.
- A negotiation can be read only with the key returned when it started, or by the signed-in owner of the buyer wallet.
- On WhatsApp, a buyer is known by a one-way pseudonym of Meta's user id. Links in chat are opaque and expire after 30 minutes; paying always happens on the web.
- Every WhatsApp chat starts by saying the buyer is talking to the seller's AI agent. HUMAN reaches the seller's team; STOP ends messages.
- Chats and order details can be deleted automatically after a retention period the operator sets.

### Limits

- WhatsApp Business chats are not end-to-end encrypted to the seller: Meta's Cloud API decrypts them and keeps messages for up to 30 days.
- The server decrypts data in memory to run the agent, so this is protection at rest and in logs, not from an operator with production access.
- Names and street addresses typed into a chat are not detected before the model call.
- Payments on a public chain are public: a funded deal shows the buyer's and seller's wallets and the amount.
