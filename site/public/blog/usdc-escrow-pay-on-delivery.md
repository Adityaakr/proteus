# Get paid on delivery: USDC escrow for small business orders

> How USDC escrow lets a buyer pay up front and a business get paid only for what it delivers, with automatic refunds, no gas for buyers and funding from 25 chains.

Aditya, founder of Proteus AI · published 2026-11-11, updated 2026-11-14 · 4 min read · https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery

## Key takeaways

- Escrow fixes the oldest problem in custom orders: who goes first. The buyer commits the money up front, and the seller is paid only for what the buyer confirms arrived.
- With USDC on Arc, the same escrow works for a business in any country, settles in seconds and charges gas in USDC.
- Anything not delivered by the end of the term can go back to the buyer, and nobody, including us, can pause that refund.
- Buyers can fund from 25 chains through Circle CCTP and pay no gas, because a relayer submits the transaction for them.

## Somebody always has to go first

Every order that is not a checkout button has the same problem. Either the buyer pays first and hopes the seller delivers, or the seller ships first and hopes the buyer pays.

Small businesses live with this every day. It shows up as 50% deposits, invoices chased on WhatsApp, refunds that depend on goodwill, and disputes settled with screenshots.

**Escrow** fixes it by putting the money somewhere neither side controls alone. The buyer commits the full amount up front. The seller is paid as delivery is confirmed. Whatever was not delivered goes back.

## How it works on Proteus AI

1. **Both sides sign the same terms.** Units, price, term and the seller's payout address, signed by the buyer and by the seller as EIP-712 typed data. Neither side can change them after.
2. **The buyer funds the escrow.** The USDC moves into our DealEscrow contract on Arc. With a USDC permit the buyer signs once, and our relayer submits it and pays the gas.
3. **The seller delivers.** For an API, every call is metered. For physical goods, the seller records each delivered batch with a note and, if they want, a proof link.
4. **The buyer countersigns.** The buyer signs the total delivered so far. Nothing moves without this signature.
5. **The escrow pays the seller.** DealEscrow checks the buyer's acceptance against the seller's signed delivery record and pays the difference since the last settlement, straight to the seller's own wallet.
6. **The rest can go back.** After the term plus a grace period (3 days by default), or as soon as the seller closes early, the unspent balance is refundable to the buyer. Anyone can trigger it, and it cannot be paused.

![A deal page on Proteus AI with balances read from the escrow contract](https://app.proteus.co.in/docs/deal.jpg "A settled sample deal on Arc testnet: deposit, settled and remaining read straight from DealEscrow, with the settlement transaction linked.")

## Why USDC, and why Arc

I did not pick these because they are fashionable. I picked them for the businesses we wanted to serve first.

- **One currency for every country.** A studio and its customer should not have to agree on a bank or a currency. USDC is a dollar that moves like a message.
- **Fast and cheap.** Arc settles in seconds and charges gas in USDC, so nobody has to buy a second token just to pay.
- **Money from where it already is.** Circle CCTP brings native USDC to Arc from 25 chains. Our first real customer brought theirs from Solana. I wrote up how that went in [How to accept USDC from any chain](https://app.proteus.co.in/blog/accept-usdc-from-any-chain).
- **Anyone can read it.** Balances, settlements and refunds are public. A buyer, a seller or an accountant can check them without asking us.

## What the escrow cannot do

I would rather you hear the limits from me.

- **It does not check delivery.** For physical goods the seller says what was delivered. The buyer's countersignature is the real check. If they disagree, they do not sign, and they can open a dispute.
- **Disputes have one arbiter, and it is us for now.** A dispute freezes the deal, and the arbiter can only split the unspent balance between buyer and seller. It cannot take money for itself, and it cannot touch payments the buyer already confirmed. No live deal has been disputed yet.
- **The owner's power is narrow.** The contract owner can pause new deals and set the arbiter. Settlement and refunds cannot be paused, and there is no function that sweeps funds.

## A real order, start to finish

On November 7, a customer of a custom merch studio bridged USDC from Solana, agreed one custom tee for $6.60 with the studio's deal desk, and funded the escrow without paying gas. I was on a call with them while they did it.

On November 11 the studio delivered, the customer countersigned, and the escrow paid the studio 6.60 USDC in a single transaction. If you call balances on DealEscrow for that deal today you get 6.60 deposited, 6.60 settled, nothing refunded, nothing left.

| Step | Who acts | What happens on chain |
|---|---|---|
| Terms signed | Buyer and seller | Terms hash recorded with the funding |
| Escrow funded | Relayer, for the buyer | USDC into DealEscrow |
| Delivery recorded | Seller | Signed receipt |
| Delivery accepted | Buyer | Settlement transaction |
| Seller paid | DealEscrow | USDC to the seller's wallet |

## Read the details

- [How the money moves](https://app.proteus.co.in/docs/money-path), step by step.
- [Signatures](https://app.proteus.co.in/docs/signatures): exactly what each side signs.
- [Verify it yourself](https://app.proteus.co.in/docs/verify): every contract and transaction we cite.

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
