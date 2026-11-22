import { describe, expect, it } from "vitest";
import { consult, consultNeeds, consultText, pickMessage, routeMessage, type ConsultProduct } from "../src";

// The shape of a merch studio's catalogue as the website importer stores it (Merch Onchain on Arc testnet): every
// summary is "<Name> from Merch Onchain.", every product has the same capabilities and the same FAQ notes.
const FAQ = [
  "Custom orders welcome.",
  "What’s the MOQ? Usually starts at 50 pieces, but depends on the item. DM us for flexibility.",
  "Can I get samples? Yes! Happy to send samples before full production.",
  "How long does production take? 8–10 days standard. Need it faster? We’ll try our best.",
];
const item = (slug: string, name: string, unitLabel: string, fromPrice: string): ConsultProduct => ({
  slug,
  name,
  unitLabel,
  summary: `${name} from Merch Onchain.`,
  capabilities: ["Custom branding", "Delivery confirmed with proof"],
  fromPrice,
  minUnits: 50,
  notes: [`Minimum order 50 ${unitLabel}s.`, ...FAQ],
});
const store: ConsultProduct[] = [
  item("backpacks", "Backpacks", "bag", "$15.20"),
  item("bottles", "Bottles", "bottle", "$6.18"),
  item("bucket-hat", "Bucket Hat", "cap", "$5.23"),
  item("event-supplies", "Event Supplies", "piece", "$1.43"),
  item("hoodies", "Hoodies", "hoodie", "$14.25"),
  item("jerseys", "Jerseys", "jersey", "$8.55"),
  item("keychain", "Keychain", "keychain", "$1.43"),
  item("notebooks", "Notebooks", "notebook", "$3.33"),
  item("pvc-bags", "PVC Bags", "bag", "$3.33"),
  item("stanleys", "Stanleys", "piece", "$49.40"),
  item("stickers", "Stickers", "sticker", "$0.38"),
  item("tote-bags", "Tote Bags", "bag", "$3.80"),
  item("t-shirts", "T-Shirts", "tee", "$5.70"),
];
const slugs = new Set(store.map((p) => p.slug));
const route = (m: string, current?: string, picks?: string[]) => routeMessage(m, store, { current, picks, sellerName: "Merch Onchain" });

describe("routing a store message", () => {
  it("keeps open questions on all products instead of locking onto one", () => {
    for (const m of ["suggest me some good merch", "what works for a hackathon?", "gift ideas for 200 employees", "I would like a quote.", "What is the minimum order?", "Show me your merch"]) {
      expect(route(m).mode, m).toBe("consult");
    }
  });

  it("does not let a word every summary shares (merch, the seller's name) pick a product", () => {
    expect(route("any merch from merch onchain?").mode).toBe("consult");
  });

  it("moves to a product the buyer names", () => {
    expect(route("Price for 100 hoodies?")).toMatchObject({ mode: "product", slug: "hoodies" });
    expect(route("we want tote bags with our logo")).toMatchObject({ mode: "product", slug: "tote-bags" });
    expect(route("let's go with the t-shirts", "hoodies")).toMatchObject({ mode: "product", slug: "t-shirts", switched: true });
  });

  it("stays on the current product for follow-ups that name nothing", () => {
    expect(route("make it 200", "hoodies")).toMatchObject({ mode: "product", slug: "hoodies", switched: false });
    expect(route("can you do it by friday?", "hoodies")).toMatchObject({ mode: "product", slug: "hoodies" });
    expect(route("what are my options?", "hoodies")).toMatchObject({ mode: "product", slug: "hoodies" });
    expect(route("which one is cheaper per piece?", "hoodies")).toMatchObject({ mode: "product", slug: "hoodies" });
  });

  it("consults on an open question even while on a product, leaving that product out", () => {
    expect(route("what else would work for a hackathon?", "hoodies")).toMatchObject({ mode: "consult", exclude: ["hoodies"] });
    expect(route("something other than hoodies?", "hoodies")).toMatchObject({ mode: "consult", exclude: ["hoodies"] });
  });

  it("consults when several products match equally", () => {
    const r = route("hoodies or t-shirts?");
    expect(r.mode).toBe("consult");
    expect(r.mode === "consult" && r.slugs.sort()).toEqual(["hoodies", "t-shirts"]);
  });

  it("picks a recommendation by position", () => {
    expect(route("the second one please", undefined, ["hoodies", "bottles", "tote-bags"])).toMatchObject({ mode: "product", slug: "bottles" });
    expect(route("the second one please").mode).toBe("consult");
  });
});

describe("what the buyer needs", () => {
  it("reads quantity, budget, deadline, occasion and branding", () => {
    expect(consultNeeds(["gift ideas for 200 employees"])).toEqual({ occasion: "gift", audience: "employees", quantity: 200 });
    expect(consultNeeds(["hackathon in 2 weeks, about $5 each, with our logo"])).toMatchObject({ occasion: "hackathon", deadline: "in 2 weeks", budgetUnit: 5, branding: true });
    expect(consultNeeds(["300 people", "budget of 2k"])).toMatchObject({ quantity: 300, budgetTotal: 2000 });
    expect(consultNeeds(["need them by 10 December"])).toEqual({ deadline: "by 10 December" });
  });
});

