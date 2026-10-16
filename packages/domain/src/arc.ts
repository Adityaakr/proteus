import { defineChain } from "viem";

/**
 * Arc testnet facts, from https://docs.arc.io/arc/references/connect-to-arc.md and
 * https://docs.arc.io/arc/references/contract-addresses.md (read 2026-10-16).
 * Native gas is USDC with 18 decimals; the ERC-20 interface below has 6 decimals and shares the balance.
 * Minimum base fee is 20 gwei; transactions below it are silently dropped.
 */
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.io";
export const ARC_TESTNET_EXPLORER = "https://explorer.testnet.arc.io";
export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
export const ARC_TESTNET_FAUCET = "https://faucet.circle.com";
export const ARC_MIN_BASE_FEE_WEI = 20_000_000_000n;
/** Circle Wallets blockchain identifier for Arc testnet. */
export const CIRCLE_BLOCKCHAIN_ARC_TESTNET = "ARC-TESTNET";

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC], webSocket: ["wss://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_TESTNET_EXPLORER } },
  testnet: true,
});

export function explorerTx(hash: string): string {
  return `${ARC_TESTNET_EXPLORER}/tx/${hash}`;
}
export function explorerAddress(addr: string): string {
  return `${ARC_TESTNET_EXPLORER}/address/${addr}`;
}
