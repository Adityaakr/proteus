# Settlement model

## Money

All amounts are integer micro-USDC on the ERC-20 interface of USDC (`0x3600…0000` on Arc testnet, 6 decimals). Native gas on Arc is the same USDC with 18 decimals; the contract never reads `msg.value`, and the server never mixes the two.

A deal's prepaid amount is a **customer liability** from the moment it is funded. It becomes seller revenue only as usage is accepted and settled. Unused balance is never seller revenue; it is refunded.

Invariant, enforced by the contract and fuzzed in `contracts/test/DealEscrow.invariants.t.sol`:

```
deposit == settled + refunded + remaining      (per deal)
sum(remaining) == USDC.balanceOf(escrow)       (across deals)
```

## Who signs what

| Action | Buyer | Seller signer | Relayer | Contract checks |
| --- | --- | --- | --- | --- |
| Create and fund | signs `Terms` (EIP-712), approves USDC | signs identical `Terms` | submits | both signatures over the same digest, digest unused, not expired, `transferFrom(buyer)` |
| Settle | signs `Acceptance{cumulativeAmount, cumulativeUnits, receiptsRoot, nonce, expiry}` | signs `Delivery{receiptsRoot, cumulativeUnits}` | submits | nonce strictly increasing, amount monotonic and ≤ deposit, units ≤ maxUnits, receipts roots match, before `end + grace` |
| Refund unused | anyone | optional early close (`sellerCloseTerm`) | submits | after `end + grace` or seller closed; pays buyer only |
| Dispute | buyer or seller opens | | | arbiter can only split `remaining` between the two parties |
| Pause | owner | | | blocks new deals only; settlement and refunds keep working |

The relayer has no authority of its own: every call it submits is either anyone-callable or carries the parties' signatures. The agent (LLM) has no key and no tool that moves money.

## Usage receipts

Each service request gets a canonical `requestId`. The gateway stores `(dealId, requestId)` uniquely, so retries return the stored receipt and never charge twice. A request is billable only when the adapter reports `delivered`; `failed` and `handoff` are never billed. Cumulative charge is `floor(totalUnits * unitNum / unitDen)` so per-request rounding cannot leak. Every receipt has a keccak evidence digest signed by the seller signer. The `receiptsRoot` the buyer signs is the keccak of the sorted billable digests.

## Trust assumptions

- The contract verifies signatures and arithmetic. It does not verify service quality. A buyer who disagrees with a receipt simply does not sign the acceptance; funds stay in escrow until the term ends and are then refundable. The dispute path exists for the remaining balance and relies on a named arbiter.
- The seller signer for the sandbox seller is a server-held key that signs `Terms` and `Delivery` only. It cannot withdraw funds.
- Chain state is authoritative. The reconciler rewrites balances from `balances(dealId)` and events; the database never invents a balance.
- Upstream cost changes create a new cost-model version used for future quotes. Accepted terms are hashed and immutable; nothing in the system can re-price a funded deal.
