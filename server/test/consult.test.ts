import { describe, expect, it } from "vitest";
import { consult, type ConsultProduct } from "@proteus/domain";
import { acceptConsult, consultContent, type ConsultInput } from "../src/agent/adapter";
import { ruleBasedAdapter } from "../src/agent/rule-based";

const item = (slug: string, name: string, unitLabel: string, fromPrice: string): ConsultProduct => ({
  slug,
  name,
  unitLabel,
  summary: `${name} from Merch Onchain.`,
  capabilities: ["Custom branding", "Delivery confirmed with proof"],
  fromPrice,
  minUnits: 50,
  notes: [`Minimum order 50 ${unitLabel}s.`, "How long does production take? 8–10 days standard."],
});
const products = [item("hoodies", "Hoodies", "hoodie", "$14.25"), item("t-shirts", "T-Shirts", "tee", "$5.70"), item("stickers", "Stickers", "sticker", "$0.38"), item("bottles", "Bottles", "bottle", "$6.18")];
const input = (message: string, extra: Partial<ConsultInput> = {}): ConsultInput => ({
  sellerName: "Merch Onchain",
  products,
  turns: [{ role: "buyer", content: message }],
  fallback: consult("Merch Onchain", products, [message], { pointed: extra.pointed, exclude: extra.exclude }),
  pointed: [],
  exclude: [],
  ...extra,
});

describe("a model's recommendation", () => {
  it("is kept when it recommends catalogue products with honest lines; prices always come from the catalogue", () => {
    const { result, rejected } = acceptConsult(
      {
        intro: "For a hackathon, these are easy wins.",
        picks: [{ slug: "t-shirts", reason: "hackers wear them all weekend" }, { slug: "stickers", reason: "laptop stickers go fast at events" }],
        questions: ["How many attendees are you expecting?", "Is there a budget per piece?"],
      },
      input("what works for a hackathon?"),
    );
    expect(rejected).toEqual([]);
    expect(result.picks.map((p) => [p.slug, p.name, p.fromPrice, p.reason])).toEqual([
      ["t-shirts", "T-Shirts", "$5.70", "Hackers wear them all weekend"],
      ["stickers", "Stickers", "$0.38", "Laptop stickers go fast at events"],
    ]);
  });

  it("never keeps a product that is not in the catalogue, or one the buyer asked to leave out", () => {
    const { result, rejected } = acceptConsult(
      { intro: "Here you go.", picks: [{ slug: "lanyards", reason: "great for badges" }, { slug: "hoodies", reason: "cosy" }, { slug: "bottles", reason: "handy" }], questions: ["How many?"] },
      input("what else besides hoodies?", { exclude: ["hoodies"] }),
    );
    expect(rejected).toEqual(["pick lanyards", "pick hoodies", "picks"]);
    // One pick left is not a recommendation: the deterministic one is used, and it leaves hoodies out too.
    expect(result.picks.every((p) => products.some((x) => x.slug === p.slug) && p.slug !== "hoodies")).toBe(true);
    expect(result.picks.length).toBeGreaterThanOrEqual(2);
  });

  it("replaces any line with a price or a number the seller and buyer never gave", () => {
    const { result, rejected } = acceptConsult(
      {
        intro: "These start at $3 each.",
        picks: [{ slug: "hoodies", reason: "only 12 left in stock" }, { slug: "bottles", reason: "minimum 50, used every day" }],
        questions: ["Do you need 500 or more?"],
      },
      input("suggest me some good merch"),
    );
    expect(rejected).toEqual(["reason for hoodies", "intro", "questions"]);
    expect(result.intro).toBe(input("suggest me some good merch").fallback.intro);
    expect(result.picks[0]!.reason).toBe("Something people wear again and again; minimum 50 hoodies");
    expect(result.picks[1]!.reason).toBe("Minimum 50, used every day");
    expect(result.questions).toEqual(input("suggest me some good merch").fallback.questions);
  });

  it("falls back entirely on a malformed answer", () => {
    const i = input("gift ideas for 200 employees");
    expect(acceptConsult("not json", i).result).toEqual(i.fallback);
    expect(acceptConsult({ picks: "hoodies" }, i).result).toEqual(i.fallback);
  });

  it("gives the model the catalogue and the seller's shared facts, not prices to repeat", () => {
    const c = consultContent(input("suggest me some good merch"));
    expect(c).toContain("- hoodies: Hoodies (sold per hoodie, minimum 50; Hoodies from Merch Onchain.");
    expect(c).not.toContain("$14.25");
    expect(c).toContain("Production: 8–10 days standard.");
  });
});

describe("without a model key", () => {
  it("recommends from the catalogue and asks follow-up questions", async () => {
    const i = input("suggest me some good merch");
    const { result } = await ruleBasedAdapter.consult(i);
    expect(result.picks.length).toBeGreaterThanOrEqual(2);
    expect(result.picks.every((p) => products.some((x) => x.slug === p.slug && x.fromPrice === p.fromPrice))).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
