# What Proteus AI is · Proteus AI docs

Source: <https://app.proteus.co.in/docs/overview> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_A deal desk for anything sold by quote, volume or usage._

- **The seller sets the rules.** Cost, margin floor, maximum discount, minimum order, capacity, and the order size it approves itself.
- **An agent does the selling.** It answers buyers and their AI agents in seconds; offers come only from those rules ([pricing.ts](https://github.com/Adityaakr/proteus/blob/main/packages/domain/src/pricing.ts#L198)).
- **Both sides sign identical terms.** EIP-712 terms, checked on chain by [DealEscrow](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol).
- **Money waits in escrow on Arc.** USDC moves only against the signatures in the agreement.
- **Paid per delivered unit.** The seller is paid for each unit the buyer countersigns; the rest becomes refundable.

> The model proposes. The seller's policy decides. The signed agreement controls the money.

| Network | App | Chain id | What is real |
|---|---|---|---|
| Arc mainnet | [app.proteus.co.in](https://app.proteus.co.in) | `5042` | Real USDC. One real business listed: [Shoonya Store](https://app.proteus.co.in/app/market/shoonya-store-t4e). |
| Arc testnet | [ai.proteus.co.in](https://ai.proteus.co.in) | `5042002` | Testnet USDC with no value. Example sellers and a demo merch seller. |

_DealEscrow is at the same address on both networks: `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`._

![The Proteus AI market on Arc mainnet, with Shoonya Store listed first](https://app.proteus.co.in/docs/market.jpg)
_The market: each seller with its Arc identity, links and services priced from the cheapest pack. (Arc mainnet)_
