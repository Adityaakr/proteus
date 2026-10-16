# Acceptance report: Arc testnet, 2026-10-16

Everything below happened on Arc testnet (chain id 5042002) with real transactions. Nothing is simulated. Funds are testnet USDC with no value. The buyer in this run was the project's own funded deployer key, so this is a **self-run proof of the loop, not customer traction**.

## Contract

| Item | Value |
| --- | --- |
| DealEscrow | `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46` ([explorer](https://explorer.testnet.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46)) |
| Deploy tx | `0x406c7f8745d3381e0be492bab698f9bc2a137db96fdab30e69d647dac8cba2a7` |
| USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` |
| Owner and arbiter | deployer `0x86448dad5B26285379fc7CeE260362A5F4F174D5` |
| Source verification | verified on Blockscout (`is_verified: true`, solc 0.8.28) |

## The loop (deal `deal_4qepl91htuzq`, public record `/records/d_kpjyvcnee838leic`)

| Step | Who signed or sent | Transaction |
| --- | --- | --- |
| Negotiate: spec example message, Zendesk disclosed as unsupported, then "trial of about 12 resolutions for $15" | agent (rule-based adapter) | offchain, decision log |
| Counter "2,000 for $1,500" rejected by `MARGIN_FLOOR_BPS` with a smaller alternative | deterministic policy | offchain, decision log |
| Buyer signs Terms (EIP-712), seller signer countersigns identical terms | buyer wallet, org signer | offchain, hash `0xe614b0f342953d68e33550982d595538d0267ebacfb28a104c43d2aadd767cc1` |
| Buyer approves 15 USDC to the escrow | buyer wallet | `0x2198e53e76e8bc19a83aa875dca388225b20507a5c88bcc0c9ebc1326b7b3cb2` |
| Relayer submits `createAndFundDeal` with both signatures | viem relayer | `0x5839b25663c18d610f5ac9b2f11d8ad330d184c47c3a53ce2518eb031fd06f96` |
| Service: 4 requests, 2 delivered and billable, 1 refund handoff not billed, 1 unknown order not billed, 1 retry deduplicated | gateway | offchain receipts with seller-signed digests |
| Buyer signs cumulative acceptance (2 units, 2.5 USDC); seller signs Delivery; relayer settles | buyer wallet, org signer, relayer | `0xd73e07c2b653b0c7360e6bf6b17bed47494f292510513743f4672cbb9c9e3de0` |
| Seller closes the term early | org signer | `0x2e2e7198054751f16462fbf1ddc0779ea6943d1674ab477c62dc89856a95fa72` |
| Refund of unused balance to the buyer | relayer (anyone may call) | `0x3af8467b98722fbdff856c3f08e3e010336937a66df097a5d428c955acd813f9` |
| Gas top-up for the seller signer (1 USDC from the relayer) | relayer | `0x0b8d88c45eab3dccb4c34727ebaad833eb2477dff2c563732638412bf98108d9` |

All seven receipts return `status: success` (blocks 67510050 to 67510406). Final balances read from the contract: deposit 15.000000, settled 2.500000, refunded 12.500000, remaining 0. `deposit = settled + refunded` holds.

Explorer link for any hash: `https://explorer.testnet.arc.io/tx/<hash>`.

## What this does and does not prove

- Proves: the deterministic margin check, dual-signed terms, escrow funding, metered delivery with non-billable failures, buyer-countersigned settlement, early close and refund all work on the real network with the real USDC interface, and the reconciler rebuilt balances from chain events.
- Does not prove: customer traction (the buyer was our own key), the Circle developer-controlled wallet relayer (viem relayer ran; Circle credentials were not provided), or x402 settlement (needs a buyer with a funded embedded wallet in the browser).

## Reproduce

```
cd server && set -a && source .env && set +a
API_URL=http://localhost:8787 ARC_RPC_URL=https://rpc.testnet.arc.io BUYER_PRIVATE_KEY=<funded key> npx tsx scripts/testnet-demo.ts
```
Needs about 16 USDC on the buyer (15 prepaid plus gas). `DEAL_ID=<id>` resumes an already funded deal.
