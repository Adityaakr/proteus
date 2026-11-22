/**
 * A real browser for sites whose catalog only appears after JavaScript runs (React, Vue, Wix, Framer, Webflow and
 * hand-built single-page apps). Two engines, no account needed for the first:
 *
 * - local: headless Chromium on this server through playwright-core. Every connection goes through the importer's
 *   egress proxy (https port 443 only, no private or loopback address, a byte budget), loopback is forced through the
 *   proxy too, WebSockets and service workers are blocked, images/fonts/media are not loaded, and robots.txt is
 *   checked for every page and data request to the seller's site.
 * - cloud: any Chrome DevTools endpoint set in BROWSER_CDP_URL (Browserless, Browserbase, Steel or your own). The
 *   browser then runs on that provider's network, so the egress proxy is not needed; the other rules still apply.
 *
 * The browser only reads: it scrolls, presses "load more" and opens the site's own shop buttons; it never fills in
 * a form, signs in or buys anything.
 */
import { existsSync } from "node:fs";
import type { Browser, BrowserContext, Page, Route } from "playwright-core";
import { env } from "../../env";
import { DOM_SCRIPT, type DomReport } from "./dom-script";
import { allowedTarget, startEgressProxy, type EgressProxy } from "./egress-proxy";
import { LIMITS } from "./types";

export interface RenderRules {
  /** May the browser load this URL as a page or a data request? (robots.txt for the seller's site) */
  allowed(u: URL): boolean;
  /** Is this URL on the seller's site? */
  sameSite(u: URL): boolean;
}

export interface RenderOptions {
  scroll?: boolean;
  loadMore?: boolean;
  /** Press the page's shop / catalogue buttons that are not links and note where they lead. */
  tryShopButtons?: boolean;
}

export type RenderResult =
  | { ok: true; status: number; page: DomReport; /** Pages a shop button opened on this site. */ routes: string[]; /** Other sites a button or link tried to open. */ popups: string[] }
  | { ok: false; why: string };

export interface RenderSession {
  render(url: string, opts?: RenderOptions): Promise<RenderResult>;
  close(): Promise<void>;
  stats(): { pages: number; requests: number; blocked: number; bytes?: number; overBudget?: boolean };
}

export interface PageRenderer {
  readonly name: string;
  readonly kind: "local" | "cloud";
  open(rules: RenderRules): Promise<RenderSession>;
}

export const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 ProteusAI-Importer/1.0 (+https://ai.proteus.co.in/docs/quickstart-seller)";

/** Requests the browser never makes: they are heavy and carry no catalog text. */
const SKIP_TYPES = new Set(["image", "media", "font", "manifest", "texttrack", "beacon", "ping", "csp_report"]);
/** Analytics and ad beacons: never needed to read a catalog, and they keep a page from going quiet. */
const TRACKERS = /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|facebook\.net|hotjar\.com|clarity\.ms|segment\.(io|com)|mixpanel\.com|amplitude\.com|sentry\.io|nr-data\.net|newrelic\.com|analytics\.tiktok\.com|bat\.bing\.com|frog\.wix\.com|panorama\.wixapps\.net|fullstory\.com|intercom\.io|crisp\.chat|tawk\.to|onesignal\.com)$/i;
/** Requests that read the seller's site and so follow its robots.txt. */
const READS = new Set(["document", "xhr", "fetch", "eventsource"]);

/** The Debian package the Railway image installs (railpack.json); used without configuration when present. */
export const SYSTEM_CHROMIUM = "/usr/bin/chromium";

/** BROWSER_EXECUTABLE_PATH when set, else the system Chromium when installed, else undefined (Playwright's own). */
export function pickExecutable(configured: string | undefined, exists: (path: string) => boolean): string | undefined {
  return configured ?? (exists(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined);
}

const SYSTEM_BROWSERS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

/* At most two browsers at once on one server; a third import waits for a free one. */
let running = 0;
const waiting: (() => void)[] = [];
async function slot(): Promise<() => void> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r));
  running++;
  let freed = false;
  return () => {
    if (freed) return;
    freed = true;
    running--;
    waiting.shift()?.();
  };
}

async function playwright() {
  return (await import("playwright-core")).chromium;
}

