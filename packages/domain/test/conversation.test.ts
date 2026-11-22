import { describe, expect, it } from "vitest";
import { switchNegotiation, type ConversationPart } from "../src";

type Neg = { id: string; product: string; turns: string[] };
const part = (n: Neg): ConversationPart<string> => ({ product: n.product, turns: n.turns });
const backpacks: Neg = { id: "n1", product: "Backpacks", turns: ["Price for 100 bags?", "100 bags is $1,520."] };
const bottles: Neg = { id: "n2", product: "Bottles", turns: [] };

describe("switching a chat to another product", () => {
  it("keeps the history unchanged when the new negotiation fails to start, on every retry", async () => {
    const history: ConversationPart<string>[] = [];
    const fail = () => Promise.reject(new Error("network"));
    await expect(switchNegotiation(backpacks, history, fail, part)).rejects.toThrow("network");
    await expect(switchNegotiation(backpacks, history, fail, part)).rejects.toThrow("network");
    expect(history).toEqual([]);
  });

  it("adds the conversation it leaves exactly once after the new one starts", async () => {
    const moved = await switchNegotiation(backpacks, [], () => Promise.resolve(bottles), part);
    expect(moved.next).toBe(bottles);
    expect(moved.history).toEqual([{ product: "Backpacks", turns: ["Price for 100 bags?", "100 bags is $1,520."] }]);
  });

  it("starts the first negotiation without any history", async () => {
    const moved = await switchNegotiation(null, [], () => Promise.resolve(backpacks), part);
    expect(moved).toEqual({ next: backpacks, history: [] });
  });
});
