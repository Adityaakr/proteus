import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { Hono } from "hono";
import { ApprovalDecisionBody, CostUpdateBody, PolicyUpdateBody, getQuoteCandidates, toMicro } from "@proteus/domain";
import { db, schema } from "../db";
import { HttpError, json, toBig } from "../lib/http";
import { id } from "../lib/ids";
import { evaluationContext, loadProductById, publicProduct } from "../services/catalog";
import { dealView, listDeals, sellerCloseTerm } from "../services/deals";
import { listNegotiations, reviveCandidate, sellerNegotiationView } from "../services/negotiation";
import { decideApproval } from "../services/quotes";
import { confirmDelivery } from "../services/delivery";
import { exportCsv, type ExportKind } from "../services/exports";
import { updateCost, updatePolicy } from "../services/product-rules";
import { catalogSyncView, runCatalogSync, saveCatalogSync } from "../services/catalog-sync";
import { createSandboxSession, requireSession, session } from "./session";
import { features } from "../env";

export const appRoutes = new Hono();

appRoutes.post("/app/session/sandbox", async (c) => json(c, await createSandboxSession(c, (await c.req.json().catch(() => ({})) as { slug?: string }).slug)));

appRoutes.use("/app/*", requireSession);

appRoutes.get("/app/session", async (c) => {
  const s = session(c);
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, s.orgId));
  return json(c, { org: org ? { id: org.id, slug: org.slug, name: org.name, label: org.label } : null, kind: s.kind });
});

appRoutes.get("/app/overview", async (c) => {
  const { orgId } = session(c);
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  const quotes = await db.select({ n: dsql<number>`count(*)` }).from(schema.quotes).where(eq(schema.quotes.orgId, orgId));
  const approvalsPending = await db.select({ n: dsql<number>`count(*)` }).from(schema.approvals).where(and(eq(schema.approvals.orgId, orgId), eq(schema.approvals.status, "pending")));
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId));
  const funded = deals.filter((d) => d.deposit > 0n);
  const usage = await db.select({ n: dsql<number>`coalesce(sum(units),0)` }).from(schema.serviceRequests).where(and(eq(schema.serviceRequests.orgId, orgId), eq(schema.serviceRequests.billable, true)));
  const fundedValue = funded.reduce((s, d) => s + d.deposit, 0n);
  const earned = funded.reduce((s, d) => s + d.settled, 0n);
  const refunded = funded.reduce((s, d) => s + d.refunded, 0n);
  return json(c, {
    quotes: Number(quotes[0]?.n ?? 0),
    approvalsPending: Number(approvalsPending[0]?.n ?? 0),
    dealsFunded: funded.length,
    dealsAwaitingFunding: deals.filter((d) => d.status === "awaiting_funding" || d.status === "funding_pending").length,
    fundedValue,
    earnedSettled: earned,
    pendingLiability: fundedValue - earned - refunded,
    refunded,
    usageUnits: Number(usage[0]?.n ?? 0),
    labels: { seller: org?.label ?? "sandbox", network: features.network, note: org?.label === "sandbox" ? "Example seller: figures are testnet USDC and are excluded from live traction counters." : "Arc testnet USDC." },
  });
});

async function productWithPrivate(orgId: string, productId: string) {
  const lp = await loadProductById(productId);
  if (lp.org.id !== orgId) throw new HttpError(404, "product not found");
  const costs = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, productId)).orderBy(desc(schema.costModels.version));
  const pols = await db.select().from(schema.policies).where(eq(schema.policies.productId, productId)).orderBy(desc(schema.policies.version));
  const ctx = evaluationContext(lp);
  const preview = [
    { label: "Requested 2,000 units with a $1,500 budget", candidates: getQuoteCandidates(ctx, { desiredUnits: 2000n, budget: toMicro("1500"), integrations: [], notes: [], openQuestions: [] }) },
    { label: "Budget $1,500 only", candidates: getQuoteCandidates(ctx, { budget: toMicro("1500"), integrations: [], notes: [], openQuestions: [] }) },
  ];
  const pub = publicProduct(lp);
  const up = lp.row.upstream as { url?: string; authHeader?: string; secretEnc?: string } | null;
  return { ...pub, id: lp.row.id, active: lp.row.active, adapter: lp.row.adapter, service: lp.row.adapter === "http" ? { kind: "http", url: up?.url ?? null, authHeader: up?.authHeader ?? null, hasSecret: Boolean(up?.secretEnc) } : lp.row.adapter === "demo" ? { kind: "example" } : { kind: "sample-store" }, maxUnitsPerDeal: lp.product.maxUnitsPerDeal, public: pub, cost: lp.cost, policy: lp.policy, costHistory: costs, policyHistory: pols, preview, previewCases: preview, labels: { seller: lp.org.label, private: "Seller only. Never shown to buyers." } };
}

