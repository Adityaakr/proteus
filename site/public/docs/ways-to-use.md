# Ways to use Proteus AI · Proteus AI docs

Source: <https://app.proteus.co.in/docs/ways-to-use> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_One deal agent, many ways in: the web, a seller's website, WhatsApp, Claude and other MCP clients, your own agent, and your own systems._

For sellers choosing where their agent should answer, and for buyers and builders choosing how to reach it. You will learn what each channel does, who it suits, how to start, and how far it is proven today.

_Diagram: Every channel reaches the same deal agent, prices from the same rules and ends in the same escrow._

Buyers reach the same deal agent from the web app, a seller's website embed, the seller's WhatsApp number, an MCP client such as Claude, their own agent over HTTP, and later a phone app (planned). The deal agent prices only from the seller's rules. The seller sets those rules in the seller console and connects its own systems through the seller API and webhooks. Every channel ends in the same signed terms and the same DealEscrow contract on Arc.

> **Same rules everywhere:** A channel changes where the conversation happens, never the price rules, the terms or where the money goes. Signing and paying always happen on a Proteus page or with the buyer's own key, never inside a chat or a third-party frame.

<a id="ways-status"></a>

### What the status means

| Status | Meaning |
|---|---|
| Live | In production and in use. Where money moves, used on Arc mainnet with real USDC. |
| Testnet | Proven end to end on Arc testnet. It also runs against mainnet, but has not been proven there yet. |
| In testing | Built and deployed, checked in tests, but not yet used end to end by a real customer. |
| Planned | Not built yet. Listed so you know it is missing; no date is promised. |

<a id="ways-talk"></a>

### Talk to a seller's deal agent

<a id="ways-web"></a>

#### Web app · Live

