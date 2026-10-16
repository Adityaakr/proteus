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
}

export interface AuthValue {
  /** Privy has finished loading the session. */
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  /** Opens the Privy login modal (mock: signs the demo user in). */
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** The PROTEUS account wallet: the embedded wallet, or the external wallet the person signed in with. */
  wallet: AuthWallet | null;
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
  ready: false,
  authenticated: false,
  user: null,
  login: noop,
  logout: async () => {},
  getAccessToken: async () => null,
  wallet: null,
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