appRoutes.get("/app/products", async (c) => {
  const { orgId } = session(c);
  const rows = await db.select().from(schema.products).where(eq(schema.products.orgId, orgId));
  const out = [];
  for (const r of rows) out.push(await productWithPrivate(orgId, r.id));
  return json(c, out);
});

appRoutes.get("/app/products/:id", async (c) => json(c, await productWithPrivate(session(c).orgId, c.req.param("id"))));

/** Listing on or off. Hidden products leave the market; existing deals and keys keep working. */
appRoutes.patch("/app/products/:id/listing", async (c) => {
  const { orgId } = session(c);
  const body = (await c.req.json()) as { active?: boolean };
  if (typeof body.active !== "boolean") throw new HttpError(400, "active must be true or false");
  const [row] = await db.select().from(schema.products).where(and(eq(schema.products.id, c.req.param("id")), eq(schema.products.orgId, orgId)));
  if (!row) throw new HttpError(404, "product not found");
  await db.update(schema.products).set({ active: body.active }).where(eq(schema.products.id, row.id));
  return json(c, await productWithPrivate(orgId, row.id));
});

/** Permanent removal, only when nothing references the product. Otherwise unpublish instead. */
appRoutes.delete("/app/products/:id", async (c) => {
  const { orgId } = session(c);
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.products).where(and(eq(schema.products.id, id), eq(schema.products.orgId, orgId)));
  if (!row) throw new HttpError(404, "product not found");
  const [deals] = await db.select({ n: dsql<number>`count(*)` }).from(schema.deals).where(eq(schema.deals.productId, id));
  const [negs] = await db.select({ n: dsql<number>`count(*)` }).from(schema.negotiations).where(eq(schema.negotiations.productId, id));
  const [ppc] = await db.select({ n: dsql<number>`count(*)` }).from(schema.payPerCallPayments).where(eq(schema.payPerCallPayments.productId, id));
  if (Number(deals?.n ?? 0) + Number(negs?.n ?? 0) + Number(ppc?.n ?? 0) > 0) {
    throw new HttpError(409, "this product has negotiations, deals or paid calls on record; unpublish it instead so those records stay intact");
  }
  await db.delete(schema.policies).where(eq(schema.policies.productId, id));
  await db.delete(schema.costModels).where(eq(schema.costModels.productId, id));
  await db.delete(schema.products).where(eq(schema.products.id, id));
  return json(c, { deleted: id });
});

appRoutes.post("/app/products/:id/preview", async (c) => {
  const { orgId } = session(c);
  const lp = await loadProductById(c.req.param("id"));
  if (lp.org.id !== orgId) throw new HttpError(404, "product not found");
  const body = (await c.req.json()) as { desiredUnits?: string; budget?: string; integrations?: string[] };
  const candidates = getQuoteCandidates(evaluationContext(lp), { desiredUnits: body.desiredUnits ? toBig(body.desiredUnits) : undefined, budget: body.budget ? toBig(body.budget) : undefined, integrations: body.integrations ?? [], notes: [], openQuestions: [] });
  return json(c, { candidates, policyVersion: lp.policy.version, costVersion: lp.cost.version });
});

appRoutes.patch("/app/products/:id/policy", async (c) => {
  const { orgId } = session(c);
  const lp = await loadProductById(c.req.param("id"));
  if (lp.org.id !== orgId) throw new HttpError(404, "product not found");
  await updatePolicy(lp, PolicyUpdateBody.parse(await c.req.json()));
  return json(c, await productWithPrivate(orgId, lp.row.id));
});

appRoutes.patch("/app/products/:id/cost", async (c) => {
  const { orgId } = session(c);
  const lp = await loadProductById(c.req.param("id"));
  if (lp.org.id !== orgId) throw new HttpError(404, "product not found");
  // Existing accepted deals are untouched by design: their terms are frozen and hashed.
  await updateCost(lp, CostUpdateBody.parse(await c.req.json()));
  return json(c, await productWithPrivate(orgId, lp.row.id));
});

/* Catalog sync: the seller's own endpoint keeps stock, cost and order rules current. */
appRoutes.get("/app/catalog-sync", async (c) => json(c, await catalogSyncView(session(c).orgId)));
appRoutes.put("/app/catalog-sync", async (c) => {
  const s = session(c);
  if (s.kind !== "privy") throw new HttpError(403, "sign in as the owner to change catalog sync");
  return json(c, await saveCatalogSync(s.orgId, (await c.req.json()) as Record<string, unknown>));
});
appRoutes.post("/app/catalog-sync/run", async (c) => json(c, await runCatalogSync(session(c).orgId)));

appRoutes.get("/app/negotiations", async (c) => json(c, await listNegotiations(session(c).orgId)));
appRoutes.get("/app/negotiations/:id", async (c) => json(c, await sellerNegotiationView(session(c).orgId, c.req.param("id"))));

