/**
 * Invite gate. Codes look like PRX-7K3M-Q9WX-2H4B: 12 characters from a 32-symbol alphabet with no look-alikes
 * (no 0/O, 1/I/L), which is 60 bits of entropy, so guessing is hopeless even without the rate limit. Only an HMAC
 * of the normalized code is stored (keyed by INVITE_PEPPER, falling back to SESSION_SECRET), so a database leak
 * exposes no usable codes. A code is consumed only when it is bound to a signed-in account; checking a code before
 * sign-in hands the browser a short-lived signed grant cookie that is redeemed on the first authenticated call.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { and, desc, eq, isNull, sql as dsql } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 symbols, no 0 O 1 I L
const PREFIX = "PRX";
const BODY_LEN = 12;
const pepper = () => env.INVITE_PEPPER ?? env.SESSION_SECRET;

export function generateCode(): string {
  const buf = randomBytes(BODY_LEN * 2);
  let body = "";
  for (let i = 0; body.length < BODY_LEN && i < buf.length; i++) {
    const v = buf[i]!;
    if (v >= 248) continue; // rejection sampling keeps the symbols uniform (248 = 8 * 31)
    body += ALPHABET[v % ALPHABET.length];
  }
  if (body.length < BODY_LEN) return generateCode();
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/** Uppercases, drops separators and the prefix, maps look-alikes, and returns the 12-symbol body or null. */
export function normalizeCode(raw: string): string | null {
  let s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  // The alphabet has no 0/1, so a mapped 0 or 1 can only come from a typo of O or I; reject those explicitly.
  if (s.length !== BODY_LEN || /[^A-Z2-9]/.test(s) || /[01]/.test(s)) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

export function hashCode(body: string): string {
  return createHmac("sha256", pepper()).update(`invite:${body}`).digest("hex");
}

/* ---------- rate limit: fixed windows in memory (one instance) ---------- */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 8;
const MAX_PER_USER = 8;
const attempts = new Map<string, { n: number; resetAt: number }>();
function hit(key: string, max: number) {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.resetAt < now) {
    attempts.set(key, { n: 1, resetAt: now + WINDOW_MS });
    return;
  }
  cur.n++;
  if (cur.n > max) throw new HttpError(429, "Too many attempts. Try again in a few minutes.", { retryAfterSeconds: Math.ceil((cur.resetAt - now) / 1000) });
  if (attempts.size > 10_000) for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
}
export function clientIp(h: (name: string) => string | undefined): string {
  return h("x-forwarded-for")?.split(",")[0]?.trim() || h("x-real-ip") || h("cf-connecting-ip") || "local";
}

