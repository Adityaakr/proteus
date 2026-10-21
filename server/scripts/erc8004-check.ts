/**
 * End-to-end check of the ERC-8004 seller identity on Arc testnet, through the same server code the app uses:
 * a throwaway live seller owned by the deployer key registers its agent (register(agentURI, metadata[])),
 * confirmRegistration reads it back from the chain, assertAgentBinding passes, then a payee mismatch is refused.
 * Testnet only; refuses to run on mainnet. Run: pnpm --filter server exec tsx scripts/erc8004-check.ts
 */
import { eq } from "drizzle-orm";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IDENTITY_REGISTRY_ABI } from "@proteus/domain";
import { env } from "../src/env";
import { db, schema } from "../src/db";
import { chain, feeParams, publicClient } from "../src/chain/client";
import { assertAgentBinding, confirmRegistration, registrationInputs } from "../src/services/agent-registry";

if (env.CHAIN_ID === 5042) throw new Error("erc8004-check runs on Arc testnet only.");
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY is required (testnet).");
const owner = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const orgId = "org_erc8004check";

await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
await db.insert(schema.orgs).values({ id: orgId, slug: "erc8004-check", name: "ERC-8004 check", label: "live", ownerAddress: owner.address, payeeAddress: owner.address, sellerSignerAddress: "0x0000000000000000000000000000000000000000" });

const inputs = await registrationInputs(orgId, "http://localhost:5174");
console.log("registry", inputs.registry, "uri", inputs.agentURI, "signer", inputs.signer);

const wallet = createWalletClient({ account: owner, chain, transport: http(env.ARC_RPC_URL) });
const hash = await wallet.writeContract({ address: inputs.registry, abi: IDENTITY_REGISTRY_ABI, functionName: "register", args: [inputs.agentURI, inputs.metadata], ...(await feeParams()) });
console.log("register tx", hash);

const confirmed = await confirmRegistration(orgId, hash);
console.log("confirmed", confirmed);

const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
await assertAgentBinding(org!);
console.log("binding: ok");

// A payee that no longer matches the chain must stop quoting.
try {
  await assertAgentBinding({ ...org!, id: `${orgId}_x`, payeeAddress: "0x000000000000000000000000000000000000dEaD" });
  console.log("binding with wrong payee: NOT refused (bug)");
  process.exitCode = 1;
} catch (e) {
  console.log("binding with wrong payee: refused ->", (e as Error).message);
}

console.log("block", (await publicClient.getTransactionReceipt({ hash })).blockNumber.toString());
await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
process.exit();
