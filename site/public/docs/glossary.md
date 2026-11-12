# Glossary · Proteus AI docs

Source: <https://app.proteus.co.in/docs/glossary> · facts as of 2026-11-13 · all docs: <https://app.proteus.co.in/docs.md>



| Term | Meaning |
|---|---|
| Terms | The EIP-712 agreement both sides sign. |
| Acceptance | The buyer's signature over cumulative delivered units and amount. |
| Delivery | The seller signer's signature over the same totals. |
| Payee | Where the seller is paid, published in its ERC-8004 identity. |
| Seller signer | A per-seller key held by Proteus that countersigns. |
| Relayer | The Proteus key that submits transactions and pays gas. |
| Arbiter | The key that resolves disputes over the unspent balance. |
| Grace | Extra time after the term ends (3 days by default, in each deal's terms) when settlement is still possible; refunds open after it. |
| Mandate | The largest prepaid amount an AI agent may commit per deal. |
| Policy commitment | A salted hash of a pricing policy on ProteusPolicyRegistry. |
| ERC-8004 | Arc's agent identity standard: owner, payee and signer, plus a reputation registry for feedback. |
| Verified buyer | A buyer who reached the seller through WhatsApp or holds a Proteus account with an email; their rating weighs 1, others 0.5. |
| Linked rating | A rating whose buyer is tied to the seller (a seller wallet, funded by one, or the same bridge source); listed, not counted. |
| Trusted reviewers | The buyers whose ratings count for a seller; pass them to ERC-8004 getSummary to read their feedback on chain. |
| micro-USDC | USDC's 6-decimal base unit; 1 USDC = 1,000,000. |
