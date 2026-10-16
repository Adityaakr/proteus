# BUILD_STATUS

Updated 2026-10-16 (Tameion deadline: 2026-10-17 23:59 ET).

## Working now

| Area | Status | Evidence |
| --- | --- | --- |
| Marketing site (PROTEUS copy, Framer-faithful design) | done | `site/`, http://localhost:5174 |
| Deterministic pricing + policy engine (micro-USDC bigint) | done | `packages/domain`, 13 Vitest tests pass |
| EIP-712 Terms / Acceptance / Delivery shared types | done | `packages/domain/src/terms.ts` |
| `DealEscrow.sol` (fund, cumulative settle, seller close, refund, dispute, pause) | done | 24 unit/fuzz tests + 3 invariants pass (`pnpm contracts:test`) |
| API: negotiation, counter, quote, accept, fund, provision, metered service, usage ack, settle, refund, review, seller console | done | `server/`, `scripts/testnet-demo.ts` passes on local Arc anvil |
| Agent adapters: rule-based (always) and Anthropic tool-use (with key) | done | `server/src/agent` |
| Prompt-injection handling ("ignore your margin policy") | done | decision log kind `injection_blocked`, policy unchanged |
| Chain reconciler (balances from chain events, journal entries) | done | `server/src/chain/reconciler.ts` |
| Relayer: Circle developer-controlled wallet or viem fallback | done, Circle path untested without credentials | `server/src/chain/relayer.ts` |
| Web platform (buyer flow, seller console, review pages, agentic components) | done, walked against the live API at 1200 and 390 with Playwright, no page errors | `site/src/app`, `site/scripts/shot-platform.mjs` |

## End-to-end rehearsal (local Arc anvil, chain 31337, real contract calls)

`E2E OK` on 2026-10-16: negotiate → below-floor counter rejected → quote → buyer signs Terms → seller countersigns → USDC approve → relayer `createAndFundDeal` → reconciled deposit 1,440.000000 → provision → 4 service calls (2 delivered and billable, 1 refund handoff not billable, 1 unknown order not billable, 1 retry deduplicated) → buyer signs cumulative usage → relayer `settleAcceptedUsage` (1.920000 USDC) → seller `sellerCloseTerm` → relayer `refundUnused` (1,438.080000) → final `deposit = settled + refunded`, remaining 0 → public record with every tx hash.

## Blocked on inputs from Aditya

1. **Arc testnet gas**: fund the deployer `0x86448dad5B26285379fc7CeE260362A5F4F174D5` and relayer `0x3DA21FF376d5E4e8F0f78787e77b803D72CA8E42` at https://faucet.circle.com (native USDC on Arc testnet). Then `pnpm --filter @proteus/contracts deploy:testnet` and set `ESCROW_ADDRESS` in `server/.env`.
2. **A buyer wallet** with Arc testnet USDC (your MetaMask, or any key passed as `BUYER_PRIVATE_KEY` to `scripts/testnet-demo.ts`).
3. Optional: `ANTHROPIC_API_KEY` (model-written replies; rule-based otherwise), `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` (relayer via Circle wallets; `pnpm --filter @proteus/server tsx scripts/circle-wallet.ts` creates the ARC-TESTNET wallet).

## Not built (deliberately, see DECISIONS.md)

Magic-link auth, teammates/roles, CSV export, Telegram, CCTP, x402, Gateway, OpenAPI generator, pg-boss worker, Playwright suite (replaced by the API-level e2e script).
