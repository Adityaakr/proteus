/**
 * Sign-in without Privy: Circle email OTP (the embedded wallet is a Circle user-controlled wallet on Arc) or an
 * external wallet signing a nonce. Both end in Proteus AI's own session cookie / bearer token.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { z } from "zod";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError, json } from "../lib/http";
import { id } from "../lib/ids";
import { SESSION_TTL_SECONDS, issueSession } from "../lib/jwt";
import { clientIp, limit } from "../lib/ratelimit";
import { insertWalletLink, userWallets } from "../services/accounts";
import { CIRCLE_CHAIN, challengeState, contractCallChallenge, emailDeviceToken, ensureWallet, refreshToken, signMessageChallenge, signTypedDataChallenge, transactionState, userFromToken } from "../services/circle";
import { auth, requireAuth } from "./auth";

export const SESSION_COOKIE = "proteus_auth";
export const circleAuthRoutes = new Hono();
const ip = (c: { req: { header: (n: string) => string | undefined } }) => clientIp((n) => c.req.header(n));
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

async function startSession(c: Parameters<typeof setCookie>[0], userId: string) {
  const token = await issueSession(userId);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", path: "/", secure: env.NODE_ENV === "production", maxAge: SESSION_TTL_SECONDS });
  return token;
}

async function upsertUser(did: string, email?: string) {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.privyDid, did));
  if (existing) {
    await db.update(schema.users).set({ lastSeenAt: new Date(), ...(email && !existing.email ? { email } : {}) }).where(eq(schema.users.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(schema.users).values({ id: id("usr"), privyDid: did, email }).returning();
  return created!;
}

/* ---------- Circle email OTP ---------- */

circleAuthRoutes.post("/auth/circle/email", async (c) => {
  if (!features.circleAuth) throw new HttpError(404, "not found");
  limit(`circle-email:${ip(c)}`, 10);
  const b = z.object({ email: z.string().email().max(254), deviceId: z.string().min(8).max(128) }).parse(await c.req.json());
  return json(c, await emailDeviceToken(b.email.trim().toLowerCase(), b.deviceId));
});

/** After the OTP is verified in the web SDK: turn the Circle user token into a Proteus AI session. */
circleAuthRoutes.post("/auth/circle/session", async (c) => {
  if (!features.circleAuth) throw new HttpError(404, "not found");
  limit(`circle-session:${ip(c)}`, 30);
  const b = z.object({ userToken: z.string().min(16), email: z.string().email().max(254).optional() }).parse(await c.req.json());
  const cu = await userFromToken(b.userToken);
  const u = await upsertUser(`did:circle:${cu.id}`, b.email?.trim().toLowerCase());
  const token = await startSession(c, u.id);
  return json(c, { token, userId: u.id, circleUserId: cu.id, pinStatus: cu.pinStatus ?? null });
});

circleAuthRoutes.post("/auth/circle/refresh", async (c) => {
  if (!features.circleAuth) throw new HttpError(404, "not found");
  const b = z.object({ userToken: z.string().min(16), refreshToken: z.string().min(16), deviceId: z.string().min(8) }).parse(await c.req.json());
  return json(c, await refreshToken(b.userToken, b.refreshToken, b.deviceId));
});

/** The account's Circle wallet on Arc: returns it, or the challenge that creates it. Links it to the account when live. */
circleAuthRoutes.post("/auth/circle/wallet", requireAuth, async (c) => {
  const b = z.object({ userToken: z.string().min(16) }).parse(await c.req.json());
  const r = await ensureWallet(b.userToken);
  if (r.wallet) {
    const addr = getAddress(r.wallet.address) as Address;
    const mine = await userWallets(auth(c).userId);
    if (!mine.some((w) => w.address === addr.toLowerCase())) await insertWalletLink(auth(c).userId, addr, "embedded", "0x" as Hex);
    return json(c, { wallet: { id: r.wallet.id, address: addr, chain: CIRCLE_CHAIN } });
  }
  return json(c, { challengeId: r.challengeId, setsPin: r.setsPin ?? false });
});

