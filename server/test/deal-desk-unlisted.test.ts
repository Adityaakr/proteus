/**
 * "i want caps" at a store that lists no caps: the agent says plainly caps are not listed, names the closest listed
 * products and offers a custom request, and never answers with the current product's offers. Covered for the
 * built-in rule-based reply and for the model path (prompt, extraction and the reply guard).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toMicro, type PublicCandidate } from "@proteus/domain";

const calls: { system?: string; content: string; jsonSchema?: unknown }[] = [];
let nextJson: unknown = undefined;
let nextText = "";
vi.mock("../src/lib/claude", () => ({
  CLAUDE_FOR: { "chat:extract": { model: "test-haiku" }, "chat:reply": { model: "test-sonnet" } },
  askClaude: vi.fn(async (_job: unknown, req: { system?: string; content: string; jsonSchema?: unknown }) => {
    calls.push(req);
    return req.jsonSchema ? { json: nextJson, text: "", stopReason: "end_turn", model: "test-haiku" } : { json: undefined, text: nextText, stopReason: "end_turn", model: "test-sonnet" };
  }),
}));

import type { ComposeInput, UnlistedAsk } from "../src/agent/adapter";
import { createAnthropicAdapter } from "../src/agent/anthropic";
import { composeRuleBased, ruleBasedAdapter } from "../src/agent/rule-based";
import { answersCustomRequest, findUnlisted, itemsText, requestedItems, sameKindListed, unlistedConsultation, type ListedProduct } from "../src/agent/unlisted";
import { unitLabelFor } from "../src/services/importer/draft";
import { routeMessage, type ConsultProduct } from "@proteus/domain";

/** The Shoonya Store case: the buyer is on the sweatshirt and asks for caps; the store lists apparel, no caps. */
const sweatshirt: ListedProduct = { name: "Unbranded Sweatshirt", unitLabel: "sweatshirt", category: "Apparel", summary: "Unbranded sweatshirt from Shoonya Store.", smallestPack: "10 sweatshirts for $86.30" };
const others: ListedProduct[] = [
  { name: "Classic T-Shirt", unitLabel: "t-shirt", category: "Apparel", smallestPack: "10 t-shirts for $52.00" },
  { name: "Steel Water Bottle", unitLabel: "bottle", category: "Drinkware", smallestPack: "25 bottles for $160.00" },
  { name: "Canvas Tote", unitLabel: "tote", category: "Bags", smallestPack: "25 totes for $95.00" },
];
const offer = (units: bigint, total: string, tierName: string): PublicCandidate => ({ candidateId: `c${units}`, tierId: tierName.toLowerCase(), tierName, units, unitPrice: { num: toMicro(total) / units, den: 1n }, prepaidTotal: toMicro(total), includes: ["Delivery to your address"], supportedIntegrations: [], unsupportedIntegrations: [], status: "eligible", origin: "tier", origins: ["tier"], publicReasons: [] });
const sweatshirtOffers = [offer(50n, "388.50", "Bulk"), offer(10n, "86.30", "Minimum order")];

function unlistedFor(message: string): UnlistedAsk {
  const u = findUnlisted(message, sweatshirt, others)!;
  return { items: itemsText(u.items), alsoListed: u.alsoListed, closest: u.closest.map((p) => ({ name: p.name, smallestPack: p.smallestPack ?? "", current: p === sweatshirt })), listed: [sweatshirt, ...others].map((p) => p.name), sellerName: "Shoonya Store" };
}
const composeInput = (message: string, extra: Partial<ComposeInput> = {}): ComposeInput => ({
  productName: "Unbranded Sweatshirt",
  unitLabel: "sweatshirt",
  requirements: { integrations: [], notes: [], openQuestions: [] },
  offers: [],
  rejected: [],
  injectionDetected: false,
  turns: [{ role: "agent", content: "Hi, I am the deal desk for Shoonya Store." }, { role: "buyer", content: message }],
  catalog: { sellerName: "Shoonya Store", products: others.map((p) => ({ name: p.name, unitLabel: p.unitLabel, detail: `${p.name}. List tiers: ${p.smallestPack}.`, smallestPack: p.smallestPack! })) },
  ...extra,
});

