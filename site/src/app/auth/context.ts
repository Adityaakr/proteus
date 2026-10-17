import { createContext } from "react";
import type { WalletClient } from "viem";
import type { Address, MeResponse } from "../lib/types";

export interface AuthUser {
  id: string;
  email?: string;
  /** How the person signed in, for settings ("email", "google", "wallet"). */
  loginMethods: string[];
}

export interface AuthWallet {
  address: Address;
  type: "embedded" | "external";
  /** Privy wallet client type for external wallets: "metamask", "coinbase_wallet", "rainbow", "wallet_connect"... */
  clientType?: string;
  /** True when the wallet can sign right now (embedded: always once created; external: connected in this browser). */
  connected: boolean;
}

/** "Embedded wallet", "MetaMask", "Coinbase Wallet"... */
export function walletLabel(w: Pick<AuthWallet, "type" | "clientType">): string {
  if (w.type === "embedded") return "Embedded wallet";
  const t = (w.clientType ?? "").toLowerCase();
  if (t.includes("metamask")) return "MetaMask";
  if (t.includes("coinbase")) return "Coinbase Wallet";
  if (t.includes("rainbow")) return "Rainbow";
  if (t.includes("wallet_connect") || t.includes("walletconnect")) return "WalletConnect";
  if (t.includes("rabby")) return "Rabby";
  if (t.includes("phantom")) return "Phantom";
  return "External wallet";
}

export type AuthProvider = "privy" | "circle" | "mock" | "dev";

export interface AuthValue {
  /** Which sign-in backs this session. */
  provider: AuthProvider;
  /** The auth layer has finished loading the session. */
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  /** Opens the sign-in flow (Privy: its modal; Circle: the sign-in page; mock: signs the demo user in). */
  login: () => void;
  /** Circle only: sends an email OTP, opens Circle's code entry, and finishes with a Proteus AI session. */
  emailLogin?: (email: string) => Promise<void>;
  /** Circle only: sign in with a browser wallet by signing a nonce. */
  loginWithWallet?: () => Promise<void>;
  /** False for MPC wallets (Circle) where there is no key to export. */
  canExportWallet: boolean;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** The active account wallet: balances, deposits, funding, payouts and signatures use it. */
  wallet: AuthWallet | null;
  /** Every wallet on the account: the embedded wallet plus any external wallet linked to it. */
  wallets: AuthWallet[];
  /** Makes one of `wallets` the active one. Remembered on the server and in this browser. */
  setActiveWallet: (address: Address) => void;
  /** Opens Privy's wallet modal: reconnects a linked external wallet (pass its address) or links a new one. */
  connectExternalWallet: (address?: Address) => void;
  /** GET /api/me. Undefined while loading, or when the server does not know the token yet (401). */
  me: MeResponse | undefined;
  meStatus: "idle" | "loading" | "ready" | "unauthorized" | "error";
  refetchMe: () => void;
  /** Viem WalletClient on Arc testnet for the account wallet. Throws in mock mode or with no wallet. */
  getWalletClient: () => Promise<WalletClient>;
  /** Opens Privy's key export modal for the embedded wallet. */
  exportWallet: () => Promise<void>;
  /** True in VITE_MOCK mode: a fake signed in user, no wallet transactions. */
  mock: boolean;
}

const noop = () => {};
export const DEFAULT_AUTH: AuthValue = {
  provider: "privy",
  canExportWallet: true,
  ready: false,
  authenticated: false,
  user: null,
  login: noop,
  logout: async () => {},
  getAccessToken: async () => null,
  wallet: null,
  wallets: [],
  setActiveWallet: noop,
  connectExternalWallet: noop,
  me: undefined,
  meStatus: "idle",
  refetchMe: noop,
  getWalletClient: async () => {
    throw new Error("Sign in to use your wallet.");
  },
  exportWallet: async () => {},
  mock: false,
};

export const AuthContext = createContext<AuthValue>(DEFAULT_AUTH);
