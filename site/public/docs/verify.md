# Verify it yourself · Proteus AI docs

Source: <https://app.proteus.co.in/docs/verify> · facts as of 2026-11-20 · all docs: <https://app.proteus.co.in/docs.md>

_Contracts, transactions and how to read a deal on chain._

For buyers, agents and auditors who want proof rather than our word. You will find every contract with its source, the mainnet deal loop, the testnet proofs, and how to read a deal on chain.

<a id="verify-contracts"></a>

### Contracts

| Contract | Network | Address | Source |
|---|---|---|---|
| DealEscrow | Arc mainnet | [`0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`](https://explorer.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) | [Sourcify](https://sourcify.dev/server/v2/contract/5042/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) |
| DealEscrow | Arc testnet | [`0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`](https://explorer.testnet.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) | [Sourcify](https://sourcify.dev/server/v2/contract/5042002/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46) |
| ProteusPolicyRegistry | Arc mainnet | [`0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B`](https://explorer.arc.io/address/0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B) | [Sourcify](https://sourcify.dev/server/v2/contract/5042/0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B) |
| ProteusPolicyRegistry | Arc testnet | [`0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A`](https://explorer.testnet.arc.io/address/0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A) | [Sourcify](https://sourcify.dev/server/v2/contract/5042002/0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A) |
| ERC-8004 IdentityRegistry | Arc mainnet | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://explorer.arc.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) | Arc's ERC-8004 deployment |
| ERC-8004 ReputationRegistry | Arc mainnet | [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://explorer.arc.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) | Arc's ERC-8004 deployment |
| USDC | Both | `0x3600000000000000000000000000000000000000` | Arc's native USDC |

_Testnet ERC-8004 registries: IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`._

<a id="mainnet-loop"></a>

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

<a id="verify-shoonya"></a>

### The first Shoonya order on mainnet

| Step | Transaction (Arc mainnet) |
|---|---|
| Shoonya registers ERC-8004 agent #2695 from its own wallet | [0x45921b0f…4e55](https://explorer.arc.io/tx/0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55) |
| Tees policy version 2 committed | [0xf9f566e3…0386](https://explorer.arc.io/tx/0xf9f566e326231199de683c3b0082a0ba37c4ab36ba76e8bb6c22fe76e7430386) |
| The buyer funds 1 tee (6.60 USDC) with a permit, gasless | [0x9145fb23…62a7](https://explorer.arc.io/tx/0x9145fb235f7c00e625ccb91e3a8a817dcf3cd0b1ee4265fd5697cf79cb1b62a7) |
| Delivery countersigned; DealEscrow pays Shoonya 6.60 USDC | [0x85272527…5542](https://explorer.arc.io/tx/0x852725276799255fa7425be9aafcd2296828a0a9553e3e2b9394104fcbad5542) |
| The buyer rates Shoonya on the ReputationRegistry | [0x4689593d…7605](https://explorer.arc.io/tx/0x4689593d2dfa8accd71ba0c3d9867ca6cd2bfa382b44fa49014f4b53d3767605) |

_The buyer wallet was later found linked to a Shoonya team account in Proteus ([why](https://app.proteus.co.in/docs/ratings#ratings-before-checks))._

<a id="testnet-proofs"></a>

### Testnet proofs

| What | Transaction (Arc testnet) |
|---|---|
| Permit + `createAndFundDeal` in one Multicall3 transaction | [0xcfc87ca9…5d7d](https://explorer.testnet.arc.io/tx/0xcfc87ca9ab00adcafbd9468a17eb203d2e89e870b874f47d1e4e7610a7065d7d) |
| Seller-confirmed delivery settled | [0x63aeb139…8b45](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45) |
| Demo seller registers on ERC-8004 (Agent #897439) | [0x4b618940…ce7f](https://explorer.testnet.arc.io/tx/0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f) |
| Policy version 2 committed at quote time | [0x1d3df618…c8ba](https://explorer.testnet.arc.io/tx/0x1d3df6183f57b16f39999988866fc93a0ac40623ab51604f0821284dfcf2c8ba) |
| Unused balance refunded | [0x3af8467b…13f9](https://explorer.testnet.arc.io/tx/0x3af8467b98722fbdff856c3f08e3e010336937a66df097a5d428c955acd813f9) |

<a id="verify-read-deal"></a>

### Read a deal on chain

1. **Find the on-chain id.** It is `dealIdOnchain` in `GET /api/deals/{id}` and on the deal's public record, `GET /api/review/{publicId}`.
2. **Open DealEscrow.** On the explorer's read tab for `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`, or with any RPC client.
3. **Call the views.** `getDeal(dealId)` for the full record, `balances(dealId)` for deposit, settled, refunded and remaining, `refundableAt(dealId)` for when a refund opens.

**Read balances:**

```bash
# deposit, settled, refunded, remaining (micro-USDC)
cast call 0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46 \
  'balances(uint256)(uint256,uint256,uint256,uint256)' <dealIdOnchain> \
  --rpc-url https://rpc.mainnet.arc.io   # testnet: https://rpc.testnet.arc.io
```

<a id="verify-seller"></a>

### Check a seller's identity and policy

1. **Find the agent.** `publicTerms.sellerAgent` in a quote names the IdentityRegistry and `agentId`; `GET /api/public/sellers/{seller}` shows it too.
2. **Read signer and payee.** `getMetadata(agentId, "proteus.signer")` must equal the terms' `seller`, and `getMetadata(agentId, "proteus.payee")` the terms' `payee` (20 raw address bytes each).
3. **Read the policy commitment.** `policyOf(agentId, keccak256(productSlug), version).commitment` on ProteusPolicyRegistry must equal `publicTerms.policy.commitment`. `GET /api/public/sellers/{seller}/policies` lists every version with its transaction.
4. **Check the terms hash.** `publicTermsHash` in the terms must equal keccak256 of the canonical JSON (sorted keys) of `publicTerms`; `hashTerms(terms)` on DealEscrow gives the digest both parties sign.
