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

## Hosting on Railway (site and API in one service)

The repo carries `railway.json` and `railpack.json`. One Railway service pointed at this repo builds the domain and server type checks plus the site (`pnpm --filter proteus-site build`), then starts with `pnpm --filter @proteus/server start:prod` (`scripts/start-prod.ts`): check the variables and print what is missing, wait for Postgres, push the Drizzle schema, bootstrap an empty market (`scripts/bootstrap.ts`), serve. A service without `DATABASE_URL` does not crash: it serves the site only and answers `/api` with a 503 that says what is missing; set `API_ORIGIN` to the API service's URL on it to forward `/api` there instead. The clean setup is still one service with the Postgres plugin. The API serves the built site from `site/dist` on the same origin, so there is no proxy and no second service. Health check: `/api/health`.

1. Create a Railway project with a **Postgres** plugin and **one** service from this GitHub repo (root directory `/`). If Railway offers one service per workspace package, keep only `@proteus/server` and delete the others; each extra one runs the same start command and crashes.
2. Service Settings → Networking → Generate Domain. The site is at `https://<domain>/`, the API at `https://<domain>/api/health`.
3. Variables: `DATABASE_URL` (reference the plugin), `NODE_ENV=production`, `WEB_ORIGIN=https://<domain>`, `SESSION_SECRET`, `KEY_ENCRYPTION_SECRET`, `ARC_RPC_URL`, `CHAIN_ID=5042002`, `USDC_ADDRESS`, `ESCROW_ADDRESS`, `DEPLOYER_PRIVATE_KEY`, `SELLER_SIGNER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `OPENROUTER_API_KEY`, `PRIVY_APP_ID`, `ADMIN_TOKEN` (32+ random chars) and `INVITE_PEPPER` (32+ random chars). Leave `PRIVY_DEV_BYPASS` unset. Redeploy after setting them.
4. Invite codes: the product is invite-only in production (`INVITE_GATE` defaults to on). Mint codes against the hosted database with the admin route, which returns each code exactly once:
   `curl -X POST https://<domain>/api/admin/invites -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{"count":100,"label":"launch"}'`
   `GET /api/admin/invites` lists status and who redeemed what; `POST /api/admin/invites/revoke {"invite":"<id or code>"}` revokes. From a shell with the database URL, `pnpm --filter @proteus/server exec tsx scripts/invites.ts generate 100 --label launch` does the same.
4. In the Privy dashboard, add `https://<domain>` to the app's allowed origins so login works there.

## Hosting (earlier notes)

Web: any static host (`pnpm --filter proteus-site build` → `site/dist`), with `/api` proxied to the API. API + reconciler: one long-running Node 22 process (Railway, Fly, Render) with Postgres. Keep `server/.env` out of git; use the host's secret manager. Mainnet is off: `CHAIN_ID`, `USDC_ADDRESS` and the faucet references are testnet-only, and there is no mainnet config path.
