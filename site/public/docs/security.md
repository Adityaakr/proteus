# Security and trust boundaries · Proteus AI docs

Source: <https://app.proteus.co.in/docs/security> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_What each part can and cannot do, stated plainly._

For security reviewers, sellers and buyers deciding what to trust. You will learn what each component and key can and cannot do, and how Proteus handles prompt injection, outbound requests, secrets and framing.

> **Warning: Not audited yet.** DealEscrow is not independently audited yet. It is source-verified (Sourcify exact match) on both networks and covered by Foundry unit and invariant tests; the invariant handler does not exercise disputes.

<a id="security-boundaries"></a>

### Trust boundaries

_Diagram: Three keys are Proteus's; every payout still needs the contract's checks._

The buyer's wallet signs the terms, permit and acceptances and funds DealEscrow. Proteus holds three keys: the relayer submits transactions and pays gas but cannot pay a seller without signatures; the seller signer countersigns terms and deliveries, can end a term early and, on chain, could open a dispute; the arbiter, which is also the owner, splits only the unspent balance of a disputed deal and can pause new deals. DealEscrow pays only the deal's payee (the seller's own wallet) and the buyer.

| Component | Controlled by | Can | Cannot |
|---|---|---|---|
| DealEscrow | Code; the owner can pause new deals and replace the arbiter | Release USDC against signatures; settlement and refunds keep working while paused | Let anyone, the owner included, withdraw buyer funds; it is not upgradeable |
| Arbiter | Proteus deployer key (also the owner) | Split the unspent balance of a disputed deal | Touch settled funds; there is no timeout yet |
| Relayer | Proteus key | Submit transactions, pay gas, call the refund once it opens (it only ever pays the buyer) | Pay a seller without both parties' signatures |
| Seller signer | Per-seller key, encrypted, held by Proteus | Countersign terms, deliveries and policies; end a term early; on chain, open a dispute (no Proteus route does); hold pay-per-call payments until swept | Pay out without the buyer's Acceptance, or change the payee of a deal already signed. Revoking it stops Proteus using it, which also stops settlement on deals it signed |
| Pricing engine | Proteus's server | Enforce the seller's rules | Be proven by the commitment alone |
| Delivery | Seller confirms, buyer countersigns | Trigger payment once countersigned | Be verified by Proteus |

> **Warning: Proteus can freeze and split a deal.** Because Proteus holds both the seller signer and the arbiter key, it could open a dispute on any funded deal and split its unspent balance between the payee and the buyer. It cannot touch settled funds or pay anyone else. An independent arbiter and a dispute timeout are Planned.

<a id="security-practices"></a>

### How Proteus protects the rest

- **Prompt injection.** Buyer text is data; prices come from code. Known override attempts are logged and evaluated normally.
- **Outbound requests.** Webhooks and catalog endpoints: https only, no private, loopback, link-local or metadata addresses, no redirects, short timeouts.
- **Secrets.** Signer keys, webhook secrets and endpoint secrets are encrypted at rest; each seller's chats and pricing basis use the seller's own data key. API keys are stored as SHA-256 hashes and shown once.
- **Framing.** Only `/embed/*` may be framed: a seller's deal agent by the sites it lists (any site when it lists none), a front desk page by any site. Every other page refuses.
- **Errors.** Unexpected errors return a generic message; the detail stays in server logs.
- **Model providers.** Anthropic runs the models; OpenRouter only as a fallback without an Anthropic key, and for embeddings. Neither sees costs, floors or policy ([Privacy](https://app.proteus.co.in/docs/privacy)).
- **Agents trust the API's addresses.** The MCP server reads the escrow and USDC addresses from `GET /api/health`; an agent should compare them with [Verify it yourself](https://app.proteus.co.in/docs/verify).
- **Threat model.** The full threat model is in the repository: [threat-model.md](https://github.com/Adityaakr/proteus/blob/main/docs/threat-model.md).
