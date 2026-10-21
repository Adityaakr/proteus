/**
 * Arbiter: resolve a disputed deal by splitting its unspent escrow balance between the seller's payee and the buyer.
 * The contract allows nothing else (DealEscrow.resolveDispute): it cannot move settled funds or pay a third party.
 *
 *   tsx scripts/resolve-dispute.ts <dealId> <toSellerUsdc> <toBuyerUsdc> [--confirm]
 *
 * Key: ARBITER_PRIVATE_KEY (must be the escrow's arbiter). On Arc testnet it falls back to DEPLOYER_PRIVATE_KEY, the
 * arbiter set at deployment. On mainnet ARBITER_PRIVATE_KEY is required and nothing is sent without --confirm.
 */
import { createWalletClient, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../src/env";
import { dealEscrowAbi } from "../src/chain/abi";
import { chain, escrowAddress, feeParams, publicClient } from "../src/chain/client";
import { loadDeal } from "../src/services/deals";
import { disputeView } from "../src/services/disputes";

const [dealId, sellerArg, buyerArg] = process.argv.slice(2);
const confirm = process.argv.includes("--confirm");
if (!dealId || sellerArg === undefined || buyerArg === undefined) throw new Error("usage: resolve-dispute.ts <dealId> <toSellerUsdc> <toBuyerUsdc> [--confirm]");
const mainnet = env.CHAIN_ID === 5042;
const key = process.env.ARBITER_PRIVATE_KEY ?? (mainnet ? undefined : process.env.DEPLOYER_PRIVATE_KEY);
if (!key) throw new Error("ARBITER_PRIVATE_KEY is required on Arc mainnet.");
const arbiter = privateKeyToAccount(key as Hex);

const deal = await loadDeal(dealId);
const view = await disputeView(dealId);
if (view.arbiter.toLowerCase() !== arbiter.address.toLowerCase()) throw new Error(`This key (${arbiter.address}) is not the escrow arbiter (${view.arbiter}).`);
const toSeller = parseUnits(sellerArg, 6);
const toBuyer = parseUnits(buyerArg, 6);
const [deposit, settled, refunded] = (await publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "balances", args: [deal.dealIdOnchain] })) as readonly [bigint, bigint, bigint, bigint];
const remaining = deposit - settled - refunded;
console.log({ deal: dealId, reason: view.dispute?.reason, remaining: remaining.toString(), toSeller: toSeller.toString(), toBuyer: toBuyer.toString(), network: mainnet ? "Arc mainnet" : "Arc testnet" });
if (toSeller + toBuyer > remaining) throw new Error("The split exceeds the unspent balance.");
if (mainnet && !confirm) {
  console.log("Dry run on mainnet. Re-run with --confirm to send.");
  process.exit(0);
}
const wallet = createWalletClient({ account: arbiter, chain, transport: http(env.ARC_RPC_URL) });
const { request } = await publicClient.simulateContract({ account: arbiter, address: escrowAddress() as Address, abi: dealEscrowAbi, functionName: "resolveDispute", args: [deal.dealIdOnchain, toSeller, toBuyer], ...(await feeParams()) });
const hash = await wallet.writeContract(request);
await publicClient.waitForTransactionReceipt({ hash });
console.log("resolveDispute tx", hash);
process.exit(0);