- **For:** Buyers who want to talk to a seller directly, and sellers running their store.
- **Does:** Store pages where one agent answers for every product, offer review with the public terms hash checked in your browser, gasless funding, and deal pages with balances, order tracking, refunds and disputes. Sellers set products and rules in the console. Sign in with a browser wallet, or on Arc testnet with email, which creates a Circle wallet.
- **Proof:** A Shoonya Store order on Arc mainnet, [funded](https://explorer.arc.io/tx/0x9145fb235f7c00e625ccb91e3a8a817dcf3cd0b1ee4265fd5697cf79cb1b62a7) gaslessly and [settled](https://explorer.arc.io/tx/0x852725276799255fa7425be9aafcd2296828a0a9553e3e2b9394104fcbad5542). Its buyer wallet was later found linked to a Shoonya team account ([why](https://app.proteus.co.in/docs/ratings#ratings-before-checks)).
- **Start:** [Buyer quickstart](https://app.proteus.co.in/docs/quickstart-buyer)

<a id="ways-embed"></a>

#### Website embed · Testnet

- **For:** Sellers who want quotes on their own website.
- **Does:** One script tag adds the deal agent as a floating "Get a quote" button or an inline panel. It runs in a Proteus frame; signing and payment open Proteus in a new tab.
- **Proof:** Tested from a third-party site on Arc testnet. The script is served by both apps.
- **Start:** [Add it to your site](https://app.proteus.co.in/docs/quickstart-seller#seller-embed)

<a id="ways-whatsapp"></a>

#### WhatsApp agent · In testing

- **For:** Sellers whose customers already buy over WhatsApp.
- **Does:** The same deal agent answers on the seller's own WhatsApp Business number through Meta's Cloud API. Offers arrive as reply buttons; paying always happens on the web through a 30-minute link. HUMAN reaches the team, STOP ends messages.
- **Proof:** Deployed on both networks; a number is connected and Meta's signed webhook is verified. No real customer conversation yet.
- **Start:** [How it works](https://app.proteus.co.in/docs/ways-to-use#ways-whatsapp-how)

<a id="ways-phone"></a>

#### Phone app · Planned

- **For:** Sellers and buyers who want Proteus AI as an app on their phone.
- **Does:** Not built yet. Today the web app works in a phone browser, with a tab bar on small screens.
- **Proof:** None yet.
- **Start:** [Open the web app](https://app.proteus.co.in)

<a id="ways-agents"></a>

### Let an AI agent buy

<a id="ways-mcp"></a>

#### MCP server · Testnet

- **For:** People who want Claude or another MCP client to buy for them, within a limit.
- **Does:** Nine tools: find services, negotiate, verify the seller on Arc, accept, fund, call the service, settle and check balances. A per-deal mandate caps the prepaid amount. It runs on your machine from a clone of the repository.
- **Proof:** Claude bought and settled within a 13 USDC mandate on Arc testnet ([transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md)). Not yet run on mainnet.
- **Start:** [Agent quickstart](https://app.proteus.co.in/docs/quickstart-agent)

<a id="ways-own-agent"></a>

#### Your own agent (HTTP) · Testnet

- **For:** Teams with an agent of their own, in any language or framework.
- **Does:** The [agent skill](https://app.proteus.co.in/api/public/agents/skill.md) walks through discovering, negotiating, signing, funding and settling over plain HTTP; each service also has its own `skill.md` and `openapi.json`. Small one-off calls can be paid per call with x402. Any EIP-712 signer works, including a Circle Agent Wallet.
- **Proof:** x402 pay per call [on Arc testnet](https://explorer.testnet.arc.io/tx/0x3d5c48a9a3fb765d5821479d0f46d4c94b8a17fc6763048fedb6f323f28de9f8). An agent buying on mainnet is not proven yet.
- **Start:** [For AI agents](https://app.proteus.co.in/docs/for-agents)

<a id="ways-agent-docs"></a>

#### Docs for agents · Live

- **For:** AI assistants and agents that need to understand Proteus before they act.
- **Does:** Every page as Markdown, an [llms.txt](https://app.proteus.co.in/llms.txt) index, and [facts.json](https://app.proteus.co.in/docs/facts.json) with networks, contracts, endpoints, limits and every claim with its evidence. Each page also has Copy page, .md, Open in Claude and Open in ChatGPT.
- **Proof:** Generated from the same source as these pages at every build, so they cannot drift from them.
- **Start:** [Read llms.txt](https://app.proteus.co.in/llms.txt)

<a id="ways-business"></a>

### Connect your business

<a id="ways-seller-api"></a>

#### Seller API and webhooks · In testing

- **For:** Sellers who want their own systems, or their own AI agent, to run the store.
- **Does:** Scoped keys to read deals, usage and payments, change prices and report deliveries. Signed webhooks push deal events to your server. A public sandbox answers with demo data, no sign-in needed.
- **Proof:** Deployed on both networks and covered by tests; the sandbox runs on Arc testnet.
- **Start:** [Seller API](https://app.proteus.co.in/docs/seller-api)

<a id="ways-front-desk"></a>

#### Front desk link · In testing

- **For:** Businesses running a scheduling service: receptionist, after-hours answering or callback booking.
- **Does:** A customer link and an iframe where the business's own customers type or speak to its AI assistant. Each finished request lands in the inbox and is billed once. No phone number yet.
- **Proof:** Covered by tests off chain ([customer-link.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/customer-link.ts)).
- **Start:** [Front desk](https://app.proteus.co.in/docs/front-desk)

<a id="ways-alerts"></a>

#### Alerts · In testing

- **For:** Sellers and buyers who want to hear about a deal without opening the app.
- **Does:** Signed webhooks, Telegram or email; sellers also get approval requests this way. A webhook into Zapier or Make reaches Slack, Sheets, a calendar or a CRM with no further integration.
- **Proof:** Signed webhooks work today; Telegram and email need their keys on the server.
- **Start:** [Alerts](https://app.proteus.co.in/docs/front-desk#front-desk-alerts)

<a id="ways-whatsapp-how"></a>

### WhatsApp in detail

_Diagram: The chat negotiates; the money moves only on the web._

The buyer messages the seller's own WhatsApp Business number. Meta's Cloud API sends a signed webhook to Proteus, which checks the signature, keys the buyer by a pseudonym and runs the same deal agent and pricing rules. Offers go back through Meta as reply buttons. To sign and pay, the buyer gets an opaque link that works for 30 minutes and opens the offer on the web; nothing about money happens inside the chat. HUMAN hands the chat to the seller's team, STOP ends messages.

- **The seller's own number.** The seller connects its WhatsApp Business number in Settings with Meta's Embedded Signup; a manual connect is the fallback. Past chats are never copied.
- **Offers as buttons.** Up to three offers arrive as reply buttons. An offer that needs the seller's approval gets its pay link only if the seller approves within WhatsApp's 24-hour reply window.
- **Says it is an AI.** Every chat opens by saying the buyer is talking to the seller's AI sales agent, that prices come from the seller's rules, and how to reach a person.
- **Commands.** HUMAN asks the seller's team to reply (for 24 hours, or until AGENT); STOP ends messages and START resumes. STOP is never rate limited.
- **Private by default.** A buyer is known by a one-way pseudonym of Meta's user id. Chat text never carries wallet addresses or deal ids; pay links are opaque and expire after 30 minutes ([Privacy](https://app.proteus.co.in/docs/privacy)).
- **Limits.** 30 messages per buyer per seller in 10 minutes; over that the agent stays silent rather than spend the seller's messages. 600 agent replies per seller per hour; over that the buyer is told the agent is busy and can reply HUMAN.
- **What Meta sees.** WhatsApp Business chats are not end-to-end encrypted to the seller: Meta's Cloud API decrypts them and keeps messages for up to 30 days.

<a id="ways-choose"></a>

### Which one to pick

| You want to… | Use |
|---|---|
| Buy from a seller yourself | The [web app](https://app.proteus.co.in/docs/ways-to-use#ways-web), or the seller's website or WhatsApp if it has them |
| Answer quotes where your customers already are | The [website embed](https://app.proteus.co.in/docs/ways-to-use#ways-embed) and, once it is out of testing, [WhatsApp](https://app.proteus.co.in/docs/ways-to-use#ways-whatsapp) |
| Have Claude buy within a budget | The [MCP server](https://app.proteus.co.in/docs/quickstart-agent) |
| Buy from your own agent or backend | The [agent skill over HTTP](https://app.proteus.co.in/docs/for-agents), and x402 for one-off calls |
| Run your store from your own systems or agent | The [seller API and webhooks](https://app.proteus.co.in/docs/seller-api) |
| Let your customers book with your AI assistant | The [front desk link](https://app.proteus.co.in/docs/front-desk) |
