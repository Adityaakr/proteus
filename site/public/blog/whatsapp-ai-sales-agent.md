# Selling on WhatsApp with an AI agent: five rules for trust, privacy and payment

> How to put an AI sales agent on a business's WhatsApp without taking payments in chat, exposing customers' numbers or breaking Meta's rules.

Aditya, founder of Proteus AI · published 2026-11-11, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/whatsapp-ai-sales-agent

## Key takeaways

- Let the chat negotiate, but never take money in it. Offers go out as buttons, then a 30-minute link to a signed checkout on the web.
- Say it is an AI in the first message, and give the customer HUMAN and STOP from the start.
- Treat a phone number as personal data. Buyers are a one-way pseudonym, and the AI model never sees the number.
- Check every webhook signature before reading anything, and be honest that WhatsApp Business chats are visible to Meta.

## Why we built this at all

I did not plan a WhatsApp channel. The first real business on Proteus AI made the decision for me.

Their whole business runs on WhatsApp. Quotes, haggling, photos of samples, "is it ready yet?", all in one chat thread. Our deal desk lived on a web page they would have to send customers to, and that is exactly where the buying was not happening.

So the same deal desk, under the same rules, now answers on a seller's WhatsApp Business number through Meta's official Cloud API. Building it meant deciding, line by line, what an AI should and should not do inside someone's chat. These are the five rules we ended up with.

## Rule 1: the chat negotiates, it never takes money

Offers arrive as tap-to-accept buttons. Accepting sends a pay link that works for 30 minutes. Signing the terms and paying in USDC happen on the web, never inside the chat.

Payments inside a chat are easy to fake. A screenshot is not a receipt. A signed checkout on Arc leaves a record both sides can check, and the money waits in escrow until the order arrives.

![The WhatsApp flow on Proteus AI, step by step](https://app.proteus.co.in/blog/whatsapp-chat.jpg "Illustration with our demo seller. Every message from the business is the exact text our server sends.")

## Rule 2: the customer always knows it is an AI

The very first reply says it: "Hi, I am Kitbox's AI sales agent. My prices come from Kitbox's own rules. Reply HUMAN to reach the team, or STOP to stop messages."

- **HUMAN** pauses the agent and alerts the seller's team, and their replies come back into the same chat.
- **STOP** opts the customer out immediately. We made sure it is never rate limited, even when everything else is.
- **START** opts back in.

This is also how Meta wants it. AI on WhatsApp is allowed when it is one business's assistant, not a general chatbot.

## Rule 3: a phone number is not a profile

A WhatsApp number is personal data, and a sales tool does not need to see it.

- Each buyer is known by a one-way pseudonym derived from Meta's user id.
- The id we need to reply is encrypted with the seller's own key.
- The seller's console never shows the buyer's number, and the AI model never receives it.
- Emails and phone numbers typed into the chat are stripped out before every model call.

## Rule 4: nothing is trusted until it is checked

Every webhook from Meta is checked against its HMAC signature over the raw body before we read a single field. Unsigned or wrongly signed calls get a 401. Bodies over 1 MB are refused, each message is handled once, and there are limits per buyer and per seller so nobody can run up AI costs. STOP still always goes through.

A smaller, very real lesson from the day we launched it: when you copy a phone number id and token from Meta's dashboard, invisible characters can come along and break the connection, even though the strings look identical on screen. We now strip those characters before connecting, and verify the token with Meta first.

## Rule 5: be honest about what WhatsApp sees

WhatsApp Business chats are not end-to-end encrypted to the business the way personal chats are. Meta's Cloud API decrypts them and keeps messages for up to 30 days. Our [privacy page](https://app.proteus.co.in/docs/privacy) says so plainly. We would rather you know than assume. It is also why costs, margins and pricing rules never go into the chat at all.

## Where it stands today

The WhatsApp channel is built and deployed on Arc mainnet and testnet. A number is connected, and Meta's webhook reaches our server and passes the signature checks. It is in testing. The next step is the first real conversation on someone's phone, then a business connecting its own number.

| Question | Answer |
|---|---|
| Does payment happen in the chat? | No. A 30-minute link opens a signed checkout on the web. |
| Does the business see my number? | No. Buyers are a pseudonym in the seller's console. |
| Does the AI see my number? | No, and numbers or emails typed in are removed first. |
| Can I reach a person? | Yes. Type HUMAN. |
| Can I stop the messages? | Yes. Type STOP at any time. |

## Read more

- [Privacy on Proteus AI](https://app.proteus.co.in/docs/privacy), including WhatsApp.
- [What is an AI deal desk?](https://app.proteus.co.in/blog/what-is-an-ai-deal-desk)
- [Front desk, orders and inbox](https://app.proteus.co.in/docs/front-desk), for businesses whose customers talk to them.

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
