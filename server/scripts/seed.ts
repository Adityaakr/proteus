import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { toMicro } from "@proteus/domain";
import { db, schema, sql } from "../src/db";
import { env } from "../src/env";
import { id } from "../src/lib/ids";
import { ensureOrgSigner } from "../src/chain/signer";

/**
 * Seeds the visibly labeled SANDBOX seller: one product (AI order support), a private cost model,
 * a commercial policy, and a sample store with representative orders. Idempotent.
 * Numbers are illustrative: the product sells a real endpoint, the costs are the seller's inputs.
 */
async function main() {
  const signer = env.SELLER_SIGNER_PRIVATE_KEY ? privateKeyToAccount(env.SELLER_SIGNER_PRIVATE_KEY as `0x${string}`).address : "0x0000000000000000000000000000000000000001";
  const payee = env.OWNER_ADDRESS ?? signer;

  let [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, "northwind-support"));
  if (!org) {
    [org] = await db.insert(schema.orgs).values({ id: id("org"), slug: "northwind-support", name: "Northwind Support (sandbox)", label: "sandbox", ownerAddress: env.OWNER_ADDRESS, sellerSignerAddress: signer, payeeAddress: payee }).returning();
  } else {
    [org] = await db.update(schema.orgs).set({ sellerSignerAddress: signer, payeeAddress: payee, ownerAddress: env.OWNER_ADDRESS }).where(eq(schema.orgs.id, org.id)).returning();
  }
  const orgId = org!.id;
  await ensureOrgSigner(orgId);

  const publicProduct = {
    id: "p_order_support",
    slug: "order-support",
    name: "AI order support",
    billableUnit: "one delivered order-status answer sourced from the store's order record (failed lookups and human handoffs are never billed)",
    unitLabel: "resolution",
    supportedIntegrations: ["rest-api", "webhook"],
    capabilities: ["Order status lookup", "Delivery and tracking questions", "Human handoff for refunds and returns", "REST API and webhooks"],
    tiers: [
      { id: "starter", name: "Starter", includedUnits: "1500", unitPrice: { num: "960000", den: "1" }, includes: ["Order status", "Delivery questions", "Human handoff", "REST API"] },
      { id: "growth", name: "Growth", includedUnits: "2000", unitPrice: { num: "850000", den: "1" }, includes: ["Order status", "Delivery questions", "Human handoff", "REST API", "Webhooks", "Priority support"] },
    ],
    maxUnitsPerDeal: "10000",
    termDays: 30,
    refundPolicy: "Unused prepaid balance is refundable after the term ends plus a grace window, or as soon as the seller closes the term early.",
  };
  const starters = [
    "We operate three online stores, handle roughly 8,000 support requests per month and use Zendesk. We want to automate order tracking and delivery questions, with a human handling refunds. Our budget is $1,500/month. What can you offer?",
    "We need about 2,000 order-status resolutions a month for $1,500. Can you do that?",
    "What is the smallest package you offer, and what happens if we go over it?",
  ];

  let [product] = await db.select().from(schema.products).where(eq(schema.products.orgId, orgId));
  if (!product) {
    [product] = await db.insert(schema.products).values({ id: id("prod"), orgId, slug: "order-support", public: { ...publicProduct }, starters, adapter: "order-support" }).returning();
  } else {
    [product] = await db.update(schema.products).set({ public: { ...publicProduct, id: product.id }, starters }).where(eq(schema.products.id, product.id)).returning();
  }
  const productId = product!.id;
  await db.update(schema.products).set({ public: { ...publicProduct, id: productId } }).where(eq(schema.products.id, productId));

  const [cost] = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, productId));
  if (!cost) {
    await db.insert(schema.costModels).values({ id: id("cost"), orgId, productId, version: 1, variableCostPerUnit: toMicro("0.52"), directCostPerDeal: toMicro("20"), txCostBps: 50, freshUntil: new Date(Date.now() + 30 * 86400 * 1000) });
  }
  const [pol] = await db.select().from(schema.policies).where(eq(schema.policies.productId, productId));
  if (!pol) {
    await db.insert(schema.policies).values({ id: id("pol"), orgId, productId, version: 1, minMarginBps: 3500, maxDiscountBps: 1500, approvalThreshold: toMicro("2500"), prepaidMinimum: toMicro("100"), availableCapacityUnits: 6000n, quoteTtlSeconds: 6 * 3600, allowNonPositiveContribution: false });
  }

  const orders = [
    { orderId: "A1001", email: "maya@example.com", status: "shipped", carrier: "UPS", tracking: "1Z999AA10123456784", eta: "Friday, October 17", items: [{ name: "Trail running shoes", qty: 1 }], total: "$129.00" },
    { orderId: "A1002", email: "kai@example.com", status: "processing", carrier: null, tracking: null, eta: "ships within 2 business days", items: [{ name: "Merino socks (3-pack)", qty: 2 }], total: "$54.00" },
    { orderId: "A1003", email: "lina@example.com", status: "delivered", carrier: "USPS", tracking: "9400110200881234567890", eta: "delivered Tuesday, October 14", items: [{ name: "Insulated bottle", qty: 1 }, { name: "Cap", qty: 1 }], total: "$61.50" },
    { orderId: "A1004", email: "sam@example.com", status: "out_for_delivery", carrier: "FedEx", tracking: "771234567890", eta: "today by 8 pm", items: [{ name: "Rain jacket", qty: 1 }], total: "$189.00" },
  ];
  for (const o of orders) {
    await db.insert(schema.sampleOrders).values({ id: id("ord"), orgId, ...o }).onConflictDoNothing();
  }
  console.log(`seeded sandbox seller ${org!.slug} product ${productId} signer ${signer} payee ${payee}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
