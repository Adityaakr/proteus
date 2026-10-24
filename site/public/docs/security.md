# Security and trust boundaries · Proteus AI docs

Source: <https://app.proteus.co.in/docs/security> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_What each part can and cannot do, stated plainly._

> DealEscrow is not independently audited yet. It is source-verified (Sourcify exact match) on both networks and covered by Foundry unit and invariant tests; the invariant handler does not exercise disputes.

| Component | Controlled by | Can | Cannot |
|---|---|---|---|
| DealEscrow | Code; owner can pause new deals | Release USDC against signatures | Let anyone withdraw buyer funds |
| Arbiter | Proteus deployer key (also the owner) | Split the unspent balance in a dispute | Touch settled funds; there is no timeout yet |
| Relayer | Proteus key | Submit transactions, pay gas | Move funds without both signatures |
| Seller signer | Per-seller key, encrypted, held by Proteus | Countersign terms, deliveries, policies | Redirect payouts; it is revocable |
| Pricing engine | Proteus's server | Enforce the seller's rules | Be proven by the commitment alone |
| Delivery | Seller confirms, buyer countersigns | Trigger payment once countersigned | Be verified by Proteus |

- **Prompt injection.** Buyer text is data; the engine never reads prose.
- **Outbound requests.** Webhooks and catalog endpoints: https only, no private addresses, no redirects, short timeouts.
- **Secrets.** Signer keys and endpoint secrets encrypted at rest; API keys stored as hashes, shown once.
- **Framing.** Only `/embed/*` may be framed; every other page refuses.