circleAuthRoutes.post("/auth/circle/sign-typed-data", requireAuth, async (c) => {
  const b = z.object({ userToken: z.string().min(16), walletId: z.string().min(8), typedData: z.record(z.string(), z.unknown()), memo: z.string().max(120).optional() }).parse(await c.req.json());
  return json(c, { challengeId: await signTypedDataChallenge(b.userToken, b.walletId, b.typedData, b.memo) });
});

circleAuthRoutes.post("/auth/circle/sign-message", requireAuth, async (c) => {
  const b = z.object({ userToken: z.string().min(16), walletId: z.string().min(8), message: z.string().min(1).max(2000), memo: z.string().max(120).optional() }).parse(await c.req.json());
  return json(c, { challengeId: await signMessageChallenge(b.userToken, b.walletId, b.message, b.memo) });
});

circleAuthRoutes.post("/auth/circle/contract-call", requireAuth, async (c) => {
  const b = z
    .object({ userToken: z.string().min(16), walletId: z.string().min(8), contractAddress: address, callData: z.string().regex(/^0x[0-9a-fA-F]*$/).max(20_000), refId: z.string().max(64).optional() })
    .parse(await c.req.json());
  return json(c, { challengeId: await contractCallChallenge(b.userToken, b.walletId, b.contractAddress, b.callData as `0x${string}`, b.refId) });
});

circleAuthRoutes.get("/auth/circle/tx/:id", requireAuth, async (c) => {
  const userToken = c.req.header("x-circle-user-token");
  if (!userToken) throw new HttpError(400, "x-circle-user-token header required");
  return json(c, await transactionState(userToken, c.req.param("id") ?? ""));
});

/** A challenge's outcome; for a transaction challenge the correlation id is the Circle transaction id. */
circleAuthRoutes.get("/auth/circle/challenge/:id", requireAuth, async (c) => {
  const userToken = c.req.header("x-circle-user-token");
  if (!userToken) throw new HttpError(400, "x-circle-user-token header required");
  return json(c, await challengeState(userToken, c.req.param("id") ?? ""));
});

/* ---------- External wallet sign-in (MetaMask and friends) ---------- */

const nonces = new Map<string, { nonce: string; exp: number }>();
export function walletLoginMessage(addr: string, nonce: string): string {
  return `PROTEUS sign in\naddress: ${addr}\nnonce: ${nonce}`;
}

circleAuthRoutes.post("/auth/wallet/nonce", async (c) => {
  limit(`wallet-nonce:${ip(c)}`, 30);
  const b = z.object({ address }).parse(await c.req.json());
  const nonce = randomBytes(16).toString("hex");
  nonces.set(b.address.toLowerCase(), { nonce, exp: Date.now() + 5 * 60 * 1000 });
  return json(c, { nonce, message: walletLoginMessage(getAddress(b.address), nonce) });
});

circleAuthRoutes.post("/auth/wallet", async (c) => {
  limit(`wallet-login:${ip(c)}`, 20);
  const b = z.object({ address, nonce: z.string().min(16), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }).parse(await c.req.json());
  const key = b.address.toLowerCase();
  const n = nonces.get(key);
  if (!n || n.nonce !== b.nonce || n.exp < Date.now()) throw new HttpError(400, "Sign-in request expired. Try again.");
  nonces.delete(key);
  const addr = getAddress(b.address) as Address;
  const ok = await verifyMessage({ address: addr, message: walletLoginMessage(addr, b.nonce), signature: b.signature as Hex });
  if (!ok) throw new HttpError(401, "The signature does not match the wallet.");
  // The account that already owns this wallet, else a new account keyed by the wallet.
  const [link] = await db.select().from(schema.walletLinks).where(eq(schema.walletLinks.address, key));
  const u = link ? (await db.select().from(schema.users).where(eq(schema.users.id, link.userId)))[0]! : await upsertUser(`did:wallet:${key}`);
  if (!link) await insertWalletLink(u.id, addr, "external", b.signature as Hex);
  const token = await startSession(c, u.id);
  return json(c, { token, userId: u.id });
});

circleAuthRoutes.post("/auth/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return json(c, { ok: true });
});
