import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates local testnet keys into server/.env (untracked) if they are missing. Prints addresses only.
 * Fund DEPLOYER and RELAYER with Arc testnet USDC (native gas) at https://faucet.circle.com.
 */
const envPath = resolve(process.cwd(), ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const lines: string[] = [];
const want = ["DEPLOYER_PRIVATE_KEY", "SELLER_SIGNER_PRIVATE_KEY", "RELAYER_PRIVATE_KEY"];
for (const name of want) {
  const m = existing.match(new RegExp(`^${name}=(0x[0-9a-fA-F]{64})`, "m"));
  const key = m?.[1] ?? generatePrivateKey();
  if (!m) lines.push(`${name}=${key}`);
  console.log(`${name.replace("_PRIVATE_KEY", "")}: ${privateKeyToAccount(key as `0x${string}`).address}${m ? "" : " (new)"}`);
}
if (lines.length) {
  writeFileSync(envPath, (existing ? existing.replace(/\n?$/, "\n") : "") + lines.join("\n") + "\n");
  console.log(`wrote ${lines.length} key(s) to ${envPath}`);
}
