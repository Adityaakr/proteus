/**
 * Seeds Lumen Voice, the voice seller that was onboarded through the seller UI locally. The hosted market
 * has no seller-owned upstream to forward to, so here its three products run on the Proteus service agent
 * (adapter "demo") and carry the "sandbox" label like the other example sellers. Idempotent.
 */
import { and, eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { toMicro } from "@proteus/domain";
import { db, schema, sql } from "../src/db";
import { env } from "../src/env";
import { id } from "../src/lib/ids";
import { ensureOrgSigner } from "../src/chain/signer";

interface Tier { id: string; name: string; units: string; usd: string; includes: string[] }
interface Product {
  slug: string; name: string; summary: string; unitLabel: string; billableUnit: string; capabilities: string[]; integrations: string[]; tiers: Tier[]; maxUnits: string; perCall: string; starters: string[]; refundPolicy: string;
  cost: { variable: string; bps: number }; policy: { marginBps: number; discountBps: number; approvalUsd: string; capacity: bigint };
}

const ORG = { slug: "lumen-voice", name: "Lumen Voice", logo: "/assets/logos/lumen.png", tagline: "AI receptionist and callback booking for service businesses.", category: "voice", accent: "#111111" };

const PRODUCTS: Product[] = [
  {
    slug: "ai-receptionist", name: "AI receptionist", summary: "Answers inbound calls for service businesses, books appointments and hands off anything it should not decide.", unitLabel: "booked call", billableUnit: "one call answered and a booking recorded in the calendar", capabilities: ["Answer missed calls", "Book appointments"], integrations: ["rest-api"],
    tiers: [{ id: "starter", name: "Starter", units: "500", usd: "0.50", includes: ["Call answering", "Booking"] }], maxUnits: "5000", perCall: "0.70", starters: ["We need about 500 booked calls a month. What can you offer?"], refundPolicy: "Unused balance refundable after the term plus grace.",
    cost: { variable: "0.16", bps: 50 }, policy: { marginBps: 3500, discountBps: 1500, approvalUsd: "2000", capacity: 4000n },
  },
  {
    slug: "after-hours-answering", name: "After-hours answering", summary: "Covers the phone when the office is closed: takes the message, books the slot, and escalates emergencies to the on-call line.", unitLabel: "call", billableUnit: "One after-hours call answered and either booked, messaged, or escalated with a written summary delivered to the business.", capabilities: ["Message taking", "Appointment booking", "Emergency escalation", "Written summaries", "Calendar sync"], integrations: ["rest-api", "webhook"],
    tiers: [{ id: "starter", name: "Starter", units: "200", usd: "0.30", includes: ["Message taking", "Booking"] }, { id: "practice", name: "Practice", units: "1000", usd: "0.22", includes: ["Message taking", "Booking", "Emergency escalation", "Written summaries"] }], maxUnits: "10000", perCall: "0.40", starters: ["We need about 200 calls a month. What can you offer?"], refundPolicy: "Unused prepaid calls are refunded to the buyer wallet when the term ends.",
    cost: { variable: "0.09", bps: 50 }, policy: { marginBps: 3200, discountBps: 1500, approvalUsd: "1500", capacity: 40000n },
  },
  {
    slug: "callback-booking", name: "Callback booking", summary: "Books a confirmed callback for a named customer and hands cancellations to a person.", unitLabel: "booking", billableUnit: "One confirmed callback booked by the Lumen Voice agent for a named customer account.", capabilities: ["Callback booking", "Cancellation handoff"], integrations: ["rest-api"],
    tiers: [{ id: "trial", name: "Trial", units: "5", usd: "0.15", includes: ["Callback booking"] }, { id: "starter", name: "Starter", units: "500", usd: "0.10", includes: ["Callback booking", "Cancellation handoff"] }], maxUnits: "5000", perCall: "0.10", starters: ["We need about 5 bookings a month. What can you offer?"], refundPolicy: "Unused prepaid bookings are refunded to the buyer wallet when the term ends.",
    cost: { variable: "0.03", bps: 50 }, policy: { marginBps: 3000, discountBps: 1500, approvalUsd: "500", capacity: 20000n },
  },
];

async function main() {
  const signer = env.SELLER_SIGNER_PRIVATE_KEY ? privateKeyToAccount(env.SELLER_SIGNER_PRIVATE_KEY as `0x${string}`).address : "0x0000000000000000000000000000000000000001";
  const payee = env.OWNER_ADDRESS ?? signer;
  const brand = { logoUrl: ORG.logo, markUrl: ORG.logo.replace("/logos/", "/logos/mark-"), tagline: ORG.tagline, category: ORG.category, accent: ORG.accent };
  let [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, ORG.slug));
  if (!org) [org] = await db.insert(schema.orgs).values({ id: id("org"), slug: ORG.slug, name: ORG.name, label: "sandbox", brand, ownerAddress: env.OWNER_ADDRESS, sellerSignerAddress: signer, payeeAddress: payee }).returning();
  const orgId = org!.id;
  await ensureOrgSigner(orgId);
  for (const p of PRODUCTS) {
    let [product] = await db.select().from(schema.products).where(and(eq(schema.products.orgId, orgId), eq(schema.products.slug, p.slug)));
    const productId = product?.id ?? id("prod");
    const pub = {
      id: productId, slug: p.slug, name: p.name, summary: p.summary, category: ORG.category, billableUnit: p.billableUnit, unitLabel: p.unitLabel, supportedIntegrations: p.integrations, capabilities: p.capabilities,
      tiers: p.tiers.map((t) => ({ id: t.id, name: t.name, includedUnits: t.units, unitPrice: { num: toMicro(t.usd).toString(), den: "1" }, includes: t.includes })),
      maxUnitsPerDeal: p.maxUnits, termDays: 30, refundPolicy: p.refundPolicy,
      ...(product ? { request: (product.public as Record<string, unknown>).request } : {}),
    };
    if (!product) [product] = await db.insert(schema.products).values({ id: productId, orgId, slug: p.slug, public: pub, starters: p.starters, adapter: "demo", payPerCallPrice: toMicro(p.perCall), active: true }).returning();
    else await db.update(schema.products).set({ public: pub, starters: p.starters, payPerCallPrice: toMicro(p.perCall), active: true }).where(eq(schema.products.id, productId));
    const costs = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, productId));
    if (!costs.length) await db.insert(schema.costModels).values({ id: id("cost"), orgId, productId, version: 1, variableCostPerUnit: toMicro(p.cost.variable), directCostPerDeal: 0n, txCostBps: p.cost.bps, freshUntil: new Date(Date.now() + 30 * 86400 * 1000) });
    const pols = await db.select().from(schema.policies).where(eq(schema.policies.productId, productId));
    if (!pols.length) await db.insert(schema.policies).values({ id: id("pol"), orgId, productId, version: 1, minMarginBps: p.policy.marginBps, maxDiscountBps: p.policy.discountBps, approvalThreshold: toMicro(p.policy.approvalUsd), prepaidMinimum: 0n, availableCapacityUnits: p.policy.capacity, quoteTtlSeconds: 6 * 3600, allowNonPositiveContribution: false });
    console.log(`lumen-voice ${p.slug} product ${productId}`);
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
