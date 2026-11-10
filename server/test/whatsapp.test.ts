import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { messagePayload, offerTitle, parseWebhook, senderHash, verifySignature } from "../src/services/whatsapp";

const secret = "test-app-secret-0123456789";
const sign = (raw: string) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
const hook = (msg: Record<string, unknown>, contacts: Record<string, unknown>[] = [{ wa_id: "919876543210", user_id: "IN.111", profile: { name: "Riya" } }]) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "106540352242922" }, contacts, messages: [msg] } }] }],
});

describe("webhook signature", () => {
  it("accepts Meta's sha256= HMAC of the raw body and rejects anything else", () => {
    const raw = JSON.stringify(hook({ id: "wamid.1", from: "919876543210", type: "text", text: { body: "hi" } }));
    expect(verifySignature(raw, sign(raw), secret)).toBe(true);
    expect(verifySignature(raw + " ", sign(raw), secret)).toBe(false);
    expect(verifySignature(raw, sign(raw).replace("sha256=", ""), secret)).toBe(false);
    expect(verifySignature(raw, undefined, secret)).toBe(false);
    expect(verifySignature(raw, "sha256=00", secret)).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("reads a text message and keys the buyer on the business-scoped id", () => {
    const [m] = parseWebhook(hook({ id: "wamid.1", from: "919876543210", from_user_id: "IN.111", type: "text", text: { body: "need 20 tees" } }));
    expect(m).toMatchObject({ phoneNumberId: "106540352242922", wamid: "wamid.1", userKey: "IN.111", kind: "text", text: "need 20 tees", group: false });
    expect(m!.contact).toEqual({ waId: "919876543210", userId: "IN.111" });
  });
  it("works for a username user with no phone number", () => {
    const [m] = parseWebhook(hook({ id: "wamid.2", from_user_id: "IN.222", type: "text", text: { body: "hi" } }, [{ user_id: "IN.222" }]));
    expect(m!.userKey).toBe("IN.222");
    expect(m!.contact.waId).toBeUndefined();
  });
  it("reads a reply-button tap", () => {
    const [m] = parseWebhook(hook({ id: "wamid.3", from: "919876543210", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "q:c_1", title: "20 · $132" } } }));
    expect(m).toMatchObject({ kind: "button", buttonId: "q:c_1" });
  });
  it("flags group messages and skips status callbacks", () => {
    expect(parseWebhook(hook({ id: "wamid.4", from: "1", type: "text", text: { body: "x" }, group_id: "g1" }))[0]!.group).toBe(true);
    expect(parseWebhook({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "1" }, statuses: [{ id: "wamid.9", status: "read" }] } }] }] })).toEqual([]);
    expect(parseWebhook({ nonsense: true })).toEqual([]);
  });
});

describe("outbound messages", () => {
  it("sends to the phone when known, else to the business-scoped id", () => {
    expect(messagePayload({ waId: "91", userId: "IN.1" }, { kind: "text", body: "hi" })).toMatchObject({ to: "91", type: "text", text: { body: "hi" } });
    const p = messagePayload({ userId: "IN.1" }, { kind: "text", body: "hi" });
    expect(p).toMatchObject({ recipient: "IN.1" });
    expect(p).not.toHaveProperty("to");
  });
  it("caps reply buttons at 3 with 20-character titles", () => {
    const p = messagePayload({ waId: "91" }, { kind: "buttons", body: "b", buttons: [1, 2, 3, 4].map((i) => ({ id: `q:${i}`, title: "x".repeat(30) })) }) as { interactive: { action: { buttons: { reply: { title: string } }[] } } };
    expect(p.interactive.action.buttons).toHaveLength(3);
    expect(p.interactive.action.buttons[0]!.reply.title).toHaveLength(20);
  });
  it("builds a cta_url link message", () => {
    expect(messagePayload({ waId: "91" }, { kind: "link", body: "b", label: "Review and pay", url: "https://x/api/w/t" })).toMatchObject({ type: "interactive", interactive: { type: "cta_url", action: { name: "cta_url", parameters: { display_text: "Review and pay", url: "https://x/api/w/t" } } } });
  });
  it("offer titles fit 20 characters", () => {
    expect(offerTitle("20", "132000000")).toBe("20 · $132");
    expect(offerTitle("1000000", "123456780000").length).toBeLessThanOrEqual(20);
  });
});

describe("sender pseudonym", () => {
  it("is stable and does not contain the id", () => {
    expect(senderHash("IN.111")).toBe(senderHash("IN.111"));
    expect(senderHash("IN.111")).not.toContain("111");
    expect(senderHash("IN.111")).not.toBe(senderHash("IN.112"));
  });
});
