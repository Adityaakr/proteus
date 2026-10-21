import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { AcceptBody, CounterBody, MessageBody, StartNegotiationBody } from "@proteus/domain";
import type { Address, Hex } from "viem";
import { db, schema } from "../db";
import { HttpError, json, toBig } from "../lib/http";
import { loadProductById, loadProductBySlugs, publicProduct } from "../services/catalog";
import { addBuyerMessage, counter, negotiationView, startNegotiation } from "../services/negotiation";
import { env, features } from "../env";
import { acceptQuote, createQuote, quoteView } from "../services/quotes";
import { platformSkill, serviceOpenApi, serviceSkill } from "../services/agentdocs";
import { policyLog, registrationFile } from "../services/agent-registry";
import { listRecords, recordView } from "../services/review";
import { resolveAuth } from "./auth";
import { checkCode, clientIp } from "../services/invites";
import { limit } from "../lib/ratelimit";
import { insertWalletLink, userOwnsAddress, userWallets } from "../services/accounts";
import { sellerCard, sellerStats } from "../services/brand";

export const publicRoutes = new Hono();

publicRoutes.get("/public/sellers/:sellerSlug", async (c) => {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, c.req.param("sellerSlug")));
  if (!org) throw new HttpError(404, "seller not found");
  const rows = await db.select().from(schema.products).where(eq(schema.products.orgId, org.id));
  const products = [];
  for (const r of rows) products.push(publicProduct(await loadProductById(r.id)));
  const stats = await sellerStats([org.id]);
  return json(c, { ...sellerCard(org, stats.get(org.id)), products });
});

publicRoutes.get("/public/sellers/:sellerSlug/products/:productSlug", async (c) => {
  const lp = await loadProductBySlugs(c.req.param("sellerSlug"), c.req.param("productSlug"));
  return json(c, publicProduct(lp));
});

/** Agent-facing docs, generated per product: a SKILL.md to carry and an OpenAPI document for the endpoint. */
const originOf = (c: { req: { header: (n: string) => string | undefined } }) => {
  const h = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const proto = c.req.header("x-forwarded-proto") ?? (h?.startsWith("localhost") || h?.startsWith("127.") ? "http" : "https");
  return env.WEB_ORIGIN || (h ? `${proto}://${h}` : "");
};
publicRoutes.get("/public/sellers/:sellerSlug/products/:productSlug/skill.md", async (c) => {
  const lp = await loadProductBySlugs(c.req.param("sellerSlug"), c.req.param("productSlug"));
  c.header("content-type", "text/markdown; charset=utf-8");
  c.header("content-disposition", `inline; filename="SKILL.md"`);
  return c.body(serviceSkill(lp, originOf(c)));
});
publicRoutes.get("/public/sellers/:sellerSlug/products/:productSlug/openapi.json", async (c) => {
  const lp = await loadProductBySlugs(c.req.param("sellerSlug"), c.req.param("productSlug"));
  return json(c, serviceOpenApi(lp, originOf(c)));
});
/** ERC-8004 registration file for a seller's agent (the agentURI its Arc identity points at). */
publicRoutes.get("/public/sellers/:sellerSlug/agent.json", async (c) => json(c, await registrationFile(c.req.param("sellerSlug"), originOf(c))));
/** Policy commitments per product and version, with the ProteusPolicyRegistry transaction for each one on chain. */
publicRoutes.get("/public/sellers/:sellerSlug/policies", async (c) => json(c, await policyLog(c.req.param("sellerSlug"))));
publicRoutes.get("/public/agents/skill.md", (c) => {
  c.header("content-type", "text/markdown; charset=utf-8");
  c.header("content-disposition", `inline; filename="SKILL.md"`);
  return c.body(platformSkill(originOf(c)));
});

publicRoutes.post("/negotiations", async (c) => {
  const body = StartNegotiationBody.parse(await c.req.json());
  const a = await resolveAuth(c);
  // While the invite gate is on, an agent without an account starts a negotiation by presenting a code in
  // X-Invite-Code. The code is checked, not consumed, and the usual per-IP attempt limit applies.
  const ipKey = clientIp((n) => c.req.header(n));
  limit(`neg-start:${ipKey}`, 30);
  // A live seller's embedded deal agent (on the seller's own site) may start a negotiation without an invite code.
  const fromEmbed = c.req.header("x-proteus-embed") === body.sellerSlug && (await sellerIsLive(body.sellerSlug));
  if (!a && features.inviteGate && !fromEmbed) {
    const code = c.req.header("x-invite-code");
    if (!code) throw new HttpError(403, "An invite code is required: send it in the X-Invite-Code header.", { code: "invite_required" });
    await checkCode(code, clientIp((n) => c.req.header(n)));
  }
  let buyer = body.buyerAddress;
  if (a) {
    const w = await userWallets(a.userId);
    buyer = (w.find((x) => x.primary) ?? w[0])?.address ?? buyer;
  }
  return json(c, await startNegotiation(body.sellerSlug, body.productSlug, buyer), 201);
});

publicRoutes.get("/negotiations/:id", async (c) => json(c, await negotiationView(c.req.param("id"))));

publicRoutes.post("/negotiations/:id/messages", async (c) => {
  // Each message runs the seller's agent (a model call): cap per visitor so an embed cannot be used to burn credits.
  limit(`neg-msg:${clientIp((n) => c.req.header(n))}`, 60);
  const body = MessageBody.parse(await c.req.json());
  return json(c, await addBuyerMessage(c.req.param("id"), body.content));
});

publicRoutes.post("/negotiations/:id/counter", async (c) => {
  const body = CounterBody.parse(await c.req.json());
  if (!body.targetTotal && !body.targetUnits) throw new HttpError(400, "targetTotal or targetUnits required");
  return json(c, await counter(c.req.param("id"), body.candidateId, { targetTotal: body.targetTotal ? toBig(body.targetTotal) : undefined, targetUnits: body.targetUnits ? toBig(body.targetUnits) : undefined }));
});

publicRoutes.post("/negotiations/:id/quotes", async (c) => {
  const { candidateId } = (await c.req.json()) as { candidateId?: string };
  if (!candidateId) throw new HttpError(400, "candidateId required");
  return json(c, await createQuote(c.req.param("id"), candidateId), 201);
});

publicRoutes.get("/quotes/:id", async (c) => {
  const buyer = c.req.query("buyer") as Address | undefined;
  return json(c, await quoteView(c.req.param("id"), buyer));
});

publicRoutes.post("/quotes/:id/accept", async (c) => {
  const body = AcceptBody.parse(await c.req.json());
  const a = await resolveAuth(c);
  // acceptQuote verifies the buyer's EIP-712 signature over the terms. For a signed-in user that is proof of
  // control, so a wallet the account has not linked yet (a freshly created embedded wallet) is linked here.
  const dealId = await acceptQuote(c.req.param("id"), body.buyerAddress as Address, body.buyerSignature as Hex);
  if (a && !(await userOwnsAddress(a.userId, body.buyerAddress))) await insertWalletLink(a.userId, body.buyerAddress as Address, "embedded", body.buyerSignature as Hex);
  const { dealView } = await import("../services/deals");
  return json(c, await dealView(dealId), 201);
});

publicRoutes.get("/review", async (c) => json(c, await listRecords()));
publicRoutes.get("/review/:publicId", async (c) => json(c, await recordView(c.req.param("publicId"))));

async function sellerIsLive(slug: string): Promise<boolean> {
  const [org] = await db.select({ label: schema.orgs.label }).from(schema.orgs).where(eq(schema.orgs.slug, slug));
  return org?.label === "live";
}