async function launchLocal(proxy: EgressProxy): Promise<Browser> {
  const chromium = await playwright();
  const base = {
    headless: true,
    timeout: 30_000,
    // Playwright also forces loopback through the proxy ("<-loopback>"), so localhost cannot be reached around it.
    proxy: { server: proxy.url },
    args: ["--disable-dev-shm-usage", "--disable-background-networking", "--no-pings", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--webrtc-ip-handling-policy=disable_non_proxied_udp", "--disable-features=DnsOverHttps,WebRtcHideLocalIpsWithMdns"],
  };
  // BROWSER_EXECUTABLE_PATH, else /usr/bin/chromium (the production image); else Playwright's own download
  // (`npx playwright install chromium`), else any system Chrome.
  const chosen = pickExecutable(env.BROWSER_EXECUTABLE_PATH, existsSync);
  const tries: (string | undefined)[] = chosen ? [chosen] : [undefined, ...SYSTEM_BROWSERS.filter((p) => existsSync(p))];
  let last: unknown;
  for (const executablePath of tries) {
    try {
      return await chromium.launch({ ...base, ...(executablePath ? { executablePath } : {}) });
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`no browser could be started on this server (${String((last as Error)?.message ?? last).split("\n")[0]!.slice(0, 160)})`);
}

async function guard(context: BrowserContext, rules: RenderRules, counters: { requests: number; blocked: number }, opened: { other: Set<string>; same: Set<string> }, mainPages: WeakSet<object>) {
  await context.route("**/*", async (route: Route) => {
    const req = route.request();
    let u: URL;
    try {
      u = new URL(req.url());
    } catch {
      counters.blocked++;
      return route.abort("blockedbyclient");
    }
    if (u.protocol === "data:" || u.protocol === "blob:") return route.fallback();
    const type = req.resourceType();
    const frame = req.frame();
    const isTop = req.isNavigationRequest() && frame.parentFrame() === null;
    // The page leaving the site, or a button opening a new tab: note where it leads, never load it.
    if (isTop && (!rules.sameSite(u) || !mainPages.has(frame.page()))) {
      (rules.sameSite(u) ? opened.same : opened.other).add(u.toString());
      counters.blocked++;
      return route.abort("blockedbyclient");
    }
    const block =
      u.protocol !== "https:" ||
      // Also refused by the egress proxy; checked here too so a cloud browser never asks for them.
      !allowedTarget(`${u.hostname}:${u.port || "443"}`) ||
      SKIP_TYPES.has(type) ||
      TRACKERS.test(u.hostname) ||
      counters.requests >= LIMITS.renderRequests ||
      (READS.has(type) && rules.sameSite(u) && !rules.allowed(u)) ||
      // Frames from other sites (video players, chat widgets, maps) carry no catalog.
      (type === "document" && !rules.sameSite(u) && !isTop);
    if (block) {
      counters.blocked++;
      return route.abort("blockedbyclient");
    }
    counters.requests++;
    // fallback, not continue: the request then goes to the network (or to a handler registered before this one).
    return route.fallback();
  });
  // WebSockets would reach a host without the per-request checks above.
  await context.routeWebSocket(/.*/, (ws) => ws.close());
}

/** Scrolls to the bottom (lazy grids and infinite scroll load as they come into view), at most 12 steps. */
async function scrollAll(page: Page) {
  let still = 0;
  for (let i = 0; i < 12 && still < 2; i++) {
    const atEnd = Boolean(await page.evaluate("(window.scrollBy(0, Math.round(window.innerHeight * 1.6)), window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4)").catch(() => true));
    await page.waitForTimeout(250);
    still = atEnd ? still + 1 : 0;
  }
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);
}

const MORE = /^\s*(load|show|view|see) more(\s+(products|items|results))?\s*$/i;

async function pressLoadMore(page: Page): Promise<number> {
  let pressed = 0;
  for (let i = 0; i < 4; i++) {
    const btn = page.locator("button, [role=button], a:not([href]), a[href='#']").filter({ hasText: MORE }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click({ timeout: 3_000 }).catch(() => undefined);
    pressed++;
    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
    await scrollAll(page);
  }
  return pressed;
}

async function report(page: Page): Promise<DomReport> {
  return (await page.evaluate(`${DOM_SCRIPT}(${JSON.stringify({ maxText: LIMITS.renderTextChars, maxHtml: LIMITS.bytesPerResponse })})`)) as DomReport;
}

/** A reading session on an open browser context (exported for tests, which serve fixture pages through a route). */
export function session(context: BrowserContext, rules: RenderRules, after: () => Promise<void>, proxy?: EgressProxy): RenderSession {
  const counters = { requests: 0, blocked: 0, pages: 0 };
  const opened = { other: new Set<string>(), same: new Set<string>() };
  const mainPages = new WeakSet<object>();
  let guarded: Promise<void> | undefined;
  const ready = () => (guarded ??= guard(context, rules, counters, opened, mainPages));
  return {
    async render(url, opts = {}) {
      await ready();
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return { ok: false, why: "not a URL" };
      }
      if (!rules.sameSite(u)) return { ok: false, why: "another site" };
      if (!rules.allowed(u)) return { ok: false, why: "disallowed by robots.txt" };
      if (proxy?.stats.overBudget) return { ok: false, why: "the download budget for this read is spent" };
      const page = await context.newPage();
      mainPages.add(page);
      opened.other.clear();
      opened.same.clear();
      counters.pages++;
      try {
        const res = await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: LIMITS.renderMs });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
        if (!rules.sameSite(new URL(page.url()))) return { ok: false, why: "redirected to another site" };
        if (opts.scroll) await scrollAll(page);
        if (opts.loadMore) await pressLoadMore(page);
        const first = await report(page);
        const routes: string[] = [];
        if (opts.tryShopButtons) {
          for (const label of first.shopButtons.slice(0, 3)) {
            const btn = page.getByRole("button", { name: label, exact: true }).first();
            if (!(await btn.isVisible().catch(() => false))) continue;
            const before = page.url();
            await btn.click({ timeout: 3_000 }).catch(() => undefined);
            await page.waitForTimeout(1_200);
            const now = page.url();
            if (now !== before) {
              routes.push(now);
              await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: LIMITS.renderMs }).catch(() => undefined);
              await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
            }
          }
        }
        return { ok: true, status: res?.status() ?? 0, page: first, routes: [...new Set([...routes, ...opened.same])].filter((r) => r !== u.toString()), popups: [...opened.other] };
      } catch (e) {
        const msg = String((e as Error).message ?? e).split("\n")[0]!;
        return { ok: false, why: /ERR_BLOCKED_BY_CLIENT/.test(msg) ? "blocked: the page tried to leave the site" : /Timeout/i.test(msg) ? "the page did not finish loading in time" : msg.slice(0, 140) };
      } finally {
        await page.close().catch(() => undefined);
      }
    },
    async close() {
      await context.close().catch(() => undefined);
      await after();
    },
    stats: () => ({ pages: counters.pages, requests: counters.requests, blocked: counters.blocked + (proxy?.stats.refused ?? 0), ...(proxy ? { bytes: proxy.stats.bytes, overBudget: proxy.stats.overBudget } : {}) }),
  };
}

