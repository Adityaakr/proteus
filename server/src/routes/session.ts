import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { resolveAuth } from "./auth";

const COOKIE = "proteus_session";

export async function createSandboxSession(c: Context) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.label, "sandbox")).limit(1);
  if (!org) throw new HttpError(500, "sandbox seller not seeded");
  const sid = id("sess", 24);
  const expiresAt = new Date(Date.now() + 12 * 3600 * 1000);
  await db.insert(schema.sessions).values({ id: sid, orgId: org.id, kind: "sandbox", expiresAt });
  setCookie(c, COOKIE, sid, { httpOnly: true, sameSite: "Lax", path: "/", secure: env.NODE_ENV === "production", expires: expiresAt });
  return { org: { id: org.id, slug: org.slug, name: org.name, label: org.label }, kind: "sandbox" };
}

export interface SessionInfo {
  orgId: string;
  kind: string;
  address?: string | null;
}

export async function requireSession(c: Context, next: Next) {
  // Privy-authenticated owner of an org takes precedence over the sandbox cookie.
  const a = await resolveAuth(c);
  if (a) {
    const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, a.userId));
    if (m) {
      c.set("session", { orgId: m.orgId, kind: "privy", address: null } satisfies SessionInfo);
      await next();
      return;
    }
  }
  const sid = getCookie(c, COOKIE);
  if (!sid) throw new HttpError(401, "no session; POST /api/app/session/sandbox to explore the sandbox seller");
  const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sid));
  if (!s || s.expiresAt.getTime() < Date.now()) throw new HttpError(401, "session expired");
  c.set("session", { orgId: s.orgId, kind: s.kind, address: s.address } satisfies SessionInfo);
  await next();
}

export function session(c: Context): SessionInfo {
  return c.get("session") as SessionInfo;
}
