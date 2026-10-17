/**
 * CircleAuthProvider: sign-in with a Circle email OTP (the account wallet is a Circle user-controlled MPC wallet
 * on Arc) or with a browser wallet that signs a nonce. Publishes the same AuthContext as PrivyAppProvider so no
 * page knows the difference. Signing and transactions for the Circle wallet are challenges created by the API
 * and approved in Circle's hosted UI; browser wallets sign through their injected provider.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createWalletClient, encodeFunctionData, getAddress, http, numberToHex, type Hex, type WalletClient } from "viem";
import { toAccount } from "viem/accounts";
import { defaultChain } from "@proteus/domain";
import { ApiError, api, qk, setAccessTokenGetter } from "../lib/api";
import { WalletError, walletClientFor } from "../lib/wallet";
import { walletKind, walletLinkMessage, walletLoginMessage, type Address, type MeResponse } from "../lib/types";
import { AuthContext, walletLabel, type AuthUser, type AuthValue, type AuthWallet } from "./context";
import { circleSdk, emailLogin, executeChallenge, serializeTypedData } from "./circle";

const SESSION_KEY = "proteus:session";
const CIRCLE_KEY = "proteus:circle";
interface CircleState {
  userToken: string;
  encryptionKey: string;
  refreshToken: string;
  deviceId: string;
  email?: string;
  walletId?: string;
  walletAddress?: Address;
}
function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
const injected = (): Eip1193 | undefined => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined);

/** A viem client over the browser's injected wallet, switched (or added) to Arc testnet. */
async function injectedClient(address: Address): Promise<WalletClient> {
  const eth = injected();
  if (!eth) throw new WalletError("No browser wallet was found. Install MetaMask or switch to your Proteus AI wallet.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.some((a) => a.toLowerCase() === address.toLowerCase())) throw new WalletError(`Select ${address.slice(0, 6)}…${address.slice(-4)} in your wallet and try again.`);
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

function meStatusOf(q: { isPending: boolean; error: unknown; data: unknown }, enabled: boolean): AuthValue["meStatus"] {
  if (!enabled) return "idle";
  if (q.data) return "ready";
  if (q.error) return q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403) ? "unauthorized" : "error";
  return "loading";
}

export function CircleAuthProvider({ appId, children }: { appId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const sdk = useMemo(() => circleSdk(appId), [appId]);
  const [session, setSession] = useState<string | null>(() => read<string>(SESSION_KEY));
  const [circle, setCircle] = useState<CircleState | null>(() => read<CircleState>(CIRCLE_KEY));
  const saveCircle = useCallback((v: CircleState | null) => {
    setCircle(v);
    write(CIRCLE_KEY, v);
  }, []);
  const saveSession = useCallback((v: string | null) => {
    setSession(v);
    write(SESSION_KEY, v);
  }, []);

  const authenticated = Boolean(session);
  setAccessTokenGetter(session ? async () => session : null);

  const meQ = useQuery<MeResponse>({ queryKey: qk.me, queryFn: api.me, enabled: authenticated, retry: false, staleTime: 30_000 });

  // A session the server no longer accepts: sign out locally so the person can sign in again.
  useEffect(() => {
    if (meQ.error instanceof ApiError && meQ.error.status === 401) {
      saveSession(null);
      qc.clear();
    }
  }, [meQ.error, saveSession, qc]);

  const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

  /* ---- The Circle wallet: created on first sign-in through a challenge, then linked to the account. ---- */
  const walletTried = useRef(false);
  useEffect(() => {
    if (!authenticated || !circle || circle.walletAddress || !meQ.data || walletTried.current) return;
    walletTried.current = true;
    (async () => {
      let r = await api.circleWallet({ userToken: circle.userToken });
      if (r.challengeId) {
        await executeChallenge(sdk, circle, r.challengeId);
        r = await api.circleWallet({ userToken: circle.userToken });
      }
      if (!r.wallet) throw new Error("Circle did not return a wallet");
      saveCircle({ ...circle, walletId: r.wallet.id, walletAddress: r.wallet.address });
      await meQ.refetch();
    })().catch((e) => {
      walletTried.current = false;
      console.warn("[proteus] circle wallet setup failed", e);
    });
  }, [authenticated, circle, meQ.data, sdk, saveCircle, meQ]);

  /* ---- Wallets on the account ---- */
  const hasInjected = Boolean(injected());
  const options: AuthWallet[] = useMemo(() => {
    if (!authenticated) return [];
    const map = new Map<string, AuthWallet>();
    const add = (address: string, type: AuthWallet["type"], clientType: string, connected: boolean) => {
      let a: Address;
      try {
        a = getAddress(address) as Address;
      } catch {
        return;
      }
      if (!map.has(a.toLowerCase())) map.set(a.toLowerCase(), { address: a, type, clientType, connected });
    };
    if (circle?.walletAddress) add(circle.walletAddress, "embedded", "circle", true);
    for (const w of meQ.data?.wallets ?? []) {
      const kind = walletKind(w);
      if (kind === "embedded" && circle?.walletAddress && !same(w.address, circle.walletAddress)) continue; // stale link from another setup
      add(w.address, kind, kind === "embedded" ? "circle" : "injected", kind === "embedded" ? Boolean(circle?.walletId) : hasInjected);
    }
    return [...map.values()].sort((x, y) => (x.type === y.type ? 0 : x.type === "embedded" ? -1 : 1));
  }, [authenticated, circle?.walletAddress, circle?.walletId, meQ.data?.wallets, hasInjected]);

  const userId = meQ.data?.userId;
  const choiceKey = userId ? `proteus:active-wallet:${userId}` : null;
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
  const activeAddr = has(choice) ? choice! : has(serverPrimary) ? serverPrimary! : (circle?.walletAddress ?? options[0]?.address ?? null);
  const wallet: AuthWallet | null = useMemo(() => (activeAddr ? (options.find((o) => same(o.address, activeAddr)) ?? null) : null), [activeAddr, options]);

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

  // Mirror the active wallet to the server's primary flag once that wallet is linked.
  const primaryTried = useRef<string | null>(null);
  useEffect(() => {
    if (!meQ.data || !activeAddr) return;
    const row = meQ.data.wallets.find((w) => same(w.address, activeAddr));
    if (!row || row.primary || primaryTried.current === activeAddr.toLowerCase()) return;
    primaryTried.current = activeAddr.toLowerCase();
    api.setPrimaryWallet(activeAddr).then(() => meQ.refetch()).catch((e) => console.warn("[proteus] could not set the active wallet", e));
  }, [meQ.data, activeAddr, meQ]);

  /* ---- Signing and transactions ---- */
  const circleClient = useCallback(
    (st: CircleState & { walletId: string; walletAddress: Address }): WalletClient => {
      const address = st.walletAddress;
      const account = toAccount({
        address,
        async signMessage({ message }) {
          const text = typeof message === "string" ? message : "raw" in message ? new TextDecoder().decode(typeof message.raw === "string" ? new TextEncoder().encode(message.raw) : message.raw) : String(message);
          const { challengeId } = await api.circleSignMessage({ userToken: st.userToken, walletId: st.walletId, message: text, memo: "Proteus AI" });
          const r = await executeChallenge(sdk, st, challengeId);
          if (!r.signature) throw new WalletError("Circle returned no signature.");
          return r.signature;
        },
        async signTypedData(td) {
          const { challengeId } = await api.circleSignTypedData({ userToken: st.userToken, walletId: st.walletId, typedData: serializeTypedData(td as never), memo: `Proteus AI: ${String((td as { primaryType?: string }).primaryType ?? "typed data")}` });
          const r = await executeChallenge(sdk, st, challengeId);
          if (!r.signature) throw new WalletError("Circle returned no signature.");
          return r.signature;
        },
        async signTransaction() {
          throw new WalletError("Circle wallets send transactions through Circle; this path is not used.");
        },
      });
      const chain = defaultChain();
      const relay = typeof window !== "undefined" ? `${window.location.origin}/api/rpc` : chain.rpcUrls.default.http[0];
      const client = createWalletClient({ account, chain, transport: http(relay) });
      // Contract writes go through a Circle transaction challenge: Circle signs with the MPC key, pays gas from
      // the wallet's USDC and broadcasts; we wait for the hash so the UI links the real transaction.
      const writeContract = async (args: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }): Promise<Hex> => {
        const callData = encodeFunctionData({ abi: args.abi, functionName: args.functionName, args: args.args ?? [] } as never);
        const { challengeId } = await api.circleContractCall({ userToken: st.userToken, walletId: st.walletId, contractAddress: args.address, callData });
        await executeChallenge(sdk, st, challengeId);
        const ch = await api.circleChallenge(challengeId, st.userToken);
        const txId = ch.correlationIds[0];
        if (!txId) throw new WalletError("Circle did not report a transaction for this approval.");
        const deadline = Date.now() + 3 * 60 * 1000;
        while (Date.now() < deadline) {
          const t = await api.circleTx(txId, st.userToken);
          if (t.txHash) return t.txHash as Hex;
          if (["FAILED", "DENIED", "CANCELLED"].includes(t.state)) throw new WalletError(`Circle transaction ${t.state.toLowerCase()}${t.errorReason ? `: ${t.errorReason}` : ""}.`);
          await new Promise((r) => setTimeout(r, 2000));
        }
        throw new WalletError("Circle has not broadcast the transaction yet. Check the wallet page in a minute.");
      };
      return Object.assign(client, { writeContract }) as unknown as WalletClient;
    },
    [sdk],
  );

  const getWalletClient = useCallback(async () => {
    if (!wallet) throw new WalletError("Your wallet is still being set up. Try again in a moment.");
    if (wallet.type === "embedded") {
      if (!circle?.walletId || !circle.walletAddress) throw new WalletError("Your Proteus AI wallet is still being created. Try again in a moment.");
      return circleClient(circle as CircleState & { walletId: string; walletAddress: Address });
    }
    return injectedClient(wallet.address);
  }, [wallet, circle, circleClient]);

  /* ---- Sign in, link, sign out ---- */
  const finishSession = useCallback(
    async (token: string) => {
      saveSession(token);
      walletTried.current = false;
      primaryTried.current = null;
      await qc.invalidateQueries({ queryKey: qk.me });
    },
    [saveSession, qc],
  );

  const doEmailLogin = useCallback(
    async (email: string) => {
      const login = await emailLogin(sdk, appId, email);
      const s = await api.circleSession({ userToken: login.userToken, email });
      saveCircle({ ...login, email });
      await finishSession(s.token);
    },
    [sdk, appId, saveCircle, finishSession],
  );

  const loginWithWallet = useCallback(async () => {
    const eth = injected();
    if (!eth) throw new WalletError("No browser wallet was found. Install MetaMask, or sign in with your email.");
    const [first] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    if (!first) throw new WalletError("No account was selected in the wallet.");
    const address = getAddress(first) as Address;
    const { nonce } = await api.walletLoginNonce(address);
    const signature = (await eth.request({ method: "personal_sign", params: [walletLoginMessage(address, nonce), address] })) as string;
    const s = await api.walletLogin({ address, nonce, signature });
    saveCircle(null);
    await finishSession(s.token);
  }, [saveCircle, finishSession]);

  const connectExternalWallet = useCallback(() => {
    (async () => {
      const eth = injected();
      if (!eth) throw new WalletError("No browser wallet was found.");
      const [first] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!first) return;
      const address = getAddress(first) as Address;
      if (meQ.data?.wallets.some((w) => same(w.address, address))) return setActiveWallet(address);
      const { nonce } = await api.walletLinkNonce();
      const signature = (await eth.request({ method: "personal_sign", params: [walletLinkMessage(address, nonce), address] })) as string;
      await api.linkWallet({ address, kind: "external", nonce, signature });
      await meQ.refetch();
      setActiveWallet(address);
    })().catch((e) => console.warn("[proteus] wallet link failed", e));
  }, [meQ, setActiveWallet]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    saveSession(null);
    saveCircle(null);
    setAccessTokenGetter(null);
    qc.clear();
  }, [saveSession, saveCircle, qc]);

  const authUser: AuthUser | null = useMemo(
    () => (authenticated ? { id: userId ?? "pending", email: meQ.data?.email ?? circle?.email, loginMethods: circle ? ["email"] : ["wallet"] } : null),
    [authenticated, userId, meQ.data?.email, circle],
  );

  const value: AuthValue = {
    provider: "circle",
    canExportWallet: false,
    ready: true,
    authenticated,
    user: authUser,
    login: () => {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    },
    emailLogin: doEmailLogin,
    loginWithWallet,
    logout,
    getAccessToken: async () => session,
    wallet,
    wallets: options,
    setActiveWallet,
    connectExternalWallet,
    me: meQ.data,
    meStatus: meStatusOf(meQ, authenticated),
    refetchMe: () => void meQ.refetch(),
    getWalletClient,
    exportWallet: async () => {
      throw new WalletError(`${walletLabel({ type: "embedded" })}: the key is split between Circle and your PIN and cannot be exported. Connect an external wallet if you need one you hold yourself.`);
    },
    mock: false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default CircleAuthProvider;
