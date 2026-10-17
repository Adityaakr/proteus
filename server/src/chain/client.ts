import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MIN_BASE_FEE_WEI, chainFor } from "@proteus/domain";
import { env } from "../env";

export const chain = { ...chainFor(env.CHAIN_ID), id: env.CHAIN_ID, rpcUrls: { default: { http: [env.ARC_RPC_URL] } } };

export const publicClient = createPublicClient({ chain, transport: http(env.ARC_RPC_URL) });

export function escrowAddress(): Address {
  if (!env.ESCROW_ADDRESS) throw new Error("ESCROW_ADDRESS not configured (deploy contracts first)");
  return env.ESCROW_ADDRESS as Address;
}

export const usdcAddress = env.USDC_ADDRESS as Address;

/** Delegated seller signer: signs Terms and Delivery digests only. Never holds buyer funds. */
export function sellerSigner() {
  if (!env.SELLER_SIGNER_PRIVATE_KEY) throw new Error("SELLER_SIGNER_PRIVATE_KEY not configured");
  return privateKeyToAccount(env.SELLER_SIGNER_PRIVATE_KEY as Hex);
}

export function sellerSignerAddress(): Address | undefined {
  return env.SELLER_SIGNER_PRIVATE_KEY ? privateKeyToAccount(env.SELLER_SIGNER_PRIVATE_KEY as Hex).address : undefined;
}

/** viem wallet client for the seller signer (used for sellerCloseTerm, which must come from the seller). */
export function sellerWalletClient() {
  return createWalletClient({ account: sellerSigner(), chain, transport: http(env.ARC_RPC_URL) });
}

/** Fee parameters that respect Arc's 20 gwei minimum base fee (below it, txs are silently dropped). */
export async function feeParams() {
  const block = await publicClient.getBlock();
  const base = block.baseFeePerGas ?? ARC_MIN_BASE_FEE_WEI;
  const maxFeePerGas = (base < ARC_MIN_BASE_FEE_WEI ? ARC_MIN_BASE_FEE_WEI : base) * 2n;
  return { maxFeePerGas, maxPriorityFeePerGas: 1_000_000_000n };
}
