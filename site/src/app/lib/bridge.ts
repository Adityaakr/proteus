/**
 * Bring USDC to Arc from another chain with Circle's CCTP, through Bridge Kit (@circle-fin/bridge-kit).
 * The browser wallet burns USDC on the source chain; Circle's Forwarder mints it on Arc straight to the
 * account wallet, so the account needs no Arc gas and no second signature. Bridge Kit is loaded on demand:
 * it is large and only this flow uses it. Every hash shown comes back from Bridge Kit; nothing is fabricated.
 */
import { defaultNetwork } from "@proteus/domain";

/**
 * Every EVM chain Bridge Kit (v1.16) supports for CCTP V2 into Arc, each with its testnet pair. Ids are Bridge Kit chain
 * identifiers; `popular` sorts first. Solana (`vm: "solana"`) is signed by a Solana wallet such as Phantom instead of an EVM one.
 */
const CHAINS: { label: string; mainnet: string; testnet: string; logo?: string; popular?: boolean; vm?: "evm" | "solana" }[] = [
  { label: "Ethereum", mainnet: "Ethereum", testnet: "Ethereum_Sepolia", logo: "ethereum.png", popular: true },
  { label: "Base", mainnet: "Base", testnet: "Base_Sepolia", logo: "base.png", popular: true },
  { label: "Arbitrum", mainnet: "Arbitrum", testnet: "Arbitrum_Sepolia", logo: "arbitrum.png", popular: true },
  { label: "Optimism", mainnet: "Optimism", testnet: "Optimism_Sepolia", logo: "optimism.png", popular: true },
  { label: "Polygon", mainnet: "Polygon", testnet: "Polygon_Amoy_Testnet", logo: "polygon.png", popular: true },
  { label: "Avalanche", mainnet: "Avalanche", testnet: "Avalanche_Fuji", logo: "avalanche.png", popular: true },
  { label: "Solana", mainnet: "Solana", testnet: "Solana_Devnet", logo: "solana.png", popular: true, vm: "solana" },
  { label: "Unichain", mainnet: "Unichain", testnet: "Unichain_Sepolia", logo: "unichain.webp" },
  { label: "Linea", mainnet: "Linea", testnet: "Linea_Sepolia", logo: "linea.png" },
  { label: "World Chain", mainnet: "World_Chain", testnet: "World_Chain_Sepolia", logo: "worldchain.webp" },
  { label: "Sonic", mainnet: "Sonic", testnet: "Sonic_Testnet", logo: "sonic.png" },
  { label: "Sei", mainnet: "Sei", testnet: "Sei_Testnet", logo: "sei.png" },
  { label: "HyperEVM", mainnet: "HyperEVM", testnet: "HyperEVM_Testnet", logo: "hyperevm.png" },
  { label: "Monad", mainnet: "Monad", testnet: "Monad_Testnet", logo: "monad.png" },
  { label: "Ink", mainnet: "Ink", testnet: "Ink_Testnet", logo: "ink.webp" },
  { label: "Plasma", mainnet: "Plasma", testnet: "Plasma_Testnet", logo: "plasma.png" },
  { label: "Plume", mainnet: "Plume", testnet: "Plume_Testnet", logo: "plume.webp" },
  { label: "Codex", mainnet: "Codex", testnet: "Codex_Testnet", logo: "codex.webp" },
  { label: "Injective", mainnet: "Injective", testnet: "Injective_Testnet", logo: "injective.png" },
  { label: "Cronos", mainnet: "Cronos", testnet: "Cronos_Testnet", logo: "cronos.png" },
  { label: "XDC", mainnet: "XDC", testnet: "XDC_Apothem", logo: "xdc.png" },
  { label: "X Layer", mainnet: "X_Layer", testnet: "X_Layer_Testnet", logo: "xlayer.png" },
  { label: "Morph", mainnet: "Morph", testnet: "Morph_Testnet", logo: "morph.webp" },
  { label: "Pharos", mainnet: "Pharos", testnet: "Pharos_Testnet", logo: "pharos.webp" },
  { label: "Edge", mainnet: "Edge", testnet: "Edge_Testnet" },
];

