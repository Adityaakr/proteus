# Security and trust boundaries · Proteus AI docs

Source: <https://app.proteus.co.in/docs/security> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_What each part can and cannot do, stated plainly._

For security reviewers, sellers and buyers deciding what to trust. You will learn what each component and key can and cannot do, and how Proteus handles prompt injection, outbound requests, secrets and framing.

> **Warning:** DealEscrow is not independently audited yet. It is source-verified (Sourcify exact match) on both networks and covered by Foundry unit and invariant tests; the invariant handler does not exercise disputes.

### Trust boundaries

| Component | Controlled by | Can | Cannot |
|---|---|---|---|
| DealEscrow | Code; the owner can pause new deals only | Release USDC against signatures; settlement and refunds keep working while paused | Let anyone, the owner included, withdraw buyer funds; it is not upgradeable |
| Arbiter | Proteus deployer key (also the owner) | Split the unspent balance of a disputed deal | Touch settled funds; there is no timeout yet |
| Relayer | Proteus key | Submit transactions, pay gas | Move funds without both parties' signatures |
| Seller signer | Per-seller key, encrypted, held by Proteus | Countersign terms, deliveries and policies; end a term early; hold pay-per-call payments until swept | Redirect payouts; once revoked, sign anything new |
| Pricing engine | Proteus's server | Enforce the seller's rules | Be proven by the commitment alone |
| Delivery | Seller confirms, buyer countersigns | Trigger payment once countersigned | Be verified by Proteus |

### How Proteus protects the rest

- **Prompt injection.** Buyer text is data; prices come from code. Known override attempts are logged and evaluated normally.
- **Outbound requests.** Webhooks and catalog endpoints: https only, no private, loopback, link-local or metadata addresses, no redirects, short timeouts.
- **Secrets.** Signer keys, webhook secrets and endpoint secrets are encrypted at rest; each seller's chats and pricing basis use the seller's own data key. API keys are stored as SHA-256 hashes and shown once.
- **Framing.** Only `/embed/*` may be framed: a seller's deal agent by the sites it lists (any site when it lists none), a front desk page by any site. Every other page refuses.
- **Errors.** Unexpected errors return a generic message; the detail stays in server logs.
- **Threat model.** The full threat model is in the repository: [threat-model.md](https://github.com/Adityaakr/proteus/blob/main/docs/threat-model.md).
