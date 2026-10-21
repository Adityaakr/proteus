# 02 · ERC-8004 seller registry on Arc

Status: built and tested on Arc testnet; contracts deployed and verified on Arc testnet and mainnet. Date: 2026-10-22.

## 0. As built

| Piece | Where |
|---|---|
| ProteusPolicyRegistry (new contract) | [`contracts/src/ProteusPolicyRegistry.sol`](../contracts/src/ProteusPolicyRegistry.sol); testnet `0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A` (Blockscout verified), mainnet `0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B` (Sourcify exact match) |
| ERC-8004 identity: register, confirm, quote-time binding | [`server/src/services/agent-registry.ts`](../server/src/services/agent-registry.ts), seller Settings card [`site/src/app/sell/pages/Settings.tsx`](../site/src/app/sell/pages/Settings.tsx) |
| Salted policy commitments, on-chain commit, public log | [`server/src/services/policy-commit.ts`](../server/src/services/policy-commit.ts), [`packages/domain/src/abi/policyRegistry.ts`](../packages/domain/src/abi/policyRegistry.ts) |
| Public terms v2 binding identity + policy; stale-offer refusal; network label fix | [`server/src/services/quotes.ts`](../server/src/services/quotes.ts) |
| Ratings verified from chain, weighted summaries, buyer UI, market display | [`server/src/services/ratings.ts`](../server/src/services/ratings.ts), [`site/src/app/buyer/RateSeller.tsx`](../site/src/app/buyer/RateSeller.tsx), [`site/src/app/market/OnArc.tsx`](../site/src/app/market/OnArc.tsx) |
| Mainnet refuses to boot without KEY_ENCRYPTION_SECRET | [`server/src/env.ts`](../server/src/env.ts) |
| Agent skill: verify the seller on Arc before signing, rate after settling | [`server/src/services/agentdocs.ts`](../server/src/services/agentdocs.ts) |
| End-to-end on Arc testnet (18 checks) | [`server/scripts/arc-registry-e2e.ts`](../server/scripts/arc-registry-e2e.ts) |

Changes from the plan below: (1) policy commitments got their own small contract instead of only living in quotes, so every version has an on-chain timestamp authorized by the seller's published signer; (2) the seller-level `policyCommit` metadata key was dropped, because policies are per product and per version; the registry keys them by (agentId, productId, version). Ratings shipped with the escrow track record as planned.

## 1. Recommendation

Register each seller's negotiating agent on Arc's **ERC-8004 IdentityRegistry** (v2.0.0, already deployed on Arc mainnet and testnet), owned by the **seller's own wallet**, in **one transaction** using `register(agentURI, metadata[])` with three metadata keys: `proteus.payee`, `proteus.signer`, `proteus.policyCommit`. Proteus serves the registration file. Commit each seller policy version as a **salted** hash and put it, with the `agentId`, **inside the public terms**, so the existing `publicTermsHash` (already part of the signed EIP-712 Terms) binds every funded deal to a policy version. **No new contract and no escrow redeploy.** Show the seller's **escrow track record** (deals settled, USDC settled, refunds, disputes, all read from DealEscrow events) as the primary trust signal; add ERC-8004 buyer feedback as a secondary signal, counted only from wallets that funded and settled a deal with that seller, weighted by USDC settled.

## 2. Why

- **It closes the one gap the escrow cannot.** The escrow already binds the money. `Terms.seller` is the server-held delegated signer (`server/src/services/quotes.ts:94`), and `Terms.payee` is a database column (`quotes.ts:95`). Today a buyer has to trust Proteus that both belong to the seller. When the seller's own wallet publishes `signer` and `payee` on chain, a buyer or buyer agent can check before signing.
- **The binding needs no contract change.** `publicTermsHash` is an opaque `bytes32` inside the Terms typehash (`contracts/src/DealEscrow.sol:48,94,163`). Extending the plaintext public terms changes what the hash commits to, not the contract.
- **It is the standard, and it is live.** IdentityRegistry `0x8004A169…a432` and ReputationRegistry `0x8004BAa1…9b63` on mainnet, and `0x8004A818…BD9e` and `0x8004B663…8713` on testnet, all report `getVersion() == "2.0.0"`. The selectors for `register(string,(string,bytes)[])`, `setMetadata`, `giveFeedback(int128…)` and `getSummary` are present in the live bytecode on both chains. Any ERC-8004 indexer or agent can discover Proteus sellers without going through Proteus.
- **Both wallet types already work.** Circle user-controlled wallets send contract calls through the existing challenge path (`site/src/app/auth/CircleAuthProvider.tsx:217-233`, `server/src/services/circle.ts:92`). Registering in one call means one PIN prompt, not four.

## 3. Steelman of the rejected options

- **A custom `SellerRegistry` that the escrow enforces.** This is the strongest version: the escrow itself would refuse Terms whose seller or payee do not match the registry, which removes Proteus from the trust path entirely. We passed because it means redeploying the verified escrow that already ran a real-USDC loop on mainnet, adds a new contract to audit, and couples settlement to an external contract. Enforcing the registry in the server first gets most of the benefit. Revisit it for a v2 escrow.
- **Reputation as the headline feature.** Ratings are the most visible thing to judges. We passed on making them primary because ERC-8004 v2 lets anyone post feedback (there is no pre-authorization), and creating a deal costs nothing (`DealEscrow.sol:189-221`). A seller can fund itself from a second wallet and rate itself five stars. Escrow events cannot be forged, so they lead.

## 4. Assumptions and falsifiers

