/**
 * Outbound requests to addresses a seller or buyer typed: webhooks and the website importer. Only public https hosts
 * on the default port are reached. For the importer the private-address check runs inside the socket's own DNS lookup,
 * so the address that is checked is the address that is connected to (no gap for a rebinding DNS answer), and every
 * redirect hop is checked again.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";

/** Loopback, private, link-local, carrier-grade NAT, documentation, benchmark, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b, c] = v4.split(".").map(Number) as [number, number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("ff") || x.startsWith("2001:db8") || x.startsWith("64:ff9b");
}

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** Parses and checks a URL before any request: https, no credentials, default port, not a private IP literal. */
export function checkPublicHttpsUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BlockedUrlError("not a valid URL");
  }
  if (u.protocol !== "https:") throw new BlockedUrlError("only https addresses can be read");
  if (u.username || u.password) throw new BlockedUrlError("the address must not contain a user name or password");
  if (u.port && u.port !== "443") throw new BlockedUrlError("only the standard https port is allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !isIP(host)) throw new BlockedUrlError("the address needs a public domain name");
  if (isIP(host) && isPrivateAddress(host)) throw new BlockedUrlError("that address is private or internal");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new BlockedUrlError("that address is private or internal");
  return u;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** dns.lookup that refuses a host when any of its addresses is private. Used as the socket's own lookup. */
export function guardedLookup(hostname: string, options: { all?: boolean; family?: number } | number, callback: LookupCallback) {
  const opts = typeof options === "number" ? { family: options } : options ?? {};
  dnsLookup(hostname, { family: opts.family, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (!list.length) return callback(Object.assign(new Error(`${hostname} does not resolve`), { code: "ENOTFOUND" }), "");
    if (list.some((a) => isPrivateAddress(a.address))) return callback(Object.assign(new BlockedUrlError(`${hostname} resolves to a private or internal address`), { code: "EBLOCKED" }), "");
    if (opts.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

export interface SafeResponse {
  /** The final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  /** True when the body was cut at maxBytes. */
  truncated: boolean;
}

export interface SafeFetchOptions {
  /** Decompressed bytes kept; the rest is not read. Default 2 MB. */
  maxBytes?: number;
  /** Whole request including redirects. Default 12 s. */
  timeoutMs?: number;
  maxRedirects?: number;
  accept?: string;
  userAgent?: string;
  /** Extra request headers (for a JSON API such as Firecrawl or an FX reference). */
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
}

export const IMPORTER_USER_AGENT = "ProteusAI-Importer/1.0 (+https://ai.proteus.co.in/docs/quickstart-seller)";

/**
 * GET (or POST) a public https URL. Refuses private targets at every hop, follows at most `maxRedirects` redirects,
 * caps the body and the time, and never throws for an HTTP status: callers read `status`.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const deadline = Date.now() + (opts.timeoutMs ?? 12_000);
  let url = checkPublicHttpsUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await requestOnce(url, opts, maxBytes, Math.max(1, deadline - Date.now()));
    if (res.redirect) {
      if (hop >= (opts.maxRedirects ?? 4)) throw new BlockedUrlError("too many redirects");
      url = checkPublicHttpsUrl(new URL(res.redirect, url).toString());
      continue;
    }
    return { url: url.toString(), status: res.status, contentType: res.contentType, body: res.body, truncated: res.truncated };
  }
}

function requestOnce(url: URL, opts: SafeFetchOptions, maxBytes: number, timeoutMs: number): Promise<{ status: number; contentType: string; body: string; truncated: boolean; redirect?: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: opts.method ?? "GET",
        lookup: guardedLookup as never,
        headers: {
          "user-agent": opts.userAgent ?? IMPORTER_USER_AGENT,
          accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
          ...(opts.headers ?? {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          resolve({ status, contentType: "", body: "", truncated: false, redirect: location });
          return;
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(createGunzip());
        else if (enc === "deflate") stream = res.pipe(createInflate());
        else if (enc === "br") stream = res.pipe(createBrotliDecompress());
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const finish = () => resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks).toString("utf8"), truncated });
        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          const room = maxBytes - size;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            size = maxBytes;
            truncated = true;
            req.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () => !truncated && finish());
        stream.on("error", (e) => (truncated ? undefined : reject(e)));
      },
    );
    req.on("timeout", () => req.destroy(new Error("the site did not answer in time")));
    req.on("error", (e) => reject(e));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
