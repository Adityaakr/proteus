# Deal lifecycle · Proteus AI docs

Source: <https://app.proteus.co.in/docs/lifecycle> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Every state a deal goes through, and who moves it between them._

For sellers, buyers and agent builders who need to know what happens when. You will learn the states a deal goes through, on Proteus and on chain, what moves it from one to the next, and the time limits that apply.

_Diagram: A deal from the first message to the refund. Dashed arrows are the exceptions._

Negotiating → Quoted (an engine-made offer) → Awaiting funding (buyer signed the terms, seller signer countersigned) → Funding pending (transaction submitted) → Active (USDC in DealEscrow, Funded on chain). A quote above the seller's approval threshold waits for the seller before the buyer can sign. While Active, usage is settled any number of times. From Active a dispute freezes the deal for the arbiter: a partial split returns it to Active, a full split closes it. refundUnused after end + grace (or after the seller closes the term) returns the rest to the buyer and closes the deal.

### Before funding

Nothing is on chain yet. These states live on Proteus; the API returns them as `status` on the negotiation, the quote and the deal.

| State | Status value | What it means | Who acts |
|---|---|---|---|
| Negotiating | negotiation `open`, then `quoted` | The buyer talks to the deal agent; `quoted` once at least one offer passes the seller's rules. | Buyer, deal agent |
| Quote | quote `draft` | The buyer picked an offer; Proteus built the EIP-712 terms. Valid for the seller's quote validity. | Buyer |
| Approval required | quote `approval_required`, then `approved` | The prepaid total is above the seller's approval threshold. The seller approves or declines in the console. | Seller |
| Awaiting funding | deal `awaiting_funding` | The buyer signed the terms and the seller signer countersigned. | Buyer, seller signer |
| Funding pending | deal `funding_pending` | The funding transaction was submitted and is waiting for Arc. | Relayer |

### After funding

From here DealEscrow is the record. Proteus reconciles each deal's status from the contract (`getDeal`), which knows four states: `None`, `Funded`, `Disputed`, `Closed`.

| State | Status value | What it means | Who acts |
|---|---|---|---|
| Active | deal `funded`, then `active`; on chain `Funded` | USDC is in escrow. Usage is settled in steps, each with the buyer's Acceptance and the seller signer's Delivery. | Buyer, seller signer; the relayer submits |
| Disputed | `disputed`; on chain `Disputed` | `openDispute` froze the deal; settlement and refund revert until the arbiter decides. | The buyer (on chain, also the seller signer), then the arbiter |
| Closed | `closed`; on chain `Closed` | `refundUnused` returned the unspent balance, or a dispute split paid out everything left. | Anyone, or the arbiter |

_A deal whose deposit is fully settled has nothing to refund and stays Active. A partial dispute split returns the deal to Active. [State machine](https://github.com/Adityaakr/proteus/blob/main/README.md#a-deals-states)._

### Time limits

| Limit | Rule |
|---|---|
| Quote | The terms carry an `expiry` from the seller's quote validity. Funding after it reverts (`Expired`). |
| Settlement | Each Acceptance has its own expiry. No settlement after the term's end plus grace. |
| Refund | `refundUnused` opens at end + grace (3 days by default), or at once after `sellerCloseTerm`; earlier calls revert (`TooEarly`). Read `refundableAt` from `GET /api/deals/{id}`. |
| Dispute | Open while the deal is Funded. There is no dispute timeout yet. |

> **Warning:** After that, settlement reverts: usage not countersigned by then can no longer be paid from escrow, and the balance can only go back to the buyer as a refund.
