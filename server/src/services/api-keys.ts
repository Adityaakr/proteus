/**
 * Seller API keys: named, scoped bearer keys for the /api/v1/seller endpoints.
 *
 * - A key is `psk_<env>_<43 base64url chars>` (256 bits). Only its SHA-256 is stored, with a short non-secret prefix
 *   and the last 4 characters for the masked view. The full key leaves the server once: in the create or regenerate
 *   response. It is never logged.
 * - `env` keeps test and live apart: a test key works only on the Arc testnet deployment (testnet data), a live key
 *   only on mainnet. Each deployment creates keys for its own network.
 * - Regenerate either keeps the old key working for a short overlap (so a live integration can switch without
 *   downtime) or cuts it off at once. Revoke takes effect immediately.
 * - Each authenticated call records `lastUsedAt` and is checked against the key's scopes.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { id as newId } from "../lib/ids";

export type KeyEnv = "test" | "live";
export type Network = "testnet" | "mainnet";

export const SCOPES = ["deals:read", "usage:read", "payments:read", "products:write", "deliveries:write"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_INFO: Record<Scope, { label: string; description: string }> = {
  "deals:read": { label: "Read deals", description: "List deals and read one deal's terms, balances and status." },
  "usage:read": { label: "Read usage", description: "Metered requests, delivered units and receipts." },
  "payments:read": { label: "Read payments", description: "Funded, settled, refunded and held totals." },
  "products:write": { label: "Write products and prices", description: "Change public price tiers and list or unlist a product." },
  "deliveries:write": { label: "Write delivery reports", description: "Record delivered units with proof and post order updates." },
};

/** How long an old key keeps working after a regenerate with overlap, by default and at most. */
export const DEFAULT_OVERLAP_HOURS = 24;
export const MAX_OVERLAP_HOURS = 72;
const MAX_ACTIVE_KEYS = 20;
const KEY_BODY = 43; // 32 random bytes, base64url without padding
const KEY_RE = /^psk_(test|live)_([A-Za-z0-9_-]{43})$/;