appRoutes.get("/app/approvals", async (c) => {
  const { orgId } = session(c);
  const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.orgId, orgId)).orderBy(desc(schema.approvals.createdAt));
  const out = [];
  for (const a of rows) {
    const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, a.quoteId));
    const cand = q ? reviveCandidate(q.candidate as Record<string, unknown>) : undefined;
    const [neg] = q ? await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, q.negotiationId)) : [];
    out.push({ ...a, quote: q ? { id: q.id, status: q.status, negotiationId: q.negotiationId, expiresAt: q.expiresAt } : null, candidate: cand, buyerAddress: neg?.buyerAddress ?? null });
  }
  return json(c, out);
});

appRoutes.post("/app/approvals/:id/decision", async (c) => {
  const s = session(c);
  const body = ApprovalDecisionBody.parse(await c.req.json());
  return json(c, await decideApproval(s.orgId, c.req.param("id"), body.decision, body.reason, s.address ?? `session:${s.kind}`, body.ownerSignature));
});

appRoutes.get("/app/deals", async (c) => json(c, await listDeals(session(c).orgId)));

appRoutes.get("/app/deals/:id", async (c) => {
  const { orgId } = session(c);
  const view = await dealView(c.req.param("id"));
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, view.id));
  if (!deal || deal.orgId !== orgId) throw new HttpError(404, "deal not found");
  const [q] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, deal.quoteId));
  const journal = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.dealId, deal.id)).orderBy(desc(schema.journalEntries.createdAt));
  const chainTxs = await db.select().from(schema.chainTxs).where(eq(schema.chainTxs.dealId, deal.id)).orderBy(desc(schema.chainTxs.createdAt));
  return json(c, { ...view, economics: q ? reviveCandidate(q.candidate as Record<string, unknown>).economics : null, candidate: q ? reviveCandidate(q.candidate as Record<string, unknown>) : null, journal, chainTxs, negotiationId: deal.negotiationId });
});

appRoutes.post("/app/deals/:id/close-term", async (c) => json(c, await sellerCloseTerm(session(c).orgId, c.req.param("id"))));

/** Seller-confirmed delivery (physical goods, offline work): records N delivered units with proof as a signed receipt. */
appRoutes.post("/app/deals/:id/deliveries", async (c) => {
  const s = session(c);
  const b = (await c.req.json()) as { units?: number; note?: string; proofUrl?: string; requestId?: string };
  return json(c, await confirmDelivery(s.orgId, c.req.param("id"), { units: Number(b.units), note: String(b.note ?? ""), proofUrl: b.proofUrl || undefined, requestId: String(b.requestId ?? "") }, s.address ?? `${s.kind}:${s.orgId}`), 201);
});

/** Accounting CSV: deals, receipts or journal (QuickBooks/Xero journal-import columns); every row links its Arc tx. */
appRoutes.get("/app/export.csv", async (c) => {
  const { filename, body } = await exportCsv(session(c).orgId, (c.req.query("kind") ?? "deals") as ExportKind);
  c.header("content-type", "text/csv; charset=utf-8");
  c.header("content-disposition", `attachment; filename="${filename}"`);
  return c.body(body);
});

appRoutes.get("/app/finance", async (c) => {
  const { orgId } = session(c);
  const deals = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId));
  const funded = deals.reduce((s, d) => s + d.deposit, 0n);
  const settled = deals.reduce((s, d) => s + d.settled, 0n);
  const refunded = deals.reduce((s, d) => s + d.refunded, 0n);
  const reqs = await db.select().from(schema.serviceRequests).where(and(eq(schema.serviceRequests.orgId, orgId), eq(schema.serviceRequests.billable, true)));
  // Earned-but-unsettled: max cumulative charged per deal minus settled.
  const chargedByDeal = new Map<string, bigint>();
  for (const r of reqs) chargedByDeal.set(r.dealId, r.cumulativeCharged > (chargedByDeal.get(r.dealId) ?? 0n) ? r.cumulativeCharged : (chargedByDeal.get(r.dealId) ?? 0n));
  const earnedUnsettled = deals.reduce((s, d) => s + ((chargedByDeal.get(d.id) ?? 0n) - d.settled > 0n ? (chargedByDeal.get(d.id) ?? 0n) - d.settled : 0n), 0n);
  const journal = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.orgId, orgId)).orderBy(desc(schema.journalEntries.createdAt)).limit(200);
  const discrepancies = deals.filter((d) => d.balancesSource === "chain" && d.deposit - d.settled - d.refunded < 0n).map((d) => ({ dealId: d.id, issue: "negative remaining" }));
  return json(c, { funded, settled, earnedUnsettled, liability: funded - settled - refunded, refunded, journal, reconciliation: { lastRunAt: deals.reduce<Date | null>((m, d) => (!m || d.updatedAt > m ? d.updatedAt : m), null), discrepancies }, labels: { network: features.network, note: "Deposits are customer liabilities until usage is accepted and settled. Unused balances are never seller revenue." } });
});
