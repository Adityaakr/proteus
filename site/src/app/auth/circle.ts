/**
 * Circle user-controlled wallets in the browser: one W3SSdk instance, promise wrappers around its callbacks,
 * and the EIP-712 serialisation Circle expects. The API key stays on the server; this file only ever holds
 * the person's own user token, which Circle scopes to their wallet.
 */
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { WalletError } from "../lib/wallet";
import { api } from "../lib/api";

let instance: W3SSdk | null = null;
let instanceAppId = "";
export function circleSdk(appId: string): W3SSdk {
  if (!instance || instanceAppId !== appId) {
    instance = new W3SSdk({ appSettings: { appId } });
    instanceAppId = appId;
  }
  return instance;
}

export interface CircleLogin {
  userToken: string;
  encryptionKey: string;
  refreshToken: string;
  deviceId: string;
}

/** Sends the OTP email, opens Circle's code entry, resolves once Circle hands back the user token. */
export function emailLogin(sdk: W3SSdk, appId: string, email: string): Promise<CircleLogin> {
  return new Promise((resolve, reject) => {
    (async () => {
      const deviceId = await sdk.getDeviceId();
      const t = await api.circleEmail({ email, deviceId });
      const timer = setTimeout(() => reject(new WalletError("The sign-in window timed out. Try again.")), 10 * 60 * 1000);
      sdk.updateConfigs({ appSettings: { appId }, loginConfigs: { deviceToken: t.deviceToken, deviceEncryptionKey: t.deviceEncryptionKey, otpToken: t.otpToken } }, (error, result) => {
        clearTimeout(timer);
        if (error || !result) return reject(new WalletError(error?.message ?? "Sign-in did not complete.", error?.code as number | undefined));
        resolve({ userToken: result.userToken, encryptionKey: result.encryptionKey, refreshToken: result.refreshToken, deviceId });
      });
      sdk.verifyOtp();
    })().catch(reject);
  });
}

export interface ChallengeOutcome {
  status?: string;
  type?: string;
  signature?: `0x${string}`;
}

/** Runs one challenge in Circle's approval UI. Resolves on COMPLETE, rejects on failure, cancel or timeout. */
export function executeChallenge(sdk: W3SSdk, auth: { userToken: string; encryptionKey: string }, challengeId: string): Promise<ChallengeOutcome> {
  return new Promise((resolve, reject) => {
    sdk.setAuthentication({ userToken: auth.userToken, encryptionKey: auth.encryptionKey });
    const timer = setTimeout(() => reject(new WalletError("The approval window timed out. Try again.")), 10 * 60 * 1000);
    sdk.execute(challengeId, (error, result) => {
      clearTimeout(timer);
      if (error) return reject(new WalletError(error.message ?? "Circle could not complete the request.", error.code as number | undefined));
      const r = result as { status?: string; type?: string; data?: { signature?: string } } | undefined;
      if (!r || r.status === "FAILED" || r.status === "EXPIRED") return reject(new WalletError(`Circle reported the request as ${r?.status ?? "not completed"}.`));
      resolve({ status: r.status, type: r.type, signature: r.data?.signature as `0x${string}` | undefined });
    });
  });
}

/** eth_signTypedData_v4 JSON for Circle: EIP712Domain spelled out, bigints as decimal strings. */
export function serializeTypedData(td: { domain: Record<string, unknown>; types: Record<string, readonly { name: string; type: string }[]>; primaryType: string; message: Record<string, unknown> }): Record<string, unknown> {
  const domainFields: { name: string; type: string }[] = [];
  if (td.domain.name !== undefined) domainFields.push({ name: "name", type: "string" });
  if (td.domain.version !== undefined) domainFields.push({ name: "version", type: "string" });
  if (td.domain.chainId !== undefined) domainFields.push({ name: "chainId", type: "uint256" });
  if (td.domain.verifyingContract !== undefined) domainFields.push({ name: "verifyingContract", type: "address" });
  if (td.domain.salt !== undefined) domainFields.push({ name: "salt", type: "bytes32" });
  const plain = (v: unknown): unknown => (typeof v === "bigint" ? v.toString() : Array.isArray(v) ? v.map(plain) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, plain(x)])) : v);
  const types: Record<string, { name: string; type: string }[]> = { EIP712Domain: domainFields };
  for (const [k, v] of Object.entries(td.types)) types[k] = v.map((f) => ({ name: f.name, type: f.type }));
  return { types, primaryType: td.primaryType, domain: plain({ ...td.domain, chainId: td.domain.chainId !== undefined ? Number(td.domain.chainId) : undefined }), message: plain(td.message) };
}
