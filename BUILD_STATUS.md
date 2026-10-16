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

## Arc testnet (real)

DealEscrow deployed and verified at `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`. Full loop executed with real transactions on 2026-10-16: see `docs/acceptance-report.md` (approve, fund, settle, close, refund; `deposit = settled + refunded`). The buyer was our own funded key, so this is proof of the loop, not customer traction.

## Circle Facilitator Service (x402)

Pay per call verified and settled by Circle's facilitator on Arc testnet (`docs/acceptance-report.md`). Pending settlements are polled on `/status/{paymentId}`.

## Account model (second pass)

Privy login with embedded wallets, `/app` dashboard with Buy and Sell, per-org seller signer, market, x402 pay-per-call endpoint. Server routes are live and tested with the dev bypass; the web rebuild is being integrated. See `docs/01-account-and-flow.md`.

## Balance reads (2026-10-16, evening)

- Wallet and Home showed "Could not read your balance: HTTP request failed" in Aditya's browser while the same RPC answered from the server. Fix: the web app's viem public client now uses a `fallback` transport (public Arc RPC, then the same-origin read-only relay `POST /api/rpc`), and `useBalances` falls back to `GET /api/me/wallet` for the linked address. Verified headless with the public RPC reachable and with it blocked (both render 13.20 USDC, relay hit 10 times); error copy now names the RPC and the HTTP status.

## Blocked on inputs from Aditya

1. Done: deployer and relayer funded, escrow deployed, loop executed on testnet.
2. An independent buyer (a second person logging in with Privy and funding their embedded wallet) would turn the self-run proof into traction.
3. Optional: `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` (model-written replies; rule-based otherwise), `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` (relayer via Circle wallets; `pnpm --filter @proteus/server tsx scripts/circle-wallet.ts` creates the ARC-TESTNET wallet).

## Not built (deliberately, see DECISIONS.md)

Magic-link auth, teammates/roles, CSV export, Telegram, CCTP, x402, Gateway, OpenAPI generator, pg-boss worker, Playwright suite (replaced by the API-level e2e script).
