# How offers are priced · Proteus AI docs

Source: <https://app.proteus.co.in/docs/pricing> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Code decides the price; the model only writes the words._

- **Candidates from tiers.** Built from published tiers and the buyer's quantity and budget ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L198)).
- **Checked against rules.** Margin floor, discount cap, minimum prepaid, capacity; breaks are refused with a public reason.
- **Big orders wait.** Above the approval threshold, the seller decides.
- **Reply guard.** Replies with unlisted figures are discarded ([openrouter.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/agent/openrouter.ts)); numbers in words slip through, but the price never comes from the reply.
- **Whole-catalog context.** The agent can point the buyer to the product that fits.
- **Commitments on Arc.** Each policy version is committed for registered sellers; it proves what was published, not how the engine ran.
