/**
 * The importer's browser path. Offline: the egress proxy refuses private, loopback and non-https targets; prices are
 * read exactly as shown; links are ranked toward shop and category pages. With a real headless browser (skipped
 * when none is installed): a JavaScript-only shop served from fixtures is read through its menu, an XHR-loaded grid,
 * "load more" and a next page; a product page gives its options; a site with no prices gives its product types; a
 * hostile page cannot reach this machine; robots.txt and other sites are respected.
 */
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, BrowserContext } from "playwright-core";
import { pageRenderer, session, type PageRenderer, type RenderRules } from "../src/services/importer/browser";
import { startBrowserService, type Launcher } from "../../browser/service";
import { browserSource, elsewhereOf, pageKey, parseShownPrice, scoreLink, tidyName } from "../src/services/importer/browser-source";
import { allowedTarget, startEgressProxy } from "../src/services/importer/egress-proxy";
import { faqHints, hintsFrom } from "../src/services/importer/html";
import { parseRobots } from "../src/services/importer/robots";
import { SiteFetcher } from "../src/services/importer/site-fetcher";
import type { SafeResponse } from "../src/lib/net-guard";

describe("egress proxy", () => {
  it("allows only public hosts on port 443", () => {
    expect(allowedTarget("shop.example.com:443")).toEqual({ host: "shop.example.com", port: 443 });
    expect(allowedTarget("93.184.216.34:443")).not.toBeNull();
    for (const bad of ["shop.example.com:80", "127.0.0.1:443", "10.0.0.8:443", "192.168.1.1:443", "169.254.169.254:443", "[::1]:443", "localhost:443", "printer.local:443", "db.internal:443", "a.localhost:443", "postgres.railway.internal:443", "[::ffff:7f00:1]:443", "[::ffff:a9fe:a9fe]:443", "[fd12:3456::1]:443", "nonsense"]) expect(allowedTarget(bad)).toBeNull();
  });

  it("refuses CONNECT to private targets and any plain-http request", async () => {
    const proxy = await startEgressProxy({ maxBytes: 1024 * 1024 });
    const port = Number(new URL(proxy.url).port);
    const ask = (raw: string) =>
      new Promise<string>((resolve) => {
        const s = connect(port, "127.0.0.1", () => s.write(raw));
        let got = "";
        s.on("data", (b) => (got += b.toString()));
        s.on("close", () => resolve(got));
        s.on("error", () => resolve(got));
        setTimeout(() => s.destroy(), 2_000);
      });
    for (const target of ["127.0.0.1:443", "localhost:443", "10.1.2.3:443", "[::1]:443", "example.com:80", "169.254.169.254:443"]) {
      expect(await ask(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`)).toMatch(/^HTTP\/1\.1 403/);
    }
    expect(await ask("GET http://127.0.0.1:8797/api/health HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")).toMatch(/^HTTP\/1\.1 403/);
    expect(proxy.stats.tunnels).toBe(0);
    expect(proxy.stats.refused).toBe(7);
    await proxy.close();
  });
});

describe("which browser the importer uses", () => {
  const cdp = "ws://browser.railway.internal:3000/?token=abc";
  it("in production renders only through BROWSER_CDP_URL and never launches a local browser", () => {
    expect(pageRenderer({ NODE_ENV: "production", IMPORTER_BROWSER: "auto" })).toBeUndefined();
    expect(pageRenderer({ NODE_ENV: "production", IMPORTER_BROWSER: "auto", BROWSER_EXECUTABLE_PATH: "/usr/bin/chromium" })).toBeUndefined();
    expect(pageRenderer({ NODE_ENV: "production", IMPORTER_BROWSER: "auto", BROWSER_CDP_URL: cdp })).toMatchObject({ kind: "cloud", name: "cloud browser (browser.railway.internal)" });
    expect(pageRenderer({ NODE_ENV: "production", IMPORTER_BROWSER: "off", BROWSER_CDP_URL: cdp })).toBeUndefined();
  });
  it("in development may use a local browser", () => {
    expect(pageRenderer({ NODE_ENV: "development", IMPORTER_BROWSER: "auto" })?.kind).toBe("local");
    expect(pageRenderer({ NODE_ENV: "development", IMPORTER_BROWSER: "auto", BROWSER_CDP_URL: cdp })?.kind).toBe("cloud");
  });
});

describe("the browser service", () => {
  const token = "t0ken-for-the-browser-service-test";
  let launched: string[] = [];
  let devtools: Server;
  let upgradedPath = "";
  let svc: Awaited<ReturnType<typeof startBrowserService>>;
  const launch: Launcher = async (proxyUrl) => {
    launched.push(proxyUrl);
    const port = (devtools.address() as { port: number }).port;
    return { wsUrl: `ws://127.0.0.1:${port}/devtools/browser/abc`, close: async () => undefined };
  };
  const upgrade = (path: string) =>
    new Promise<string>((resolve) => {
      const s = connect(svc.port, "127.0.0.1", () => s.write(`GET ${path} HTTP/1.1\r\nHost: browser.railway.internal\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`));
      let got = "";
      s.on("data", (b) => {
        got += b.toString();
        if (got.includes("\r\n\r\n")) s.destroy();
      });
      s.on("close", () => resolve(got));
      s.on("error", () => resolve(got));
      setTimeout(() => s.destroy(), 3_000);
    });
  beforeAll(async () => {
    devtools = createServer();
    devtools.on("upgrade", (req, socket) => {
      upgradedPath = `${req.url} ${req.headers.host}`;
      socket.end("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
    });
    await new Promise<void>((r) => devtools.listen(0, "127.0.0.1", () => r()));
    svc = await startBrowserService({ token, port: 0, host: "127.0.0.1", launch });
  });
  afterAll(async () => {
    await svc.close();
    devtools.close();
  });

  it("refuses a connection without the right token and starts no browser for it", async () => {
    launched = [];
    expect(await upgrade("/")).toMatch(/^HTTP\/1\.1 401/);
    expect(await upgrade("/?token=wrong")).toMatch(/^HTTP\/1\.1 401/);
    expect(await upgrade(`/?token=${token}x`)).toMatch(/^HTTP\/1\.1 401/);
    expect(launched).toEqual([]);
  });

  it("with the token, starts a browser behind its own egress proxy and connects to its DevTools", async () => {
    launched = [];
    expect(await upgrade(`/?token=${token}`)).toMatch(/^HTTP\/1\.1 101/);
    expect(launched).toHaveLength(1);
    expect(upgradedPath).toMatch(/^\/devtools\/browser\/abc 127\.0\.0\.1:\d+$/);
  });

  it("stops the browser and its proxy when the client leaves while the browser is still starting", async () => {
    let started!: () => void;
    const starting = new Promise<void>((r) => (started = r));
    let finish!: () => void;
    const held = new Promise<void>((r) => (finish = r));
    let closed = 0;
    let launches = 0;
    let proxyUrl = "";
    const slow = await startBrowserService({
      token,
      port: 0,
      host: "127.0.0.1",
      maxOpen: 1,
      launch: async (url) => {
        launches++;
        proxyUrl = url;
        started();
        await held;
        return { wsUrl: "ws://127.0.0.1:9/devtools/browser/x", close: async () => void closed++ };
      },
    });
    const s = connect(slow.port, "127.0.0.1", () => s.write(`GET /?token=${token} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
    s.on("error", () => undefined);
    await starting;
    s.destroy();
    await new Promise((r) => setTimeout(r, 50));
    finish();
    for (let i = 0; i < 100 && !closed; i++) await new Promise((r) => setTimeout(r, 10));
    expect(closed).toBe(1);
    const proxyGone = await new Promise<boolean>((resolve) => {
      const p = connect(Number(new URL(proxyUrl).port), "127.0.0.1");
      p.on("connect", () => (p.destroy(), resolve(false)));
      p.on("error", () => resolve(true));
    });
    expect(proxyGone).toBe(true);
    const again = await new Promise<string>((resolve) => {
      const c = connect(slow.port, "127.0.0.1", () => c.write(`GET /?token=${token} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
      let got = "";
      c.on("data", (b) => (got += b.toString()));
      c.on("close", () => resolve(got));
      c.on("error", () => resolve(got));
    });
    expect(again).not.toMatch(/503/);
    expect(launches).toBe(2);
    await slow.close();
  });

  it("refuses a token that is too short to start", async () => {
    await expect(startBrowserService({ token: "short", port: 0, launch })).rejects.toThrow(/at least 24/);
  });

  it("its browser's proxy refuses private and Railway-internal targets", async () => {
    let proxyUrl = "";
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const probe = await startBrowserService({
      token,
      port: 0,
      host: "127.0.0.1",
      launch: async (url) => {
        proxyUrl = url;
        await held;
        throw new Error("no browser in this test");
      },
    });
    const pending = new Promise<string>((resolve) => {
      const s = connect(probe.port, "127.0.0.1", () => s.write(`GET /?token=${token} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
      let got = "";
      s.on("data", (b) => (got += b.toString()));
      s.on("close", () => resolve(got));
      s.on("error", () => resolve(got));
    });
    while (!proxyUrl) await new Promise((r) => setTimeout(r, 10));
    const port = Number(new URL(proxyUrl).port);
    const ask = (target: string) =>
      new Promise<string>((resolve) => {
        const s = connect(port, "127.0.0.1", () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
        let got = "";
        s.on("data", (b) => (got += b.toString()));
        s.on("close", () => resolve(got));
        s.on("error", () => resolve(got));
        setTimeout(() => s.destroy(), 2_000);
      });
    for (const target of ["127.0.0.1:443", "10.0.0.5:443", "169.254.169.254:443", "[fd12::10]:443", "[::ffff:7f00:1]:443", "api.railway.internal:443", "example.com:80"]) {
      expect(await ask(target), target).toMatch(/^HTTP\/1\.1 403/);
    }
    release();
    expect(await pending).toMatch(/^HTTP\/1\.1 502/);
    await probe.close();
  });
});

describe("reading what a page shows", () => {
  it("parses prices exactly as shown, never guessing a number", () => {
    expect(parseShownPrice("₹1,299.00", "shop.in")).toEqual({ amount: "1299.00", currency: "INR" });
    expect(parseShownPrice("Rs. 450", "shop.in")).toEqual({ amount: "450", currency: "INR" });
    expect(parseShownPrice("From $12", "shop.com")).toEqual({ amount: "12", currency: "USD" });
    expect(parseShownPrice("$12", "shop.com.au")).toEqual({ amount: "12", currency: "AUD" });
    expect(parseShownPrice("12,50 €", "shop.de")).toEqual({ amount: "12.50", currency: "EUR" });
    expect(parseShownPrice("Ask for a quote", "shop.com")).toBeUndefined();
    expect(parseShownPrice("US$ 25.00", "shop.com")).toEqual({ amount: "25.00", currency: "USD" });
    expect(parseShownPrice("S$ 12", "shop.com")).toEqual({ amount: "12", currency: "SGD" });
    expect(parseShownPrice("₹1,29,999", "shop.in")).toEqual({ amount: "129999", currency: "INR" });
    expect(parseShownPrice("₹12,34,567.50", "shop.in")).toEqual({ amount: "1234567.50", currency: "INR" });
    expect(parseShownPrice("₹1,299", "shop.in")).toEqual({ amount: "1299", currency: "INR" });
  });

  it("ranks shop, category and next-page links first and never opens account, cart or blog pages", () => {
    const at = (url: string, text = "", area: "nav" | "main" | "footer" = "main") => ({ url, text, area });
    expect(scoreLink(at("https://s.test/collections/hoodies", "Hoodies", "nav"), 1, false)).toBeGreaterThan(scoreLink(at("https://s.test/our-team", "Team", "nav"), 1, false));
    expect(scoreLink(at("https://s.test/shop?page=2", "2"), 1, true)).toBeGreaterThan(scoreLink(at("https://s.test/shop?page=2", "2"), 1, false));
    for (const u of ["https://s.test/cart", "https://s.test/account/login", "https://s.test/blog/launch", "https://s.test/policies/terms", "https://s.test/catalogue.pdf"]) expect(scoreLink(at(u, "x", "nav"), 1, false)).toBeLessThan(0);
    expect(pageKey("https://s.test/shop/?utm_source=x#reviews")).toBe("https://s.test/shop");
    expect(pageKey("https://s.test/#/shop")).toBe("https://s.test/#/shop");
  });

  it("notes catalogues kept on another service without opening them", () => {
    const same = (u: URL) => u.hostname === "s.test";
    expect(elsewhereOf({ url: "https://docsend.com/v/abc/catalogue", text: "VIEW CATALOGUE" }, same)).toMatchObject({ host: "docsend.com", label: "View Catalogue" });
    expect(elsewhereOf({ url: "https://s.test/files/price-list.pdf", text: "Price list" }, same)).toMatchObject({ host: "s.test" });
    expect(elsewhereOf({ url: "https://instagram.com/shop", text: "Instagram" }, same)).toBeUndefined();
  });

  it("tidies shouted names and pairs FAQ questions with their answers", () => {
    expect(tidyName("FOOTWEAR (SLIDERS)")).toBe("Footwear (Sliders)");
    expect(tidyName("iPhone case")).toBe("iPhone case");
    const text = "What’s the MOQ?\n+\nUsually starts at 50 pieces, but depends on the item.\nHow long does production take?\n8–10 days standard.\nWho are you?\nA studio.";
    expect(faqHints(text)).toEqual(["What’s the MOQ? Usually starts at 50 pieces, but depends on the item.", "How long does production take? 8–10 days standard."]);
    expect(hintsFrom("What’s the MOQ?\nOrder in bulk with us.")).toEqual(["Order in bulk with us."]);
  });
});

/* ---------------------------------------------------------------- with a real browser */

const ORIGIN = "https://shop.test";
const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${title}"></head><body>${body}</body></html>`;

/** A shop that only exists once its JavaScript runs: the HTML is an empty shell and the products come from an XHR. */
const APP = page(
  "Acme Studio",
  `<div id="root"></div><script>
const P = [
  { id: 1, name: "Classic Tee", price: "₹1,299.00", was: "₹1,499.00" },
  { id: 2, name: "Studio Hoodie", price: "₹2,499.00" },
  { id: 3, name: "Canvas Tote", price: "₹599.00", sold: true },
  { id: 4, name: "Enamel Mug", price: "₹450.00" },
  { id: 5, name: "Sticker Pack", price: "₹199.00" },
];
function nav() {
  return '<header><nav><a href="/">Home</a> <a href="/shop">Shop</a> <a href="/blog/launch">Blog</a> <a href="/private/drafts">Drafts</a> <a href="https://docsend.com/v/xyz/acme">View catalogue</a></nav></header>';
}
function card(p) {
  return '<div class="card"><a href="/products/' + p.id + '"><img src="https://shop.test/i/' + p.id + '.jpg" alt=""><h3>' + p.name + '</h3></a><div class="price">' + (p.was ? '<s>' + p.was + '</s> ' : '') + '<span>' + p.price + '</span></div>' + (p.sold ? '<em>Sold out</em>' : '') + '</div>';
}
const root = document.getElementById("root");
const path = location.pathname;
if (path === "/") {
  root.innerHTML = nav() + '<main><h1>Acme Studio</h1><p>Custom printed merch.</p><button id="browse">Browse catalogue</button><h2>FAQ</h2><p>What is the minimum order?</p><p>Minimum order is 25 pieces per design.</p></main><footer><a href="/terms">Terms</a></footer>';
  document.getElementById("browse").onclick = () => { history.pushState({}, "", "/sale"); };
} else if (path === "/shop") {
  root.innerHTML = nav() + '<main><h1>All products</h1><div class="grid" id="grid"></div><button id="more">Load more</button></main>';
  fetch("/api/products?page=1").then(r => r.json()).then(list => { document.getElementById("grid").innerHTML = list.map(card).join(""); });
  document.getElementById("more").onclick = () => fetch("/api/products?page=2").then(r => r.json()).then(list => { document.getElementById("grid").insertAdjacentHTML("beforeend", list.map(card).join("")); document.getElementById("more").remove(); });
} else if (path === "/sale") {
  const pg = new URLSearchParams(location.search).get("page") || "1";
  const items = pg === "1" ? [{ id: 6, name: "Sale Cap", price: "₹350.00" }, { id: 7, name: "Sale Socks", price: "₹150.00" }] : [{ id: 8, name: "Sale Bottle", price: "₹700.00" }, { id: 9, name: "Sale Notebook", price: "₹250.00" }];
  root.innerHTML = nav() + '<main><h1>Sale</h1><div class="grid">' + items.map(card).join("") + '</div>' + (pg === "1" ? '<a rel="next" href="/sale?page=2">Next</a>' : '') + '</main>';
} else {
  root.innerHTML = nav() + '<main><h1>Not found</h1></main>';
}
</script>`,
);

const PRODUCT = page(
  "Enamel Mug",
  `<main><h1>Enamel Mug</h1><p class="price"><s>$15.00</s> <span>$12.50</span></p>
<form action="/cart/add"><label for="size">Size</label><select id="size"><option>Choose a size</option><option>Small</option><option>Large</option></select>
<fieldset><legend>Colour</legend><label><input type="radio" name="c" value="Blue">Blue</label><label><input type="radio" name="c" value="Green">Green</label></fieldset>
<button>Add to cart</button></form>
<h2>You may also like</h2><div class="grid"><div class="card"><a href="/products/9"><h3>Tee</h3></a><span>$20.00</span></div><div class="card"><a href="/products/10"><h3>Cap</h3></a><span>$18.00</span></div></div></main>`,
);

const NO_PRICES = page(
  "Swag House",
  `<div id="root"></div><script>document.getElementById("root").innerHTML = '<main><h1>Merch for every team</h1><div class="list">' + ["JERSEYS", "T-SHIRTS", "HOODIES", "TOTE BAGS", "STICKERS", "BOTTLES"].map(x => '<span>' + x + '</span>').join("") + '</div><div class="perks"><span>Fast delivery</span><span>Great support</span><span>Free design</span><span>Happy teams</span></div></main>';</script>`,
);

const LD_APP = page("LD Shop", `<div id="root"></div><script>const s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: "Rendered Lamp", offers: { "@type": "Offer", price: "49.00", priceCurrency: "EUR" } }); document.head.appendChild(s); document.getElementById("root").innerHTML = "<h1>Rendered Lamp</h1>";</script>`);

const API: Record<string, unknown> = {
  "/api/products?page=1": [
    { id: 1, name: "Classic Tee", price: "₹1,299.00", was: "₹1,499.00" },
    { id: 2, name: "Studio Hoodie", price: "₹2,499.00" },
    { id: 3, name: "Canvas Tote", price: "₹599.00", sold: true },
  ],
  "/api/products?page=2": [
    { id: 4, name: "Enamel Mug", price: "₹450.00" },
    { id: 5, name: "Sticker Pack", price: "₹199.00" },
  ],
};

let browser: Browser | undefined;
let why = "";
beforeAll(async () => {
  const { chromium } = await import("playwright-core");
  const tries = [process.env.BROWSER_EXECUTABLE_PATH, undefined, "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  for (const executablePath of tries) {
    try {
      browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
      return;
    } catch (e) {
      why = String((e as Error).message).split("\n")[0]!;
    }
  }
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

/** A context whose only "network" is the fixture site; every request is recorded. */
async function fixtureContext(pages: Record<string, string>) {
  const context = await browser!.newContext();
  const requested: string[] = [];
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    requested.push(u.pathname + u.search);
    if (u.origin !== ORIGIN) return route.abort();
    const api = API[u.pathname + u.search];
    if (api) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(api) });
    const body = pages[u.pathname] ?? pages["*"];
    return body ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body }) : route.fulfill({ status: 404, body: "not found" });
  });
  return { context, requested };
}

const robots = parseRobots("User-agent: *\nDisallow: /private/\n");
const rules: RenderRules = { allowed: (u) => robots.allowed(u.pathname + u.search), sameSite: (u) => u.hostname === "shop.test" };

function fixtureRenderer(context: BrowserContext): PageRenderer {
  return { name: "test browser", kind: "local", open: async (r) => session(context, r, async () => undefined) };
}

function fixtureSite() {
  const fetch = async (url: string): Promise<SafeResponse> => ({ url, status: 404, contentType: "text/plain", body: "", truncated: false });
  const site = new SiteFetcher(new URL(ORIGIN), fetch, { delayMs: 0 });
  site.robots = robots;
  return site;
}

describe("in a real browser", () => {
  it("reads a JavaScript-only shop through its menu, an XHR grid, load more, a shop button route and a next page", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    const { context, requested } = await fixtureContext({ "*": APP });
    const found = await browserSource(fixtureSite(), fixtureRenderer(context), `${ORIGIN}/`, { siteName: "Acme", progress: () => undefined, delayMs: 0, maxPages: 8 });
    await context.close();
    const byName = Object.fromEntries(found.products.map((p) => [p.name, p]));
    expect(Object.keys(byName).sort()).toEqual(["Canvas Tote", "Classic Tee", "Enamel Mug", "Sale Bottle", "Sale Cap", "Sale Notebook", "Sale Socks", "Sticker Pack", "Studio Hoodie"]);
    // The price shown, not the struck-through one; currency from the symbol; sold out noted.
    expect(byName["Classic Tee"]).toMatchObject({ price: "1299.00", currency: "INR", source: "page-layout", url: `${ORIGIN}/products/1` });
    expect(byName["Canvas Tote"]).toMatchObject({ price: "599.00", available: false });
    expect(byName["Sale Notebook"]!.price).toBe("250.00");
    // robots.txt, the blog and the catalogue on DocSend were never loaded; DocSend is reported.
    expect(requested.some((r) => r.startsWith("/private"))).toBe(false);
    expect(requested.some((r) => r.startsWith("/blog"))).toBe(false);
    expect(found.elsewhere).toEqual([expect.objectContaining({ host: "docsend.com" })]);
    expect(found.home?.text).toContain("Minimum order is 25 pieces");
  }, 90_000);

  it("reads a product's own page: the shown price and its options, not the related products", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    const { context } = await fixtureContext({ "/products/mug": PRODUCT });
    const s = session(context, rules, async () => undefined);
    const r = await s.render(`${ORIGIN}/products/mug`);
    await context.close();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.page.detail).toMatchObject({ name: "Enamel Mug", priceText: "$12.50" });
    expect(r.page.detail!.options).toEqual([
      { name: "Size", values: ["Small", "Large"] },
      { name: "Colour", values: ["Blue", "Green"] },
    ]);
  }, 60_000);

  it("lists the product types of a site that shows no prices, without inventing any price", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    const { context } = await fixtureContext({ "/": NO_PRICES });
    const found = await browserSource(fixtureSite(), fixtureRenderer(context), `${ORIGIN}/`, { siteName: "Swag", progress: () => undefined, delayMs: 0, maxPages: 2 });
    await context.close();
    expect(found.products.map((p) => p.name)).toEqual(["Jerseys", "T-Shirts", "Hoodies", "Tote Bags", "Stickers", "Bottles"]);
    expect(found.products.every((p) => p.price === undefined && p.source === "page-layout")).toBe(true);
  }, 60_000);

  it("lets a model read the rendered text, keeping only names, prices and options the text contains", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    const { context } = await fixtureContext({ "/": NO_PRICES });
    const seen: string[] = [];
    const extractor = {
      name: "fake model",
      async extract(pages: { url: string; text: string }[]) {
        seen.push(...pages.map((p) => p.text));
        return [
          { name: "Hoodies", price: "999", currency: "INR" },
          { name: "Golden Yacht", price: "5" },
          { name: "Tote Bags", options: [{ name: "Colour", values: ["Black", "Purple"] }] },
        ];
      },
    };
    const found = await browserSource(fixtureSite(), fixtureRenderer(context), `${ORIGIN}/`, { siteName: "Swag", extractor, progress: () => undefined, delayMs: 0, maxPages: 1 });
    await context.close();
    expect(seen.join(" ")).toContain("HOODIES");
    const byName = Object.fromEntries(found.products.map((p) => [p.name, p]));
    expect(byName["Golden Yacht"]).toBeUndefined();
    expect(byName["Hoodies"]).toMatchObject({ source: "page-text", price: undefined });
    expect(byName["Tote Bags"]!.options).toEqual([]);
    expect(Object.keys(byName).sort()).toEqual(["Bottles", "Hoodies", "Jerseys", "Stickers", "T-Shirts", "Tote Bags"]);
  }, 60_000);

  it("takes structured data the page adds with JavaScript as exact", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    const { context } = await fixtureContext({ "/": LD_APP });
    const found = await browserSource(fixtureSite(), fixtureRenderer(context), `${ORIGIN}/`, { siteName: "LD", progress: () => undefined, delayMs: 0, maxPages: 1 });
    await context.close();
    expect(found.products).toEqual([expect.objectContaining({ name: "Rendered Lamp", price: "49.00", currency: "EUR", source: "browser" })]);
  }, 60_000);

  it("keeps a hostile page away from this machine: no loopback, no private address, no WebSocket", async (ctx) => {
    if (!browser) return ctx.skip(`no browser: ${why}`);
    let hits = 0;
    const local: Server = createServer((_q, res) => {
      hits++;
      res.end("secret");
    });
    local.on("upgrade", (_q, sock) => {
      hits++;
      sock.destroy();
    });
    await new Promise<void>((r) => local.listen(0, "127.0.0.1", () => r()));
    const port = (local.address() as { port: number }).port;
    const hostile = page("Hostile", `<h1>Hi</h1><script>
      fetch("https://127.0.0.1:${port}/").catch(() => {});
      fetch("http://127.0.0.1:${port}/").catch(() => {});
      fetch("https://localhost:${port}/").catch(() => {});
      fetch("https://169.254.169.254/latest/meta-data/").catch(() => {});
      try { new WebSocket("ws://127.0.0.1:${port}/"); } catch (e) {}
      const i = new Image(); i.src = "http://127.0.0.1:${port}/pixel.png";
    </script>`);
    const context = await browser.newContext();
    // Unlike the fixture context, everything not on the fixture site goes to the real network stack here.
    await context.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostile }));
    const s = session(context, rules, async () => undefined);
    const r = await s.render(`${ORIGIN}/`);
    await new Promise((res) => setTimeout(res, 800));
    await context.close();
    await new Promise<void>((res) => local.close(() => res()));
    expect(r.ok).toBe(true);
    expect(hits).toBe(0);
    expect(s.stats().blocked).toBeGreaterThanOrEqual(4);
  }, 60_000);
});
