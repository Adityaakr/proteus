import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { bindGrantCookie } from "../services/invites";
import { getCookie } from "hono/cookie";
import { verifySession } from "../lib/jwt";

/**
 * Privy access tokens are ES256 JWTs signed by the app's key; we verify them against the app's public
 * JWKS (https://auth.privy.io/api/v1/apps/<appId>/jwks.json). No app secret is involved.
 * Claims used: `sub` (the Privy DID), `aud` (must be our app id), `exp`.
 */
const jwks = createRemoteJWKSet(new URL(env.PRIVY_JWKS_URL ?? `https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/jwks.json`));

export interface AuthInfo {
  userId: string;
  did: string;
  /** True once an invite code is bound to the account (always true when the gate is off). */
  access: boolean;
}

/** Account-level routes a signed-in person may use before redeeming an invite: their profile and wallet links. */
const UNGATED = [/^\/api\/me$/, /^\/api\/me\/wallets?(\/|$)/, /^\/api\/invites(\/|$)/];

/**
 * The invite gate. A signed-in account without access gets 403 `invite_required` on everything except the
 * ungated account routes. A grant cookie from a pre-sign-in check is consumed here, on the first call.
 */
async function gate(c: Context, userId: string, granted: boolean): Promise<boolean> {
  if (!features.inviteGate) return true;
  let access = granted;
  if (!access) access = await bindGrantCookie(c, userId);
  if (access) return true;
  if (UNGATED.some((re) => re.test(c.req.path))) return false;
  throw new HttpError(403, "An invite code is required to use Proteus AI.", { code: "invite_required" });
}

export async function verifyPrivyToken(token: string): Promise<{ did: string }> {
  const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: env.PRIVY_APP_ID });
  if (!payload.sub) throw new HttpError(401, "token has no subject");
  return { did: payload.sub };
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

/** Resolves the caller from the bearer token. Sets `auth` on the context, or leaves it unset when absent. */
export async function resolveAuth(c: Context): Promise<AuthInfo | undefined> {
  const cached = c.get("auth") as AuthInfo | undefined;
  if (cached) return cached;
  const devUser = c.req.header("x-dev-user");
  if (devUser && features.privyDevBypass) {
    const u = await upsertUser(`did:privy:dev:${devUser}`, `${devUser}@dev.local`);
    const info = { userId: u.id, did: u.privyDid, access: await gate(c, u.id, Boolean(u.accessGrantedAt)) };
    c.set("auth", info);
    return info;
  }
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer?.startsWith("pk_live_")) return undefined; // service api keys are handled elsewhere
  // Proteus AI's own session (Circle or wallet sign-in): bearer token or the proteus_auth cookie.
  const own = bearer ? await verifySession(bearer) : null;
  const cookieUser = own ? null : await verifySession(getCookie(c, "proteus_auth") ?? "");
  const sessionUser = own ?? cookieUser;
  if (sessionUser) {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, sessionUser));
    if (!u) throw new HttpError(401, "session user no longer exists");
    await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, u.id));
    const info = { userId: u.id, did: u.privyDid, access: await gate(c, u.id, Boolean(u.accessGrantedAt)) };
    c.set("auth", info);
    return info;
  }
  if (!bearer) return undefined;
  try {
    const { did } = await verifyPrivyToken(bearer);
    const u = await upsertUser(did);
    const info = { userId: u.id, did, access: await gate(c, u.id, Boolean(u.accessGrantedAt)) };
    c.set("auth", info);
    return info;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, `invalid session: ${String((e as Error).message).slice(0, 120)}`);
  }
}

export async function requireAuth(c: Context, next: Next) {
  const a = await resolveAuth(c);
  if (!a) throw new HttpError(401, "sign in required");
  await next();
}

export function auth(c: Context): AuthInfo {
  const a = c.get("auth") as AuthInfo | undefined;
  if (!a) throw new HttpError(401, "sign in required");
  return a;
}
