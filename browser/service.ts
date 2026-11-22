/**
 * The importer's browser as its own service. It holds no application secrets, only BROWSER_TOKEN. The API connects
 * with Chrome DevTools at ws://<host>:<port>/?token=<BROWSER_TOKEN>. Each accepted connection gets a fresh headless
 * Chromium (its own profile) and its own egress proxy from the API (server/src/services/importer/egress-proxy.ts). That
 * proxy allows https on port 443 only, checks the resolved address, refuses private, loopback, link-local and
 * *.internal (so *.railway.internal) targets, and keeps a byte budget for the read. Loopback is forced through it too.
 * When the connection closes, the browser and its proxy are stopped. The API keeps applying its own per-request rules
 * (robots.txt, blocked resource types, WebSockets) over the DevTools connection.
 */
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Duplex } from "node:stream";
import { startEgressProxy, type EgressProxy } from "../server/src/services/importer/egress-proxy";

/** A running browser: its DevTools WebSocket URL on loopback, and how to stop it. */
export interface LaunchedBrowser {
  wsUrl: string;
  close(): Promise<void>;
}

/** Starts a browser whose every connection goes through proxyUrl. */
export type Launcher = (proxyUrl: string) => Promise<LaunchedBrowser>;

export interface BrowserServiceOptions {
  token: string;
  port: number;
  host?: string;
  /** Browsers at once; more connections get 503. */
  maxOpen?: number;
  /** Bytes per read through the egress proxy. */
  maxBytes?: number;
  launch?: Launcher;
}

export interface BrowserService {
  port: number;
  close(): Promise<void>;
}

function tokenOf(req: IncomingMessage): string | null {
  try {
    return new URL(req.url ?? "/", "http://x").searchParams.get("token");
  } catch {
    return null;
  }
}

function sameToken(given: string | null, want: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function refuse(socket: Duplex, status: string) {
  socket.end(`HTTP/1.1 ${status}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`);
}

/** Headless Chromium with the sandbox on (BROWSER_SANDBOX=off turns it off where the platform has no user namespaces). */
export function chromiumLauncher(executable = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", sandbox = process.env.BROWSER_SANDBOX !== "off"): Launcher {
  return (proxyUrl) =>
    new Promise((resolve, reject) => {
      const profile = mkdtempSync(join(tmpdir(), "importer-browser-"));
      const child = spawn(executable, [
        "--headless",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        `--proxy-server=${proxyUrl}`,
        "--proxy-bypass-list=<-loopback>",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--no-pings",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-features=DnsOverHttps,WebRtcHideLocalIpsWithMdns",
        ...(sandbox ? [] : ["--no-sandbox"]),
        "about:blank",
      ], { stdio: ["ignore", "ignore", "pipe"] });
      const stop = () =>
        new Promise<void>((done) => {
          if (child.exitCode !== null) return done();
          child.once("exit", () => done());
          child.kill("SIGKILL");
        }).finally(() => rmSync(profile, { recursive: true, force: true }));
      let err = "";
      const timer = setTimeout(() => {
        void stop();
        reject(new Error("the browser did not start in time"));
      }, 20_000);
      child.stderr.on("data", (b: Buffer) => {
        err += b.toString();
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
        if (m) {
          clearTimeout(timer);
          resolve({ wsUrl: m[1]!, close: stop });
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        rmSync(profile, { recursive: true, force: true });
        reject(new Error(`the browser exited (${code}): ${err.slice(-300)}`));
      });
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
}

export async function startBrowserService(opts: BrowserServiceOptions): Promise<BrowserService> {
  if (opts.token.length < 24) throw new Error("BROWSER_TOKEN must be at least 24 characters");
  const launch = opts.launch ?? chromiumLauncher();
  const maxOpen = opts.maxOpen ?? 2;
  let open = 0;

  const server: Server = createServer((_req, res) => {
    res.writeHead(404).end();
  });

  server.on("upgrade", async (req: IncomingMessage, client: Duplex, head: Buffer) => {
    if (!sameToken(tokenOf(req), opts.token)) return refuse(client, "401 Unauthorized");
    if (open >= maxOpen) return refuse(client, "503 Service Unavailable");
    open++;
    let proxy: EgressProxy | undefined;
    let browser: LaunchedBrowser | undefined;
    let ended = false;
    const end = async () => {
      if (ended) return;
      ended = true;
      client.destroy();
      await browser?.close().catch(() => undefined);
      await proxy?.close().catch(() => undefined);
      open--;
    };
    client.on("error", () => void end());
    client.on("close", () => void end());
    try {
      proxy = await startEgressProxy({ maxBytes: opts.maxBytes ?? 40 * 1024 * 1024 });
      browser = await launch(proxy.url);
    } catch {
      if (!client.destroyed) refuse(client, "502 Bad Gateway");
      return end();
    }
    if (ended) return end();
    const target = new URL(browser.wsUrl);
    const upstream = connect(Number(target.port), target.hostname);
    upstream.on("error", () => void end());
    upstream.on("close", () => void end());
    upstream.once("connect", () => {
      const lines = [`GET ${target.pathname} HTTP/1.1`, `host: ${target.host}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const k = req.rawHeaders[i]!.toLowerCase();
        if (k === "host" || k === "origin") continue;
        lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }
      upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.host ?? "::", () => resolve());
  });
  const addr = server.address();
  return {
    port: typeof addr === "object" && addr ? addr.port : opts.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
