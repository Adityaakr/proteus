# Verify it yourself · Proteus AI docs

Source: <https://app.proteus.co.in/docs/verify> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Contracts, transactions and how to read a deal on chain._

| Contract | Network | Address | Source |
|---|---|---|---|
| DealEscrow | Arc mainnet | [`0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`](https://explorer.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) | [Sourcify](https://sourcify.dev/server/v2/contract/5042/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) |
| DealEscrow | Arc testnet | [`0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`](https://explorer.testnet.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) | [Sourcify](https://sourcify.dev/server/v2/contract/5042002/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) |
| ProteusPolicyRegistry | Arc mainnet | [`0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B`](https://explorer.arc.io/address/0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B) | [Sourcify](https://sourcify.dev/server/v2/contract/5042/0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B) |
| ProteusPolicyRegistry | Arc testnet | [`0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A`](https://explorer.testnet.arc.io/address/0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A) | [Sourcify](https://sourcify.dev/server/v2/contract/5042002/0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A) |

### The mainnet deal loop

Run by the Proteus team with its own USDC, to prove the mechanism (not traction): 0.60 in, 0.30 settled, 0.30 refunded.

| Step | Transaction (Arc mainnet) |
|---|---|
| Deploy DealEscrow | [0xf31053ff…7280](https://explorer.arc.io/tx/0xf31053ff9ebdf450e739e2a5c5b93316febe7f0af1e0419cfb4f4a7415f37280) |
| Buyer approves USDC | [0x9bbc3336…fa07](https://explorer.arc.io/tx/0x9bbc33367d4c712dd599950309ea23ecfa769368c6619fdd2782e00b1d1bfa07) |
| `createAndFundDeal` (0.60 USDC) | [0xe527f3c4…fe9d](https://explorer.arc.io/tx/0xe527f3c4d6d5d2bebeb25dbd67dcc429b99827deac6349a81f7a88c3f75efe9d) |
| `settleAcceptedUsage` (0.30 to the payee) | [0xce2caa88…53b0](https://explorer.arc.io/tx/0xce2caa88fa3a2b136a85771573f2b5ce269be2ea2182da91f78cd9a2243153b0) |
| `sellerCloseTerm` | [0x4c51245b…61b0](https://explorer.arc.io/tx/0x4c51245b0bb2daeae5e5509e599e77e0302f9efb190a2d0d852a5d70c69e61b0) |
| `refundUnused` (0.30 back) | [0x70d68aa1…c94d](https://explorer.arc.io/tx/0x70d68aa16db7588b90f172ccb68d20bb4f95ca099650a2755ee1a3436481c94d) |

### Testnet proofs

| What | Transaction (Arc testnet) |
|---|---|
| Permit + `createAndFundDeal` in one Multicall3 transaction | [0xcfc87ca9…5d7d](https://explorer.testnet.arc.io/tx/0xcfc87ca9ab00adcafbd9468a17eb203d2e89e870b874f47d1e4e7610a7065d7d) |
| Seller-confirmed delivery settled | [0x63aeb139…8b45](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45) |
| Demo seller registers on ERC-8004 (Agent #897439) | [0x4b618940…ce7f](https://explorer.testnet.arc.io/tx/0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f) |
| Policy version 2 committed at quote time | [0x1d3df618…c8ba](https://explorer.testnet.arc.io/tx/0x1d3df6183f57b16f39999988866fc93a0ac40623ab51604f0821284dfcf2c8ba) |
| Unused balance refunded | [0x3af8467b…13f9](https://explorer.testnet.arc.io/tx/0x3af8467b98722fbdff856c3f08e3e010336937a66df097a5d428c955acd813f9) |

To read a deal: open DealEscrow's read tab on the explorer and call `deals(dealId)` with the on-chain deal id from the deal page.