export interface BridgeSource {
  id: string;
  label: string;
  /** Logo path under the site's public assets; absent means the picker draws a monogram. */
  logo?: string;
  popular: boolean;
  /** Which kind of wallet signs on this chain. */
  vm: "evm" | "solana";
}

const sourcesFor = (net: "mainnet" | "testnet"): BridgeSource[] =>
  CHAINS.map((c) => ({ id: c[net], label: c.label, logo: c.logo ? `/assets/chains/${c.logo}` : undefined, popular: Boolean(c.popular), vm: c.vm ?? "evm" }));
export const BRIDGE_SOURCES = { mainnet: sourcesFor("mainnet"), testnet: sourcesFor("testnet") } as const;

export const bridgeSources = (): readonly BridgeSource[] => BRIDGE_SOURCES[defaultNetwork()];
const arcChain = () => (defaultNetwork() === "mainnet" ? "Arc" : "Arc_Testnet");

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
const injected = (): Eip1193 | undefined => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined);

/** A Solana browser wallet (Phantom, Solflare, Backpack, or any that injects window.solana). */
type SolanaProvider = { isConnected: boolean; connect: () => Promise<unknown> };
const injectedSolana = (): SolanaProvider | undefined => {
  if (typeof window === "undefined") return undefined;
  const g = window as unknown as { phantom?: { solana?: SolanaProvider }; solflare?: SolanaProvider; backpack?: SolanaProvider; solana?: SolanaProvider };
  return g.phantom?.solana ?? g.solflare ?? g.backpack ?? g.solana;
};

const vmOf = (source: string): "evm" | "solana" => bridgeSources().find((s) => s.id === source)?.vm ?? "evm";

/** True when this browser has a wallet that can sign on the source chain (EVM wallet, or Solana wallet for Solana). */
export const hasBrowserWallet = (source?: string) => Boolean(source && vmOf(source) === "solana" ? injectedSolana() : injected());

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
/** The Solana adapter and web3.js load only when a Solana route is used. */
const loadSolana = () => Promise.all([import("@circle-fin/adapter-solana"), import("@solana/web3.js")]);

async function sourceAdapter(source: string) {
  if (vmOf(source) === "solana") {
    const provider = injectedSolana();
    if (!provider) throw new Error("No Solana wallet found. Open this page in a browser with Phantom, Solflare or Backpack.");
    if (!provider.isConnected) await provider.connect();
    const [sol] = await loadSolana();
    return sol.createSolanaAdapterFromProvider({ provider: provider as never });
  }
  const provider = injected();
  if (!provider) throw new Error("No browser wallet found. Open this page in a browser with MetaMask, Rabby or another wallet extension.");
  await provider.request({ method: "eth_requestAccounts" });
  const { adapters } = await loadKit();
  return adapters.createViemAdapterFromProvider({ provider: provider as never });
}

/** A throwaway signer of the right kind, for fee quotes only; it never holds funds or signs anything sent. */
async function quoteAdapter(source: string) {
  if (vmOf(source) === "solana") {
    const [sol, web3] = await loadSolana();
    return sol.createSolanaAdapterFromPrivateKey({ privateKey: JSON.stringify(Array.from(web3.Keypair.generate().secretKey)) });
  }
  const [{ adapters }, { generatePrivateKey }] = await Promise.all([loadKit(), import("viem/accounts")]);
  return adapters.createViemAdapterFromPrivateKey({ privateKey: generatePrivateKey() });
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
  const [{ kit }, adapter] = await Promise.all([loadKit(), quoteAdapter(source)]);
  const est = await kit.estimate(params(adapter, source, amount, recipient) as never);
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
  const adapter = await sourceAdapter(source);
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
  const adapter = await sourceAdapter(source);
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
