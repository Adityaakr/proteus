import { describe, expect, it } from "vitest";
import { greetingFacts, greetingText, sellerGreeting, type GreetingProduct } from "../src";

// Notes as the website importer stores them for a merch studio (one product per item, same FAQ on every product).
const FAQ = [
  "Custom orders welcome.",
  "What’s the MOQ? Usually starts at 50 pieces, but depends on the item. DM us for flexibility.",
  "Can I get samples? Yes! Happy to send samples before full production.",
  "How long does production take? 8–10 days standard. Need it faster? We’ll try our best.",
  "How long does delivery take? Depends on location, but usually 5–10 days after production.",
];
const item = (name: string, unit: string): GreetingProduct => ({ name, notes: [`Minimum order 50 ${unit}.`, `100 or more ${unit} get the bulk price.`, ...FAQ] });
const store = [item("Backpacks", "bags"), item("Bottles", "bottles"), item("T-Shirts", "tees")];

describe("seller greeting", () => {
  it("greets a store with the facts every product shares, from the seller's own lines", () => {
    const g = sellerGreeting("Merch Onchain", store);
    expect(g.opening).toBe("Hi, welcome to Merch Onchain. I can quote and set up an order for any of their products in seconds.");
    expect(g.facts).toEqual([
      { kind: "moq", label: "Minimum order", text: "usually starts at 50 pieces, but depends on the item." },
      { kind: "production", label: "Production", text: "8–10 days standard." },
      { kind: "samples", label: "Samples", text: "happy to send samples before full production." },
    ]);
    expect(g.chips.map((c) => c.label)).toEqual(["Get a quote", "Minimum order?", "Delivery time?", "Samples?"]);
  });

  it("greets one product with that product's own minimum order", () => {
    const g = sellerGreeting("Merch Onchain", store, store[0]);
    expect(g.opening).toContain("an order for backpacks in seconds");
    expect(g.facts[0]).toEqual({ kind: "moq", label: "Minimum order", text: "50 bags." });
    expect(g.chips[0]!.message).toBe("I would like a quote for backpacks.");
  });

  it("never lists prices and stays short as one message", () => {
    const text = greetingText(sellerGreeting("Merch Onchain", store));
    expect(text).not.toMatch(/\$/);
    expect(text.split("\n").filter(Boolean)).toHaveLength(5);
    expect(text).toContain("Minimum order: usually starts at 50 pieces");
  });

  it("skips facts that do not hold for the whole store and says nothing when the site gave nothing", () => {
    expect(greetingFacts([{ name: "A", notes: ["Minimum order 10 mugs."] }, { name: "B", notes: [] }])).toEqual([]);
    const g = sellerGreeting("Kitbox", [{ name: "Boxes" }]);
    expect(g.facts).toEqual([]);
    expect(g.chips.map((c) => c.label)).toEqual(["Get a quote"]);
    expect(greetingText(g)).toBe("Hi, welcome to Kitbox. I can quote and set up an order for boxes in seconds.\n\nTell me what you need, how many and by when, and I will put together options the seller can actually deliver.");
  });
});
