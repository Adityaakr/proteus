# What is ERC-8004? Verifiable identity for AI agents that sell

> ERC-8004 gives an AI agent an on-chain identity: who owns it, where it gets paid and which key signs for it. Here is how sellers use it and how buyers check it.

Proteus AI team · published 2026-11-05 · 4 min read · https://app.proteus.co.in/blog/erc-8004-agent-identity

## Key takeaways

- ERC-8004 is a standard for AI agent identity on Ethereum-compatible chains: an identity registry, plus registries for reputation and validation.
- On Arc, a seller registers its agent from its own wallet in one transaction and publishes where it gets paid (payee) and which key signs its deals (signer).
- A buyer, or the buyer's AI agent, checks that the signer and payee in the terms match the registered identity before paying. An impersonator cannot pass without the seller's wallet.
- Identity proves who you are dealing with, not that they will deliver. Escrow covers the second part.

## Why agents need an identity

When a person buys from a website, they lean on signals built for people: a familiar domain, a padlock, reviews, a brand they recognise. An AI agent buying for its owner cannot use most of those. And when the seller is also an agent, anyone can stand one up with the same name, the same logo and a different payout address.

The question an agent has to answer before it pays is simple: **is the party on the other side really the business it claims to be, and is the money going to that business?** ERC-8004 lets it answer that from public data instead of from a sales page.

## What ERC-8004 is

ERC-8004, "Trustless Agents", is a proposed Ethereum standard for discovering and trusting AI agents. It defines three registries:

- **Identity registry:** each agent gets an on-chain identity, owned by a wallet, with metadata the owner publishes.
- **Reputation registry:** clients can leave feedback about an agent. The registry rejects feedback from the agent's own owner or operators.
- **Validation registry:** for independent checks of an agent's work.

Arc runs ERC-8004 registries on mainnet and testnet. The identity registry is at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Arc mainnet and `0x8004A818BFB912233c491871b3d84c89A494BD9e` on Arc testnet. You can read the full proposal on [Ethereum EIPs](https://eips.ethereum.org/EIPS/eip-8004).

## How a seller registers its agent on Proteus AI

1. **The seller's own wallet registers the agent.** It is a single transaction on Arc's identity registry, signed by the seller, not by Proteus. The seller owns the identity.
2. **It publishes a payee and a signer.** The payee is the wallet that receives payouts. The signer is the key that signs the seller's deal terms and delivery records.
3. **Each pricing policy is committed.** The seller's signer commits a salted hash of every policy version to ProteusPolicyRegistry. The numbers stay private, but the commitment is public and dated.

One honest detail: on Proteus AI the seller's signer key is held encrypted by Proteus, so the deal desk can sign offers while the seller sleeps. The payee is the seller's own wallet, and settlement pays it directly.

## How a buyer checks a seller

Before signing anything, a buyer's agent runs four checks against Arc:

| Check | What it compares | What it stops |
|---|---|---|
| Terms hash | The hash in the signed terms vs. the public terms shown | Terms changed after you read them |
| Signer | The signer in the terms vs. the signer in the seller's ERC-8004 identity | A copycat signing as the seller |
| Payee | The payout address in the terms vs. the registered payee | Money sent to the wrong wallet |
| Policy | The quote's policy version vs. ProteusPolicyRegistry | Prices from rules the seller never committed |

If any check fails, the agent does not sign. On Proteus AI this is one MCP tool, `proteus_verify_seller`.

> Identity answers "who is this?". Escrow answers "what if they do not deliver?". You need both.

## Real registrations you can check

- **A real business on Arc mainnet.** A custom merch studio registered its selling agent from its own wallet on October 24, 2026 as Agent #2695: [registration transaction](https://explorer.arc.io/tx/0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55).
- **A demo seller on Arc testnet.** Kitbox, our labelled demo merch seller, is Agent #897439: [registration transaction](https://explorer.testnet.arc.io/tx/0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f). An AI agent ran all four checks against it before buying a sample; see [How AI agents can buy safely](https://app.proteus.co.in/blog/how-ai-agents-buy-safely).

## What identity does not prove

- **It does not prove delivery.** A registered seller can still fail to ship. That is why the buyer pays into escrow and the seller is paid for what the buyer countersigns. See [Get paid on delivery](https://app.proteus.co.in/blog/usdc-escrow-pay-on-delivery).
- **It does not prove the business is good.** Identity tells you it is the same seller every time; reputation and your own judgement tell you whether to buy.
- **It is only as strong as the seller's wallet.** If the seller loses the wallet that owns the identity, whoever holds it controls the identity.

## Get started

- Sellers: register in the [seller quickstart](https://app.proteus.co.in/docs/quickstart-seller); the one transaction is from your own wallet.
- Agents: [Buy with an AI agent](https://app.proteus.co.in/docs/quickstart-agent) shows the checks in order.
- Everyone: [Verify it yourself](https://app.proteus.co.in/docs/verify) lists every contract and transaction.

## Frequently asked questions

### What is ERC-8004?

ERC-8004, Trustless Agents, is a proposed Ethereum standard that gives AI agents an on-chain identity, with registries for identity, reputation and validation.

### How does a seller get an ERC-8004 identity on Arc?

On Proteus AI the seller's own wallet sends one transaction to Arc's identity registry and publishes its payee and signer. The seller, not Proteus, owns the identity.

### How can an AI agent verify a seller?

It checks that the signer and payout address in the terms match the seller's ERC-8004 identity, that the terms hash matches what it was shown, and that the pricing policy is committed on chain.

### Does an ERC-8004 identity prove a seller will deliver?

No. It proves who the seller is and where the money goes. Escrow, where the seller is paid only for countersigned delivery, covers the delivery risk.

### Who holds the seller's signing key on Proteus AI?

The seller's signer key is held encrypted by Proteus so the deal desk can sign offers around the clock. Payouts go to the seller's own payee wallet.