describe("what the buyer asks for", () => {
  it.each([
    ["hey i want caps", ["caps"]],
    ["i want caps", ["caps"]],
    ["do you have any caps?", ["caps"]],
    ["caps?", ["caps"]],
    ["need 50 tote bags by friday", ["tote bags"]],
    ["I'd like a quote for 200 mugs", ["mugs"]],
    ["i want caps and 50 sweatshirts", ["caps", "sweatshirts"]],
    ["I'm looking for a cap", ["cap"]],
    ["order 30 water bottles", ["water bottles"]],
    ["I am interested in your sweatshirts", ["sweatshirts"]],
  ])("%s → %j", (msg, want) => {
    expect(requestedItems(msg).map((i) => i.phrase)).toEqual(want);
  });
  it.each([
    "we want to automate order tracking and delivery questions",
    "We need a human handling refunds",
    "i want a discount",
    "i need it by friday",
    "we need appointment scheduling for 3 clinics",
    "i want the black one in XL",
    "do you do custom logos",
    "how long does delivery take?",
    "what colours do you have?",
    "thanks",
  ])("names no kind of product: %s", (msg) => {
    expect(requestedItems(msg)).toEqual([]);
  });
});

describe("is it listed", () => {
  it("'i want caps' against a store without caps: not listed, closest apparel first", () => {
    const u = findUnlisted("i want caps", sweatshirt, others)!;
    expect(u.items.map((i) => i.phrase)).toEqual(["caps"]);
    expect(u.alsoListed).toBe(false);
    expect(u.closest.map((p) => p.name)).toEqual(["Unbranded Sweatshirt", "Classic T-Shirt"]);
  });
  it("a listed kind under another name is listed: tees at a store with t-shirts, sweatshirts on the sweatshirt", () => {
    expect(findUnlisted("need 25 tees", sweatshirt, others)).toBeUndefined();
    expect(findUnlisted("i want 50 sweatshirts", sweatshirt, others)).toBeUndefined();
    expect(findUnlisted("do you have totes?", sweatshirt, others)).toBeUndefined();
  });
  it("a store with caps lists caps", () => {
    expect(findUnlisted("i want caps", sweatshirt, [...others, { name: "Shoonya Cap", unitLabel: "cap", category: "Apparel" }])).toBeUndefined();
  });
  it("caps together with something listed: offers still apply", () => {
    expect(findUnlisted("i want caps and 50 sweatshirts", sweatshirt, others)).toMatchObject({ alsoListed: true, items: [{ phrase: "caps" }] });
  });
  it("closeness reads the product's name, unit and category, not words in its summary", () => {
    const bottle: ListedProduct = { name: "FlipTop Bottle", unitLabel: "bottle", category: "merch", summary: "A flip-top bottle for everyday use." };
    const carton: ListedProduct = { name: "Corrugated Shipping Carton", unitLabel: "box", category: "merch", summary: "A slotted carton with four top flaps." };
    const tee: ListedProduct = { name: "Oversized Tee", unitLabel: "tee", category: "merch" };
    expect(findUnlisted("hey i want caps", bottle, [carton, tee])!.closest.map((p) => p.name)).toEqual(["Oversized Tee"]);
  });
  it("nothing listed is close: no closest products", () => {
    expect(findUnlisted("we need gift hampers", sweatshirt, others)!.closest).toEqual([]);
  });
  it("the buyer's answer to the custom request offer", () => {
    const all = [sweatshirt, ...others];
    expect(answersCustomRequest("yes please", "Caps", all)).toBe(true);
    expect(answersCustomRequest("200 caps by 10 March, reach me at buyer@example.com", "Caps", all)).toBe(true);
    expect(answersCustomRequest("150 by next month", "Caps", all)).toBe(true);
    expect(answersCustomRequest("no thanks", "Caps", all)).toBe(false);
    expect(answersCustomRequest("ok then 50 sweatshirts", "Caps", all)).toBe(false);
    expect(answersCustomRequest("what else do you have?", "Caps", all)).toBe(false);
    // The same ask again ("hey i want caps", then "i want caps") gets the same answer; it sends nothing.
    expect(answersCustomRequest("i want caps", "Caps", all)).toBe(false);
  });
  it("a follow-up about a listed product after the offer is not the custom request", () => {
    const all = [sweatshirt, ...others];
    expect(answersCustomRequest("can i get 20 of the classic t-shirt", "Caps", all)).toBe(false);
    expect(answersCustomRequest("how much for 20 t-shirts?", "Caps", all)).toBe(false);
    expect(answersCustomRequest("I would like a quote for classic t-shirt.", "Caps", all)).toBe(false);
    expect(answersCustomRequest("200 pieces by march, buyer@example.com", "Caps", all)).toBe(true);
  });
  it("a colour at the end of a product's name is not its kind: the reply naming that colour is still the custom request", () => {
    const blackTee: ListedProduct = { name: "Classic Tee - Black", unitLabel: "piece", category: "Apparel" };
    const store = [blackTee, sweatshirt];
    expect(findUnlisted("i want caps", blackTee, [sweatshirt])).toMatchObject({ alsoListed: false, items: [{ phrase: "caps" }] });
    expect(findUnlisted("i want tees", blackTee, [sweatshirt])).toBeUndefined();
    expect(answersCustomRequest("100 black caps by friday, priya@example.com", "Caps", store)).toBe(true);
    expect(answersCustomRequest("can i get 20 of the classic tee", "Caps", store)).toBe(false);
  });
  it("a word only in a summary or the middle of a name does not make a kind listed", () => {
    const steel: ListedProduct = { name: "Steel Water Bottle", unitLabel: "bottle", category: "Drinkware", summary: "steel bottle with screw cap" };
    const loop: ListedProduct = { name: "Loop Cap Bottle", unitLabel: "bottle", category: "Drinkware" };
    const u = findUnlisted("hey i want caps", steel, [loop, ...others.slice(0, 1)])!;
    expect(u.items.map((i) => i.phrase)).toEqual(["caps"]);
    expect(u.alsoListed).toBe(false);
    expect(u.closest.map((p) => p.name)).toEqual(["Classic T-Shirt"]);
    const reply = composeRuleBased({ ...composeInput("hey i want caps"), productName: "Steel Water Bottle", unitLabel: "bottle", unlisted: { items: itemsText(u.items), alsoListed: false, closest: u.closest.map((p) => ({ name: p.name, smallestPack: p.smallestPack ?? "", current: false })), listed: [], sellerName: "Shoonya Store" } });
    expect(reply).toMatch(/^Caps are not something Shoonya Store lists\./);
    expect(reply).not.toMatch(/\$160\.00|25 bottles/);
  });
});