export const envForNetwork = (n: Network): KeyEnv => (n === "mainnet" ? "live" : "test");
export const networkForEnv = (e: KeyEnv): Network => (e === "live" ? "mainnet" : "testnet");

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** A fresh key. The caller stores `hash`, `prefix` and `last4` and shows `key` once. */
export function generateKey(env: KeyEnv): { key: string; hash: string; prefix: string; last4: string } {
  const body = randomBytes(32).toString("base64url");
  if (body.length !== KEY_BODY) throw new Error("unexpected key length");
  const key = `psk_${env}_${body}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, `psk_${env}_`.length + 4), last4: key.slice(-4) };
}

/** The environment a presented key claims, or null when it is not a seller API key at all. */
export function keyEnvOf(key: string): KeyEnv | null {
  const m = KEY_RE.exec(key);
  return m ? (m[1] as KeyEnv) : null;
}

export type KeyRow = typeof schema.sellerApiKeys.$inferSelect;
export type KeyState = "active" | "expiring" | "expired" | "revoked";

export function keyState(row: Pick<KeyRow, "revokedAt" | "expiresAt">, now: Date): KeyState {
  if (row.revokedAt && row.revokedAt.getTime() <= now.getTime()) return "revoked";
  if (row.expiresAt) return row.expiresAt.getTime() <= now.getTime() ? "expired" : "expiring";
  return "active";
}

export const maskKey = (row: Pick<KeyRow, "prefix" | "last4">) => `${row.prefix}${"•".repeat(8)}${row.last4}`;

/** What the dashboard and API return for a key. Never the hash, never the key. */
export function keyView(row: KeyRow, now: Date) {
  return {
    id: row.id,
    name: row.name,
    env: row.env as KeyEnv,
    masked: maskKey(row),
    scopes: normalizeScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    replacedBy: row.replacedBy,
    state: keyState(row, now),
  };
}
export type KeyView = ReturnType<typeof keyView>;

function normalizeScopes(v: unknown): Scope[] {
  return Array.isArray(v) ? SCOPES.filter((s) => v.includes(s)) : [];
}

export function parseScopes(v: unknown): Scope[] {
  if (!Array.isArray(v) || v.length === 0) throw new HttpError(400, "Choose at least one permission for this key.");
  const bad = v.filter((s) => !SCOPES.includes(s as Scope));
  if (bad.length) throw new HttpError(400, `Unknown permission: ${bad.map(String).join(", ")}. Use ${SCOPES.join(", ")}.`);
  return SCOPES.filter((s) => v.includes(s));
}

export function parseName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 60) throw new HttpError(400, "Give the key a name of 1 to 60 characters, such as \"Order sync\".");
  return name;
}

export function parseOverlap(v: unknown): number {
  if (v === undefined || v === null) return DEFAULT_OVERLAP_HOURS;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_OVERLAP_HOURS) throw new HttpError(400, `overlapHours must be a whole number from 0 (cut off now) to ${MAX_OVERLAP_HOURS}.`);
  return n;
}

/* ---------------------------------------------------------------- storage */

export interface KeyStore {
  insert(row: KeyRow): Promise<void>;
  byHash(hash: string): Promise<KeyRow | undefined>;
  byId(orgId: string, id: string): Promise<KeyRow | undefined>;
  list(orgId: string): Promise<KeyRow[]>;
  update(id: string, patch: Partial<KeyRow>): Promise<void>;
}

export const dbKeyStore: KeyStore = {
  async insert(row) {
    await db.insert(schema.sellerApiKeys).values(row);
  },
  async byHash(hash) {
    const [r] = await db.select().from(schema.sellerApiKeys).where(eq(schema.sellerApiKeys.keyHash, hash));
    return r;
  },
  async byId(orgId, id) {
    const [r] = await db.select().from(schema.sellerApiKeys).where(and(eq(schema.sellerApiKeys.id, id), eq(schema.sellerApiKeys.orgId, orgId)));
    return r;
  },
  async list(orgId) {
    return db.select().from(schema.sellerApiKeys).where(eq(schema.sellerApiKeys.orgId, orgId)).orderBy(desc(schema.sellerApiKeys.createdAt));
  },
  async update(id, patch) {
    await db.update(schema.sellerApiKeys).set(patch).where(eq(schema.sellerApiKeys.id, id));
  },
};

/** In-memory store with the same behavior, for tests and local tooling. */
export function memoryKeyStore(): KeyStore & { rows: KeyRow[] } {
  const rows: KeyRow[] = [];
  return {
    rows,
    async insert(row) {
      if (rows.some((r) => r.keyHash === row.keyHash)) throw new Error("duplicate key hash");
      rows.push({ ...row });
    },
    async byHash(hash) {
      return rows.find((r) => r.keyHash === hash);
    },
    async byId(orgId, id) {
      return rows.find((r) => r.id === id && r.orgId === orgId);
    },
    async list(orgId) {
      return rows.filter((r) => r.orgId === orgId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
  };
}

/* ---------------------------------------------------------------- management (dashboard) */

export async function listKeys(store: KeyStore, orgId: string, now = new Date()) {
  return (await store.list(orgId)).map((r) => keyView(r, now));
}

async function insertKey(store: KeyStore, base: { orgId: string; name: string; env: KeyEnv; scopes: Scope[]; createdBy: string | null }, now: Date) {
  const k = generateKey(base.env);
  const row: KeyRow = { id: newId("key"), orgId: base.orgId, name: base.name, env: base.env, keyHash: k.hash, prefix: k.prefix, last4: k.last4, scopes: base.scopes, createdBy: base.createdBy, createdAt: now, lastUsedAt: null, expiresAt: null, revokedAt: null, replacedBy: null };
  await store.insert(row);
  return { row, secret: k.key };
}

/** Creates a key. `secret` is the full key: return it to the caller once and never store or log it. */
export async function createKey(store: KeyStore, input: { orgId: string; name: unknown; scopes: unknown; env: KeyEnv; createdBy?: string | null }, now = new Date()) {
  const name = parseName(input.name);
  const scopes = parseScopes(input.scopes);
  const live = (await store.list(input.orgId)).filter((r) => keyState(r, now) === "active" || keyState(r, now) === "expiring");
  if (live.length >= MAX_ACTIVE_KEYS) throw new HttpError(409, `You have ${MAX_ACTIVE_KEYS} working keys. Revoke one you no longer use first.`);
  const { row, secret } = await insertKey(store, { orgId: input.orgId, name, env: input.env, scopes, createdBy: input.createdBy ?? null }, now);
  return { key: keyView(row, now), secret };
}

/**
 * Replaces a key with a new one (same name, environment and permissions). With `overlapHours` > 0 the old key keeps
 * working until then; with 0 it stops at once.
 */
export async function regenerateKey(store: KeyStore, orgId: string, id: string, opts: { overlapHours?: unknown; createdBy?: string | null }, now = new Date()) {
  const old = await store.byId(orgId, id);
  if (!old) throw new HttpError(404, "key not found");
  const state = keyState(old, now);
  if (state === "revoked" || state === "expired") throw new HttpError(409, "This key no longer works, so there is nothing to regenerate. Create a new key instead.");
  if (old.replacedBy) throw new HttpError(409, "This key was already regenerated. Regenerate its replacement instead.");
  const overlap = parseOverlap(opts.overlapHours);
  const { row, secret } = await insertKey(store, { orgId, name: old.name, env: old.env as KeyEnv, scopes: normalizeScopes(old.scopes), createdBy: opts.createdBy ?? null }, now);
  const patch: Partial<KeyRow> = overlap > 0 ? { expiresAt: new Date(now.getTime() + overlap * 3600_000), replacedBy: row.id } : { revokedAt: now, replacedBy: row.id };
  await store.update(old.id, patch);
  return { key: keyView(row, now), secret, previous: keyView({ ...old, ...patch }, now) };
}

/** Revokes a key immediately, including an old key still inside its overlap window. */
export async function revokeKey(store: KeyStore, orgId: string, id: string, now = new Date()) {
  const row = await store.byId(orgId, id);
  if (!row) throw new HttpError(404, "key not found");
  if (keyState(row, now) === "revoked") return keyView(row, now);
  await store.update(row.id, { revokedAt: now });
  return keyView({ ...row, revokedAt: now }, now);
}

/* ---------------------------------------------------------------- authentication (seller API) */

export interface ApiKeyPrincipal {
  keyId: string;
  orgId: string;
  name: string;
  env: KeyEnv;
  scopes: Scope[];
}

const constantTimeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Resolves the bearer key on a request. Throws 401 for a missing, malformed, unknown, revoked or expired key and for a
 * key from the other environment; records `lastUsedAt` on success.
 */
export async function authenticateKey(store: KeyStore, authorization: string | undefined, network: Network, now = new Date()): Promise<ApiKeyPrincipal> {
  const presented = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!presented) throw new HttpError(401, "Send your seller API key as Authorization: Bearer psk_live_… (or psk_test_… on testnet).");
  const env = keyEnvOf(presented);
  if (!env) throw new HttpError(401, "That is not a seller API key. Keys start with psk_live_ or psk_test_.");
  const expected = envForNetwork(network);
  if (env !== expected) {
    throw new HttpError(401, env === "test" ? "This is a test key. It only works with the Arc testnet API and testnet data; use a live key here." : "This is a live key. It only works with the Arc mainnet API and mainnet data; use a test key here.");
  }
  const hash = hashKey(presented);
  const row = await store.byHash(hash);
  if (!row || !constantTimeEqual(row.keyHash, hash) || row.env !== env) throw new HttpError(401, "Unknown API key. It may have been deleted, or copied incompletely.");
  const state = keyState(row, now);
  if (state === "revoked") throw new HttpError(401, "This API key was revoked.");
  if (state === "expired") throw new HttpError(401, "This API key was replaced and its overlap window has ended. Use the new key.");
  await store.update(row.id, { lastUsedAt: now });
  return { keyId: row.id, orgId: row.orgId, name: row.name, env, scopes: normalizeScopes(row.scopes) };
}

export function assertScope(p: ApiKeyPrincipal, scope: Scope) {
  if (!p.scopes.includes(scope)) throw new HttpError(403, `This key does not have the ${scope} permission (${SCOPE_INFO[scope].label.toLowerCase()}). Add it by creating a key with that permission.`, { required: scope, granted: p.scopes });
}

/** Hono middleware: authenticates the seller API key and, when given, enforces one scope. */
export function apiKeyAuth(opts: { store: KeyStore; network: () => Network; scope?: Scope; now?: () => Date }): MiddlewareHandler {
  return async (c, next) => {
    const p = (c.get("apiKey") as ApiKeyPrincipal | undefined) ?? (await authenticateKey(opts.store, c.req.header("authorization"), opts.network(), opts.now?.() ?? new Date()));
    c.set("apiKey", p);
    if (opts.scope) assertScope(p, opts.scope);
    await next();
  };
}

export const apiKeyOf = (c: Context) => c.get("apiKey") as ApiKeyPrincipal;
