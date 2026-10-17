/** Proteus AI's own session: an HS256 JWT under SESSION_SECRET, issued after a Circle or wallet sign-in. */
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

const key = () => new TextEncoder().encode(env.SESSION_SECRET);
const ISSUER = "proteus";
export const SESSION_TTL_SECONDS = 14 * 24 * 3600;

export async function issueSession(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setSubject(userId).setIssuedAt().setExpirationTime(`${SESSION_TTL_SECONDS}s`).sign(key());
}

/** The user id inside a valid session token, else null (never throws: a foreign token simply is not ours). */
export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
