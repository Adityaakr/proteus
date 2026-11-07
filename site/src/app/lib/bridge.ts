/**
 * Bring USDC to Arc from another chain with Circle's CCTP, through Bridge Kit (@circle-fin/bridge-kit).
 * The browser wallet burns USDC on the source chain; Circle's Forwarder mints it on Arc straight to the
 * account wallet, so the account needs no Arc gas and no second signature. Bridge Kit is loaded on demand:
 * it is large and only this flow uses it. Every hash shown comes back from Bridge Kit; nothing is fabricated.
 */
import { getWallets } from "@wallet-standard/app";
import type { IdentifierString, Wallet } from "@wallet-standard/base";
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
type SolanaProvider = { isConnected: boolean; publicKey?: { toString(): string }; connect: () => Promise<unknown>; disconnect?: () => Promise<void>; signTransaction?: (tx: unknown) => Promise<unknown> };

/**
 * A wallet in this browser that can sign on a source chain. Several can be installed at once and `window.ethereum` or
 * `window.solana` holds whichever injected last (Phantom often takes both), so the person picks and we never assume.
 */
export interface BridgeWallet {
  id: string;
  name: string;
  icon?: string;
  vm: "evm" | "solana";
  provider: Eip1193 | SolanaProvider;
}

const browserGlobals = () => window as unknown as { ethereum?: Eip1193; phantom?: { solana?: SolanaProvider }; solflare?: SolanaProvider; backpack?: SolanaProvider; solana?: SolanaProvider };

/** EVM wallets through EIP-6963 announcements, with `window.ethereum` only when none announce themselves. */
function watchEvmWallets(onChange: (wallets: BridgeWallet[]) => void): () => void {
  const found = new Map<string, BridgeWallet>();
  const emit = () => {
    const injected = browserGlobals().ethereum;
    onChange(found.size || !injected ? [...found.values()] : [{ id: "injected", name: "Browser wallet", vm: "evm", provider: injected }]);
  };
  const onAnnounce = (e: Event) => {
    const { info, provider } = (e as CustomEvent<{ info: { rdns: string; name: string; icon?: string }; provider: Eip1193 }>).detail;
    found.set(info.rdns, { id: info.rdns, name: info.name, icon: info.icon, vm: "evm", provider });
    emit();
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  emit();
  return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
}

/** Wraps a Wallet Standard wallet (how MetaMask exposes Solana) in the provider shape the Solana adapter expects. */
function standardProvider(wallet: Wallet, chain: IdentifierString): SolanaProvider {
  type Account = Wallet["accounts"][number];
  type Features = { "standard:connect": { connect: () => Promise<{ accounts: readonly Account[] }> }; "solana:signTransaction": { signTransaction: (input: { account: Account; transaction: Uint8Array; chain: IdentifierString }) => Promise<readonly { signedTransaction: Uint8Array }[]> } };
  const features = wallet.features as unknown as Features;
  let account: Account | undefined = wallet.accounts[0];
  return {
    get isConnected() { return Boolean(account); },
    get publicKey() { const address = account?.address; return address ? { toString: () => address } : undefined; },
    connect: async () => {
      account = (await features["standard:connect"].connect()).accounts[0];
      if (!account) throw new Error(`${wallet.name} did not share a Solana account.`);
      const { address } = account;
      return { publicKey: { toString: () => address } };
    },
    disconnect: async () => {},
    signTransaction: async (tx) => {
      if (!account) throw new Error(`Connect ${wallet.name} first.`);
      const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
      const versioned = tx instanceof VersionedTransaction;
      const transaction = versioned ? tx.serialize() : (tx as InstanceType<typeof Transaction>).serialize({ requireAllSignatures: false, verifySignatures: false });
      const [signed] = await features["solana:signTransaction"].signTransaction({ account, transaction, chain });
      return versioned ? VersionedTransaction.deserialize(signed.signedTransaction) : Transaction.from(signed.signedTransaction);
    },
  };
}

/** Solana wallets through Wallet Standard, using a wallet's own injected provider when it has one. */
function watchSolanaWallets(onChange: (wallets: BridgeWallet[]) => void): () => void {
  const g = browserGlobals();
  const injected: Record<string, SolanaProvider | undefined> = { Phantom: g.phantom?.solana, Solflare: g.solflare, Backpack: g.backpack };
  const chain: IdentifierString = defaultNetwork() === "mainnet" ? "solana:mainnet" : "solana:devnet";
  const { get, on } = getWallets();
  const emit = () => {
    const found = new Map<string, BridgeWallet>();
    for (const w of get()) {
      const provider = injected[w.name];
      if (provider) found.set(w.name, { id: w.name, name: w.name, icon: w.icon, vm: "solana", provider });
      else if (w.chains.includes(chain) && "standard:connect" in w.features && "solana:signTransaction" in w.features) found.set(w.name, { id: w.name, name: w.name, icon: w.icon, vm: "solana", provider: standardProvider(w, chain) });
    }
    for (const [name, provider] of Object.entries(injected)) if (provider && !found.has(name)) found.set(name, { id: name, name, vm: "solana", provider });
    if (!found.size && g.solana) found.set("solana", { id: "solana", name: "Solana wallet", vm: "solana", provider: g.solana });
    onChange([...found.values()]);
  };
  const off = on("register", emit);
  emit();
  return off;
}

/** Calls back with every wallet that can sign for this kind of chain, now and as extensions announce themselves. */
export const watchBridgeWallets = (vm: "evm" | "solana", onChange: (wallets: BridgeWallet[]) => void): (() => void) =>
  typeof window === "undefined" ? () => {} : vm === "solana" ? watchSolanaWallets(onChange) : watchEvmWallets(onChange);

const vmOf = (source: string): "evm" | "solana" => bridgeSources().find((s) => s.id === source)?.vm ?? "evm";

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

/** Through our own relay: Solana's public endpoint, the adapter's default, answers 403 to browsers. */
const solanaRpcUrl = () => `${window.location.origin}/api/solana-rpc`;

async function sourceAdapter(source: string, wallet: BridgeWallet) {
  if (vmOf(source) === "solana") {
    const provider = wallet.provider as SolanaProvider;
    if (!provider.isConnected) await provider.connect();
    const [sol, web3] = await loadSolana();
    return sol.createSolanaAdapterFromProvider({ provider: provider as never, connection: new web3.Connection(solanaRpcUrl(), "confirmed") });
  }
  const provider = wallet.provider as Eip1193;
  await provider.request({ method: "eth_requestAccounts" });
  const { adapters } = await loadKit();
  return adapters.createViemAdapterFromProvider({ provider: provider as never });
}

/** A throwaway signer of the right kind, for fee quotes only; it never holds funds or signs anything sent. */
async function quoteAdapter(source: string) {
  if (vmOf(source) === "solana") {
    const [sol, web3] = await loadSolana();
    return sol.createSolanaAdapterFromPrivateKey({ privateKey: JSON.stringify(Array.from(web3.Keypair.generate().secretKey)), connection: new web3.Connection(solanaRpcUrl(), "confirmed") });
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
export async function bridgeToArc(source: string, wallet: BridgeWallet, amount: string, recipient: string, onStep?: (s: BridgeProgress) => void): Promise<BridgeOutcome> {
  const { kit } = await loadKit();
  const adapter = await sourceAdapter(source, wallet);
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
export async function retryBridge(previous: BridgeOutcome, source: string, wallet: BridgeWallet, recipient: string): Promise<BridgeOutcome> {
  const { kit } = await loadKit();
  const adapter = await sourceAdapter(source, wallet);
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
