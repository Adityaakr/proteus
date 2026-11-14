# How to accept USDC from any chain: Circle CCTP into Arc

> Your customers hold USDC on Solana, Base or Ethereum. Here is how Circle CCTP brings it to Arc as native USDC, so they can pay you without a wrapped token or a bridge they have to trust.

Aditya, founder of Proteus AI · published 2026-11-07 · 4 min read · https://app.proteus.co.in/blog/accept-usdc-from-any-chain

## Key takeaways

- Your customers almost never hold USDC on the chain you settle on. Circle CCTP moves it by burning it on their chain and minting the same amount of native USDC on Arc.
- Proteus AI brings USDC into Arc from 25 chains, Solana included, straight to the buyer's account wallet, and sends it back out to 19.
- There is no wrapped token and no pool in the middle. What arrives is the same USDC every Arc app accepts.
- On November 7, 2026, our first real customer bridged from Solana and funded an order the same day. We shipped six fixes to the bridge that day too.

## The day the bridge met a real customer

On November 7, the first customer of the first real business on Proteus AI tried to pay. Their USDC was on Solana. Our escrow is on Arc.

That day the bridge was used by someone who just wanted to buy a tee. Here is what we shipped to it that same day, straight from the git log:

- Phantom kept opening when people wanted MetaMask, so we added a proper wallet picker.
- The public Solana RPC refuses requests from browsers, so we added a relay on our own domain.
- We added a check that the Solana wallet has enough SOL for the network fee before it signs, instead of failing halfway.
- Errors now show the real reason, not a generic "something went wrong".
- If a burn has already been sent, you can resume instead of starting over.
- And bridging now works both ways: out of Arc to the 19 chains Circle's Forwarder mints on.

The customer's USDC landed on Arc ([the mint](https://explorer.arc.io/tx/0x3e7f549108d377aa340c8a2d93b75322ac4a7454d4f54f2011d4b22357460862)), and they funded their order in escrow the same day without paying any gas.

That is the whole lesson of this post, really. Your customer's money is on some other chain. Getting it to you has to be boring.

## How CCTP works, in plain words

CCTP is Circle's Cross-Chain Transfer Protocol. It does not lock your tokens in a pool and hand you an IOU. It **burns** USDC on the source chain and **mints** the same amount on the destination, after Circle confirms the burn happened.

1. **Burn.** The customer signs one transaction on their chain. It burns their USDC and names the wallet on Arc that should receive it.
2. **Attest.** Circle sees the burn and signs an attestation.
3. **Mint.** That attestation is presented on Arc, and native USDC is minted to the customer's wallet.

Because Circle's own contracts mint it, the USDC on Arc is the real thing. Nothing to unwrap later. No pool that can run dry.

## What it looks like in the app

![The Proteus AI deposit panel, bridging USDC into Arc](https://app.proteus.co.in/blog/bridge.jpg "The real deposit panel on Arc testnet. Left: from Ethereum to the buyer's Arc wallet. Right: picking the source chain from 25.")

The buyer picks the chain their USDC is on, enters an amount, and signs once in their own wallet. The panel shows where the money will land (their account wallet on Arc), roughly how long it takes, and that no Arc gas is needed. The small print under the button is the whole design: native USDC, burned there, minted here, nothing wrapped.

## What we built around it

- **25 chains in.** Through Circle's Bridge Kit, buyers bring USDC into Arc from 25 chains, Solana included, straight to the wallet tied to their account.
- **19 chains out.** Sellers and buyers can move USDC back out of Arc. That direction is tested on Arc testnet to Base and Solana. It has not run on mainnet yet.
- **Then no gas at all.** Arc charges gas in USDC. When a buyer funds a deal, they sign a permit and our relayer submits it, so they never need a second token on Arc.

## What the customer actually pays

- **The source chain's network fee,** in that chain's own token. SOL on Solana, for example.
- **Any fee Circle charges for the transfer.** That is Circle's, not ours.
- **Nothing to Proteus AI** for bridging. And no gas when funding a deal, because during the pilot we pay it.

## The two real mints on mainnet

| Who | From | To | Proof |
|---|---|---|---|
| The merch studio, for its own wallet | Solana | Arc mainnet | [mint](https://explorer.arc.io/tx/0x7357c72f92224eafbfed0c664e7b346966ca175bcd835d95ae09eb76165fe7a5) |
| Its first customer | Solana | Arc mainnet | [mint](https://explorer.arc.io/tx/0x3e7f549108d377aa340c8a2d93b75322ac4a7454d4f54f2011d4b22357460862) |

## Next steps

- [How the money moves](https://app.proteus.co.in/docs/money-path), from bridge to settlement.
- [Get paid on delivery with USDC escrow](https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery), which is what happens right after the bridge.
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