describe("recommendations", () => {
  it("recommends 2 to 4 products from the catalogue, with the catalogue's own prices", () => {
    for (const m of ["suggest me some good merch", "what works for a hackathon?", "gift ideas for 200 employees", "something under $4 a piece for 500 attendees"]) {
      const c = consult("Merch Onchain", store, [m]);
      expect(c.picks.length, m).toBeGreaterThanOrEqual(2);
      expect(c.picks.length, m).toBeLessThanOrEqual(4);
      for (const p of c.picks) {
        expect(slugs.has(p.slug), p.slug).toBe(true);
        expect(p.fromPrice).toBe(store.find((x) => x.slug === p.slug)!.fromPrice);
      }
      // Every figure in the message is the buyer's own or comes from the catalogue.
      const known = new Set([...store.flatMap((p) => [p.fromPrice!, String(p.minUnits)]), ...(m.match(/\$?\d[\d,]*/g) ?? [])]);
      for (const f of consultText(c).match(/\$?\d[\d,.]*\d|\$?\d/g) ?? []) expect(known.has(f), `${f} in ${m}`).toBe(true);
    }
  });

  it("answers an open merch question with varied picks and asks what it is for and how many", () => {
    const c = consult("Merch Onchain", store, ["suggest me some good merch"]);
    expect(c.picks.map((p) => p.slug)).toEqual(["hoodies", "bottles", "tote-bags"]);
    expect(c.questions).toEqual(["What is it for, and who will get it (an event, your team, clients)?", "Roughly how many do you need?"]);
    expect(consultText(c)).toContain("Hoodies, from $14.25 a hoodie: Something people wear again and again; minimum 50 hoodies.");
  });

  it("fits the picks to the occasion and skips questions already answered", () => {
    const hack = consult("Merch Onchain", store, ["what works for a hackathon?"]);
    expect(hack.picks.map((p) => p.slug)).toEqual(["t-shirts", "stickers", "bottles"]);
    expect(hack.intro).toBe("For your hackathon, these Merch Onchain picks work well:");
    expect(hack.questions).toEqual(["Roughly how many do you need?", "Do you have a budget, per piece or in total?"]);

    const gift = consult("Merch Onchain", store, ["gift ideas for 200 employees"]);
    expect(gift.picks[0]!.slug).toBe("stanleys");
    expect(gift.intro).toBe("For gifts for your employees, these Merch Onchain picks work well:");
    expect(gift.questions).toEqual(["Do you have a budget, per piece or in total?", "When do you need them by?"]);
  });

  it("keeps to a stated budget per piece", () => {
    const c = consult("Merch Onchain", store, ["something under $4 a piece for 500 attendees"]);
    for (const p of c.picks) expect(Number(p.fromPrice!.slice(1))).toBeLessThanOrEqual(4);
    expect(c.intro).toContain("within about $4 a piece");
  });

  it("recommends the products a message pointed at first and leaves out the excluded one", () => {
    expect(consult("Merch Onchain", store, ["hoodies or t-shirts?"], { pointed: ["hoodies", "t-shirts"] }).picks.slice(0, 2).map((p) => p.slug)).toEqual(["hoodies", "t-shirts"]);
    expect(consult("Merch Onchain", store, ["what else?"], { exclude: ["hoodies"] }).picks.map((p) => p.slug)).not.toContain("hoodies");
  });

  it("answers a store-wide fact question from the seller's own notes before recommending", () => {
    const c = consult("Merch Onchain", store, ["What is the minimum order?"]);
    expect(c.intro.startsWith("Minimum order: usually starts at 50 pieces, but depends on the item.")).toBe(true);
  });

  it("recommends from the seller's own order when the catalogue is not goods", () => {
    const services: ConsultProduct[] = [
      { slug: "support", name: "AI order support", unitLabel: "resolution", summary: "Answers order-status questions in your helpdesk.", fromPrice: "$0.80" },
      { slug: "voice", name: "Voice receptionist", unitLabel: "call", summary: "Answers calls after hours.", fromPrice: "$1.20" },
    ];
    const c = consult("Lumen", services, ["what do you offer?"]);
    expect(c.picks.map((p) => [p.slug, p.reason])).toEqual([["support", "Answers order-status questions in your helpdesk"], ["voice", "Answers calls after hours"]]);
  });
});

describe("tapping a recommendation", () => {
  it("asks that product for a quote with what the buyer already said", () => {
    const needs = consultNeeds(["hackathon for 200 people, about $5 each, by 10 December"]);
    expect(pickMessage({ name: "T-Shirts", unitLabel: "tee" }, needs)).toBe("I would like a quote for t-shirts for our hackathon: 200 tees, budget about $1,000, needed by 10 December.");
    expect(pickMessage({ name: "Hoodies", unitLabel: "hoodie" })).toBe("I would like a quote for hoodies.");
    expect(pickMessage({ name: "Hoodies", unitLabel: "hoodie" }, consultNeeds(["gift ideas, $20 each"]))).toBe("I would like a quote for hoodies as gifts.");
  });
});
