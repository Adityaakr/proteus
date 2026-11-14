# Get paid on delivery: USDC escrow for small business orders

> How USDC escrow lets a buyer pay up front and a business get paid only for what it delivers, with automatic refunds, no gas for buyers and funding from 25 chains.

Proteus AI team · published 2026-11-11, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery

## Key takeaways

- Escrow removes the one-way trust problem: the buyer's money is committed up front, and the seller is paid only for what the buyer confirms as delivered.
- With USDC on Arc, the same escrow works for a business in any country, settles in seconds and charges gas in USDC.
- Anything not delivered by the end of the term is refundable to the buyer, and that refund cannot be paused by anyone.
- Buyers can fund from 25 chains through Circle CCTP and pay no gas, because a relayer submits the transaction.

## The trust problem in every custom order

Every order that is not paid at a checkout has the same problem. Either the buyer pays first and hopes the seller delivers, or the seller delivers first and hopes the buyer pays. Small businesses live with this every day, and it shows up as deposits, chasing invoices, refunds by goodwill and disputes settled with screenshots.

**Escrow** fixes it by putting the money somewhere neither side controls alone. The buyer commits the full amount up front. The seller is paid as delivery is confirmed. Whatever is not delivered goes back to the buyer.

## How USDC escrow works on Proteus AI

1. **Both sides sign the same terms.** Units, price, term and the seller's payout address are signed by the buyer and by the seller as EIP-712 typed data. Neither side can change them later.
2. **The buyer funds the escrow.** The prepaid amount in USDC moves into DealEscrow on Arc. With a USDC permit, the buyer signs once and our relayer submits the transaction and pays the gas.
3. **The seller delivers.** For an API, each call is metered. For goods, the seller records each delivered batch with a note and an optional proof link.
4. **The buyer countersigns.** The buyer signs the cumulative units and amount delivered. Nothing moves without this signature.
5. **The escrow pays the seller.** DealEscrow checks the buyer's acceptance against the seller's signed delivery record and pays the difference since the last settlement, straight to the seller's own wallet.
6. **The rest is refundable.** After the term plus a grace period, or as soon as the seller closes early, the unspent balance goes back to the buyer. Anyone can trigger it, and it cannot be paused.

![The seller's usage and delivery page on Proteus AI](https://app.proteus.co.in/docs/seller-usage.jpg "The seller's side: each delivered unit, what was billed, and the signed receipt behind it.")

## Why USDC, and why Arc

- **One currency for every country.** A merch studio and its customer do not need to agree on a currency or a bank. USDC is a dollar that moves like a message.
- **Fast, cheap settlement.** Arc settles in seconds and charges gas in USDC, so nobody needs a second token.
- **Money from where it already is.** Circle CCTP brings native USDC to Arc from 25 chains, burned on the source chain and minted on Arc, never wrapped. Our first live business brought its USDC in from Solana this way.
- **Readable by anyone.** Escrow balances, settlements and refunds are public. A buyer, a seller or an auditor can check them without asking us.

## What the escrow cannot do

Being precise about limits is part of trust.

- **It does not verify delivery.** For physical goods the seller confirms delivery; the buyer's countersignature is the real check. A buyer who disagrees does not sign and can open a dispute.
- **Disputes have one arbiter.** A dispute freezes the deal, and an arbiter can only split the unspent balance between buyer and seller. It can never take money for itself, and it cannot touch payments the buyer already confirmed.
- **The owner's power is narrow.** The contract owner can pause new deals and set the arbiter. Settlement and refunds cannot be paused, and there is no function that sweeps funds.

## A real order, start to finish

On Arc mainnet, a custom merch studio's customer bought one tee for $6.60. The customer bridged USDC from Solana, accepted the agent's offer, and funded the escrow with no gas. The studio delivered, the customer countersigned, and the escrow paid the studio 6.60 USDC in a single transaction. You can read the escrow's balances for that deal on chain today: 6.60 deposited, 6.60 settled, nothing left.

| Step | Who acts | On chain |
|---|---|---|
| Terms signed | Buyer and seller | Terms hash in the funding transaction |
| Escrow funded | Relayer, for the buyer | USDC into DealEscrow |
| Delivery recorded | Seller | Signed receipt |
| Delivery accepted | Buyer | Settlement transaction |
| Seller paid | DealEscrow | USDC to the seller's wallet |

## Get started

- [How the money moves](https://app.proteus.co.in/docs/money-path), step by step.
- [Signatures](https://app.proteus.co.in/docs/signatures): exactly what each side signs.
- [Verify it yourself](https://app.proteus.co.in/docs/verify): contracts and transactions.

## Frequently asked questions

### What is USDC escrow?

USDC escrow holds a buyer's payment in a smart contract until the agreed conditions are met. On Proteus AI the seller is paid for what the buyer confirms as delivered, and the rest is refundable.

### Do buyers need ETH or another token for gas?

No. Arc charges gas in USDC, and on Proteus AI the buyer signs a USDC permit while a relayer submits the transaction and pays the gas.

### Can I pay with USDC from another chain?

Yes. Circle CCTP brings native USDC to Arc from 25 chains, including Solana, without wrapping.

### What happens if the seller never delivers?

Nothing is paid without the buyer's countersignature. After the term plus a grace period, the unspent balance is refundable to the buyer, and that refund cannot be paused.

### Who resolves disputes?

An arbiter key that can only split the unspent balance between buyer and seller. It cannot take funds or reverse payments the buyer already confirmed.