describe("the built-in reply (no model)", () => {
  it("'i want caps' says caps are not listed, names the closest products, offers a custom request, and shows no sweatshirt offers", async () => {
    const ext = await ruleBasedAdapter.extractRequirements({ productName: "Unbranded Sweatshirt", unitLabel: "sweatshirt", capabilities: [], supportedIntegrations: [], starters: [], prior: { integrations: [], notes: [], openQuestions: [] }, turns: [{ role: "buyer", content: "i want caps" }] });
    expect(ext.askedFor).toEqual(["caps"]);
    const reply = composeRuleBased(composeInput("i want caps", { unlisted: unlistedFor("i want caps") }));
    expect(reply).toMatch(/^Caps are not something Shoonya Store lists\./);
    expect(reply).toMatch(/closest listed products are Unbranded Sweatshirt \(the product we are on, from 10 sweatshirts for \$86\.30\) and Classic T-Shirt \(from 10 t-shirts for \$52\.00\)\. If one of them works, ask me about it\./);
    expect(reply).toMatch(/custom request: reply with how many you need, by when, and how they can reach you/);
    expect(reply).not.toMatch(/\$388\.50|50 sweatshirts/);
  });
  it("caps together with hoodies: the hoodie offers, a plain 'not listed' line, and no custom request offer to answer", () => {
    const hoodie: ListedProduct = { name: "Zip Hoodie", unitLabel: "hoodie", category: "Apparel" };
    const u = findUnlisted("i want hoodies and caps", hoodie, others)!;
    expect(u.alsoListed).toBe(true);
    const reply = composeRuleBased(composeInput("i want hoodies and caps", { productName: "Zip Hoodie", unitLabel: "hoodie", offers: [offer(50n, "900.00", "Bulk")], unlisted: { items: itemsText(u.items), alsoListed: true, closest: [], listed: [], sellerName: "Shoonya Store" } }));
    expect(reply).toMatch(/\$900\.00/);
    expect(reply).toMatch(/Caps are not something Shoonya Store lists\./);
    expect(reply).not.toMatch(/custom request/);
  });
  it("before the fix the same input answered with the sweatshirt offers; with caps and sweatshirts it shows both", () => {
    expect(composeRuleBased(composeInput("i want caps", { offers: sweatshirtOffers }))).toMatch(/\$388\.50/);
    const mixed = composeRuleBased(composeInput("i want caps and 50 sweatshirts", { offers: sweatshirtOffers, unlisted: unlistedFor("i want caps and 50 sweatshirts") }));
    expect(mixed).toMatch(/\$388\.50/);
    expect(mixed).toMatch(/Caps are not something Shoonya Store lists/);
  });
  it("names what the store lists when nothing is close", () => {
    const reply = composeRuleBased(composeInput("we need gift hampers", { unlisted: unlistedFor("we need gift hampers") }));
    expect(reply).toMatch(/Gift hampers are not something Shoonya Store lists\. Shoonya Store lists Unbranded Sweatshirt, Classic T-Shirt, Steel Water Bottle and Canvas Tote\./);
  });
});

