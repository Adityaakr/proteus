# The money path · Proteus AI docs

Source: <https://app.proteus.co.in/docs/money-path> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Where the USDC is at every moment, and what releases it._

For buyers and sellers who want to know exactly where the money is, and for anyone checking that Proteus cannot take it. You will learn how escrow is funded, what settles and refunds it, what a dispute can do, and how pay per call differs.

_Diagram: Authority is in the signatures a transaction carries, not in who sends it._

Buyer wallet → DealEscrow (prepaid USDC; the relayer submits and pays gas). DealEscrow → seller payee, only with the buyer's Acceptance and the seller signer's Delivery. DealEscrow → buyer, refundUnused after the term plus grace or a seller close. Arbiter → DealEscrow in a dispute, splitting only the unspent balance. Pay per call (x402) is outside escrow.

### Where the money is

| Moment | Where the USDC is | What releases it |
|---|---|---|
| Before funding | Buyer's wallet | The buyer's permit (or approval) for exactly the prepaid amount |
| Funded | DealEscrow, per deal | Nothing without signatures; no owner withdrawal |
| Settlement | Escrow → seller's payee | Buyer's Acceptance + seller signer's Delivery |
| Refund | Escrow → buyer | `refundUnused`, by anyone, after term plus grace or a seller close |
| Dispute | Escrow, frozen | The arbiter splits only the unspent balance |
| Pay per call | Buyer → seller signer key (or payee, with Gateway) | Paid per billable call; outside escrow, no refund |

### Funding

- **Gasless (default).** The buyer signs the terms and an EIP-2612 USDC permit and sends no transaction. The relayer submits the permit and `createAndFundDeal` in one Multicall3 transaction ([gasless.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/gasless.ts)).
- **Approve.** The buyer approves USDC to DealEscrow from its wallet, then `POST /api/deals/{id}/funding-intent`; the relayer funds.
- **Exactly the prepaid amount.** The web app, the server and the MCP server refuse a permit for any other owner, spender, amount or token.
- **From other chains.** USDC can be bridged to Arc with CCTP through Circle Bridge Kit before funding ([bridge.ts](https://github.com/Adityaakr/proteus/blob/main/site/src/app/lib/bridge.ts)).

### Settlement

Each settlement carries two signatures over the same usage: the buyer's Acceptance (cumulative units and amount, receipts root) and the seller signer's Delivery (cumulative units, receipts root). DealEscrow pays the payee the difference between the new cumulative amount and what it already paid. The totals only grow, never above the deposit, and only until end + grace ([DealEscrow.sol](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol#L233)).

### Refunds and disputes

- **Refunds go to the buyer only.** `refundUnused` sends the unspent balance to the deal's buyer, whoever calls it. The deal page offers it as one click, with Proteus paying the gas.
- **Not pausable.** The owner can pause new deals; settlement and refunds keep working.
- **Disputes freeze, then split.** The arbiter can send the unspent balance to the seller's payee, the buyer, or both. It cannot touch settled funds. A partial split returns the deal to Active.

### Pay per call (x402)

For one-off calls an agent can pay per call over HTTP instead of opening a deal: `POST /api/pay/{seller}/{product}/execute` answers 402 with payment options, the agent signs a USDC authorization (EIP-3009), and the service runs. The payment is settled only if the call is billable, so a failed call is not charged. There is no escrow and no refund path ([x402.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/x402.ts#L102)).

| Scheme | Paid to | Then |
|---|---|---|
| `exact`, through Circle's facilitator | The seller's Proteus-held signer key (the facilitator requires the seller's proof to be signed by the payee of the payment) | The seller sweeps it to its payee from Settings; 0.05 USDC stays back for gas |
| Circle Gateway batching | The seller's payee directly | Nothing to sweep |

### Invariants

- **Accounting.** `deposit = settled + refunded + remaining` for every deal ([DealEscrow.sol](https://github.com/Adityaakr/proteus/blob/main/contracts/src/DealEscrow.sol)).
- **Balance.** The contract's USDC equals the sum of all remainders. The invariant tests do not yet cover disputes.
