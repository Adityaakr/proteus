import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret } from "../src/lib/crypto";
import { httpUpstream } from "../src/services/gateway";

/** Seller-owned endpoint contract: 2xx JSON with billable !== false is one delivered unit; everything else is never billed. */
let server: http.Server;
let url: string;
const seen: { auth?: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const body = JSON.parse(b || "{}");
      seen.push({ auth: req.headers.authorization, body });
      res.setHeader("content-type", "application/json");
      if (req.headers.authorization !== "Bearer s3cret") {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: "nope" }));
      }
      const q = String(body.input?.question ?? "");
      if (req.url === "/slow") return; // never answers
      if (req.url === "/text") return res.end("not json");
      if (/refund/i.test(q)) return res.end(JSON.stringify({ status: "handoff", billable: false, answer: "A human will follow up." }));
      res.end(JSON.stringify({ answer: `Booked for ${body.input?.orderId}`, billable: true }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  url = `http://127.0.0.1:${addr.port}`;
});
afterAll(() => server.close());

const ctx = { requestId: "req_1", dealId: "deal_1", orgId: "org_1", productSlug: "callback" };

describe("httpUpstream", () => {
  it("bills a delivered 2xx JSON answer and sends the decrypted secret as a bearer", async () => {
    const out = await httpUpstream({ url: `${url}/ok`, secretEnc: encryptSecret("s3cret") }, ctx, { question: "Book a callback", orderId: "ACC-9" });
    expect(out.status).toBe("delivered");
    expect(out.billable).toBe(true);
    expect(out.answer).toBe("Booked for ACC-9");
    expect(seen.at(-1)?.auth).toBe("Bearer s3cret");
    expect(seen.at(-1)?.body.requestId).toBe("req_1");
  });
  it("never bills a handoff the endpoint reports", async () => {
    const out = await httpUpstream({ url: `${url}/ok`, secretEnc: encryptSecret("s3cret") }, ctx, { question: "I want a refund" });
    expect(out.status).toBe("handoff");
    expect(out.billable).toBe(false);
  });
  it("never bills a non-2xx answer (wrong secret)", async () => {
    const out = await httpUpstream({ url: `${url}/ok`, secretEnc: encryptSecret("wrong") }, ctx, { question: "Book" });
    expect(out.status).toBe("failed");
    expect(out.billable).toBe(false);
    expect(out.answer).toMatch(/HTTP 401/);
  });
  it("never bills non-JSON or an unreachable endpoint", async () => {
    const text = await httpUpstream({ url: `${url}/text`, secretEnc: encryptSecret("s3cret") }, ctx, { question: "Book" });
    expect(text.billable).toBe(false);
    const down = await httpUpstream({ url: "http://127.0.0.1:1/x" }, ctx, { question: "Book" });
    expect(down.status).toBe("failed");
    expect(down.billable).toBe(false);
  });
});
