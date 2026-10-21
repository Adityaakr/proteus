# Proteus AI: project model (prism)

## Architecture
- DealEscrow.sol (Arc, same address 0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46 on 5042 and 5042002) holds prepaid USDC; Terms is an EIP-712 struct whose `publicTermsHash` is an opaque bytes32 (contracts/src/DealEscrow.sol:48,94,163).
- publicTermsHash = keccak(JSON.stringify(sortKeys(publicTerms))) (packages/domain/src/terms.ts:113-130); preimage built in server/src/services/quotes.ts:19-38.
- Terms.seller is the server-held delegated seller signer, Terms.payee a DB column (quotes.ts:94-95).

## Invariants
- Changing what publicTerms contains needs NO contract change; changing the Terms struct does (redeploy).
- Seller signer keys are AES-GCM encrypted with KEY_ENCRYPTION_SECRET, falling back to SESSION_SECRET (server/src/lib/crypto.ts:6). Treat the fallback as a defect.

## Danger zones
- Policy edits are non-transactional version+1 inserts (server/src/routes/app.ts:113-131); quotes stamp the latest version, not the priced one (quotes.ts:41,68).
- publicTerms hardcodes network "arc-testnet" (quotes.ts:35).

## Decision log
- 2026-10-22: ERC-8004 seller registry (docs/02-erc8004-seller-registry.md). Use Arc's v2.0.0 Identity/Reputation registries, seller-owned identity, salted policy commitment inside publicTerms, escrow track record primary, feedback secondary. No escrow redeploy.

## Assumptions to check later
- Design partners will sign the on-chain registration from their own wallet.
- 2026-10-22 (built): ProteusPolicyRegistry deployed — testnet 0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A (Blockscout), mainnet 0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B (Sourcify exact). Authority = agent owner/operator or EIP-712 sig from ERC-8004 metadata `proteus.signer`. publicTermsVersion 2 binds sellerAgent + policy {version, commitment, registry}. Ratings verified from ReputationRegistry NewFeedback (buyer, agentId, tags). E2E: server/scripts/arc-registry-e2e.ts (18 checks, testnet).

## Invariants (added 2026-10-22)
- policyCommitment encoding is pinned by a golden vector in both contracts/test/PolicyCommitment.t.sol and packages/domain/test/policy.test.ts; change both or neither.
- Mainnet blockscout API is behind Cloudflare: verify new mainnet contracts with --verifier sourcify.
