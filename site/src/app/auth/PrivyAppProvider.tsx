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
import { AuthContext, walletLabel, type AuthUser, type AuthValue, type AuthWallet } from "./context";

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

  /* ---- Wallets on the account -------------------------------------------------------------
   * The embedded Privy wallet always exists (created at first login). Any external wallet the person
   * signed in with, or linked later, is on the account too. One of them is the active wallet: balances,
   * deposits, deal funding, payouts and signatures use it. The default is the wallet the person signed
   * in with; the choice is remembered on the server (primary) and in this browser.
   * Browser extensions that merely exist are never picked up: only wallets Privy reports as linked or
   * connected, so nothing opens MetaMask behind the person's back. */
  type LinkedWalletAccount = { type: string; address?: string; walletClientType?: string; chainType?: string; connectorType?: string };
  const linkedWallets = useMemo<LinkedWalletAccount[]>(
    () => ((user?.linkedAccounts ?? []) as unknown as LinkedWalletAccount[]).filter((a) => a.type === "wallet" && a.chainType !== "solana" && Boolean(a.address)),
    [user?.linkedAccounts],
  );
  const embedded: ConnectedWallet | undefined = wallets.find((w) => w.walletClientType === "privy");
  const embeddedAddr = embedded?.address ?? linkedWallets.find((a) => a.walletClientType === "privy")?.address;
  const hasPrivyWallet = Boolean(embeddedAddr);
  const loginWalletAddr = linkedWallets.find((a) => a.walletClientType !== "privy")?.address;

  // Accounts created before every user got an embedded wallet: create one now, once.
  const { createWallet } = useCreateWallet();
  const createTried = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || hasPrivyWallet || createTried.current) return;
    createTried.current = true;
    createWallet().catch((e: unknown) => console.warn("[proteus] embedded wallet creation failed", e));
  }, [ready, authenticated, hasPrivyWallet, createWallet]);

  const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  const options: AuthWallet[] = useMemo(() => {
    if (!authenticated) return [];
    const map = new Map<string, AuthWallet>();
    const add = (address: string, type: AuthWallet["type"], clientType?: string) => {
      let a: Address;
      try {
        a = getAddress(address) as Address;
      } catch {
        return;
      }
      const k = a.toLowerCase();
      const prev = map.get(k);
      const connected = wallets.some((w) => same(w.address, k));
      if (prev) {
        if (!prev.clientType && clientType) prev.clientType = clientType;
        prev.connected = prev.connected || connected;
        return;
      }
      map.set(k, { address: a, type, clientType, connected });
    };
    for (const a of linkedWallets) add(a.address!, a.walletClientType === "privy" ? "embedded" : "external", a.walletClientType);
    for (const w of wallets) add(w.address, w.walletClientType === "privy" ? "embedded" : "external", w.walletClientType);
    for (const w of meQ.data?.wallets ?? []) {
      const kind = walletKind(w);
      // A server row marked embedded that Privy does not report is a stale link from an earlier account
      // setup. Nothing here can sign for it, so it is not offered.
      if (kind === "embedded" && hasPrivyWallet && !same(w.address, embeddedAddr)) continue;
      add(w.address, kind);
    }
    return [...map.values()].sort((x, y) => (x.type === y.type ? 0 : x.type === "embedded" ? -1 : 1));
  }, [authenticated, linkedWallets, wallets, meQ.data?.wallets, hasPrivyWallet, embeddedAddr]);

  // The person's choice, per account, remembered in this browser; the server's primary flag mirrors it.
  const choiceKey = user?.id ? `proteus:active-wallet:${user.id}` : null;
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    if (!choiceKey) return setChoice(null);
    try {
      setChoice(localStorage.getItem(choiceKey));
    } catch {
      setChoice(null);
    }
  }, [choiceKey]);
  const serverPrimary = meQ.data?.wallets.find((w) => w.primary)?.address;
  const has = (addr?: string | null) => Boolean(addr && options.some((o) => same(o.address, addr)));
  const activeAddr = has(choice) ? choice! : choice === null && has(serverPrimary) && !loginWalletAddr ? serverPrimary! : has(loginWalletAddr) ? loginWalletAddr! : has(serverPrimary) ? serverPrimary! : (embeddedAddr ?? options[0]?.address ?? null);
  const wallet: AuthWallet | null = useMemo(() => (activeAddr ? (options.find((o) => same(o.address, activeAddr)) ?? null) : null), [activeAddr, options]);
  const connected: ConnectedWallet | undefined = activeAddr ? wallets.find((w) => same(w.address, activeAddr)) : undefined;

  const setActiveWallet = useCallback(
    (address: Address) => {
      setChoice(address);
      try {
        if (choiceKey) localStorage.setItem(choiceKey, address);
      } catch {
        /* ignore */
      }
    },
    [choiceKey],
  );

  const authUser: AuthUser | null = useMemo(
    () => (authenticated && user ? { id: user.id, email: user.email?.address ?? user.google?.email ?? meQ.data?.email, loginMethods: loginMethodsOf(user) } : null),
    [authenticated, user, meQ.data?.email],
  );

  const getWalletClient = useCallback(async () => {
    if (!connected) {
      if (wallet?.type === "external") throw new WalletError(`${walletLabel(wallet)} (${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}) is not connected in this browser. Open it, connect this site, or switch to your embedded wallet.`);
      throw new WalletError("Your embedded wallet is still being set up. Try again in a moment.");
    }
    return walletClientFor({
      address: connected.address,
      switchChain: (id) => connected.switchChain(id),
      getEthereumProvider: () => connected.getEthereumProvider() as never,
    });
  }, [connected, wallet]);

  // Link every connected wallet to the account once the server knows the user (GET /api/me ok) and
  // the wallet is not listed yet: GET nonce, personal_sign the exact link message, POST link. One at a time.
  const linkTried = useRef<Set<string>>(new Set());
  const linking = useRef(false);
  useEffect(() => {
    if (!meQ.data || linking.current) return;
    const pending = wallets.find((w) => !meQ.data!.wallets.some((x) => same(x.address, w.address)) && !linkTried.current.has(w.address.toLowerCase()));
    if (!pending) return;
    linkTried.current.add(pending.address.toLowerCase());
    linking.current = true;
    (async () => {
      try {
        const { nonce } = await api.walletLinkNonce();
        const address = getAddress(pending.address);
        const signature = await pending.sign(walletLinkMessage(address, nonce));
        await api.linkWallet({ address, kind: pending.walletClientType === "privy" ? "embedded" : "external", nonce, signature });
        await meQ.refetch();
      } catch (e) {
        console.warn("[proteus] wallet link failed", e);
      } finally {
        linking.current = false;
      }
    })();
  }, [meQ.data, wallets, meQ]);

  // Mirror the active wallet to the server's primary flag once that wallet is linked.
  const primaryTried = useRef<string | null>(null);
  useEffect(() => {
    if (!meQ.data || !activeAddr) return;
    const row = meQ.data.wallets.find((w) => same(w.address, activeAddr));
    if (!row || row.primary || primaryTried.current === activeAddr.toLowerCase()) return;
    primaryTried.current = activeAddr.toLowerCase();
    api.setPrimaryWallet(activeAddr).then(() => meQ.refetch()).catch((e) => console.warn("[proteus] could not set the active wallet", e));
  }, [meQ.data, activeAddr, meQ]);

  const connectExternalWallet = useCallback(
    (address?: Address) => {
      if (address && options.some((o) => same(o.address, address) && o.type === "external")) privy.connectWallet();
      else privy.linkWallet();
    },
    [privy, options],
  );

  const logout = useCallback(async () => {
    linkTried.current = new Set();
    primaryTried.current = null;
    await privy.logout();
    setAccessTokenGetter(null);
    qc.clear();
  }, [privy, qc]);

  const exportWallet = useCallback(async () => {
    await privy.exportWallet(embedded ? { address: embedded.address } : undefined);
  }, [privy, embedded]);

  const value: AuthValue = {
    provider: "privy",
    canExportWallet: true,
    ready,
    authenticated,
    user: authUser,
    login: () => privy.login(),
    logout,
    getAccessToken,
    wallet,
    wallets: options,
    setActiveWallet,
    connectExternalWallet,
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
    provider: "mock",
    canExportWallet: true,
    ready: true,
    authenticated,
    user: authenticated ? { id: meQ.data?.userId ?? "did:privy:mock-buyer", email: meQ.data?.email ?? "demo@proteus.dev", loginMethods: ["email"] } : null,
    login: () => setOut(false),
    logout: async () => {
      setOut(true);
      qc.clear();
    },
    getAccessToken: async () => null,
    wallet: authenticated && primary ? { address: primary.address, type: walletKind(primary), connected: true } : null,
    wallets: authenticated ? (meQ.data?.wallets ?? []).map((w) => ({ address: w.address, type: walletKind(w), connected: true })) : [],
    setActiveWallet: () => {},
    connectExternalWallet: () => window.alert("Mock mode: in the real app this opens Privy's wallet window."),
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
    provider: "dev",
    canExportWallet: false,
    ready: true,
    authenticated: true,
    user: { id: `did:privy:dev:${DEV_USER}`, email: meQ.data?.email ?? `${DEV_USER}@dev.local`, loginMethods: ["dev-key"] },
    login: () => {},
    logout: async () => {
      qc.clear();
    },
    getAccessToken: async () => null,
    wallet: { address: account.address, type: "external", clientType: "dev-key", connected: true },
    wallets: [{ address: account.address, type: "external", clientType: "dev-key", connected: true }, ...(meQ.data?.wallets ?? []).filter((w) => w.address.toLowerCase() !== account.address.toLowerCase()).map((w) => ({ address: w.address, type: walletKind(w), connected: false }))],
    setActiveWallet: () => {},
    connectExternalWallet: () => {},
    me: meQ.data,
    meStatus: meQ.data ? "ready" : meQ.error ? "error" : "loading",
    refetchMe: () => void meQ.refetch(),
    getWalletClient: async () => createWalletClient({ account, chain: arcTestnet, transport: http(arcTestnet.rpcUrls.default.http[0]) }),
    exportWallet: async () => window.alert("Dev key mode: the key is in VITE_DEV_BUYER_KEY."),
    mock: false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
