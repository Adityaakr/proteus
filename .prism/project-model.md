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

## Decision log (2026-10-22, deal desk features)
- Gasless funding uses EIP-2612 permit + createAndFundDeal batched through Multicall3 (canonical 0xcA11…CA11, present on 5042 and 5042002). No contract change. The relayer's batch targets are restricted to USDC and the escrow (server/src/chain/relayer.ts batchData). The permit field order is owner, spender, value, nonce, deadline; the wrong order fails with "EIP2612: invalid signature".
- x402 has a second scheme, "gateway" (Circle Gateway batched, @circle-fin/x402-batching 3.5.0). The verifying contract and minValiditySeconds (604800) are read from Gateway /v1/x402/supported. Gateway refuses known public-key payees ("unauthorized"), so test sellers must have real payees.
- Notifications use a single outbox keyed by txHash:logIndex and are drained after each reconciler tick. Webhook URLs are re-checked against the SSRF rules at send time.
- Treasury yield was cut: Earn is not GA on Arc mainnet, USYC is allowlisted, and it would be custody.

## Lessons (2026-10-22)
- `tsc -p .` at site/ does not typecheck the app (project references). Use `pnpm --filter ./site build` (tsc -b) before declaring the site green.


## Decision log: product docs at /docs (2026-10-24)
- `/docs` renders from `site/src/app/docs/docsContent.ts`. The page and Copy Markdown use the same data. The API reference lives at `/docs/api`.
- Rules for the docs:
  - Every claim links an Arc tx (checked with eth_getTransactionReceipt), a contract (Sourcify exact match), a code line or a live page.
  - Every proof carries a network label.
  - Caveats sit next to the claim they qualify.
- Corrected facts. Keep these true in any public text:
  - Refunds need a `refundUnused` call (end + grace, or after sellerCloseTerm); they are not automatic.
  - The seller's EIP-712 signature comes from a server-held, encrypted per-seller key.
  - The arbiter is the deployer/owner key, and disputes have no timeout.
  - x402 pay per call is outside escrow and has no refund path.
  - Delivery is "confirmed by the seller, not verified by Proteus".
  - The MCP mandate is per deal and enforced by the local process.
  - A policy commitment proves the published policy, not that the engine applied it.
  - The listing PATCH does not check Arc registration (catalog sync does).
- The Claude MCP run's evidence is in `docs/evidence/2026-10-23-claude-mcp-kitbox.md` (Kitbox fund 0x2802…3c73, settle 0x63ae…8b45, Arc testnet).
- `docs/images/who-moves-money.png` is stale (it says testnet and Privy). Redraw it before reusing.
- 2026-10-24 docs v3 (prism-ship):
  - **Structure.** `/docs/:page` is multi-page, one page per section. Hand-drawn diagrams come from data in `site/src/app/docs/Sketch.tsx` (no dependency). The roughjs install re-resolved viem's zod peer from 3 to 4 and broke server types, so it was reverted.
  - **Agent files.** `llms.txt`, `docs.md`, `docs/<page>.md` and `docs/facts.json` are generated at build by `site/scripts/gen-agent-docs.ts`, run through the server's tsx, because the site does not declare tsx.
  - **Markdown serving.** `.md` files are served as text/markdown by `server/src/index.ts`, because Hono's static mime table has no .md entry.
  - **Agent review.** An agent-perspective review scored the docs 7/10. Fixed after it:
    - MCP testnet default stated;
    - API endpoints, auth, errors and rate limits in facts.json;
    - grace period stated (3 days);
    - permit funding marked as testnet-only;
    - trust addresses verified on chain (owner = arbiter = 0x8644…74D5);
    - network values normalized;
    - notProven list added.

## Decision log: WhatsApp private channel (2026-11-10, plan only)
- Plan: docs/03-whatsapp-private-channel.md. Meta Cloud API direct as Tech Provider (seller-owned WABA, Embedded Signup v4+), no BSP; pricing stays in code; chat carries only public offers; money/identity steps on web via buyer-bound link tokens.
- Phase 0 leaks to fix first (verified): unauth GET /negotiations/:id (public.ts:96) and /deals/:id (deals.ts:16-20); no counter rate limit + rule-specific reasons enable floor binary search (public.ts:105, pricing.ts:314-355); clientIp trusts x-forwarded-for (ratelimit.ts:16); /review exposes publicTerms + dealIdOnchain (review.ts:50-51); quotes.ts:62 returns raw rule ids; onError echoes raw messages (index.ts:105-111).
- Invariant: buyer PII (phone, name) never to LLM, chain, notify payloads or logs; key WA buyers by HMAC of business-scoped user id.
- Assumptions to check: Meta §4.7 AI rule permits seller sales agents; USDC via external link not "selling currency"; Meta service-message delivery after free tier needs card.
- 2026-11-11 built (uncommitted at time of writing): Phase 0 + Phase 1a of docs/03.
  - Negotiation key: start returns buyerKey once; sha256 stored in negotiations.buyer_key_hash; GET/messages/counter/quotes need X-Negotiation-Key or a signed-in owner of buyerAddress; null hash = legacy, open by id (services/negotiation.ts assertNegotiationAccess).
  - Counter limits: 12/negotiation + 40/IP per 10 min. Price rule reasons merged into one PRICE_REASON (packages/domain/src/pricing.ts).
  - /review list excludes label "live" orgs; /review/:publicId still public by link.
  - Vault (server/src/lib/vault.ts): per-org random AES-256 key wrapped by crypto.ts master in orgs.data_key_enc; AAD = orgId; text "pv2:" prefix, jsonb { $sealed }. Sealed: turns.content, service_requests.input (gateway), decisions.privateBasis, agent_runs.steps. Plaintext legacy values pass through.
  - Invariant: rotating SESSION_SECRET/KEY_ENCRYPTION_SECRET without re-wrapping orgs.data_key_enc makes every sealed chat unreadable (same as signer keys).
  - LLM input passes through redactPersonalData (agent/adapter.ts): emails, 10–19 digit numbers; not names or street addresses.
- 2026-11-11 WhatsApp channel built (feat/whatsapp-channel): services/whatsapp.ts, routes/channels.ts (webhook under /api, bodyLimit 1 MB, HMAC over raw body), tables whatsapp_accounts/sessions/events/inbound/links. Buyers keyed by HMAC(BSUID ?? wa_id); reply ids sealed. Connect verifies token via GET {graph}/{phoneNumberId}. Sandbox org may not connect. Limits: 30/buyer/10min (STOP/START exempt), 600 agent turns/seller/hour. Feature on only when WHATSAPP_APP_SECRET + WHATSAPP_VERIFY_TOKEN set.
  - Lesson: a script that imports services runs them with ITS OWN env; the e2e once sent a fake-token request to real graph.facebook.com. Scripts that can reach external APIs must assert their base URL first.
  - Invariant: sealed values are opened with openTextOr/openJsonOr in views so one bad row never 500s a page.
  - Retention purges a negotiation only if every deal on it is closed (or never funded) past the cutoff (multiple deals per negotiation are possible).
  - Open: senderHash and data keys both derive from KEY_ENCRYPTION_SECRET ?? SESSION_SECRET; rotating either orphans WhatsApp sessions and sealed data. No rotation tooling yet.
