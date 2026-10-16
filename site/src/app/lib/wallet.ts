/**
 * Injected wallet (window.ethereum) helpers built on viem. Every transaction hash shown in the UI
 * comes back from the wallet; nothing here fabricates one.
 */
import { useCallback, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, erc20Abi, getAddress, http, type Address, type EIP1193Provider, type Hex, type WalletClient } from "viem";
import { ACCEPTANCE_TYPES, ARC_TESTNET_USDC, TERMS_TYPES, arcTestnet, domain } from "@proteus/domain";
import type { AcceptanceWire, TermsWire, TypedDataWire } from "./types";

declare global {
  interface Window {
    ethereum?: EIP1193Provider & { isMetaMask?: boolean };
  }
}

export const ESCROW_ABI = [
  {
    type: "function",
    name: "createAndFundDeal",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "t",
        type: "tuple",
        components: TERMS_TYPES.Terms.map((f) => ({ name: f.name, type: f.type })),
      },
      { name: "buyerSig", type: "bytes" },
      { name: "sellerSig", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export class WalletError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function provider(): EIP1193Provider {
  if (!hasInjectedWallet()) throw new WalletError("No browser wallet found. Install a wallet such as MetaMask or Rabby to continue.");
  return window.ethereum!;
}

let wallet: WalletClient | null = null;
function walletClient(): WalletClient {
  if (!wallet) wallet = createWalletClient({ chain: arcTestnet, transport: custom(provider()) });
  return wallet;
}

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

/** Turn wallet / RPC errors into short, human copy. */
export function walletErrorMessage(e: unknown): string {
  const err = e as { code?: number; shortMessage?: string; message?: string; cause?: { code?: number } };
  const code = err?.code ?? err?.cause?.code;
  if (code === 4001 || /user rejected|denied/i.test(err?.message ?? "")) return "You declined the request in your wallet.";
  if (code === -32002) return "Your wallet already has a pending request. Open it to continue.";
  return err?.shortMessage ?? err?.message ?? "The wallet request failed.";
}

export async function connectWallet(): Promise<Address> {
  const accounts = (await provider().request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new WalletError("No account was shared by the wallet.");
  return getAddress(accounts[0]);
}

export async function currentAccount(): Promise<Address | null> {
  if (!hasInjectedWallet()) return null;
  const accounts = (await provider().request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ? getAddress(accounts[0]) : null;
}

export async function currentChainId(): Promise<number | null> {
  if (!hasInjectedWallet()) return null;
  const hex = (await provider().request({ method: "eth_chainId" })) as string;
  return parseInt(hex, 16);
}

/** Switch to Arc testnet, adding it to the wallet (wallet_addEthereumChain) if unknown. */
export async function ensureArcTestnet(): Promise<void> {
  const id = await currentChainId();
  if (id === arcTestnet.id) return;
  const chainIdHex = `0x${arcTestnet.id.toString(16)}`;
  try {
    await provider().request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (e) {
    const code = (e as { code?: number; data?: { originalError?: { code?: number } } }).code ?? (e as { data?: { originalError?: { code?: number } } }).data?.originalError?.code;
    if (code !== 4902 && code !== -32603) throw e;
    await provider().request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: arcTestnet.name,
          nativeCurrency: arcTestnet.nativeCurrency,
          rpcUrls: [...arcTestnet.rpcUrls.default.http],
          blockExplorerUrls: [arcTestnet.blockExplorers!.default.url],
        },
      ],
    });
  }
}

const big = (v: string | number | bigint) => BigInt(v);

export function termsToMessage(t: TermsWire) {
  return {
    dealId: big(t.dealId),
    buyer: getAddress(t.buyer),
    seller: getAddress(t.seller),
    payee: getAddress(t.payee),
    usdc: getAddress(t.usdc),
    productId: t.productId,
    unitNum: big(t.unitNum),
    unitDen: big(t.unitDen),
    maxUnits: big(t.maxUnits),
    prepaid: big(t.prepaid),
    start: big(t.start),
    end: big(t.end),
    grace: big(t.grace),
    publicTermsHash: t.publicTermsHash,
    nonce: big(t.nonce),
    expiry: big(t.expiry),
  };
}

export function acceptanceToMessage(a: AcceptanceWire) {
  return {
    dealId: big(a.dealId),
    termsHash: a.termsHash,
    cumulativeAmount: big(a.cumulativeAmount),
    cumulativeUnits: big(a.cumulativeUnits),
    receiptsRoot: a.receiptsRoot,
    nonce: big(a.nonce),
    expiry: big(a.expiry),
  };
}

/** EIP-712 sign the Terms. Uses the canonical TERMS_TYPES from @proteus/domain, not server-sent types. */
export async function signTerms(account: Address, td: TypedDataWire<"Terms", TermsWire>): Promise<Hex> {
  await ensureArcTestnet();
  return walletClient().signTypedData({
    account,
    domain: domain(Number(td.domain.chainId), getAddress(td.domain.verifyingContract)),
    types: TERMS_TYPES,
    primaryType: "Terms",
    message: termsToMessage(td.message),
  });
}

export async function signAcceptance(account: Address, td: TypedDataWire<"Acceptance", AcceptanceWire>): Promise<Hex> {
  await ensureArcTestnet();
  return walletClient().signTypedData({
    account,
    domain: domain(Number(td.domain.chainId), getAddress(td.domain.verifyingContract)),
    types: ACCEPTANCE_TYPES,
    primaryType: "Acceptance",
    message: acceptanceToMessage(td.message),
  });
}

export async function readUsdcBalance(owner: Address, usdc: Address = ARC_TESTNET_USDC): Promise<bigint> {
  return publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export async function readUsdcAllowance(owner: Address, spender: Address, usdc: Address = ARC_TESTNET_USDC): Promise<bigint> {
  return publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
}

/** ERC-20 approve(escrow, amount) on the Arc testnet USDC interface (6 decimals). Returns the wallet's tx hash. */
export async function approveUsdc(account: Address, spender: Address, amount: bigint, usdc: Address = ARC_TESTNET_USDC): Promise<Hex> {
  await ensureArcTestnet();
  return walletClient().writeContract({ account, chain: arcTestnet, address: usdc, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

/** Buyer submits createAndFundDeal(terms, buyerSig, sellerSig) on the escrow. Returns the wallet's tx hash. */
export async function createAndFundDeal(account: Address, escrow: Address, terms: TermsWire, buyerSig: Hex, sellerSig: Hex): Promise<Hex> {
  await ensureArcTestnet();
  return walletClient().writeContract({
    account,
    chain: arcTestnet,
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "createAndFundDeal",
    args: [termsToMessage(terms), buyerSig, sellerSig],
  });
}

export async function waitForReceipt(hash: Hex) {
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return { status: r.status, blockNumber: r.blockNumber, hash: r.transactionHash };
}

/* ------------------------------------------------------------------ */
/* React hook                                                          */
/* ------------------------------------------------------------------ */

export interface WalletState {
  available: boolean;
  account: Address | null;
  chainId: number | null;
  onArc: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<Address | null>;
  switchToArc: () => Promise<boolean>;
}

export function useWallet(): WalletState {
  const available = hasInjectedWallet();
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let live = true;
    currentAccount().then((a) => live && setAccount(a)).catch(() => {});
    currentChainId().then((c) => live && setChainId(c)).catch(() => {});
    const eth = window.ethereum!;
    const onAccounts = (accs: string[]) => setAccount(accs?.[0] ? getAddress(accs[0]) : null);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    eth.on?.("accountsChanged", onAccounts as never);
    eth.on?.("chainChanged", onChain as never);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts as never);
      eth.removeListener?.("chainChanged", onChain as never);
    };
  }, [available]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const a = await connectWallet();
      setAccount(a);
      setChainId(await currentChainId());
      return a;
    } catch (e) {
      setError(walletErrorMessage(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToArc = useCallback(async () => {
    setError(null);
    try {
      await ensureArcTestnet();
      setChainId(await currentChainId());
      return true;
    } catch (e) {
      setError(walletErrorMessage(e));
      return false;
    }
  }, []);

  return { available, account, chainId, onArc: chainId === arcTestnet.id, connecting, error, connect, switchToArc };
}
