import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { AcceptBody, CounterBody, MessageBody, StartNegotiationBody } from "@proteus/domain";
import type { Address, Hex } from "viem";
import { db, schema } from "../db";
import { HttpError, json, toBig } from "../lib/http";
import { loadProductById, loadProductBySlugs, publicProduct } from "../services/catalog";
import { routeToProduct } from "../services/storefront";
import { addBuyerMessage, assertNegotiationAccess, counter, negotiationView, startNegotiation } from "../services/negotiation";
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
import { publicRatings } from "../services/ratings";
import { customerPage, customerRequest } from "../services/customer-link";

export const publicRoutes = new Hono();

publicRoutes.get("/public/sellers/:sellerSlug", async (c) => {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, c.req.param("sellerSlug")));
  if (!org) throw new HttpError(404, "seller not found");
  // Only listed products: an unlisted one (for example before the seller is registered on Arc) is not shown anywhere.
  const rows = await db.select().from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.active, true)));
  const products = [];
  for (const r of rows) products.push(publicProduct(await loadProductById(r.id)));
  const stats = await sellerStats([org.id]);
  return json(c, { ...sellerCard(org, stats.get(org.id)), products });
});

/**
 * Every rating for a seller, counted or not, with why, and the trusted-reviewer list behind its score. Anyone can
 * recompute the on-chain part with ERC-8004 getSummary(agentId, trustedReviewers, "proteus-deal", "").
 */
publicRoutes.get("/public/sellers/:sellerSlug/ratings", async (c) => {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, c.req.param("sellerSlug")));
  if (!org) throw new HttpError(404, "seller not found");
  return json(c, await publicRatings(org));
});

/** A business's public page for its own customers (scheduling services): what to fill in. */
publicRoutes.get("/public/talk/:token", async (c) => json(c, await customerPage(c.req.param("token"))));

/** A customer's request to the business's AI receptionist; the customer gets only the reply meant for them. */
publicRoutes.post("/public/talk/:token/messages", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return json(c, await customerRequest(c.req.param("token"), clientIp((n) => c.req.header(n)), body));
});

/** Store-wide deal desk: which of this seller's products a buyer message is about. */
publicRoutes.post("/public/sellers/:sellerSlug/route", async (c) => {
  limit(`store-route:${clientIp((n) => c.req.header(n))}`, 120);
  const b = (await c.req.json().catch(() => ({}))) as { message?: unknown; current?: unknown };
  if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 4000) throw new HttpError(400, "message is required (up to 4000 characters)");
  return json(c, await routeToProduct(c.req.param("sellerSlug"), b.message, typeof b.current === "string" ? b.current : undefined));
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
  const store = body.store === "open" || body.store === "continue" ? body.store : undefined;
  return json(c, await startNegotiation(body.sellerSlug, body.productSlug, buyer, store), 201);
});

/** Key holder or the signed-in owner of the buyer wallet; see assertNegotiationAccess. */
async function negotiationAccess(c: Context) {
  const a = await resolveAuth(c);
  await assertNegotiationAccess(c.req.param("id")!, c.req.header("x-negotiation-key"), async (addr) => Boolean(a && (await userOwnsAddress(a.userId, addr))));
}

publicRoutes.get("/negotiations/:id", async (c) => {
  await negotiationAccess(c);
  return json(c, await negotiationView(c.req.param("id")));
});

publicRoutes.post("/negotiations/:id/messages", async (c) => {
  // Each message runs the seller's agent (a model call): cap per visitor so an embed cannot be used to burn credits.
  limit(`neg-msg:${clientIp((n) => c.req.header(n))}`, 60);
  await negotiationAccess(c);
  const body = MessageBody.parse(await c.req.json());
  return json(c, await addBuyerMessage(c.req.param("id"), body.content));
});

publicRoutes.post("/negotiations/:id/counter", async (c) => {
  // Counters are evaluated by deterministic rules, so unlimited tries would let a buyer search for the seller's floor.
  // Cap per negotiation (holds whatever the client IP is) and per visitor.
  limit(`neg-counter-ip:${clientIp((n) => c.req.header(n))}`, 40);
  await negotiationAccess(c);
  // After the access check, so someone without the key cannot use up the buyer's counters.
  limit(`neg-counter:${c.req.param("id")}`, 12);
  const body = CounterBody.parse(await c.req.json());
  if (!body.targetTotal && !body.targetUnits) throw new HttpError(400, "targetTotal or targetUnits required");
  return json(c, await counter(c.req.param("id"), body.candidateId, { targetTotal: body.targetTotal ? toBig(body.targetTotal) : undefined, targetUnits: body.targetUnits ? toBig(body.targetUnits) : undefined }));
});

publicRoutes.post("/negotiations/:id/quotes", async (c) => {
  await negotiationAccess(c);
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
