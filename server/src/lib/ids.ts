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

/** Random uint256-ish deal id (128 bits of entropy) for the onchain deal key. */
export function randomDealId(): bigint {
  return BigInt("0x" + randomBytes(16).toString("hex"));
}

export function apiKey(): { key: string; hash: string } {
  const key = "pk_live_" + randomBytes(24).toString("base64url");
  return { key, hash: sha256(key) };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
