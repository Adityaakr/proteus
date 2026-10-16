import { createWalletClient, encodeFunctionData, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CIRCLE_BLOCKCHAIN_ARC_TESTNET } from "@proteus/domain";
import { env, features } from "../env";
import { dealEscrowAbi } from "./abi";
import { chain, escrowAddress, feeParams, publicClient } from "./client";

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
      const fees = await feeParams();
      // Simulate first so a revert surfaces as a typed error instead of a dropped tx.
      const { request } = await publicClient.simulateContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: fn, args: args as never, account, ...fees });
      const txHash = await wallet.writeContract(request);
      return { txHash };
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
  return {
    kind: "circle",
    address: env.CIRCLE_WALLET_ADDRESS as Address,
    async submit(fn, args) {
      const client = await getClient();
      const callData = encodeFunctionData({ abi: dealEscrowAbi, functionName: fn, args: args as never });
      // Simulate with the public client from the Circle wallet address to catch reverts before paying gas.
      await publicClient.call({ account: env.CIRCLE_WALLET_ADDRESS as Address, to: escrowAddress(), data: callData });
      const res = await client.createContractExecutionTransaction({
        walletId: env.CIRCLE_WALLET_ID!,
        contractAddress: escrowAddress(),
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
    },
  };
}

export { CIRCLE_BLOCKCHAIN_ARC_TESTNET };
