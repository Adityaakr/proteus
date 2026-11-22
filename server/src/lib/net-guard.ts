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

function privateV4(a: number, b: number, c: number): boolean {
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

/** The eight 16-bit groups of an IPv6 address (any spelling, including a dotted IPv4 tail), or null. */
function hextets(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail) {
    if (isIP(tail[1]!) !== 4) return null;
    const [a, b, c, d] = tail[1]!.split(".").map(Number) as [number, number, number, number];
    s = `${s.slice(0, -tail[1]!.length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...rest];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** Loopback, private, link-local, carrier-grade NAT, documentation, benchmark, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number) as [number, number, number];
    return privateV4(a, b, c);
  }
  const g = hextets(ip);
  if (!g) return true;
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d, which also covers :: and ::1), in any spelling.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return privateV4(g[6]! >> 8, g[6]! & 0xff, g[7]! >> 8);
  // 6to4 (2002:AABB:CCDD::) carries an IPv4 address too.
  if (g[0] === 0x2002) return privateV4(g[1]! >> 8, g[1]! & 0xff, g[2]! >> 8);
  return (
    (g[0]! & 0xfe00) === 0xfc00 ||
    (g[0]! & 0xff80) === 0xfe80 ||
    g[0]! >= 0xff00 ||
    (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) ||
    (g[0] === 0x64 && g[1] === 0xff9b)
  );
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
  /** The raw body, when the request asked for bytes (body is then empty). */
  bytes?: Buffer;
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
  /** Keep the body as bytes (an image) instead of decoding it as UTF-8 text. */
  bytes?: boolean;
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
    return { url: url.toString(), status: res.status, contentType: res.contentType, body: res.body, truncated: res.truncated, ...(res.bytes ? { bytes: res.bytes } : {}) };
  }
}

function requestOnce(url: URL, opts: SafeFetchOptions, maxBytes: number, timeoutMs: number): Promise<{ status: number; contentType: string; body: string; truncated: boolean; bytes?: Buffer; redirect?: string }> {
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
        const finish = () => {
          const raw = Buffer.concat(chunks);
          resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: opts.bytes ? "" : raw.toString("utf8"), ...(opts.bytes ? { bytes: raw } : {}), truncated });
        };
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
