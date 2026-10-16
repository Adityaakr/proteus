import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function id(prefix: string, bytes = 12): string {
  const buf = randomBytes(bytes);
  let out = "";
  for (const b of buf) out += ALPHABET[b % 36];
  return `${prefix}_${out}`;
}

/** Unguessable public id for buyer/review links. */
export function publicId(prefix: string): string {
  return id(prefix, 16);
}

/** Random onchain deal id: 62 bits of entropy so it fits a Postgres int8 while staying unguessable. */
export function randomDealId(): bigint {
  return BigInt("0x" + randomBytes(8).toString("hex")) & ((1n << 62n) - 1n);
}

export function apiKey(): { key: string; hash: string } {
  const key = "pk_live_" + randomBytes(24).toString("base64url");
  return { key, hash: sha256(key) };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
