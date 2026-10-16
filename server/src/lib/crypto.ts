import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env";

/** AES-256-GCM with a key derived from KEY_ENCRYPTION_SECRET (falls back to SESSION_SECRET in dev). */
function key(): Buffer {
  return createHash("sha256").update(env.KEY_ENCRYPTION_SECRET ?? env.SESSION_SECRET).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(blob: string): string {
  const [v, ivB, tagB, encB] = blob.split(".");
  if (v !== "v1" || !ivB || !tagB || !encB) throw new Error("bad secret blob");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([d.update(Buffer.from(encB, "base64url")), d.final()]).toString("utf8");
}
