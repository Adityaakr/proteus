import { numberToHex, type Address, type WalletClient } from "viem";
import { defaultChain } from "@proteus/domain";
import { WalletError, walletClientFor } from "./wallet";

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
export interface BrowserWallet { id: string; name: string; icon?: string; provider: Eip1193 }

/** Every EVM wallet in this browser (EIP-6963), plus whatever holds `window.ethereum` if it did not announce itself. */
export function browserWallets(): BrowserWallet[] {
  if (typeof window === "undefined") return [];
  const found: BrowserWallet[] = [];
  const onAnnounce = (e: Event) => {
    const { info, provider } = (e as CustomEvent<{ info: { rdns: string; name: string; icon?: string }; provider: Eip1193 }>).detail;
    if (!found.some((w) => w.provider === provider)) found.push({ id: info.rdns, name: info.name, icon: info.icon, provider });
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider")); // Wallets answer synchronously.
  window.removeEventListener("eip6963:announceProvider", onAnnounce);
  const legacy = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  if (legacy && !found.some((w) => w.provider === legacy)) found.push({ id: "injected", name: "Browser wallet", provider: legacy });
  return found;
}

export const hasBrowserWallet = () => browserWallets().length > 0;

const CHOSEN = "proteus:signin-wallet";
/** The wallet to use when the person has not said: the one they last signed in with, else any but Phantom, which also answers for EVM. */
export function preferredWallet(id?: string): BrowserWallet | undefined {
  const all = browserWallets();
  let remembered: string | null = null;
  try { remembered = localStorage.getItem(CHOSEN); } catch { /* not remembered */ }
  const pick = all.find((w) => w.id === id) ?? all.find((w) => w.id === remembered) ?? all.find((w) => !/phantom/i.test(w.name)) ?? all[0];
  if (pick && id) try { localStorage.setItem(CHOSEN, pick.id); } catch { /* not remembered */ }
  return pick;
}

const holds = (accounts: unknown, address: Address) => Array.isArray(accounts) && accounts.some((a) => String(a).toLowerCase() === address.toLowerCase());

/**
 * The wallet that holds `address`. `window.ethereum` belongs to whichever extension injected last, so with several
 * installed it is often the wrong one. Asks each wallet silently first, and only prompts when none has shared it yet.
 */
async function walletHolding(address: Address): Promise<Eip1193> {
  const wallets = browserWallets();
  if (!wallets.length) throw new WalletError("No browser wallet was found. Install MetaMask or switch to your Proteus AI wallet.");
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  for (const w of wallets) {
    const accounts = await w.provider.request({ method: "eth_accounts" }).catch(() => []);
    if (holds(accounts, address)) return w.provider;
  }
  for (const w of [...wallets].sort((a, b) => Number(/phantom/i.test(a.name)) - Number(/phantom/i.test(b.name)))) {
    try {
      if (holds(await w.provider.request({ method: "eth_requestAccounts" }), address)) return w.provider;
    } catch (e) {
      if ((e as { code?: number }).code === 4001) throw new WalletError(`You declined in ${w.name}. Connect ${short} from the wallet that holds it and try again.`);
    }
  }
  throw new WalletError(`None of your wallets (${wallets.map((w) => w.name).join(", ")}) shared ${short}. Open the one that holds it, select that account, connect this site and try again.`);
}

/** A viem client over the browser wallet that holds `address`, switched (or added) to this deployment's Arc network. */
export async function browserWalletClient(address: Address): Promise<WalletClient> {
  const eth = await walletHolding(address);
  return walletClientFor({
    address,
    switchChain: async (id) => {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(id) }] });
      } catch (e) {
        if ((e as { code?: number }).code !== 4902) throw e;
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: numberToHex(id), chainName: defaultChain().name, nativeCurrency: defaultChain().nativeCurrency, rpcUrls: [...defaultChain().rpcUrls.default.http], blockExplorerUrls: defaultChain().blockExplorers ? [defaultChain().blockExplorers!.default.url] : undefined }],
        });
      }
    },
    getEthereumProvider: async () => eth,
  });
}
