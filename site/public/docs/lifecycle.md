# Deal lifecycle · Proteus AI docs

Source: <https://app.proteus.co.in/docs/lifecycle> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Eight states, and who moves a deal between them._

_Diagram: A deal from the first message to the refund._

Negotiate → Quote → Sign (buyer + seller signer) → Fund (USDC into DealEscrow) → Deliver and settle, repeated. A quote above the approval threshold waits for the seller first. From an active deal: a dispute freezes funds for the arbiter; when the term ends (plus grace) or the seller closes, the unspent balance is refunded.

| State | How it gets there | Who acts |
|---|---|---|
| Negotiating | A buyer opens a conversation. | Buyer, agent |
| Quoted | The buyer picks an engine-made offer. | Buyer |
| Approval required | Prepaid is above the approval threshold. | Seller |
| Awaiting funding | Buyer signs the terms; seller signer countersigns. | Buyer, seller signer |
| Funded | `createAndFundDeal` moves USDC into escrow. | Relayer submits |
| Active | Service provisioned or goods delivered; usage settled in steps. | Buyer, seller |
| Disputed | `openDispute`; settlement and refund blocked. | Buyer or seller, then arbiter |
| Closed | `refundUnused` after term plus grace or seller close, or a full dispute payout. | Anyone, or the arbiter |

_A fully settled deal has nothing to refund and stays Active. [State machine](https://github.com/Adityaakr/proteus/blob/main/README.md#a-deals-states)._
