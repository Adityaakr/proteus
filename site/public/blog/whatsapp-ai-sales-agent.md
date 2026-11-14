# Selling on WhatsApp with an AI agent: five rules for trust, privacy and payment

> How to put an AI sales agent on a business's WhatsApp without taking payments in chat, exposing customers' numbers or breaking Meta's rules.

Proteus AI team · published 2026-11-11, updated 2026-11-14 · 3 min read · https://app.proteus.co.in/blog/whatsapp-ai-sales-agent

## Key takeaways

- Let the chat negotiate, never take money: offers as buttons, then a short-lived link to a signed checkout on the web.
- Tell the customer it is an AI from the first message, and give them HUMAN and STOP.
- Treat a phone number as personal data: identify buyers by a one-way pseudonym and keep numbers away from the AI model.
- Verify every webhook signature before reading it, and be honest that WhatsApp Business chats are visible to Meta.

## Why WhatsApp

For many small businesses, WhatsApp is the shop. Quotes, haggling, photos of samples and "is it ready?" all happen in one chat thread. The first real business we worked with runs this way. A deal desk that lives only on a website misses where the buying actually happens.

So the same deal desk, under the same rules, answers on a seller's WhatsApp Business number through Meta's official Cloud API. Building it meant deciding what an AI should and should not do inside a chat. These are the five rules we landed on.

## Rule 1: the chat negotiates, it never takes money

Offers arrive as tap-to-accept buttons. Accepting sends a secure pay link that works for 30 minutes. Signing the terms and paying in USDC happen on the web, never inside the chat.

Payments inside a chat are hard to verify and easy to fake: a screenshot is not a receipt. A signed checkout on Arc leaves a record both sides can check, and the money waits in escrow until delivery.

## Rule 2: the customer always knows it is an AI

The first reply says the customer is talking to the business's AI agent and how to reach a person.

- **HUMAN** pauses the agent and alerts the seller's team, whose replies come back into the same chat.
- **STOP** opts the customer out at once, and is never rate limited.
- **START** opts back in.

This is also what Meta requires: AI on WhatsApp is allowed when it is scoped to one business, not as a general assistant.

## Rule 3: a phone number is not a profile

A WhatsApp number is personal data, and a sales tool does not need it in plain sight.

- Each buyer is known by a one-way pseudonym derived from Meta's user id.
- The id needed to reply is encrypted with the seller's own key.
- The seller's console never shows the buyer's number, and the AI model never receives it.
- Emails and phone numbers typed into the chat are removed before every model call.

## Rule 4: nothing is trusted until it is verified

Every webhook from Meta is checked against its HMAC signature over the raw body before anything is read. Unsigned or wrongly signed calls are refused with 401, bodies over 1 MB are refused, and each message is handled once. Limits per buyer and per seller cap abuse and AI spend, while STOP always goes through.

## Rule 5: be honest about what WhatsApp sees

WhatsApp Business chats are not end-to-end encrypted to the business the way personal chats are. Meta's Cloud API decrypts them and keeps messages for up to 30 days. We say so on our [privacy page](https://app.proteus.co.in/docs/privacy) rather than imply otherwise, and we keep costs, margins and policy out of the chat entirely, so the most sensitive business data never travels through it.

## Where it stands

The WhatsApp channel is built and deployed on Arc mainnet and testnet, a number is connected, and Meta's webhook reaches our server and passes signature checks. It is in testing: the next step is the first real conversation on a phone, then a business's own number.

| Question | Answer |
|---|---|
| Does payment happen in the chat? | No. A 30-minute link opens a signed checkout on the web. |
| Does the business see my number? | No. Buyers are a pseudonym in the seller's console. |
| Does the AI see my number? | No, and numbers or emails typed in are removed first. |
| Can I reach a person? | Yes. Type HUMAN. |
| Can I stop messages? | Yes. Type STOP at any time. |

## Learn more

- [Privacy on Proteus AI](https://app.proteus.co.in/docs/privacy), including WhatsApp.
- [What is an AI deal desk?](https://app.proteus.co.in/blog/what-is-an-ai-deal-desk)
- [Front desk, orders and inbox](https://app.proteus.co.in/docs/front-desk) for businesses whose customers talk to them.

## Frequently asked questions

### Can an AI agent sell on WhatsApp?

Yes, through Meta's WhatsApp Cloud API, if it is scoped to one business, discloses that it is an AI, and lets the customer reach a person and opt out.

### Should payments happen inside WhatsApp?

We recommend not. On Proteus AI the chat negotiates and sends a 30-minute link to a signed USDC checkout on the web, so the payment can be verified on chain.

### Does the seller see the buyer's phone number?

No. On Proteus AI buyers are identified by a one-way pseudonym; the number needed to reply is encrypted with the seller's own key and never shown.

### Are WhatsApp Business chats end-to-end encrypted?

Not to the business. Meta's Cloud API decrypts them and keeps messages for up to 30 days, which is why costs, margins and policy never enter the chat.

### Is the Proteus AI WhatsApp channel live?

It is built and deployed on Arc mainnet and testnet and is in testing; the first real conversation on a phone is the next step.