/* ---------- grant cookie: HMAC-signed, 7 days, carries only the invite id ---------- */
const GRANT_TTL_MS = 7 * 24 * 3600 * 1000;
export const GRANT_COOKIE = "proteus_invite";
function sign(payload: string): string {
  return createHmac("sha256", pepper()).update(`grant:${payload}`).digest("base64url");
}
export function issueGrant(inviteId: string): { token: string; expires: Date } {
  const exp = Date.now() + GRANT_TTL_MS;
  const payload = `${inviteId}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, expires: new Date(exp) };
}
export function readGrant(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [inviteId, expStr, sig] = parts as [string, string, string];
  const expected = sign(`${inviteId}.${expStr}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (!/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return null;
  return inviteId;
}

/** Called by the gate on an authenticated request: consumes the grant cookie if one is present. */
export async function bindGrantCookie(c: Context, userId: string): Promise<boolean> {
  const inviteId = readGrant(getCookie(c, GRANT_COOKIE));
  if (!inviteId) return false;
  const ok = await bindInvite(userId, inviteId, clientIp((n) => c.req.header(n)));
  deleteCookie(c, GRANT_COOKIE, { path: "/" });
  return ok;
}

/* ---------- lookups ---------- */
type InviteRow = typeof schema.invites.$inferSelect;
function usable(inv: InviteRow | undefined): inv is InviteRow {
  return Boolean(inv && !inv.revokedAt && (!inv.expiresAt || inv.expiresAt.getTime() > Date.now()) && inv.uses < inv.maxUses);
}
async function findByCode(raw: string): Promise<InviteRow | undefined> {
  const body = normalizeCode(raw);
  if (!body) return undefined;
  const [inv] = await db.select().from(schema.invites).where(eq(schema.invites.codeHash, hashCode(body)));
  return inv;
}

export async function hasAccess(userId: string): Promise<boolean> {
  const [u] = await db.select({ at: schema.users.accessGrantedAt }).from(schema.users).where(eq(schema.users.id, userId));
  return Boolean(u?.at);
}

/** Checks a code without consuming it. Throws 400 on a bad code. Returns the invite. */
export async function checkCode(raw: string, ip: string): Promise<InviteRow> {
  hit(`ip:${ip}`, MAX_PER_IP);
  const inv = await findByCode(raw);
  if (!usable(inv)) throw new HttpError(400, "That invite code is not valid.", { code: "invalid_invite" });
  return inv;
}

/**
 * Binds an invite to an account: one use of the code, one redemption row, access granted. Atomic on the use
 * counter so two accounts cannot share the last use of a code. Idempotent for an account that already has access.
 */
export async function bindInvite(userId: string, inviteId: string, ip: string): Promise<boolean> {
  if (await hasAccess(userId)) return true;
  const [row] = await db
    .update(schema.invites)
    .set({ uses: dsql`${schema.invites.uses} + 1` })
    .where(and(eq(schema.invites.id, inviteId), isNull(schema.invites.revokedAt), dsql`${schema.invites.uses} < ${schema.invites.maxUses}`, dsql`(${schema.invites.expiresAt} is null or ${schema.invites.expiresAt} > now())`))
    .returning({ id: schema.invites.id });
  if (!row) return false;
  await db.insert(schema.inviteRedemptions).values({ id: id("inv_use"), inviteId, userId, ip }).onConflictDoNothing();
  await db.update(schema.users).set({ accessGrantedAt: new Date() }).where(and(eq(schema.users.id, userId), isNull(schema.users.accessGrantedAt)));
  return true;
}

/** Signed-in redemption: check and bind in one step. */
export async function redeemForUser(userId: string, raw: string, ip: string): Promise<void> {
  if (await hasAccess(userId)) return;
  hit(`user:${userId}`, MAX_PER_USER);
  const inv = await checkCode(raw, ip);
  const ok = await bindInvite(userId, inv.id, ip);
  if (!ok) throw new HttpError(400, "That invite code has already been used.", { code: "invite_exhausted" });
}

/* ---------- admin ---------- */
export async function mintInvites(opts: { count: number; label?: string; maxUses?: number; expiresInDays?: number }): Promise<string[]> {
  const count = Math.max(1, Math.min(500, Math.floor(opts.count)));
  const codes: string[] = [];
  const rows: (typeof schema.invites.$inferInsert)[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    codes.push(code);
    rows.push({ id: id("inv"), codeHash: hashCode(normalizeCode(code)!), label: opts.label ?? null, maxUses: Math.max(1, opts.maxUses ?? 1), expiresAt: opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86400 * 1000) : null });
  }
  await db.insert(schema.invites).values(rows);
  return codes;
}

export async function listInvites() {
  const rows = await db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt));
  const uses = await db.select({ inviteId: schema.inviteRedemptions.inviteId, userId: schema.inviteRedemptions.userId, email: schema.users.email, at: schema.inviteRedemptions.redeemedAt }).from(schema.inviteRedemptions).innerJoin(schema.users, eq(schema.users.id, schema.inviteRedemptions.userId));
  return rows.map((r) => ({
    id: r.id, label: r.label, uses: r.uses, maxUses: r.maxUses, expiresAt: r.expiresAt, revokedAt: r.revokedAt, createdAt: r.createdAt,
    status: r.revokedAt ? "revoked" : r.expiresAt && r.expiresAt.getTime() < Date.now() ? "expired" : r.uses >= r.maxUses ? "used" : "open",
    redeemedBy: uses.filter((u) => u.inviteId === r.id).map((u) => ({ userId: u.userId, email: u.email, at: u.at })),
  }));
}

export async function revokeInvite(idOrCode: string): Promise<boolean> {
  const inv = idOrCode.startsWith("inv_") ? (await db.select().from(schema.invites).where(eq(schema.invites.id, idOrCode)))[0] : await findByCode(idOrCode);
  if (!inv) return false;
  await db.update(schema.invites).set({ revokedAt: new Date() }).where(eq(schema.invites.id, inv.id));
  return true;
}

/** Constant-time check of the admin bearer token. 404 when admin routes are not configured. */
export function requireAdminToken(header: string | undefined, ip: string): void {
  if (!env.ADMIN_TOKEN) throw new HttpError(404, "not found");
  hit(`admin:${ip}`, 20);
  const given = header?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(env.ADMIN_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "admin token required");
}
