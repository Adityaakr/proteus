/**
 * The only way out of the importer's local browser. Chromium is launched with this proxy and with loopback forced
 * through it, so every connection a seller's page makes (documents, scripts, XHR, WebSockets, preconnects) arrives
 * here as a CONNECT for host:443. Each one is checked like net-guard's safeFetch: https port only, no private or
 * loopback address at the resolved IP (resolution happens here and the socket connects to the checked address, so
 * DNS rebinding cannot swap it), and a byte budget for the whole read. Plain-http requests are refused.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { connect, isIP, type Socket } from "node:net";
import type { Duplex } from "node:stream";
import { guardedLookup, isPrivateAddress } from "../../lib/net-guard";

export interface EgressProxy {
  /** http://127.0.0.1:<port> */
  url: string;
  stats: { tunnels: number; refused: number; bytes: number; overBudget: boolean };
  close(): Promise<void>;
}

export interface EgressOptions {
  /** Bytes in both directions across all tunnels before every tunnel is cut. */
  maxBytes: number;
  /** Tunnels open at once. */
  maxOpen?: number;
  /** Test hook: replaces the outbound connect (still called only for a host that passed the checks). */
  connectTo?: (host: string, port: number) => Socket;
}

const LOCAL_NAMES = /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback)$|\.(localhost|local|internal|home\.arpa)$/i;

/** host:port of a CONNECT target, or null when it is not one the browser may reach. */
export function allowedTarget(authority: string): { host: string; port: number } | null {
  const m = /^\[?([^\]]+?)\]?:(\d{1,5})$/.exec(authority.trim());
  if (!m) return null;
  const host = m[1]!.toLowerCase();
  const port = Number(m[2]);
  if (port !== 443) return null;
  if (LOCAL_NAMES.test(host)) return null;
  if (isIP(host) && isPrivateAddress(host)) return null;
  if (!isIP(host) && !/^[a-z0-9.-]+$/.test(host)) return null;
  return { host, port };
}

export async function startEgressProxy(opts: EgressOptions): Promise<EgressProxy> {
  const stats = { tunnels: 0, refused: 0, bytes: 0, overBudget: false };
  const open = new Set<Duplex>();
  const maxOpen = opts.maxOpen ?? 48;

  const cutAll = () => {
    stats.overBudget = true;
    for (const s of open) s.destroy();
  };

  const server: Server = createServer((_req, res) => {
    // Plain http (or a proxied GET for any URL): never.
    stats.refused++;
    res.writeHead(403, { "content-type": "text/plain" }).end("only https is allowed");
  });

  server.on("connect", (req: IncomingMessage, client: Duplex, head: Buffer) => {
    const target = allowedTarget(req.url ?? "");
    if (!target || stats.overBudget || open.size >= maxOpen) {
      stats.refused++;
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const upstream: Socket = opts.connectTo ? opts.connectTo(target.host, target.port) : connect({ host: target.host, port: target.port, lookup: guardedLookup as never, timeout: 15_000 });
    open.add(client);
    open.add(upstream);
    const count = (n: number) => {
      stats.bytes += n;
      if (stats.bytes > opts.maxBytes) cutAll();
    };
    const done = () => {
      open.delete(client);
      open.delete(upstream);
      client.destroy();
      upstream.destroy();
    };
    let connected = false;
    upstream.once("connect", () => {
      connected = true;
      stats.tunnels++;
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.on("data", (b: Buffer) => {
        count(b.length);
        upstream.write(b);
      });
      upstream.on("data", (b: Buffer) => {
        count(b.length);
        client.write(b);
      });
    });
    upstream.on("timeout", done);
    upstream.on("error", () => {
      // A refused lookup (private address) or an unreachable host.
      if (!connected) {
        stats.refused++;
        if (!client.destroyed) client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      }
      done();
    });
    upstream.on("close", done);
    client.on("error", done);
    client.on("close", done);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    stats,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of open) s.destroy();
        server.close(() => resolve());
      }),
  };
}
