# DECISIONS

Decision log for PROTEUS (renamed from MARGIN on 2026-10-16). Each entry: decision, why, what would change it.

## 2026-10-16 Architecture (Prism panel: practitioner, security/custody, UX, simplicity)

**Recommendation.** Keep the existing Vite + React marketing site as the web app and add the platform as lazy-loaded react-router route trees in the same visual system. Put a separate Hono API in `server/` on Postgres 17 with Drizzle. One non-upgradeable `DealEscrow` contract on Arc testnet, funded by `approve` + `safeTransferFrom` of the ERC-20 USDC interface (6 decimals), settled only with a buyer-signed cumulative EIP-712 acceptance plus a seller-signed delivery digest. Deterministic pricing and policy math lives in `packages/domain` as bigint micro-USDC. The negotiation agent is an `AgentAdapter`: a rule-based adapter always works, an Anthropic tool-use adapter activates when `ANTHROPIC_API_KEY` is set. Background jobs run as an in-process scheduler inside the API, not a separate worker.

**Why.**
- The spec prescribes Next.js, but the finished site is Vite + CSS modules + framer-motion with a Framer shim. Porting costs hours with no judging value; the spec's non-negotiables are about money and policy, not the framework.
- Postgres is already running locally; unique constraints and `FOR UPDATE SKIP LOCKED` give idempotency and receipt dedupe for free.
- `approve` + `transferFrom` works on any ERC-20. Neither the Arc docs nor Circle's arc-escrow reference confirm EIP-2612 permit or EIP-3009 on the USDC interface at `0x3600000000000000000000000000000000000000`, so we do not depend on them.
- Judging is 30% agentic sophistication and 30% real USDC flowing: one working loop beats breadth.

**Steelman of the rejected option (Next.js monorepo as specified).** Server components, route handlers and the worker split map one-to-one onto the spec's layout, and Vercel deployment is turnkey. We still passed: the deadline is about 30 hours away, the site already exists, and the backend split (Hono + scheduler) deploys anywhere that runs Node.

**Assumptions and falsifiers.**
- Circle developer-controlled wallets execute contracts on `ARC-TESTNET` (SDK 10.8.1 exposes `createContractExecutionTransaction`, `signTypedData`, `requestTestnetTokens`). If execution fails on Arc, the relayer falls back to viem with a server-held bounded key and the Circle usage is reported honestly as not performed.
- Arc USDC ERC-20 interface has 6 decimals and native gas is 18 decimals (docs.arc.io EVM differences). All money is integer micro-USDC; `msg.value` is never used.
- Minimum base fee on Arc is 20 gwei; transactions below it are dropped silently.

**Open questions for Aditya.** Model provider key (Anthropic) for the LLM adapter; Circle API key + entity secret for the relayer wallet; a funded deployer on Arc testnet (we generate the key locally, you fund it at faucet.circle.com); whether the public site should go live before the deadline.

**Cuts (simplicity lens).** No magic-link auth, no teammates/roles, no CSV, no Telegram, CCTP, x402 or Gateway, no OpenAPI generator (curl examples in docs), no pg-boss. Seller console is gated by an env-configured owner wallet signature; the sandbox seller is visibly labeled and excluded from live counters.

> Cross-tier verification reduces instance- and tier-level error correlation but not shared-lineage blind spots. Treat cross-tier survival as weaker evidence than grounding.

## Telemetry
- divergence: 0.22 (evidence 0.35, conclusion 0.05) | threshold 0.30 UNCALIBRATED. Lenses converged; the spec pins most choices, so low divergence is expected here rather than cosmetic.
- grounding: n/a
- models: draft=opus · panel=2x-opus+2x-sonnet · skeptics not run (decisions are reversible except the contract, which gets Foundry tests instead)
- claims: circle-sdk-methods grounded (installed types) · arc-chain-facts grounded (docs.arc.io) · permit-support unverified
- fleet: 4 lenses
