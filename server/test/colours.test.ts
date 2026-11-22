/**
 * Buyers never see a colour code: a site that gives only a swatch ("#273a6b") gets the nearest plain name ("navy"),
 * at import, in the agent's facts and in the public product, also for products imported before this.
 */
import { describe, expect, it } from "vitest";
import { composeRuleBased } from "../src/agent/rule-based";
import { nameColourCodes, nameColourCodesInProse, nameColourValues, nearestColourName } from "../src/lib/colours";
import { runImport } from "../src/services/importer/run";
import { productFacts } from "../src/services/negotiation";
import type { SafeResponse } from "../src/lib/net-guard";

describe("colour codes become colour names", () => {
  it.each([
    ["#273a6b", "navy"],
    ["#000", "black"],
    ["#FFFFFF", "white"],
    ["#c62828", "red"],
    ["#8B4513", "brown"],
    ["#808080", "grey"],
    ["#2e7d32ff", "green"],
    ["rgb(0, 128, 128)", "teal"],
    ["#f5f5dc", "beige"],
    // Swatches shoonyastore.com gives for its caps.
    ["#183c34", "forest green"],
    ["#e5e1e6", "light grey"],
    ["#a9514c", "rust"],
    ["#d3c6b3", "khaki"],
  ])("%s → %s", (code, name) => {
    expect(nearestColourName(code)).toBe(name);
  });
  it("keeps real names, names codes inside text, and drops a name a second swatch repeats", () => {
    expect(nameColourValues(["#273a6b", "Black", "Forest Green", "#111111", "#121212"])).toEqual(["navy", "Black", "Forest Green"]);
    expect(nameColourCodes("Utility Cap / #273a6b")).toBe("Utility Cap / navy");
    expect(nameColourCodes("Size L, 2 pieces")).toBe("Size L, 2 pieces");
    // In the agent's prose only a code that is clearly a colour is named; an order number stays.
    expect(nameColourCodesInProse("The colour is #273a6b.")).toBe("The colour is navy.");
    expect(nameColourCodesInProse("Listing offers 1 colour (#273A6B).")).toBe("Listing offers 1 colour (navy).");
    expect(nameColourCodesInProse("Order #123456 and #abc ship Friday.")).toBe("Order #123456 and #abc ship Friday.");
  });

  it("the agent answers a colour question with names, also for a product imported with a code", () => {
    const facts = productFacts({ product: { termDays: 30, refundPolicy: "", billableUnit: "cap", supportedIntegrations: [], capabilities: [], knowledge: { options: [{ name: "Colour", values: ["#273a6b"] }], variants: ["Utility Cap - #273a6b"], notes: [], policies: [] } } as never });
    expect(facts.knowledge!.options).toEqual([{ name: "Colour", values: ["navy"] }]);
    expect(facts.knowledge!.variants).toEqual(["Utility Cap - navy"]);
    const reply = composeRuleBased({ productName: "Utility Cap", unitLabel: "cap", requirements: { integrations: [], notes: [], openQuestions: [] }, offers: [], rejected: [], injectionDetected: false, turns: [{ role: "buyer", content: "what colours does it come in?" }], facts });
    expect(reply).toMatch(/Colour: navy\./);
    expect(reply).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("the importer stores names, not codes", async () => {
    const page = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Utility Cap", color: ["#273a6b", "Black"], offers: { price: "699", priceCurrency: "INR" } })}</script>`;
    const pages: Record<string, { body: string; type?: string }> = {
      "/robots.txt": { body: "User-agent: *\nAllow: /\nSitemap: https://caps.example/sitemap.xml", type: "text/plain" },
      "/": { body: "<html><head><title>Caps</title></head><body>Caps for teams</body></html>" },
      "/sitemap.xml": { type: "application/xml", body: "<urlset><url><loc>https://caps.example/products/utility-cap</loc></url></urlset>" },
      "/products/utility-cap": { body: page },
    };
    const fetch = async (url: string): Promise<SafeResponse> => {
      const p = pages[new URL(url).pathname];
      return p ? { url, status: 200, contentType: p.type ?? "text/html", body: p.body, truncated: false } : { url, status: 404, contentType: "text/html", body: "", truncated: false };
    };
    const r = await runImport("caps.example", { fetch, delayMs: 0 });
    expect(r.products[0]!.options).toEqual([{ name: "Colour", values: ["navy", "Black"] }]);
  });
});
