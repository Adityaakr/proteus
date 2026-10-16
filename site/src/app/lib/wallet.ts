/**
 * Embedded wallet (Privy) helpers built on viem. The account's wallet is a Privy ConnectedWallet;
 * `walletClientFor` wraps its EIP-1193 provider in a viem WalletClient pinned to Arc testnet.
 * Every transaction hash shown in the UI comes back from the wallet; nothing here fabricates one.
 */
import { createPublicClient, createWalletClient, custom, erc20Abi, getAddress, http, type Address, type Hex, type WalletClient } from "viem";
import { ACCEPTANCE_TYPES, ARC_TESTNET_USDC, TERMS_TYPES, arcTestnet, domain } from "@proteus/domain";
import type { AcceptanceWire, PayAccept, PayAuthorization, TermsWire, TypedDataWire } from "./types";

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

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

/** Turn wallet / RPC errors into short, human copy. */
export function walletErrorMessage(e: unknown): string {
  const err = e as { code?: number; shortMessage?: string; message?: string; cause?: { code?: number } };
  const code = err?.code ?? err?.cause?.code;
  if (code === 4001 || /user rejected|denied|cancel/i.test(err?.message ?? "")) return "You declined the request.";
  if (code === -32002) return "Your wallet already has a pending request. Open it to continue.";
  if (/insufficient funds/i.test(err?.message ?? "")) return "Not enough testnet USDC for this transaction and its gas.";
  return err?.shortMessage ?? err?.message ?? "The wallet request failed.";
}

/** The parts of a Privy ConnectedWallet these helpers need (kept structural so lib stays SDK free). */
export interface EmbeddedWalletLike {
  address: string;
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<{ request: (args: { method: string; params?: unknown }) => Promise<unknown> }>;
}

/** Switch the wallet to Arc testnet and return a viem WalletClient bound to its address. */
export async function walletClientFor(w: EmbeddedWalletLike): Promise<WalletClient> {
  try {
    await w.switchChain(arcTestnet.id);
  } catch (e) {
    throw new WalletError(`Could not switch the wallet to Arc testnet. ${walletErrorMessage(e)}`);
  }
  const provider = await w.getEthereumProvider();
  return createWalletClient({ account: getAddress(w.address), chain: arcTestnet, transport: custom(provider as never) });
}

function accountOf(client: WalletClient): Address {
  const a = client.account?.address;
  if (!a) throw new WalletError("The wallet has no account.");
  return a;
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
export async function signTerms(client: WalletClient, td: TypedDataWire<"Terms", TermsWire>): Promise<Hex> {
  return client.signTypedData({
    account: client.account ?? accountOf(client),
    domain: domain(Number(td.domain.chainId), getAddress(td.domain.verifyingContract)),
    types: TERMS_TYPES,
    primaryType: "Terms",
    message: termsToMessage(td.message),
  });
}

export async function signAcceptance(client: WalletClient, td: TypedDataWire<"Acceptance", AcceptanceWire>): Promise<Hex> {
  return client.signTypedData({
    account: client.account ?? accountOf(client),
    domain: domain(Number(td.domain.chainId), getAddress(td.domain.verifyingContract)),
    types: ACCEPTANCE_TYPES,
    primaryType: "Acceptance",
    message: acceptanceToMessage(td.message),
  });
}

export async function readUsdcBalance(owner: Address, usdc: Address = ARC_TESTNET_USDC): Promise<bigint> {
  return publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

/** Native USDC balance in wei (18 decimals). Same funds as the ERC-20 view, which uses 6 decimals. */
export async function readNativeBalance(owner: Address): Promise<bigint> {
  return publicClient.getBalance({ address: owner });
}

export async function readUsdcAllowance(owner: Address, spender: Address, usdc: Address = ARC_TESTNET_USDC): Promise<bigint> {
  return publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
}

/** ERC-20 approve(escrow, amount) on the Arc testnet USDC interface (6 decimals). Returns the wallet's tx hash. */
export async function approveUsdc(client: WalletClient, spender: Address, amount: bigint, usdc: Address = ARC_TESTNET_USDC): Promise<Hex> {
  return client.writeContract({ account: client.account ?? accountOf(client), chain: arcTestnet, address: usdc, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

/** Buyer submits createAndFundDeal(terms, buyerSig, sellerSig) on the escrow. Returns the wallet's tx hash. */
export async function createAndFundDeal(client: WalletClient, escrow: Address, terms: TermsWire, buyerSig: Hex, sellerSig: Hex): Promise<Hex> {
  return client.writeContract({
    account: client.account ?? accountOf(client),
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
/* x402 exact scheme: EIP-3009 TransferWithAuthorization               */
/* ------------------------------------------------------------------ */

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Sign the payment authorization for one x402 requirement. The nonce comes from the server. */
export async function signTransferAuthorization(client: WalletClient, req: PayAccept, nonce: Hex, chainId: number = arcTestnet.id): Promise<{ signature: Hex; authorization: PayAuthorization }> {
  const from = accountOf(client);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + Math.min(120, req.maxTimeoutSeconds || 120));
  const authorization: PayAuthorization = { from, to: getAddress(req.payTo), value: req.amount, validAfter: "0", validBefore: validBefore.toString(), nonce };
  const signature = await client.signTypedData({
    account: from,
    domain: { name: req.extra?.name ?? "USDC", version: req.extra?.version ?? "2", chainId, verifyingContract: getAddress(req.asset) },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: { from, to: authorization.to, value: BigInt(req.amount), validAfter: 0n, validBefore, nonce },
  });
  return { signature, authorization };
}
