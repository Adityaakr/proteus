/**
 * Circle user-controlled wallets: the sign-in and embedded wallet behind every account when AUTH_PROVIDER is
 * "circle". The person logs in with an email OTP in Circle's web SDK; the browser then holds a Circle user
 * token. Anything that needs the wallet (creating it, signing typed data, calling a contract) is a challenge
 * this server creates with the API key and the browser executes in Circle's hosted approval UI, so the key
 * never leaves the server and the key shares never leave Circle's MPC. Wallets are EOAs on Arc.
 */
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { env } from "../env";
import { HttpError } from "../lib/http";

type Client = ReturnType<typeof initiateUserControlledWalletsClient>;
let cached: Client | undefined;
function client(): Client {
  if (!env.CIRCLE_API_KEY) throw new HttpError(503, "Circle sign-in is not configured on this server.");
  cached ??= initiateUserControlledWalletsClient({ apiKey: env.CIRCLE_API_KEY });
  return cached;
}

/** Circle's chain code for the configured chain. */
export const CIRCLE_CHAIN = (env.CHAIN_ID === 5042002 ? "ARC-TESTNET" : "ARC") as "ARC-TESTNET" | "ARC";

/** Circle SDK errors carry the API message under response.data; surface it as a 502 with that text. */
async function call<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { message?: string; code?: number } }; message?: string };
    const msg = err.response?.data?.message ?? err.message ?? "unknown error";
    const code = err.response?.data?.code;
    console.warn(`[circle] ${label} failed: ${msg}${code ? ` (code ${code})` : ""}`);
    throw new HttpError(err.response?.status === 401 ? 401 : 502, `Circle: ${msg}`, { code: code ?? null, label });
  }
}

export async function emailDeviceToken(email: string, deviceId: string) {
  const r = await call("createDeviceTokenForEmailLogin", () => client().createDeviceTokenForEmailLogin({ email, deviceId }));
  const d = r.data;
  if (!d?.deviceToken || !d.deviceEncryptionKey || !d.otpToken) throw new HttpError(502, "Circle did not return a device token.");
  return { deviceToken: d.deviceToken, deviceEncryptionKey: d.deviceEncryptionKey, otpToken: d.otpToken };
}

/** Who a Circle user token belongs to. */
export async function userFromToken(userToken: string) {
  const r = await call("getUserStatus", () => client().getUserStatus({ userToken }));
  const u = r.data;
  if (!u?.id) throw new HttpError(401, "Circle session is not valid.");
  return { id: u.id, status: u.status, pinStatus: u.pinStatus };
}

export async function refreshToken(userToken: string, refreshToken: string, deviceId: string) {
  const r = await call("refreshUserToken", () => client().refreshUserToken({ userToken, refreshToken, deviceId }));
  if (!r.data?.userToken) throw new HttpError(401, "Circle session could not be refreshed.");
  return { userToken: r.data.userToken, encryptionKey: r.data.encryptionKey };
}

export interface CircleWallet { id: string; address: string; blockchain: string; state: string }

/** The user's live wallet on the configured chain, or a challenge the browser must execute to create one. */
export async function ensureWallet(userToken: string): Promise<{ wallet?: CircleWallet; challengeId?: string }> {
  const list = await call("listWallets", () => client().listWallets({ userToken, blockchain: CIRCLE_CHAIN }));
  const live = (list.data?.wallets ?? []).find((w) => w.blockchain === CIRCLE_CHAIN && w.state === "LIVE");
  if (live) return { wallet: { id: live.id, address: live.address, blockchain: live.blockchain, state: live.state } };
  const r = await call("createWallet", () => client().createWallet({ userToken, blockchains: [CIRCLE_CHAIN], accountType: "EOA" }));
  if (!r.data?.challengeId) throw new HttpError(502, "Circle did not return a wallet creation challenge.");
  return { challengeId: r.data.challengeId };
}

export async function signTypedDataChallenge(userToken: string, walletId: string, typedData: unknown, memo?: string): Promise<string> {
  const r = await call("signTypedData", () => client().signTypedData({ userToken, walletId, data: JSON.stringify(typedData), memo }));
  if (!r.data?.challengeId) throw new HttpError(502, "Circle did not return a signing challenge.");
  return r.data.challengeId;
}

export async function signMessageChallenge(userToken: string, walletId: string, message: string, memo?: string): Promise<string> {
  const r = await call("signMessage", () => client().signMessage({ userToken, walletId, message, memo }));
  if (!r.data?.challengeId) throw new HttpError(502, "Circle did not return a signing challenge.");
  return r.data.challengeId;
}

export async function contractCallChallenge(userToken: string, walletId: string, contractAddress: string, callData: `0x${string}`, refId?: string): Promise<string> {
  const r = await call("createUserTransactionContractExecutionChallenge", () =>
    client().createUserTransactionContractExecutionChallenge({ userToken, walletId, contractAddress, callData, refId, fee: { type: "level", config: { feeLevel: "MEDIUM" } } }),
  );
  if (!r.data?.challengeId) throw new HttpError(502, "Circle did not return a transaction challenge.");
  return r.data.challengeId;
}

export async function transactionState(userToken: string, id: string): Promise<{ state: string; txHash: string | null; errorReason: string | null }> {
  const r = await call("getTransaction", () => client().getTransaction({ userToken, id }));
  const t = r.data?.transaction;
  if (!t) throw new HttpError(404, "transaction not found");
  return { state: String(t.state), txHash: t.txHash ?? null, errorReason: t.errorReason ?? null };
}

export async function challengeState(userToken: string, challengeId: string): Promise<{ status: string; type: string; correlationIds: string[]; errorMessage: string | null }> {
  const r = await call("getUserChallenge", () => client().getUserChallenge({ userToken, challengeId }));
  const ch = (r.data as { challenge?: { status?: string; type?: string; correlationIds?: string[]; errorMessage?: string } } | undefined)?.challenge;
  if (!ch) throw new HttpError(404, "challenge not found");
  return { status: String(ch.status ?? ""), type: String(ch.type ?? ""), correlationIds: ch.correlationIds ?? [], errorMessage: ch.errorMessage ?? null };
}
