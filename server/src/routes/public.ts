import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { AcceptBody, CounterBody, MessageBody, StartNegotiationBody } from "@proteus/domain";
import type { Address, Hex } from "viem";
import { db, schema } from "../db";
import { HttpError, json, toBig } from "../lib/http";
import { loadProductById, loadProductBySlugs, publicProduct } from "../services/catalog";
import { addBuyerMessage, counter, negotiationView, startNegotiation } from "../services/negotiation";
import { acceptQuote, createQuote, quoteView } from "../services/quotes";
import { listRecords, recordView } from "../services/review";

export const publicRoutes = new Hono();

publicRoutes.get("/public/sellers/:sellerSlug", async (c) => {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, c.req.param("sellerSlug")));
  if (!org) throw new HttpError(404, "seller not found");
  const rows = await db.select().from(schema.products).where(eq(schema.products.orgId, org.id));
  const products = [];
  for (const r of rows) products.push(publicProduct(await loadProductById(r.id)));
  return json(c, { slug: org.slug, name: org.name, label: org.label, products });
});

publicRoutes.get("/public/sellers/:sellerSlug/products/:productSlug", async (c) => {
  const lp = await loadProductBySlugs(c.req.param("sellerSlug"), c.req.param("productSlug"));
  return json(c, publicProduct(lp));
});

publicRoutes.post("/negotiations", async (c) => {
  const body = StartNegotiationBody.parse(await c.req.json());
  return json(c, await startNegotiation(body.sellerSlug, body.productSlug, body.buyerAddress), 201);
});

publicRoutes.get("/negotiations/:id", async (c) => json(c, await negotiationView(c.req.param("id"))));

publicRoutes.post("/negotiations/:id/messages", async (c) => {
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
  const dealId = await acceptQuote(c.req.param("id"), body.buyerAddress as Address, body.buyerSignature as Hex);
  const { dealView } = await import("../services/deals");
  return json(c, await dealView(dealId), 201);
});

publicRoutes.get("/review", async (c) => json(c, await listRecords()));
publicRoutes.get("/review/:publicId", async (c) => json(c, await recordView(c.req.param("publicId"))));