describe("the model path", () => {
  beforeEach(() => {
    calls.length = 0;
  });
  it("extraction asks the model for the kinds of product asked for and merges them with the rule-based read", async () => {
    nextJson = { desiredUnits: null, budgetUsd: null, integrations: [], industry: null, useCase: null, notes: [], openQuestions: [], askedFor: ["baseball caps"] };
    const ext = await createAnthropicAdapter().extractRequirements({ productName: "Unbranded Sweatshirt", unitLabel: "sweatshirt", capabilities: [], supportedIntegrations: [], starters: [], prior: { integrations: [], notes: [], openQuestions: [] }, turns: [{ role: "buyer", content: "hey i want caps" }] });
    expect(JSON.stringify(calls[0]!.jsonSchema)).toMatch(/askedFor/);
    expect(ext.askedFor).toEqual(["caps", "baseball caps"]);
    expect(findUnlisted("hey i want caps", sweatshirt, others, ext.askedFor)!.items.map((i) => i.head)).toEqual(["caps"]);
  });
  it("a model-only reading of the request is checked too", () => {
    expect(findUnlisted("got anything for the head?", sweatshirt, others, ["caps"])!.items.map((i) => i.phrase)).toEqual(["caps"]);
  });
  it("the reply prompt carries the unlisted request, the closest products and no options; the custom request offer is always there", async () => {
    nextText = "Shoonya Store does not list caps. The closest listed products are Unbranded Sweatshirt (from 10 sweatshirts for $86.30) and Classic T-Shirt.";
    const { reply } = await createAnthropicAdapter().composeReply(composeInput("i want caps", { unlisted: unlistedFor("i want caps") }));
    const req = calls.at(-1)!;
    expect(req.system).toMatch(/UNLISTED REQUEST is not none/);
    expect(req.system).toMatch(/Never present this product's options as if they were the item asked for/);
    expect(req.content).toMatch(/UNLISTED REQUEST: Caps\n/);
    expect(req.content).toMatch(/CLOSEST LISTED: Unbranded Sweatshirt \(from 10 sweatshirts for \$86\.30\) \[this product\]; Classic T-Shirt/);
    expect(req.content).toMatch(/OPTIONS:\n- none/);
    expect(reply).toMatch(/^Shoonya Store does not list caps/);
    expect(reply).toMatch(/I can send Shoonya Store a custom request/);
  });
  it("a model reply that quotes the sweatshirt offers for caps is refused, and the built-in reply says caps are not listed", async () => {
    nextText = "Here are options for caps: 50 for $388.50.";
    const { reply } = await createAnthropicAdapter().composeReply(composeInput("i want caps", { unlisted: unlistedFor("i want caps") }));
    expect(reply).toMatch(/^Caps are not something Shoonya Store lists/);
    expect(reply).not.toMatch(/\$388\.50/);
  });
});

describe("'i want caps' on a store that lists caps (shoonyastore.com, with its caps published)", () => {
  it.each([
    ["Bucket Hat", "hat"],
    ["Loop Cap Bottle", "bottle"],
    ["Baseball Cap", "cap"],
    ["Winter Visor Cap", "cap"],
    ["Logo Hoodie", "hoodie"],
    ["Tote Bag", "bag"],
    ["T-Shirt Gift Box", "box"],
  ])("the importer counts %s in %s", (name, unit) => {
    expect(unitLabelFor(name)).toBe(unit);
  });

  const store = [
    { slug: "unbranded-sweatshirt", name: "Unbranded Sweatshirt", unitLabel: "sweatshirt", capabilities: [] },
    // Imported before the unit fix: a hat sold per "cap".
    { slug: "bucket-hat", name: "Bucket Hat", unitLabel: "cap", capabilities: [] },
    { slug: "loop-cap-bottle", name: "Loop Cap Bottle", unitLabel: "bottle", capabilities: [] },
    { slug: "baseball-cap", name: "Baseball Cap", unitLabel: "cap", capabilities: [] },
    { slug: "utility-cap", name: "Utility Cap", unitLabel: "cap", capabilities: [] },
  ];
  const route = (m: string, products: typeof store, current?: string) => routeMessage(m, products, { current, sellerName: "Shoonya Store" });
  it("the store desk answers 'hey i want caps' with the caps, named by their names, not a hat sold per cap or a cap bottle", () => {
    for (const current of [undefined, "unbranded-sweatshirt"]) {
      const d = route("hey i want caps", store, current);
      expect(d.mode, current).toBe("consult");
      expect(d.mode === "consult" && d.slugs, current).toEqual(["baseball-cap", "utility-cap"]);
    }
    // With one cap listed, the conversation moves to it.
    expect(route("hey i want caps", store.filter((p) => p.slug !== "utility-cap"), "unbranded-sweatshirt")).toMatchObject({ mode: "product", slug: "baseball-cap", switched: true });
    // Names before units: the cap bottle before the hat sold per cap; the hat is still found by its unit on its own.
    expect(route("hey i want caps", store.filter((p) => !/cap$/.test(p.slug)))).toMatchObject({ mode: "product", slug: "loop-cap-bottle" });
    expect(route("hey i want caps", store.filter((p) => !/cap/.test(p.slug)))).toMatchObject({ mode: "product", slug: "bucket-hat" });
  });

  it("a follow-up about 'it' stays on the cap, even when its words are in another cap's summary; naming another cap moves", () => {
    const withSummary = [...store, { slug: "ivy-flat-cap", name: "Ivy Flat Cap", unitLabel: "cap", capabilities: [], summary: "A flat cap, available in one colour." }];
    expect(route("is it available in any other colour?", withSummary, "utility-cap")).toMatchObject({ mode: "product", slug: "utility-cap", switched: false });
    expect(route("what about the ivy flat cap?", withSummary, "utility-cap")).toMatchObject({ mode: "product", slug: "ivy-flat-cap", switched: true });
  });

  it("on a cap, the other caps are offered as a choice; the hat and the bottle are not caps", () => {
    const listed: ListedProduct[] = [
      { name: "Bucket Hat", unitLabel: "hat" },
      { name: "Loop Cap Bottle", unitLabel: "bottle" },
      { name: "Utility Cap", unitLabel: "cap", smallestPack: "1 cap for $4.10" },
      { name: "Legionnaire Cap", unitLabel: "cap", smallestPack: "1 cap for $5.20" },
    ];
    const kin = sameKindListed("hey i want caps", listed);
    expect(kin.map((p) => p.name)).toEqual(["Utility Cap", "Legionnaire Cap"]);
    const reply = composeRuleBased({
      ...composeInput("hey i want caps"),
      productName: "Baseball Cap",
      unitLabel: "cap",
      offers: [offer(1n, "4.50", "Single")],
      choices: { kind: "caps", products: kin.map((p) => ({ name: p.name, smallestPack: p.smallestPack! })), total: kin.length, sellerName: "Shoonya Store" },
    });
    expect(reply).toMatch(/^Shoonya Store lists 3 caps: this Baseball Cap, Utility Cap \(from 1 cap for \$4\.10\) and Legionnaire Cap \(from 1 cap for \$5\.20\)\. Tell me which one you want/);
    expect(reply).toMatch(/\$4\.50/);
    expect(reply).not.toMatch(/not something/);
  });

  it("the model is told about the other caps and may quote their from-prices", async () => {
    nextText = "Shoonya Store lists 3 caps: this Baseball Cap, Utility Cap (from 1 cap for $4.10) and Legionnaire Cap. Which one would you like?";
    const { reply } = await createAnthropicAdapter().composeReply({
      ...composeInput("hey i want caps"),
      productName: "Baseball Cap",
      unitLabel: "cap",
      offers: [offer(1n, "4.50", "Single")],
      choices: { kind: "caps", products: [{ name: "Utility Cap", smallestPack: "1 cap for $4.10" }, { name: "Legionnaire Cap", smallestPack: "1 cap for $5.20" }], total: 2, sellerName: "Shoonya Store" },
    });
    const req = calls.at(-1)!;
    expect(req.system).toMatch(/SAME KIND LISTED is not none/);
    expect(req.content).toMatch(/SAME KIND LISTED: 3 caps in all, this product and Utility Cap \(from 1 cap for \$4\.10\); Legionnaire Cap/);
    expect(reply).toBe(nextText);
  });
});

describe("'i want caps' on the store's own deal desk, before any product is chosen (all products)", () => {
  const products: ConsultProduct[] = [
    { slug: "unbranded-sweatshirt", name: "Unbranded Sweatshirt", unitLabel: "sweatshirt", summary: sweatshirt.summary, capabilities: [], fromPrice: "$8.63", minUnits: 10 },
    { slug: "classic-t-shirt", name: "Classic T-Shirt", unitLabel: "t-shirt", capabilities: [], fromPrice: "$5.20", minUnits: 10 },
    { slug: "steel-water-bottle", name: "Steel Water Bottle", unitLabel: "bottle", capabilities: [], fromPrice: "$6.40", minUnits: 25 },
    { slug: "canvas-tote", name: "Canvas Tote", unitLabel: "tote", capabilities: [], fromPrice: "$3.80", minUnits: 25 },
  ];
  const listed = [sweatshirt, ...others];

  it("routes to a recommendation, which says caps are not listed, recommends the closest apparel and offers a custom request", () => {
    expect(routeMessage("hey i want caps", products, { sellerName: "Shoonya Store" }).mode).toBe("consult");
    const missing = findUnlisted("hey i want caps", listed[0]!, listed.slice(1))!;
    const { result, text, items } = unlistedConsultation("Shoonya Store", products, missing, ["hey i want caps"]);
    expect(items).toBe("Caps");
    expect(result.intro).toBe("Caps are not something Shoonya Store lists. The closest listed products are:");
    expect(result.picks.map((p) => p.slug)).toEqual(["unbranded-sweatshirt", "classic-t-shirt"]);
    expect(result.questions).toEqual(["If you want caps made, I can send Shoonya Store a custom request: reply with how many you need, by when, and how they can reach you."]);
    expect(text).toMatch(/^Caps are not something Shoonya Store lists\. The closest listed products are:\n\n• Unbranded Sweatshirt, from \$8\.63 a sweatshirt/);
    expect(text).not.toMatch(/bottle|tote/i);
  });

  it("nothing listed is close: shows what the store does list, still with the custom request offer", () => {
    const missing = findUnlisted("do you have umbrellas?", listed[0]!, listed.slice(1))!;
    const { result, text } = unlistedConsultation("Shoonya Store", products, missing, ["do you have umbrellas?"]);
    expect(result.intro).toBe("Umbrellas are not something Shoonya Store lists. Here is what Shoonya Store does list:");
    expect(result.picks.length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/custom request/);
  });

  it("the buyer's answer to the offer is the custom request; asking for a listed product is not", () => {
    expect(answersCustomRequest("50 by friday, reach me at buyer@example.com", "Caps", listed)).toBe(true);
    expect(answersCustomRequest("I would like a quote for classic t-shirt.", "Caps", listed)).toBe(false);
  });
});
