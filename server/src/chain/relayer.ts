import { createWalletClient, encodeFunctionData, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { circleBlockchainFor } from "@proteus/domain";
import { env, features } from "../env";
import { dealEscrowAbi } from "./abi";
import { chain, escrowAddress, feeParams, publicClient, usdcAddress } from "./client";

/**
 * The relayer submits transactions whose authority comes entirely from signatures inside the calldata
 * (createAndFundDeal with buyer+seller sigs, settleAcceptedUsage with buyer+seller sigs) or that anyone
 * may call (refundUnused). It never holds buyer funds and cannot redirect payouts.
 *
 * Two implementations: Circle developer-controlled wallet (preferred when configured) and a viem
 * wallet with a server-held key. Which one ran is recorded on every chain_txs row.
 */
export interface Relayer {
  readonly kind: "circle" | "viem";
  readonly address: Address;
  submit(fn: "createAndFundDeal" | "settleAcceptedUsage" | "refundUnused", args: readonly unknown[]): Promise<{ txHash: Hex }>;
  /** Several calls in one transaction through Multicall3 (atomic unless a call allows failure). Targets: USDC and the escrow only. */
  submitBatch(calls: readonly BatchCall[]): Promise<{ txHash: Hex }>;
}

export interface BatchCall {
  target: Address;
  allowFailure: boolean;
  callData: Hex;
}

/** Multicall3, deployed at its canonical address on Arc mainnet and testnet (checked with eth_getCode). */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;
export const multicall3Abi = parseAbi(["struct Call3 { address target; bool allowFailure; bytes callData; }", "struct Result { bool success; bytes returnData; }", "function aggregate3(Call3[] calls) payable returns (Result[] returnData)"]);

/** The relayer only batches calls into the two contracts whose authority is signature-based. */
function batchData(calls: readonly BatchCall[]): Hex {
  const allowed = new Set([escrowAddress().toLowerCase(), usdcAddress.toLowerCase()]);
  for (const c of calls) if (!allowed.has(c.target.toLowerCase())) throw new Error(`relayer batch target not allowed: ${c.target}`);
  return encodeFunctionData({ abi: multicall3Abi, functionName: "aggregate3", args: [calls] });
}

export function relayerKind(): "circle" | "viem" | "none" {
  if (features.circle) return "circle";
  if (features.viemRelayer) return "viem";
  return "none";
}

let cached: Relayer | undefined;

export function getRelayer(): Relayer {
  if (cached) return cached;
  if (features.circle) cached = circleRelayer();
  else if (features.viemRelayer) cached = viemRelayer();
  else throw new Error("No relayer configured: set CIRCLE_* or RELAYER_PRIVATE_KEY");
  return cached;
}

function viemRelayer(): Relayer {
  const account = privateKeyToAccount(env.RELAYER_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({ account, chain, transport: http(env.ARC_RPC_URL) });
  return {
    kind: "viem",
    address: account.address,
    async submit(fn, args) {
      return withRpcRetry(async () => {
        const fees = await feeParams();
        // Simulate first so a revert surfaces as a typed error instead of a dropped tx.
        const { request } = await publicClient.simulateContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: fn, args: args as never, account, ...fees });
        const txHash = await wallet.writeContract(request);
        return { txHash };
      });
    },
    async submitBatch(calls) {
      const data = batchData(calls);
      return withRpcRetry(async () => {
        const fees = await feeParams();
        await publicClient.call({ account, to: MULTICALL3, data });
        const gas = await publicClient.estimateGas({ account, to: MULTICALL3, data });
        const txHash = await wallet.sendTransaction({ account, chain, to: MULTICALL3, data, gas: (gas * 12n) / 10n, ...fees });
        return { txHash };
      });
    },
  };
}

function circleRelayer(): Relayer {
  // Lazy import so environments without Circle credentials never load the SDK.
  let clientPromise: Promise<ReturnType<typeof import("@circle-fin/developer-controlled-wallets")["initiateDeveloperControlledWalletsClient"]>> | undefined;
  const getClient = () => {
    clientPromise ??= import("@circle-fin/developer-controlled-wallets").then((m) => m.initiateDeveloperControlledWalletsClient({ apiKey: env.CIRCLE_API_KEY!, entitySecret: env.CIRCLE_ENTITY_SECRET! }));
    return clientPromise;
  };
  async function execute(contractAddress: Address, callData: Hex): Promise<{ txHash: Hex }> {
    const client = await getClient();
    // Simulate with the public client from the Circle wallet address to catch reverts before paying gas.
    await publicClient.call({ account: env.CIRCLE_WALLET_ADDRESS as Address, to: contractAddress, data: callData });
    const res = await client.createContractExecutionTransaction({
      walletId: env.CIRCLE_WALLET_ID!,
      contractAddress,
      callData,
      fee: { type: "level", config: { feeLevel: "HIGH" } },
    });
    const txId = res.data?.id;
    if (!txId) throw new Error("Circle: no transaction id returned");
    // Poll for the tx hash. Circle states: INITIATED, QUEUED, SENT, CONFIRMED, COMPLETE, FAILED, ...
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const tx = await client.getTransaction({ id: txId });
      const t = tx.data?.transaction;
      if (t?.txHash) return { txHash: t.txHash as Hex };
      if (t?.state && ["FAILED", "DENIED", "CANCELLED"].includes(String(t.state))) throw new Error(`Circle transaction ${t.state}: ${String((t as { errorReason?: string }).errorReason ?? "")}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Circle transaction did not return a hash in time");
  }
  return {
    kind: "circle",
    address: env.CIRCLE_WALLET_ADDRESS as Address,
    submit(fn, args) {
      return execute(escrowAddress(), encodeFunctionData({ abi: dealEscrowAbi, functionName: fn, args: args as never }));
    },
    submitBatch(calls) {
      return execute(MULTICALL3, batchData(calls));
    },
  };
}

/** Circle chain code for the configured network. */
export const CIRCLE_BLOCKCHAIN = circleBlockchainFor(env.CHAIN_ID);

/**
 * Retries a relayed call when the RPC rate-limits it (HTTP 429 or JSON-RPC "limit exceeded"), with backoff.
 * Contract reverts and every other error surface immediately; nothing is retried that could double-submit,
 * because a rate-limited request was rejected before it reached the mempool.
 */
export async function withRpcRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const text = `${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? ""} ${String((e as { cause?: unknown })?.cause ?? "")}`;
      const limited = /LimitExceeded|exceeds defined limit|429|Too Many Requests|rate limit/i.test(text);
      if (!limited || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i + Math.floor(Math.random() * 300)));
    }
  }
}
