import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * Per-seller encryption at rest for buyer and pricing data: chat turns, order details, private pricing basis and agent
 * notes. Each seller has its own random AES-256 key, stored wrapped by the platform key (crypto.ts). The org id is bound
 * as associated data, so a value cannot be moved to another seller's rows and still decrypt.
 *
 * Values written before this existed are plaintext and are returned unchanged, so old rows keep working.
 */
const PREFIX = "pv2:";
const cache = new Map<string, Buffer>();

async function dataKey(orgId: string): Promise<Buffer> {
  const hit = cache.get(orgId);
  if (hit) return hit;
  const [o] = await db.select({ k: schema.orgs.dataKeyEnc }).from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!o) throw new Error("unknown org for data key");
  let wrapped = o.k;
  if (!wrapped) {
    // Set only if still empty, then re-read: two first writes at once agree on a single key.
    await db.update(schema.orgs).set({ dataKeyEnc: encryptSecret(randomBytes(32).toString("base64")) }).where(and(eq(schema.orgs.id, orgId), isNull(schema.orgs.dataKeyEnc)));
    const [again] = await db.select({ k: schema.orgs.dataKeyEnc }).from(schema.orgs).where(eq(schema.orgs.id, orgId));
    wrapped = again!.k!;
  }
  const key = Buffer.from(decryptSecret(wrapped), "base64");
  cache.set(orgId, key);
  return key;
}

export async function sealText(orgId: string, plain: string): Promise<string> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", await dataKey(orgId), iv);
  c.setAAD(Buffer.from(orgId));
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export async function openText(orgId: string, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const d = createDecipheriv("aes-256-gcm", await dataKey(orgId), raw.subarray(0, 12));
  d.setAAD(Buffer.from(orgId));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/** jsonb columns hold { $sealed: "pv2:..." }. */
export async function sealJson(orgId: string, value: unknown): Promise<{ $sealed: string }> {
  return { $sealed: await sealText(orgId, JSON.stringify(value)) };
}

export async function openJson<T = unknown>(orgId: string, stored: unknown): Promise<T> {
  if (stored && typeof stored === "object" && typeof (stored as { $sealed?: unknown }).$sealed === "string") return JSON.parse(await openText(orgId, (stored as { $sealed: string }).$sealed)) as T;
  return stored as T;
}