- Sellers will sign one on-chain transaction from their own wallet. *Falsifier:* partners refuse the extra step. Fallback: offer registration as optional.
- The policy commitment is framed as **non-repudiation** (it proves which rules the seller committed to), **not** as proof the AI obeyed them. The engine runs off chain. *Falsifier:* copy that claims more than this.
- A 256-bit salt makes the policy hash impossible to brute-force. Without the salt, the small integer space of a policy (floor bps, discount bps) can be ground to recover private economics.
- The ERC-8004 v2.0.0 interface stays stable. It is still a Draft EIP.

## 5. Required constraints

1. **The seller's wallet only.** No Proteus key, including the relayer, ever owns, operates or writes the agent NFT.
2. **Never on chain:** private keys, encrypted key blobs, `KEY_ENCRYPTION_SECRET`, upstream `secretEnc` or authHeader, unit costs, or raw margins.
3. **Server enforcement before quoting:** on-chain `proteus.signer == org.sellerSignerAddress`, `proteus.payee == org.payeeAddress`, and `ownerOf(agentId) == org.ownerAddress`. If any check fails, refuse to quote and say why.
4. **Rotation:** revoking or rotating the signer prompts the seller to update `proteus.signer`. The UI lists open deals still bound to the old key.
5. **Sandbox orgs** cannot register and are excluded from track records and ratings.

## 6. Findings to fix along the way (grounded)

- **Key-encryption fallback (high).** `encryptSecret` derives its key from `KEY_ENCRYPTION_SECRET ?? SESSION_SECRET` (`server/src/lib/crypto.ts:6`). `SESSION_SECRET` has a public default (`env.ts:26`), and `KEY_ENCRYPTION_SECRET` is optional (`env.ts:60`). Make `KEY_ENCRYPTION_SECRET` required on mainnet and refuse to boot without it.
- **Wrong network label.** Public terms hardcode `network: "arc-testnet"` (`quotes.ts:35`), which is wrong on mainnet.
- **Policy race.** A quote stamps the latest policy version (`quotes.ts:41,68`), not the version the candidate was priced under. Policy edits insert `version + 1` without a transaction (`server/src/routes/app.ts:113-131`). Store `policyVersion` on the candidate, and refuse the quote if the policy has moved since.

## 7. Plan

| Phase | Scope | Effort |
|---|---|---|
| 1 Identity | ERC-8004 ABI and addresses in `packages/domain`. `orgs`: `agentId`, `agentOwner`, `agentTx`. `GET /public/sellers/:slug/agent.json` (registration file, `services` + `registrations` with `eip155:<chain>:<registry>`). `GET /app/agent` and `POST /app/agent/confirm` (reads the `Registered` log, checks `ownerOf`). An "Register on Arc" section in seller Settings, calling `register(uri, [payee, signer, policyCommit])` in one transaction | ~1.5 days |
| 2 Policy commit | `policies`: `salt`, `policy_hash`, `tiers_snapshot`. Salted `abi.encode` commitment per version. Add `policyVersion`, `policyCommit` and `sellerAgentId` to public terms (`publicTermsVersion: 2`). Fix the race and the network label | ~1 day |
| 3 Trust signals | Escrow track record per seller (from DealEscrow events). A "Rate this seller" card after settlement (`giveFeedback`, tag `proteus-deal`, `feedbackURI` = deal receipt, `feedbackHash`). Market display filtered to verified funders and weighted by USDC settled | ~1.5 days |
| 0 Hardening | Require `KEY_ENCRYPTION_SECRET` on mainnet | ~0.5 hour |

Testnet first for every phase. Mainnet only after a full testnet run.

## 8. Open questions for Aditya

1. Do the design partners register their own agent, or do you register them on their behalf with their wallet in a screen-share? (Their wallet must sign either way.)
2. Should ratings ship in this round, or only the escrow track record?
3. Should a policy be publicly revealable on dispute (publish its salt)? That is good for trust, but it exposes that version's floor.

## Evidence

4 verified (grounded against code: `DealEscrow.sol:48,94,163`; `quotes.ts:35,94-95`; `crypto.ts:6` with `env.ts:26,60`; `app.ts:113-131`), 3 supported (ERC-8004 v2.0.0 signatures and selectors confirmed live by the spec lens over RPC; the Circle contract-call path from the practitioner's citations), 1 unverified (sellers will accept the on-chain step), 1 contradicted ("binding policyHash requires changing TERMS_TYPEHASH and redeploying"; it does not, because the field is opaque).

> Cross-tier verification reduces instance- and tier-level error correlation but not shared-lineage blind spots. Treat cross-tier survival as weaker evidence than grounding.

## Telemetry
- divergence: 0.71 (evidence 0.87, conclusion 0.47) | threshold 0.30 UNCALIBRATED
- grounding: n/a (no eval fixtures this run)
- models: draft=opus · lenses=6x general-purpose · skeptic panel replaced by direct grounding of the 4 load-bearing claims (all re-opened and confirmed); the one contradiction resolved by grounding
- claims: opaque-publicTermsHash grounded · seller-is-delegated-signer grounded · key-fallback grounded · network-hardcode grounded · erc8004-v2-live supported (RPC) · circle-contract-calls supported
- fleet: 6 lenses (first-principles, adversary, practitioner, security, data-integrity, spec-currency) · token-multiple vs single-pass n/a

Changelog: the panel moved reputation from the headline to a secondary signal behind the escrow track record, made the policy commitment salted and bound through `publicTermsHash` instead of a contract change, and added server-side enforcement plus three pre-existing fixes. Open risk: whether sellers adopt the extra on-chain step.
