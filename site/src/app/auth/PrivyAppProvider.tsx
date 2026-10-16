/**
 * PrivyAppProvider: wraps PrivyProvider (email, Google or an external wallet; one embedded EVM wallet
 * per user on Arc testnet) and publishes the account through AuthContext. In mock mode
 * (VITE_MOCK=1) it skips Privy entirely and provides a fake signed in user so every screen renders.
 *
 * Needs a QueryClientProvider above it (GET /api/me goes through react-query).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PrivyProvider, useCreateWallet, usePrivy, useWallets, type ConnectedWallet, type User } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "@proteus/domain";

/**
 * The chain the embedded wallet talks to. Its RPC goes through the same-origin relay (POST /api/rpc,
 * reads plus eth_sendRawTransaction) so browser content blockers that block rpc.testnet.arc.io cannot
 * stop a signature or a broadcast. Chain id, currency and explorer are unchanged.
 */
const walletChain = typeof window !== "undefined" ? { ...arcTestnet, rpcUrls: { default: { http: [`${window.location.origin}/api/rpc`] } } } : arcTestnet;
import { ApiError, api, isMock, qk, setAccessTokenGetter } from "../lib/api";
import { WalletError, walletClientFor } from "../lib/wallet";
import { walletKind, walletLinkMessage, type Address, type MeResponse } from "../lib/types";
import { AuthContext, type AuthUser, type AuthValue, type AuthWallet } from "./context";

export const PRIVY_APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? "cmvb0p1b901l50fl20lp1eths";

/** Dev-only key auth: VITE_DEV_USER + VITE_DEV_BUYER_KEY drive the real app and real chain without a Privy login (server needs PRIVY_DEV_BYPASS=1). */
const DEV_USER = import.meta.env.VITE_DEV_USER as string | undefined;
const DEV_KEY = import.meta.env.VITE_DEV_BUYER_KEY as `0x${string}` | undefined;

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (isMock()) return <MockAuthProvider>{children}</MockAuthProvider>;
  if (DEV_USER && DEV_KEY && import.meta.env.DEV) return <DevKeyAuthProvider>{children}</DevKeyAuthProvider>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
        defaultChain: walletChain,
        supportedChains: [walletChain],
        appearance: {
          theme: "light",
          accentColor: "#012BFF",
          logo: "/assets/proteus-ai-wordmark.png",
          landingHeader: "Sign in to Proteus AI",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}

export default PrivyAppProvider;

function meStatusOf(q: { isPending: boolean; error: unknown; data: unknown; fetchStatus: string }, enabled: boolean): AuthValue["meStatus"] {
  if (!enabled) return "idle";
  if (q.data) return "ready";
  if (q.error) return q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403) ? "unauthorized" : "error";
  return "loading";
}

function loginMethodsOf(user: User | null): string[] {
  if (!user) return [];
  const out = new Set<string>();
  for (const a of user.linkedAccounts ?? []) {
    const t = (a as { type: string }).type;
    if (t === "email") out.add("email");
    else if (t === "google_oauth") out.add("google");
    else if (t === "wallet" && (a as { walletClientType?: string }).walletClientType !== "privy") out.add("wallet");
  }
  return [...out];
}

