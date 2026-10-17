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

/** Arc mainnet facts, from https://docs.arc.io/arc/references/rpc-endpoints (read 2026-10-17): chain 5042, same USDC interface. */
export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_MAINNET_RPC = "https://rpc.mainnet.arc.io";
export const ARC_MAINNET_EXPLORER = "https://explorer.arc.io";
export const ARC_MAINNET_USDC = "0x3600000000000000000000000000000000000000" as const;
export const CIRCLE_BLOCKCHAIN_ARC_MAINNET = "ARC";

export type ArcNetwork = "testnet" | "mainnet";
export const ARC_NETWORK_NAMES: Record<ArcNetwork, string> = { testnet: "Arc testnet", mainnet: "Arc mainnet" };

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC], webSocket: ["wss://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_TESTNET_EXPLORER } },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_MAINNET_RPC], webSocket: ["wss://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_MAINNET_EXPLORER } },
  testnet: false,
});

export function networkOf(chainId: number): ArcNetwork {
  return chainId === ARC_MAINNET_CHAIN_ID ? "mainnet" : "testnet";
}
export function chainFor(chainId: number) {
  return chainId === ARC_MAINNET_CHAIN_ID ? arcMainnet : arcTestnet;
}
export function explorerBase(chainId: number): string {
  return chainId === ARC_MAINNET_CHAIN_ID ? ARC_MAINNET_EXPLORER : ARC_TESTNET_EXPLORER;
}
export function circleBlockchainFor(chainId: number): "ARC" | "ARC-TESTNET" {
  return chainId === ARC_MAINNET_CHAIN_ID ? CIRCLE_BLOCKCHAIN_ARC_MAINNET : CIRCLE_BLOCKCHAIN_ARC_TESTNET;
}

/**
 * The chain this process talks to. The server sets it from CHAIN_ID at boot; the site sets it from /api/health
 * before any page renders. Explorer links and wallet clients default to it, so one deployment serves one network.
 */
let currentChainId: number = ARC_TESTNET_CHAIN_ID;
export function setDefaultChainId(id: number): void {
  currentChainId = id;
}
export function defaultChainId(): number {
  return currentChainId;
}
export function defaultChain() {
  return chainFor(currentChainId);
}
export function defaultNetwork(): ArcNetwork {
  return networkOf(currentChainId);
}

export function explorerTx(hash: string, chainId: number = currentChainId): string {
  return `${explorerBase(chainId)}/tx/${hash}`;
}
export function explorerAddress(addr: string, chainId: number = currentChainId): string {
  return `${explorerBase(chainId)}/address/${addr}`;
}
