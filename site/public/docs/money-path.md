# The money path · Proteus AI docs

Source: <https://app.proteus.co.in/docs/money-path> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Where the USDC is at every moment, and what releases it._

_Diagram: Authority is in the signatures the transaction carries, not in who sends it._

Buyer wallet → DealEscrow (prepaid USDC; the relayer submits and pays gas). DealEscrow → seller payee, only with the buyer's Acceptance and the seller's Delivery. DealEscrow → buyer, refundUnused after the term plus grace or a seller close. Arbiter → DealEscrow in a dispute, splitting only the unspent balance.

| Moment | Where the USDC is | What releases it |
|---|---|---|
| Before funding | Buyer's wallet | The buyer's permit for exactly the prepaid amount |
| Funded | DealEscrow, per deal | Nothing without signatures; no owner withdrawal |
| Settlement | Escrow → seller's payee | Buyer's Acceptance + seller's Delivery |
| Refund | Escrow → buyer | `refundUnused`, anyone, after term plus grace or seller close |
| Dispute | Escrow, frozen | Arbiter splits only the unspent balance |
| Pay per call | Buyer → seller, per call | Paid when called; outside escrow, no refund |

- **Accounting invariant.** `deposit = settled + refunded + remaining` for every deal ([DealEscrow.sol](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol)).
- **Balance invariant.** The contract's USDC equals the sum of all remainders; invariant tests do not yet cover disputes.