function PrivyBridge({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const { wallets } = useWallets();
  const qc = useQueryClient();
  const { ready, authenticated, user, getAccessToken } = privy;

  // Register synchronously so the first queries of child routes already carry the token.
  setAccessTokenGetter(authenticated ? getAccessToken : null);

  const meEnabled = ready && authenticated;
  const meQ = useQuery<MeResponse>({ queryKey: qk.me, queryFn: api.me, enabled: meEnabled, retry: false, staleTime: 30_000 });

  // The Proteus AI account wallet is always the Privy embedded wallet. An injected wallet (MetaMask and the
  // like) is used only when the user signed in with it and has no embedded wallet at all. Browser
  // extensions that merely exist are never picked up, so nothing opens MetaMask behind the user's back.
  const embedded: ConnectedWallet | undefined = wallets.find((w) => w.walletClientType === "privy");
  const hasPrivyWallet = Boolean(embedded) || (user?.linkedAccounts ?? []).some((a) => (a as { type: string; walletClientType?: string }).type === "wallet" && (a as { walletClientType?: string }).walletClientType === "privy");
  const loginWalletAddr = (user?.linkedAccounts ?? []).find((a) => (a as { type: string; walletClientType?: string; connectorType?: string }).type === "wallet" && (a as { walletClientType?: string }).walletClientType !== "privy") as { address?: string } | undefined;
  const external: ConnectedWallet | undefined = hasPrivyWallet ? undefined : wallets.find((w) => w.walletClientType !== "privy" && loginWalletAddr?.address?.toLowerCase() === w.address.toLowerCase());
  const connected = embedded ?? external;

  // Accounts created before every user got an embedded wallet: create one now, once.
  const { createWallet } = useCreateWallet();
  const createTried = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || hasPrivyWallet || createTried.current) return;
    createTried.current = true;
    createWallet().catch((e: unknown) => console.warn("[proteus] embedded wallet creation failed", e));
  }, [ready, authenticated, hasPrivyWallet, createWallet]);

  const wallet: AuthWallet | null = useMemo(() => {
    if (!authenticated) return null;
    if (connected) return { address: getAddress(connected.address) as Address, type: connected === embedded ? "embedded" : "external" };
    const privyAccount = (user?.linkedAccounts ?? []).find((a) => (a as { type: string; walletClientType?: string }).type === "wallet" && (a as { walletClientType?: string }).walletClientType === "privy") as { address?: string } | undefined;
    if (privyAccount?.address) return { address: getAddress(privyAccount.address) as Address, type: "embedded" };
    const primary = meQ.data?.wallets.find((w) => w.primary) ?? meQ.data?.wallets[0];
    return primary ? { address: getAddress(primary.address) as Address, type: walletKind(primary) } : null;
  }, [authenticated, connected, embedded, user?.linkedAccounts, meQ.data]);

  const authUser: AuthUser | null = useMemo(
    () => (authenticated && user ? { id: user.id, email: user.email?.address ?? user.google?.email ?? meQ.data?.email, loginMethods: loginMethodsOf(user) } : null),
    [authenticated, user, meQ.data?.email],
  );

  const getWalletClient = useCallback(async () => {
    if (!connected) throw new WalletError("Your Proteus AI wallet is still being set up. Try again in a moment.");
    return walletClientFor({
      address: connected.address,
      switchChain: (id) => connected.switchChain(id),
      getEthereumProvider: () => connected.getEthereumProvider() as never,
    });
  }, [connected]);

  // Link the account wallet to the Proteus AI account once the server knows the user (GET /api/me ok) and
  // the wallet is not listed yet: GET nonce, personal_sign the exact link message, POST link.
  const linkTried = useRef<string | null>(null);
  useEffect(() => {
    if (!meQ.data || !connected) return;
    const addr = connected.address.toLowerCase();
    if (meQ.data.wallets.some((w) => w.address.toLowerCase() === addr)) return;
    if (linkTried.current === addr) return;
    linkTried.current = addr;
    (async () => {
      try {
        const { nonce } = await api.walletLinkNonce();
        const address = getAddress(connected.address);
        const signature = await connected.sign(walletLinkMessage(address, nonce));
        await api.linkWallet({ address, kind: connected === embedded ? "embedded" : "external", nonce, signature });
        void meQ.refetch();
      } catch (e) {
        console.warn("[proteus] wallet link failed", e);
      }
    })();
  }, [meQ.data, connected, embedded, meQ]);

  const logout = useCallback(async () => {
    linkTried.current = null;
    await privy.logout();
    setAccessTokenGetter(null);
    qc.clear();
  }, [privy, qc]);

  const exportWallet = useCallback(async () => {
    await privy.exportWallet(embedded ? { address: embedded.address } : undefined);
  }, [privy, embedded]);

  const value: AuthValue = {
    ready,
    authenticated,
    user: authUser,
    login: () => privy.login(),
    logout,
    getAccessToken,
    wallet,
    me: meQ.data,
    meStatus: meStatusOf(meQ, meEnabled),
    refetchMe: () => void meQ.refetch(),
    getWalletClient,
    exportWallet,
    mock: false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Mock mode                                                           */
/* ------------------------------------------------------------------ */

const SIGNED_OUT = "proteus:mock:signed-out";
function readSignedOut(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_OUT) === "1";
  } catch {
    return false;
  }
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedOut, setSignedOut] = useState(readSignedOut);
  setAccessTokenGetter(null);
  const authenticated = !signedOut;
  const meQ = useQuery<MeResponse>({ queryKey: qk.me, queryFn: api.me, enabled: authenticated, retry: false, staleTime: 30_000 });
  const primary = meQ.data?.wallets.find((w) => w.primary) ?? meQ.data?.wallets[0];

  const setOut = (v: boolean) => {
    try {
      if (v) sessionStorage.setItem(SIGNED_OUT, "1");
      else sessionStorage.removeItem(SIGNED_OUT);
    } catch {
      /* ignore */
    }
    setSignedOut(v);
  };

  const value: AuthValue = {
    ready: true,
    authenticated,
    user: authenticated ? { id: meQ.data?.userId ?? "did:privy:mock-buyer", email: meQ.data?.email ?? "demo@proteus.dev", loginMethods: ["email"] } : null,
    login: () => setOut(false),
    logout: async () => {
      setOut(true);
      qc.clear();
    },
    getAccessToken: async () => null,
    wallet: authenticated && primary ? { address: primary.address, type: walletKind(primary) } : null,
    me: authenticated ? meQ.data : undefined,
    meStatus: !authenticated ? "idle" : meQ.data ? "ready" : meQ.error ? "error" : "loading",
    refetchMe: () => void meQ.refetch(),
    getWalletClient: async () => {
      throw new WalletError("Mock mode does not sign or send transactions.");
    },
    exportWallet: async () => {
      window.alert("Mock mode: in the real app this opens Privy's key export window.");
    },
    mock: true,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


/* ------------------------------------------------------------------ */
/* Dev key mode (never in production builds)                           */
/* ------------------------------------------------------------------ */

function DevKeyAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const account = useMemo(() => privateKeyToAccount(DEV_KEY!), []);
  setAccessTokenGetter(null);
  const meQ = useQuery<MeResponse>({ queryKey: qk.me, queryFn: api.me, retry: false, staleTime: 30_000 });
  const linkTried = useRef(false);
  useEffect(() => {
    if (!meQ.data || linkTried.current) return;
    const addr = account.address.toLowerCase();
    if (meQ.data.wallets.some((w) => w.address.toLowerCase() === addr)) return;
    linkTried.current = true;
    (async () => {
      const { nonce } = await api.walletLinkNonce();
      const signature = await account.signMessage({ message: walletLinkMessage(account.address, nonce) });
      await api.linkWallet({ address: account.address, kind: "external", nonce, signature });
      void meQ.refetch();
    })().catch((e) => console.warn("[proteus] dev wallet link failed", e));
  }, [meQ.data, account, meQ]);
  const value: AuthValue = {
    ready: true,
    authenticated: true,
    user: { id: `did:privy:dev:${DEV_USER}`, email: meQ.data?.email ?? `${DEV_USER}@dev.local`, loginMethods: ["dev-key"] },
    login: () => {},
    logout: async () => {
      qc.clear();
    },
    getAccessToken: async () => null,
    wallet: { address: account.address, type: "external" },
    me: meQ.data,
    meStatus: meQ.data ? "ready" : meQ.error ? "error" : "loading",
    refetchMe: () => void meQ.refetch(),
    getWalletClient: async () => createWalletClient({ account, chain: arcTestnet, transport: http(arcTestnet.rpcUrls.default.http[0]) }),
    exportWallet: async () => window.alert("Dev key mode: the key is in VITE_DEV_BUYER_KEY."),
    mock: false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
