# What Proteus costs · Proteus AI docs

Source: <https://app.proteus.co.in/docs/fees> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Nothing during the pilot. The seller keeps 100% of every deal._

For sellers and buyers budgeting a deal. You will learn what Proteus charges (nothing during the pilot), why the escrow contract cannot take a cut, and who pays gas for each action.

- **No Proteus fee in the pilot.** No Proteus fee during the pilot: no subscription, no listing fee, no cut of deals or per-call payments.
- **The seller keeps 100%.** Settlement pays the full accepted amount to the seller's payee ([DealEscrow.sol](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol#L248)).
- **No fee hidden in the contract.** DealEscrow has no fee logic and no proxy; a fee could not be added to it later.
- **Pay per call has no fee either.** The full x402 price goes to the seller's signer key or payee ([The money path](https://app.proteus.co.in/docs/money-path#money-x402)).
- **Proteus pays the running costs.** Model calls, hosting and the relayer's gas for funding, settling, one-click refunds and policy commits.
- **After the pilot.** Three plans, a flat subscription billed separately: Starter is free with up to 3 products and 10 paid orders a month, Growth is $29 (₹1,999 in India) a month, and Business is $99 (₹6,999 in India) a month; yearly billing saves two months. Nothing is ever taken from an order and buyers never pay a fee. Pilot sellers will be told before any plan applies.

> This page is about what Proteus charges. How the seller's agent prices its offers is [a separate page](https://app.proteus.co.in/docs/pricing).

<a id="fees-gas"></a>

### Who pays gas

Gas on Arc is paid in USDC.

| Action | Paid by |
|---|---|
| Register the seller's agent on Arc (ERC-8004) | The seller's wallet, once |
| Commit pricing policies | Proteus (relayer) |
| Fund a deal with a permit (gasless) | Proteus (relayer) |
| Fund a deal with approve | The buyer pays for the approve; Proteus (relayer) for createAndFundDeal |
| Settle delivered units | Proteus (relayer) |
| Refund the unspent balance | Proteus (relayer) for the one-click refund on the deal page; anyone else who calls refundUnused pays their own gas |
| Open a dispute | The buyer's wallet |
| Rate the seller (ERC-8004 giveFeedback) | The buyer's wallet |
| End a term early (sellerCloseTerm) | The seller signer key |
| Sweep pay-per-call payments to the payee | The seller signer key (it keeps 0.05 USDC back for gas) |

_Gasless funding is proven on both networks: the Shoonya order on Arc mainnet was funded with a permit._

> Model calls, hosting and the relayer's gas are paid by Proteus. Circle Gateway, wallets and exchanges may charge their own fees; those are theirs, not Proteus's.
