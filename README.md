# PROTEUS

**Close the deal. Keep the margin.** The autonomous deal desk for internet businesses.

A seller configures what it sells, what each unit costs, a margin floor, capacity and an approval threshold. A buyer (a person, or a buyer agent through the same API) describes a real business need. PROTEUS interprets the need, assembles the packages that clear policy, negotiates within it, has both sides sign identical terms, funds the deal in USDC on Arc, runs a real metered service, and settles only the usage the buyer countersigned. Unused balance goes back to the buyer.

Built for the Tameion Agents Hackathon (Canteen x Circle x Arc), October 2026. **Testnet only. Sandbox seller labeled. Contract unaudited. No mainnet.**

## What the agent decides, and what it cannot

- **Decides:** what the buyer is asking for, which of the deterministic candidates to present, how to explain a rejection, when to propose a smaller package, when to escalate to the owner.
- **Cannot:** set a price, change the margin floor or any policy, mint a number that is not in a candidate, sign anything, or move money. Prices and policy checks are pure functions in `packages/domain`. Money moves only on buyer + seller EIP-712 signatures inside `contracts/src/DealEscrow.sol`. The relayer (a Circle developer-controlled wallet when configured, otherwise a bounded viem key) only submits transactions whose authority is in the calldata.

The key phrase, implemented literally: **the model proposes, your policies decide, the agreement controls the money.**

## Layout

```
site/                Vite + React web app: marketing page, buyer flow, seller console, public records
server/              Hono API, Drizzle/Postgres, agent adapters, service gateway, chain reconciler, relayer
packages/domain/     bigint micro-USDC money math, candidate engine, policy rules, EIP-712 types, Arc constants
contracts/           DealEscrow.sol (Arc Foundry), unit + fuzz + invariant tests, deploy script
docs/                api.md, settlement-model.md, threat-model.md, demo-script.md
DECISIONS.md BUILD_STATUS.md OPEN_ISSUES.md DEPLOYMENT.md
```

## Run it

```bash
pnpm install
createdb proteus && cp .env.example server/.env
pnpm --filter @proteus/server keys:gen && pnpm --filter @proteus/server db:push && pnpm --filter @proteus/server db:seed
pnpm --filter @proteus/server dev      # API :8787
pnpm --filter proteus-site dev         # web :5174
```

Tests: `pnpm --filter @proteus/domain test` (13), `pnpm --filter @proteus/server test`, `pnpm contracts:test` (24 unit/fuzz + 3 invariants). Full money loop against a local Arc anvil: see `DEPLOYMENT.md` and `server/scripts/testnet-demo.ts`.

## What a reviewer can do without credentials

- Negotiate with the sandbox seller at `/s/northwind-support/order-support` (try the e-commerce support starter).
- Watch a below-floor counter get rejected with a safe explanation, and a prompt-injection attempt change nothing.
- Open the seller console via "Try the sandbox seller" and see the private economics, rule ids and the agent's activity log for the same negotiation.
- With an Arc testnet wallet: sign terms, approve and fund USDC, call the real order-support endpoint, sign usage, watch settlement and refund on the explorer.
- Read `/review` and `/records/:publicId`: redacted proof with transaction hashes.

## Provenance and traction, honestly

- Everything in the sandbox seller is **illustrative** data on **testnet** USDC and is excluded from live counters.
- Arc testnet: `DealEscrow` verified at `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`; the full loop ran with real transactions, hashes in `docs/acceptance-report.md`. The buyer in that run was our own key, so it is proof of the mechanism, not traction.
- No customers, revenue or mainnet activity are claimed.

## Circle and Arc usage

Arc testnet (chain 5042002) with the native-gas USDC and its 6-decimal ERC-20 interface; Arc Foundry for the contract; Circle developer-controlled wallets SDK 10.8.1 for the relayer (`createContractExecutionTransaction`, `ARC-TESTNET`). Which relayer actually ran is recorded on every transaction row and shown on the deal page.
