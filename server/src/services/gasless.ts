/**
 * Gasless funding for buyers. The buyer signs two messages and sends no transaction:
 *   1. the deal Terms (EIP-712, as before), and
 *   2. an EIP-2612 USDC permit for exactly `prepaid` to the escrow, with a short deadline.
 * The relayer then submits permit + createAndFundDeal in one Multicall3 transaction and pays the gas.
 *
 * Authority still comes only from the buyer's signatures: the permit names the escrow as spender and the
 * exact amount, and the escrow pulls from `terms.buyer` only against the buyer-signed Terms. The permit call
 * allows failure, so a third party front-running the permit just sets the same allowance and funding still
 * succeeds. No contract change: Arc USDC implements permit (name "USDC", version "2", read live below).
 */
import { encodeFunctionData, erc20Abi, hexToSignature, parseAbi, size, type Address, type Hex } from "viem";
import { dealEscrowAbi } from "../chain/abi";
import { escrowAddress, publicClient, usdcAddress } from "../chain/client";
import { getRelayer, withRpcRetry, type BatchCall } from "../chain/relayer";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { eq } from "drizzle-orm";
import { dealView, loadDeal, reviveTerms } from "./deals";

const usdcPermitAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, bytes signature)",
]);
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const; // field order is part of the EIP-2612 type hash
const PERMIT_TTL_S = 20 * 60;

let usdcDomain: { name: string; version: string } | undefined;
async function permitDomain() {
  usdcDomain ??= {
    name: await withRpcRetry(() => publicClient.readContract({ address: usdcAddress, abi: usdcPermitAbi, functionName: "name" })),
    version: await withRpcRetry(() => publicClient.readContract({ address: usdcAddress, abi: usdcPermitAbi, functionName: "version" })),
  };
  return { ...usdcDomain, chainId: env.CHAIN_ID, verifyingContract: usdcAddress };
}

async function fundable(dealId: string) {
  const deal = await loadDeal(dealId);
  if (deal.status !== "awaiting_funding") throw new HttpError(409, `deal is ${deal.status}`);
  return { deal, terms: reviveTerms(deal.terms as Record<string, unknown>) };
}

/** The permit the buyer signs: spender = escrow, value = exactly the prepaid amount, deadline in 20 minutes. */
export async function permitRequest(dealId: string) {
  const { terms } = await fundable(dealId);
  const nonce = await withRpcRetry(() => publicClient.readContract({ address: usdcAddress, abi: usdcPermitAbi, functionName: "nonces", args: [terms.buyer] }));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_TTL_S);
  return {
    domain: await permitDomain(),
    types: PERMIT_TYPES,
    primaryType: "Permit" as const,
    message: { owner: terms.buyer, spender: escrowAddress(), value: terms.prepaid.toString(), nonce: nonce.toString(), deadline: deadline.toString() },
    note: "Signing this lets the escrow pull exactly this USDC amount for this deal. Proteus AI submits the transaction and pays the gas.",
  };
}

/** Relays permit + createAndFundDeal atomically. The buyer's wallet sends nothing. */
export async function fundGasless(dealId: string, body: { deadline: string; signature: Hex }) {
  const { deal, terms } = await fundable(dealId);
  const deadline = BigInt(body.deadline);
  if (deadline <= BigInt(Math.floor(Date.now() / 1000))) throw new HttpError(400, "the permit has expired; sign a new one");
  const sigLen = size(body.signature);
  const domain = await permitDomain();
  const nonce = await publicClient.readContract({ address: usdcAddress, abi: usdcPermitAbi, functionName: "nonces", args: [terms.buyer] });
  // verifyTypedData on the public client also accepts ERC-1271 smart-account signatures.
  const ok = await publicClient.verifyTypedData({ address: terms.buyer, domain, types: PERMIT_TYPES, primaryType: "Permit", message: { owner: terms.buyer, spender: escrowAddress(), value: terms.prepaid, nonce, deadline }, signature: body.signature });
  if (!ok) throw new HttpError(400, "the permit signature does not match this deal's buyer, escrow and amount");
  const balance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [terms.buyer] });
  if (balance < terms.prepaid) throw new HttpError(409, "buyer USDC balance is below the prepaid amount", { required: terms.prepaid.toString(), balance: balance.toString() });

  let permitData: Hex;
  if (sigLen === 65) {
    const { v, r, s } = hexToSignature(body.signature);
    permitData = encodeFunctionData({ abi: usdcPermitAbi, functionName: "permit", args: [terms.buyer, escrowAddress(), terms.prepaid, deadline, Number(v), r, s] });
  } else {
    permitData = encodeFunctionData({ abi: usdcPermitAbi, functionName: "permit", args: [terms.buyer, escrowAddress(), terms.prepaid, deadline, body.signature] });
  }
  const calls: BatchCall[] = [
    { target: usdcAddress as Address, allowFailure: true, callData: permitData },
    { target: escrowAddress(), allowFailure: false, callData: encodeFunctionData({ abi: dealEscrowAbi, functionName: "createAndFundDeal", args: [terms, deal.buyerSignature as Hex, deal.sellerSignature as Hex] as never }) },
  ];
  const relayer = getRelayer();
  const { txHash } = await relayer.submitBatch(calls).catch((e) => {
    throw new HttpError(409, `funding would revert: ${String((e as Error).message).split("\n")[0]?.slice(0, 200)}`);
  });
  await db.insert(schema.chainTxs).values({ id: id("tx"), orgId: deal.orgId, dealId, kind: "fund", txHash, submittedVia: `${relayer.kind}-permit` }).onConflictDoNothing();
  await db.update(schema.deals).set({ status: "funding_pending", fundingTxHash: txHash, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  return dealView(dealId);
}
