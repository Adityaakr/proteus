# DEPLOYMENT

## Local

```bash
pnpm install
createdb proteus
cp .env.example server/.env
pnpm --filter @proteus/server keys:gen          # writes DEPLOYER / SELLER_SIGNER / RELAYER keys into server/.env, prints addresses
pnpm --filter @proteus/server db:push           # drizzle-kit push
pnpm --filter @proteus/server db:seed           # sandbox seller, product, cost model, policy, sample store
pnpm --filter @proteus/server dev               # API on :8787
pnpm --filter proteus-site dev                  # web on :5174 (proxies /api)
```

Contracts: `pnpm contracts:test` (Arc Foundry: install `arc-forge` per https://docs.arc.io/arc/tutorials/install-arc-foundry.md; on macOS it needs `brew install libusb`).

## Rehearsal on local Arc anvil (no funds needed)

```bash
arc-anvil --network arc --port 8545
cd contracts && USDC_ADDRESS=0x3600000000000000000000000000000000000000 DEPLOYER_PRIVATE_KEY=<anvil key 0> \
  arc-forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key <anvil key 0> --broadcast
createdb proteus_local
cd server && DATABASE_URL=postgres://localhost:5432/proteus_local PORT=8788 ARC_RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337 \
  ESCROW_ADDRESS=<deployed> SELLER_SIGNER_PRIVATE_KEY=<anvil key 3> RELAYER_PRIVATE_KEY=<anvil key 2> DEAL_GRACE_SECONDS=60 \
  sh -c 'npx drizzle-kit push --force && npx tsx scripts/seed.ts && npx tsx src/index.ts'
API_URL=http://localhost:8788 ARC_RPC_URL=http://127.0.0.1:8545 BUYER_PRIVATE_KEY=<anvil key 4> npx tsx scripts/testnet-demo.ts
```
Avoid anvil account 1 as the buyer: it is the blocklisted test address on Arc.

## Arc testnet

1. Fund the deployer and relayer addresses printed by `keys:gen` with Arc testnet USDC at https://faucet.circle.com (USDC is native gas on Arc; min base fee 20 gwei).
2. `cd contracts && source ../server/.env && USDC_ADDRESS=0x3600000000000000000000000000000000000000 pnpm deploy:testnet` → address in `contracts/deployments/latest.json`.
3. `ESCROW_ADDRESS=<address> pnpm verify:testnet` (Blockscout at https://explorer.testnet.arc.io).
4. Put `ESCROW_ADDRESS` in `server/.env`, restart the API, re-run `db:seed` if the seller signer changed.
5. Optional Circle relayer: set `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET`, run `npx tsx scripts/circle-wallet.ts` to create an `ARC-TESTNET` wallet and request faucet tokens; put the printed `CIRCLE_WALLET_ID` / `CIRCLE_WALLET_ADDRESS` in `server/.env`.
6. Run `API_URL=http://localhost:8787 BUYER_PRIVATE_KEY=<funded buyer> npx tsx scripts/testnet-demo.ts` and record the printed hashes in `docs/acceptance-report.md`.

## Hosting (not done)

Web: any static host (`pnpm --filter proteus-site build` → `site/dist`), with `/api` proxied to the API. API + reconciler: one long-running Node 22 process (Railway, Fly, Render) with Postgres. Keep `server/.env` out of git; use the host's secret manager. Mainnet is off: `CHAIN_ID`, `USDC_ADDRESS` and the faucet references are testnet-only, and there is no mainnet config path.
