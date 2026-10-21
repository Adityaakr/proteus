/**
 * Bring USDC to Arc from another chain with Circle's CCTP, through Bridge Kit (@circle-fin/bridge-kit).
 * The browser wallet burns USDC on the source chain; Circle's Forwarder mints it on Arc straight to the
 * account wallet, so the account needs no Arc gas and no second signature. Bridge Kit is loaded on demand:
 * it is large and only this flow uses it. Every hash shown comes back from Bridge Kit; nothing is fabricated.
 */
import { defaultNetwork } from "@proteus/domain";

/** Source chains offered per Arc network. Ids are Bridge Kit chain identifiers; labels are what people see. */
export const BRIDGE_SOURCES = {
  mainnet: [
    { id: "Base", label: "Base" },
    { id: "Ethereum", label: "Ethereum" },
    { id: "Arbitrum", label: "Arbitrum" },
  ],
  testnet: [
    { id: "Base_Sepolia", label: "Base Sepolia" },
    { id: "Ethereum_Sepolia", label: "Ethereum Sepolia" },
    { id: "Arbitrum_Sepolia", label: "Arbitrum Sepolia" },
  ],
} as const;

export type BridgeSource = (typeof BRIDGE_SOURCES)[keyof typeof BRIDGE_SOURCES][number];

export const bridgeSources = (): readonly BridgeSource[] => BRIDGE_SOURCES[defaultNetwork()];
const arcChain = () => (defaultNetwork() === "mainnet" ? "Arc" : "Arc_Testnet");

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
const injected = (): Eip1193 | undefined => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined);

/** True when this browser has a wallet extension that can sign on the source chain. */
export const hasBrowserWallet = () => Boolean(injected());

/** One step of the transfer as Bridge Kit reports it: approve, burn, fetchAttestation, mint. */
export interface BridgeProgress {
  name: string;
  state: "pending" | "success" | "error" | "noop";
  txHash?: string;
  explorerUrl?: string;
}

export interface BridgeOutcome {
  ok: boolean;
  steps: BridgeProgress[];
  /** Raw Bridge Kit result, kept for a retry. */
  raw: unknown;
}

let kitPromise: Promise<{ kit: InstanceType<typeof import("@circle-fin/bridge-kit").BridgeKit>; adapters: typeof import("@circle-fin/adapter-viem-v2") }> | null = null;
function loadKit() {
  kitPromise ??= Promise.all([import("@circle-fin/bridge-kit"), import("@circle-fin/adapter-viem-v2")]).then(([bk, adapters]) => ({ kit: new bk.BridgeKit(), adapters }));
  return kitPromise;
}

async function sourceAdapter() {
  const provider = injected();
  if (!provider) throw new Error("No browser wallet found. Open this page in a browser with MetaMask, Rabby or another wallet extension.");
  await provider.request({ method: "eth_requestAccounts" });
  const { adapters } = await loadKit();
  return adapters.createViemAdapterFromProvider({ provider: provider as never });
}

const params = (adapter: unknown, source: string, amount: string, recipient: string) => ({
  from: { adapter, chain: source },
  to: { chain: arcChain(), recipientAddress: recipient, useForwarder: true as const },
  amount,
});

/**
 * Circle's fees for this transfer, in USDC, summed across protocol and forwarder fees. Null when unknown.
 * Fees do not depend on the sender, so the quote uses a throwaway read-only signer and never opens the wallet.
 */
export async function estimateBridgeFee(source: string, amount: string, recipient: string): Promise<string | null> {
  const [{ kit, adapters }, { generatePrivateKey }] = await Promise.all([loadKit(), import("viem/accounts")]);
  const quoteAdapter = adapters.createViemAdapterFromPrivateKey({ privateKey: generatePrivateKey() });
  const est = await kit.estimate(params(quoteAdapter, source, amount, recipient) as never);
  const known = est.fees.filter((f) => f.amount != null);
  if (!known.length) return null;
  return known.reduce((sum, f) => sum + Number(f.amount), 0).toFixed(6).replace(/\.?0+$/, "") || "0";
}

const toProgress = (steps: { name: string; state: BridgeProgress["state"]; txHash?: string; explorerUrl?: string }[]): BridgeProgress[] =>
  steps.map(({ name, state, txHash, explorerUrl }) => ({ name, state, txHash, explorerUrl }));

/**
 * Burn `amount` USDC on `source` from the browser wallet and mint it on Arc to `recipient` (the account wallet).
 * `onStep` fires as each step settles, so the dialog can show live progress.
 */
export async function bridgeToArc(source: string, amount: string, recipient: string, onStep?: (s: BridgeProgress) => void): Promise<BridgeOutcome> {
  const { kit } = await loadKit();
  const adapter = await sourceAdapter();
  const handler = (payload: unknown) => {
    const p = payload as { method?: string; values?: { name?: string; state?: BridgeProgress["state"]; txHash?: string; explorerUrl?: string } };
    const v = p.values;
    if (v?.name && v.state) onStep?.({ name: v.name, state: v.state, txHash: v.txHash, explorerUrl: v.explorerUrl });
  };
  if (onStep) kit.on("*" as never, handler as never);
  try {
    const result = (await kit.bridge(params(adapter, source, amount, recipient) as never)) as { state: string; steps: Parameters<typeof toProgress>[0] };
    return { ok: result.state === "success", steps: toProgress(result.steps), raw: result };
  } finally {
    if (onStep) kit.off("*" as never, handler as never);
  }
}

/** Resume a transfer that stopped part way (for example the attestation timed out); the burn is never repeated. */
export async function retryBridge(previous: BridgeOutcome, source: string, recipient: string): Promise<BridgeOutcome> {
  const { kit } = await loadKit();
  const adapter = await sourceAdapter();
  const p = params(adapter, source, "0", recipient);
  const result = (await kit.retry(previous.raw as never, { from: p.from, to: p.to } as never)) as { state: string; steps: Parameters<typeof toProgress>[0] };
  return { ok: result.state === "success", steps: toProgress(result.steps), raw: result };
}

/** Plain-language label for a Bridge Kit step. */
export function stepLabel(name: string, source: string): string {
  const src = bridgeSources().find((s) => s.id === source)?.label ?? source;
  switch (name) {
    case "approve":
      return `Approve USDC on ${src}`;
    case "burn":
      return `Send from ${src}`;
    case "fetchAttestation":
      return "Circle confirms the transfer";
    case "mint":
      return "USDC arrives on Arc";
    default:
      return name;
  }
}
