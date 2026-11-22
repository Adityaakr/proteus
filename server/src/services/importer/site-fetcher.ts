/**
 * One seller site, read politely: same site only (the host and its www twin), robots.txt honoured, a pause between
 * requests, a hard request budget, and every response capped. The raw fetch is injected so tests run offline; in
 * production it is net-guard's safeFetch (https only, no private targets at any hop).
 */
import { BlockedUrlError, type SafeFetchOptions, type SafeResponse } from "../../lib/net-guard";
import { ALLOW_ALL, DENY_ALL, parseRobots, type Robots } from "./robots";
import { LIMITS, type SourceReport } from "./types";

export type RawFetch = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

export class SiteFetcher {
  origin: URL;
  robots: Robots = ALLOW_ALL;
  requests = 0;
  /** Paths robots.txt kept us from, for the report. */
  disallowed = 0;
  private last = 0;

  constructor(
    origin: URL,
    private raw: RawFetch,
    private opts: { delayMs?: number; totalRequests?: number } = {},
  ) {
    this.origin = new URL(origin.origin);
  }

  get budgetLeft() {
    return (this.opts.totalRequests ?? LIMITS.totalRequests) - this.requests;
  }

  sameSite(u: URL) {
    return bare(u.hostname) === bare(this.origin.hostname);
  }

  /** Reads robots.txt. A missing file allows everything; an unreachable one or a 5xx allows nothing. */
  async loadRobots(): Promise<SourceReport> {
    try {
      const r = await this.fetchRaw(new URL("/robots.txt", this.origin).toString(), { accept: "text/plain,*/*;q=0.5", maxBytes: 512 * 1024 });
      const final = new URL(r.url);
      if (this.sameSite(final)) this.origin = new URL(final.origin);
      if (r.status >= 500) {
        this.robots = DENY_ALL;
        return { source: "robots", status: "blocked", detail: `robots.txt answered HTTP ${r.status}, so nothing is read` };
      }
      if (r.status >= 400) return { source: "robots", status: "not-found", detail: "no robots.txt, every page may be read" };
      this.robots = parseRobots(r.body);
      return { source: "robots", status: "used", detail: `robots.txt read${this.robots.sitemaps.length ? `, ${this.robots.sitemaps.length} sitemap${this.robots.sitemaps.length > 1 ? "s" : ""} listed` : ""}` };
    } catch (e) {
      if (e instanceof BlockedUrlError) throw e;
      this.robots = DENY_ALL;
      return { source: "robots", status: "blocked", detail: `robots.txt could not be loaded (${(e as Error).message}), so nothing is read` };
    }
  }

  /**
   * GET a page of this site. Null when it is on another site, robots.txt disallows it, or the request budget is spent;
   * the reason is in `why`.
   */
  async get(target: string, opts: SafeFetchOptions = {}): Promise<{ res: SafeResponse | null; why?: string }> {
    let u: URL;
    try {
      u = new URL(target, this.origin);
    } catch {
      return { res: null, why: "not a URL" };
    }
    if (!this.sameSite(u)) return { res: null, why: "another site" };
    if (!this.robots.allowed(u.pathname + u.search)) {
      this.disallowed++;
      return { res: null, why: "disallowed by robots.txt" };
    }
    if (this.budgetLeft <= 0) return { res: null, why: "request limit reached" };
    try {
      const res = await this.fetchRaw(u.toString(), opts);
      // A redirect may leave the site (a CDN or a login page); its body is not used.
      if (!this.sameSite(new URL(res.url))) return { res: null, why: "redirected to another site" };
      return { res };
    } catch (e) {
      return { res: null, why: (e as Error).message.slice(0, 120) };
    }
  }

  /**
   * GET an asset (an image) for this site: it may live on another public https host such as a CDN. On this site
   * robots.txt applies; every host passes the raw fetch's own guard. Null when refused or unreachable.
   */
  async asset(target: string, opts: SafeFetchOptions = {}): Promise<SafeResponse | null> {
    let u: URL;
    try {
      u = new URL(target, this.origin);
    } catch {
      return null;
    }
    if (u.protocol !== "https:") return null;
    if (this.sameSite(u) && !this.robots.allowed(u.pathname + u.search)) {
      this.disallowed++;
      return null;
    }
    if (this.budgetLeft <= 0) return null;
    try {
      return await this.fetchRaw(u.toString(), opts);
    } catch {
      return null;
    }
  }

  private async fetchRaw(url: string, opts: SafeFetchOptions) {
    const wait = (this.opts.delayMs ?? LIMITS.delayMs) - (Date.now() - this.last);
    if (wait > 0 && this.requests > 0) await new Promise((r) => setTimeout(r, wait));
    this.requests++;
    try {
      return await this.raw(url, { maxBytes: LIMITS.bytesPerResponse, timeoutMs: 12_000, ...opts });
    } finally {
      this.last = Date.now();
    }
  }
}
