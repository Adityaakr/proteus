import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";

/**
 * Privy access tokens are ES256 JWTs signed by the app's key; we verify them against the app's public
 * JWKS (https://auth.privy.io/api/v1/apps/<appId>/jwks.json). No app secret is involved.
 * Claims used: `sub` (the Privy DID), `aud` (must be our app id), `exp`.
 */
const jwks = createRemoteJWKSet(new URL(env.PRIVY_JWKS_URL ?? `https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/jwks.json`));

export interface AuthInfo {
  userId: string;
  did: string;
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
    const info = { userId: u.id, did: u.privyDid };
    c.set("auth", info);
    return info;
  }
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer || bearer.startsWith("pk_live_")) return undefined; // service api keys are handled elsewhere
  try {
    const { did } = await verifyPrivyToken(bearer);
    const u = await upsertUser(did);
    const info = { userId: u.id, did };
    c.set("auth", info);
    return info;
  } catch (e) {
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
