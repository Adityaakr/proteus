/** Adds two more services to the Orbit Labs example seller: embeddings and dedicated GPU hours. Idempotent. */
import { and, eq } from "drizzle-orm";
import { toMicro } from "@proteus/domain";
import { db, schema, sql } from "../src/db";
import { id } from "../src/lib/ids";

const PRODUCTS = [
  {
    slug: "embeddings", name: "Embeddings", summary: "Text embeddings from an open-weight model, metered per million tokens, for search and retrieval.", unitLabel: "million tokens",
    billableUnit: "one million input tokens embedded and returned as vectors from the reserved endpoint", capabilities: ["Open-weight embedding models", "Batch endpoint", "Per-token metering", "OpenAI-compatible API"], integrations: ["rest-api"],
    tiers: [{ id: "starter", name: "Starter", units: "500", usd: "0.02", includes: ["Batch endpoint", "Per-token metering"] }, { id: "scale", name: "Scale", units: "5000", usd: "0.015", includes: ["Batch endpoint", "Per-token metering", "Priority support"] }],
    maxUnits: "50000", termDays: 30, perCall: "0.03", starters: ["We index about 2B tokens a month for retrieval. Budget around $80.", "What does 500M tokens of embeddings cost on the starter?"],
    cost: { variable: "0.006", direct: "0", bps: 50 }, policy: { marginBps: 3000, discountBps: 1500, approvalUsd: "2000", minUsd: "0", capacity: 200000n },
  },
  {
    slug: "gpu-hours", name: "Dedicated GPU hours", summary: "Reserved H100-class GPU hours for fine-tuning and batch jobs, with the container you ship.", unitLabel: "GPU hour",
    billableUnit: "one hour of a dedicated H100-class GPU running the buyer's container, metered from start to shutdown", capabilities: ["H100-class GPUs", "Bring your own container", "Persistent volumes", "Job logs and metrics", "Webhook on completion"], integrations: ["rest-api", "webhook"],
    tiers: [{ id: "starter", name: "Starter", units: "40", usd: "1.90", includes: ["Dedicated GPU", "Job logs"] }, { id: "reserved", name: "Reserved", units: "300", usd: "1.60", includes: ["Dedicated GPU", "Persistent volumes", "Job logs and metrics", "Completion webhook"] }],
    maxUnits: "3000", termDays: 30, perCall: "2.20", starters: ["We fine-tune twice a week, roughly 60 GPU hours a month. Budget about $160.", "Can we start with 40 hours and see the throughput?"],
    cost: { variable: "0.95", direct: "0", bps: 50 }, policy: { marginBps: 3000, discountBps: 1200, approvalUsd: "3000", minUsd: "0", capacity: 12000n },
  },
];

async function main() {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, "orbit-labs"));
  if (!org) throw new Error("orbit-labs not seeded");
  for (const p of PRODUCTS) {
    const [existing] = await db.select().from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.slug, p.slug)));
    const productId = existing?.id ?? id("prod");
    const pub = { id: productId, slug: p.slug, name: p.name, summary: p.summary, category: "infra", billableUnit: p.billableUnit, unitLabel: p.unitLabel, supportedIntegrations: p.integrations, capabilities: p.capabilities, tiers: p.tiers.map((t) => ({ id: t.id, name: t.name, includedUnits: t.units, unitPrice: { num: toMicro(t.usd).toString(), den: "1" }, includes: t.includes })), maxUnitsPerDeal: p.maxUnits, termDays: p.termDays, refundPolicy: "Unused prepaid balance is refundable after the term ends plus a grace window, or as soon as the seller closes the term early." };
    if (!existing) await db.insert(schema.products).values({ id: productId, orgId: org.id, slug: p.slug, public: pub, starters: p.starters, adapter: "demo", payPerCallPrice: toMicro(p.perCall), active: true });
    else await db.update(schema.products).set({ public: pub, starters: p.starters, active: true }).where(eq(schema.products.id, productId));
    const costs = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, productId));
    if (!costs.length) await db.insert(schema.costModels).values({ id: id("cost"), orgId: org.id, productId, version: 1, variableCostPerUnit: toMicro(p.cost.variable), directCostPerDeal: toMicro(p.cost.direct), txCostBps: p.cost.bps, freshUntil: new Date(Date.now() + 30 * 86400 * 1000) });
    const pols = await db.select().from(schema.policies).where(eq(schema.policies.productId, productId));
    if (!pols.length) await db.insert(schema.policies).values({ id: id("pol"), orgId: org.id, productId, version: 1, minMarginBps: p.policy.marginBps, maxDiscountBps: p.policy.discountBps, approvalThreshold: toMicro(p.policy.approvalUsd), prepaidMinimum: toMicro(p.policy.minUsd), availableCapacityUnits: p.policy.capacity, quoteTtlSeconds: 6 * 3600, allowNonPositiveContribution: false });
    console.log("orbit product", p.slug, productId);
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