/** Headless Chromium on this server, or undefined when the importer's browser is switched off. */
export function localBrowser(): PageRenderer | undefined {
  if (env.IMPORTER_BROWSER === "off") return undefined;
  return {
    name: "headless Chromium on this server",
    kind: "local",
    async open(rules) {
      const free = await slot();
      let proxy: EgressProxy | undefined;
      try {
        proxy = await startEgressProxy({ maxBytes: LIMITS.renderBytes });
        const browser = await launchLocal(proxy);
        const context = await browser.newContext({ userAgent: BROWSER_USER_AGENT, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", acceptDownloads: false, locale: "en-US" });
        const p = proxy;
        return session(context, rules, async () => {
          await browser.close().catch(() => undefined);
          await p.close();
          free();
        }, proxy);
      } catch (e) {
        await proxy?.close();
        free();
        throw e;
      }
    },
  };
}

/** A cloud browser at BROWSER_CDP_URL (a wss:// Chrome DevTools endpoint that carries its own key). */
export function cloudBrowser(): PageRenderer | undefined {
  const endpoint = env.BROWSER_CDP_URL;
  if (!endpoint || env.IMPORTER_BROWSER === "off") return undefined;
  let host = "cloud browser";
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return undefined;
  }
  return {
    name: `cloud browser (${host})`,
    kind: "cloud",
    async open(rules) {
      const free = await slot();
      try {
        const browser = await (await playwright()).connectOverCDP(endpoint, { timeout: 30_000 });
        const context = browser.contexts()[0] ?? (await browser.newContext({ userAgent: BROWSER_USER_AGENT, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", acceptDownloads: false }));
        return session(context, rules, async () => {
          await browser.close().catch(() => undefined);
          free();
        });
      } catch (e) {
        free();
        throw new Error(`the cloud browser at ${host} could not be reached (${String((e as Error).message).split("\n")[0]!.slice(0, 120)})`);
      }
    },
  };
}

/** The cloud browser when one is configured, else the local one. */
export function pageRenderer(): PageRenderer | undefined {
  return cloudBrowser() ?? localBrowser();
}
