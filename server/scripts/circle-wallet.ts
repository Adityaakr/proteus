/**
 * Creates (or reuses) a Circle developer-controlled wallet set and one ARC-TESTNET wallet for the relayer,
 * requests faucet tokens, and prints the env values to add to server/.env.
 *
 *   CIRCLE_API_KEY=... CIRCLE_ENTITY_SECRET=... npx tsx scripts/circle-wallet.ts
 *
 * SDK: @circle-fin/developer-controlled-wallets 10.8.1 (methods verified in installed types:
 * createWalletSet, createWallets, requestTestnetTokens, getWalletTokenBalance).
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
if (!apiKey || !entitySecret) throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required");

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
const setName = process.env.CIRCLE_WALLET_SET_NAME ?? "proteus-relayer";

const set = await client.createWalletSet({ name: setName });
const walletSetId = set.data?.walletSet?.id;
if (!walletSetId) throw new Error("no wallet set id returned");
const wallets = await client.createWallets({ blockchains: ["ARC-TESTNET"], count: 1, walletSetId, accountType: "EOA" });
const w = wallets.data?.wallets?.[0];
if (!w) throw new Error("no wallet returned");
console.log(`CIRCLE_WALLET_ID=${w.id}`);
console.log(`CIRCLE_WALLET_ADDRESS=${w.address}`);
try {
  await client.requestTestnetTokens({ address: w.address, blockchain: "ARC-TESTNET", usdc: true, native: true });
  console.log("requested testnet tokens (USDC + native gas)");
} catch (e) {
  console.log("faucet request failed (use https://faucet.circle.com manually):", String((e as Error).message).slice(0, 200));
}
