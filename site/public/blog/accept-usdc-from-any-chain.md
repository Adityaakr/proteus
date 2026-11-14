# How to accept USDC from any chain: Circle CCTP into Arc

> Your customers hold USDC on Solana, Base or Ethereum. Here is how Circle CCTP brings it to Arc as native USDC, so they can pay you without a wrapped token or a bridge they have to trust.

Proteus AI team · published 2026-11-07 · 3 min read · https://app.proteus.co.in/blog/accept-usdc-from-any-chain

## Key takeaways

- Customers rarely hold USDC on the chain you settle on. Circle CCTP moves it by burning USDC on the source chain and minting the same amount of native USDC on Arc.
- Proteus AI brings USDC into Arc from 25 chains, Solana included, straight to the buyer's account wallet.
- There is no wrapped token and no liquidity pool in between: the USDC that arrives is the same asset Circle issues on Arc.
- On November 7, 2026, a real customer bridged USDC from Solana and funded an order on Arc mainnet the same day.

## The problem: the money is on another chain

You settle on Arc. Your customer holds USDC on Solana, or Base, or Ethereum. Before they can pay you, the money has to move, and that is where most first purchases die: a bridge they have never heard of, a wrapped token that is not quite USDC, a second token for gas, and a wait with no progress bar.

For a business, the fix has to be boring: the customer picks the chain their money is on, signs, and arrives on Arc with real USDC.

## How CCTP works

CCTP, Circle's Cross-Chain Transfer Protocol, does not lock tokens in a pool and issue an IOU. It **burns** USDC on the source chain and **mints** the same amount on the destination, after Circle attests that the burn happened.

1. **Burn.** The customer signs a transaction on the source chain that burns their USDC and names the destination wallet on Arc.
2. **Attest.** Circle observes the burn and signs an attestation.
3. **Mint.** The attestation is presented on Arc and native USDC is minted to the destination wallet.

Because the USDC on Arc is minted by Circle's own contracts, it is the same asset every other Arc app accepts. There is nothing to unwrap later, and no pool that can run dry.

## What we built on Proteus AI

- **25 source chains in.** Through Circle's Bridge Kit, buyers bring USDC into Arc from 25 chains, Solana included, straight to the wallet tied to their account.
- **Out again to 19 chains.** Sellers and buyers can send USDC from Arc to the 19 chains Circle's Forwarder mints on. This direction is tested on Arc testnet to Base and Solana.
- **The right wallet.** A wallet picker for EVM and Solana wallets, so MetaMask and Phantom do not fight over the same button.
- **Fewer failed attempts.** A check that the Solana wallet has enough SOL for the network fee before it signs, plain error messages, and a resume option once a burn was sent.
- **Then gasless.** Arc charges gas in USDC, and when the buyer funds a deal, a relayer submits it, so the buyer never needs a second token on Arc.

## What the customer pays

- **The source chain's network fee,** in that chain's token, for example SOL on Solana.
- **Any fee Circle charges for the transfer.** Those are Circle's, not ours.
- **Nothing to Proteus AI** for bridging, and no gas when funding a deal: the relayer pays it during the pilot.

## A real customer, from Solana to an order

On November 7, 2026, a customer of a custom merch studio bridged USDC from Solana to Arc mainnet with CCTP ([mint on Arc](https://explorer.arc.io/tx/0x3e7f549108d377aa340c8a2d93b75322ac4a7454d4f54f2011d4b22357460862)), negotiated a custom tee with the studio's deal desk, and funded the order in escrow without paying gas. The studio itself had brought its own USDC in from Solana the same way ([mint on Arc](https://explorer.arc.io/tx/0x7357c72f92224eafbfed0c664e7b346966ca175bcd835d95ae09eb76165fe7a5)).

| Step | Chain | Who signs |
|---|---|---|
| Burn USDC | Solana | The customer's Solana wallet |
| Attest the burn | Off chain | Circle |
| Mint native USDC | Arc | Minted to the customer's Arc wallet |
| Fund the deal | Arc | The customer signs a permit; the relayer submits |

## Get started

- [How the money moves](https://app.proteus.co.in/docs/money-path) from bridge to settlement.
- [Get paid on delivery with USDC escrow](https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery), the step after the bridge.
- [Verify it yourself](https://app.proteus.co.in/docs/verify): every mainnet transaction we cite.

## Frequently asked questions

### What is Circle CCTP?

Circle's Cross-Chain Transfer Protocol moves USDC between chains by burning it on the source chain and minting the same amount of native USDC on the destination, after Circle attests the burn.

### Is USDC bridged with CCTP a wrapped token?

No. It is native USDC minted by Circle's contracts on the destination chain, the same asset as any other USDC there.

### Which chains can customers pay from on Proteus AI?

USDC comes into Arc from 25 chains through CCTP, including Solana, Ethereum and Base. Sending out of Arc reaches the 19 chains Circle's Forwarder mints on.

### What fees does the customer pay to bridge?

The source chain's network fee in its own token, such as SOL on Solana, plus any fee Circle charges for the transfer. Proteus AI charges nothing for bridging.

### Do buyers need gas on Arc after bridging?

No. Arc charges gas in USDC, and when a buyer funds a deal on Proteus AI a relayer submits the transaction and pays the gas.
