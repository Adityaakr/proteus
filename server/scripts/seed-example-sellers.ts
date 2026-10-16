/**
 * Seeds the EXAMPLE sellers. Each one is modeled on a customer segment the tools in our comparison serve:
 *   usage-based AI infrastructure (Metronome's customers), API-first fintech and data startups (Sequence's),
 *   legal and SaaS scale-ups (Nue's), ops teams in midsize B2B (DealHub's), and vertical operators.
 * Prices sit at public market rates for each category. Brands are Proteus AI's own invented marks, never a real
 * company; every seller carries label "sandbox" (shown as "Example seller"), runs the deterministic example
 * adapter, and is excluded from live counters. Deals on them are real Arc testnet transactions. Idempotent.
 */
import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { toMicro } from "@proteus/domain";
import { db, schema, sql } from "../src/db";
import { env } from "../src/env";
import { id } from "../src/lib/ids";
import { ensureOrgSigner } from "../src/chain/signer";

interface DemoTier { id: string; name: string; units: string; usd: string; includes: string[] }
interface DemoSeller {
  slug: string; name: string; logo: string; tagline: string; category: string; accent: string;
  product: { slug: string; name: string; summary: string; unitLabel: string; billableUnit: string; capabilities: string[]; integrations: string[]; tiers: DemoTier[]; maxUnits: string; termDays: number; perCall: string; starters: string[] };
  cost: { variable: string; direct: string; bps: number };
  policy: { marginBps: number; discountBps: number; approvalUsd: string; minUsd: string; capacity: bigint };
}

const SELLERS: DemoSeller[] = [
  {
    slug: "harbor-logistics", name: "Harbor Logistics", logo: "/assets/logos/harbor.png", tagline: "Shipment exceptions handled before the customer asks.", category: "logistics", accent: "#0f6e56",
    product: { slug: "shipment-exceptions", name: "Shipment exception handling", summary: "Detects delays, fixes addresses and files carrier claims for e-commerce shipments.", unitLabel: "exception", billableUnit: "one shipment exception resolved with a customer-facing update and a carrier action recorded", capabilities: ["Delay and misroute notices", "Address correction with the carrier", "Carrier claim filing", "Human handoff for lost parcels", "Webhooks"], integrations: ["rest-api", "webhook", "shopify"], tiers: [{ id: "starter", name: "Starter", units: "1000", usd: "0.70", includes: ["Delay notices", "Address correction", "REST API"] }, { id: "scale", name: "Scale", units: "5000", usd: "0.55", includes: ["Delay notices", "Address correction", "Claim filing", "Webhooks", "Priority queue"] }], maxUnits: "40000", termDays: 30, perCall: "1.00", starters: ["We ship about 3,000 parcels a month through two carriers and need exceptions handled automatically. Budget around $1,500.", "What does a 1,000 exception starter include?"] },
    cost: { variable: "0.31", direct: "0", bps: 50 }, policy: { marginBps: 3200, discountBps: 1200, approvalUsd: "3000", minUsd: "0", capacity: 60000n },
  },
  {
    slug: "kaidata", name: "Kaidata", logo: "/assets/logos/kaidata.png", tagline: "Company records enriched in one call.", category: "data", accent: "#5b3df5",
    product: { slug: "record-enrichment", name: "Company record enrichment", summary: "Firmographics, tech stack and validated contacts appended to each company record.", unitLabel: "record", billableUnit: "one company record returned with at least one enriched field verified against a source", capabilities: ["Firmographics", "Tech stack detection", "Contact validation", "Batch API", "Nightly refresh"], integrations: ["rest-api", "salesforce"], tiers: [{ id: "starter", name: "Starter", units: "5000", usd: "0.04", includes: ["Firmographics", "Batch API"] }, { id: "growth", name: "Growth", units: "25000", usd: "0.03", includes: ["Firmographics", "Tech stack", "Contact validation", "Batch API", "Nightly refresh"] }], maxUnits: "200000", termDays: 30, perCall: "0.08", starters: ["We have 18,000 CRM accounts to enrich this quarter and sync to Salesforce. What can you do for $600?", "Smallest package to test quality on 5,000 records?"] },
    cost: { variable: "0.011", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1500, approvalUsd: "2500", minUsd: "0", capacity: 500000n },
  },
  {
    slug: "meridian-legal", name: "Meridian Legal", logo: "/assets/logos/meridian.png", tagline: "Contract review against your playbook, with a lawyer one click away.", category: "legal", accent: "#8a4b08",
    product: { slug: "contract-review", name: "Contract clause review", summary: "Extracts clauses, flags deviations from your playbook and drafts redlines.", unitLabel: "contract", billableUnit: "one contract reviewed with clause extraction, risk flags and a redline draft delivered", capabilities: ["Clause extraction", "Playbook deviation flags", "Redline suggestions", "Attorney handoff", "Audit trail"], integrations: ["rest-api"], tiers: [{ id: "starter", name: "Starter", units: "50", usd: "18.00", includes: ["Clause extraction", "Risk flags"] }, { id: "firm", name: "Firm", units: "250", usd: "14.00", includes: ["Clause extraction", "Risk flags", "Redlines", "Attorney handoff", "Audit trail"] }], maxUnits: "2000", termDays: 30, perCall: "25.00", starters: ["We review roughly 120 vendor contracts a month. Budget is $2,000. Can you cover that?", "Try 50 contracts first, what is the price?"] },
    cost: { variable: "6.50", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1000, approvalUsd: "5000", minUsd: "0", capacity: 4000n },
  },
  {
    slug: "vantage-api", name: "Vantage API", logo: "/assets/logos/vantage.png", tagline: "Transaction risk scores in under 100 ms.", category: "risk", accent: "#b42318",
    product: { slug: "risk-scoring", name: "Transaction risk scoring", summary: "A fraud and chargeback risk score for each payment, with reason codes.", unitLabel: "transaction", billableUnit: "one transaction scored and returned with reason codes within the agreed latency", capabilities: ["Fraud score with reason codes", "Chargeback likelihood", "Velocity rules", "Webhook alerts", "Model change log"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "20000", usd: "0.012", includes: ["Fraud score", "Reason codes"] }, { id: "scale", name: "Scale", units: "100000", usd: "0.009", includes: ["Fraud score", "Reason codes", "Chargeback likelihood", "Velocity rules", "Webhook alerts"] }], maxUnits: "2000000", termDays: 30, perCall: "0.02", starters: ["We process about 60,000 card payments a month and want every one scored. Budget $700.", "What is the smallest package to integrate and test?"] },
    cost: { variable: "0.004", direct: "0", bps: 50 }, policy: { marginBps: 3000, discountBps: 1500, approvalUsd: "4000", minUsd: "0", capacity: 5000000n },
  },
  {
    slug: "orbit-labs", name: "Orbit Labs", logo: "/assets/logos/orbit.png", tagline: "Hosted inference for open models, billed per million tokens.", category: "infra", accent: "#1b4dff",
    product: { slug: "inference-capacity", name: "Inference capacity", summary: "Reserved throughput on open-weight models with per-token metering and a committed-use discount.", unitLabel: "million tokens", billableUnit: "one million input plus output tokens served from the reserved endpoint at the agreed latency", capabilities: ["Open-weight models (Llama, Qwen, Mistral)", "Reserved throughput", "OpenAI-compatible API", "Per-token metering", "Usage webhooks"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "50", usd: "0.30", includes: ["Shared capacity", "Per-token metering"] }, { id: "scale", name: "Scale", units: "500", usd: "0.22", includes: ["Reserved throughput", "Per-token metering", "Usage webhooks", "Priority support"] }], maxUnits: "5000", termDays: 30, perCall: "0.40", starters: ["We serve about 300M tokens a month on a Llama-class model and want reserved capacity. Budget around $150.", "What does 50M tokens on the starter cost, and what latency do you commit to?"] },
    cost: { variable: "0.09", direct: "0", bps: 50 }, policy: { marginBps: 3000, discountBps: 1500, approvalUsd: "3000", minUsd: "0", capacity: 20000n },
  },
  {
    slug: "tidewater-health", name: "Tidewater Health", logo: "/assets/logos/tidewater.png", tagline: "Appointment triage that books the right slot the first time.", category: "health", accent: "#0b7285",
    product: { slug: "appointment-triage", name: "Appointment triage calls", summary: "Answers inbound patient calls, triages urgency by your protocol and books into the calendar.", unitLabel: "call", billableUnit: "one inbound call triaged by protocol and either booked or handed to staff with a summary", capabilities: ["Protocol-based urgency triage", "Calendar booking", "Insurance pre-check questions", "Staff handoff with summary", "Call recording retention"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "500", usd: "1.40", includes: ["Triage", "Booking"] }, { id: "clinic", name: "Clinic", units: "2000", usd: "1.10", includes: ["Triage", "Booking", "Insurance pre-check", "Staff handoff", "Recording retention"] }], maxUnits: "20000", termDays: 30, perCall: "2.00", starters: ["Two clinics, roughly 1,200 inbound calls a month, we use a REST scheduling API. Budget $1,500.", "Start with 500 calls, what does that cost?"] },
    cost: { variable: "0.55", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1200, approvalUsd: "3000", minUsd: "0", capacity: 50000n },
  },
  {
    slug: "cairn-treasury", name: "Cairn Treasury", logo: "/assets/logos/cairn.png", tagline: "Idle cash across accounts and chains, put to work under rules you set.", category: "treasury", accent: "#0f6e56",
    product: { slug: "treasury-runs", name: "Treasury runs", summary: "A daily run that sweeps idle balances to your target allocation and reports every move, within limits you approve.", unitLabel: "treasury run", billableUnit: "one completed daily treasury run that reconciles balances across your accounts and executes approved sweeps, with a signed report", capabilities: ["Multi-account balance view", "Target allocation rules", "Approved sweeps only", "Daily signed report", "Alerting on drift"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "30", usd: "4.00", includes: ["Daily run", "Signed report"] }, { id: "ops", name: "Operations", units: "90", usd: "3.20", includes: ["Daily run", "Signed report", "Drift alerts", "Priority support"] }], maxUnits: "365", termDays: 30, perCall: "6.00", starters: ["We hold cash in four accounts and two chains and want a daily sweep to a target split. Budget around $100 a month.", "What does one treasury run include, and what can it never do without approval?"] },
    cost: { variable: "1.20", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1200, approvalUsd: "1000", minUsd: "0", capacity: 3000n },
  },
  {
    slug: "ledgerline", name: "Ledgerline", logo: "/assets/logos/ledgerline.png", tagline: "Invoices read, matched and paid under policy, not when someone gets to them.", category: "payables", accent: "#1b4dff",
    product: { slug: "invoice-processing", name: "Invoice processing", summary: "Reads each invoice, matches it to a purchase order or contract, and schedules payment inside your approval rules.", unitLabel: "invoice", billableUnit: "one invoice read, matched to its order or contract, and either scheduled for payment under policy or routed to a human with a reason", capabilities: ["OCR and field extraction", "Two-way matching", "Approval routing", "Payment scheduling", "Audit trail"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "250", usd: "0.25", includes: ["Extraction", "Matching", "Approval routing"] }, { id: "finance", name: "Finance", units: "2000", usd: "0.18", includes: ["Extraction", "Matching", "Approval routing", "Payment scheduling", "Audit trail"] }], maxUnits: "20000", termDays: 30, perCall: "0.35", starters: ["We get about 600 supplier invoices a month and pay them by hand. Budget around $400.", "Start with 250 invoices to see the match rate?"] },
    cost: { variable: "0.07", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1500, approvalUsd: "2000", minUsd: "0", capacity: 60000n },
  },
  {
    slug: "tessera-vendors", name: "Tessera", logo: "/assets/logos/tessera.png", tagline: "A memory of every vendor you have used, and a negotiator for the next one.", category: "vendors", accent: "#8a4b08",
    product: { slug: "vendor-evaluations", name: "Vendor evaluations", summary: "Scores a vendor from your own history and public signals, then runs the first negotiation round for you.", unitLabel: "evaluation", billableUnit: "one vendor evaluated with a scorecard from your records and public signals, plus a first negotiation round summarized with a recommendation", capabilities: ["Vendor scorecards", "Past-performance memory", "First-round negotiation", "Recommendation with reasons", "Export to your CRM"], integrations: ["rest-api", "salesforce"], tiers: [{ id: "starter", name: "Starter", units: "25", usd: "0.60", includes: ["Scorecard", "Recommendation"] }, { id: "procurement", name: "Procurement", units: "200", usd: "0.45", includes: ["Scorecard", "First-round negotiation", "Recommendation", "CRM export"] }], maxUnits: "5000", termDays: 30, perCall: "0.80", starters: ["We onboard about 15 contractors a month and keep losing track of who was good. Budget around $20.", "Can you evaluate 25 vendors first?"] },
    cost: { variable: "0.18", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1200, approvalUsd: "1500", minUsd: "0", capacity: 20000n },
  },
  {
    slug: "pilotlight-ops", name: "Pilotlight", logo: "/assets/logos/pilotlight.png", tagline: "Revenue in, bills out, no person sitting between every dollar.", category: "operations", accent: "#b42318",
    product: { slug: "operator-tasks", name: "Operator tasks", summary: "Runs defined back-office tasks end to end, such as paying a bill under policy or chasing a late receivable, and reports each one.", unitLabel: "task", billableUnit: "one defined operator task completed end to end under your policy, with a written record of what was done and why", capabilities: ["Bill payment under policy", "Receivables follow-up", "Subscription housekeeping", "Written task records", "Escalation to you"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "100", usd: "0.60", includes: ["Bill payment", "Task records"] }, { id: "operator", name: "Operator", units: "600", usd: "0.45", includes: ["Bill payment", "Receivables follow-up", "Subscription housekeeping", "Task records", "Escalation"] }], maxUnits: "6000", termDays: 30, perCall: "0.80", starters: ["We are a three-person agency with around 200 small admin tasks a month. Budget about $200.", "What exactly is one task, and what will you refuse to do without me?"] },
    cost: { variable: "0.18", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1500, approvalUsd: "1500", minUsd: "0", capacity: 20000n },
  },
  {
    slug: "lantern-compliance", name: "Lantern", logo: "/assets/logos/lantern.png", tagline: "Counterparties screened continuously, not once at the moment of payment.", category: "compliance", accent: "#0b7285",
    product: { slug: "screening-checks", name: "Screening checks", summary: "Screens a counterparty against sanctions and risk lists and keeps watching it, with an alert and a reason when its status changes.", unitLabel: "check", billableUnit: "one counterparty assessed from the details and documents you send: identity consistency, risk indicators, reason codes and a recommendation in a written memo. Live sanctions-list lookup is not part of this unit yet", capabilities: ["Identity and document consistency", "Address and entity risk indicators", "Reason codes", "Written memo with recommendation", "Live list screening (next)"], integrations: ["rest-api", "webhook"], tiers: [{ id: "starter", name: "Starter", units: "500", usd: "0.12", includes: ["Screening", "Reason codes"] }, { id: "monitor", name: "Monitor", units: "5000", usd: "0.08", includes: ["Screening", "Continuous monitoring", "Reason codes", "Audit export"] }], maxUnits: "100000", termDays: 30, perCall: "0.20", starters: ["We pay about 400 counterparties a month and screen them once, by hand. Budget around $150.", "Smallest package to test screening quality on 500 checks?"] },
    cost: { variable: "0.03", direct: "0", bps: 50 }, policy: { marginBps: 3500, discountBps: 1500, approvalUsd: "2000", minUsd: "0", capacity: 300000n },
  },
];

async function main() {
  const signer = env.SELLER_SIGNER_PRIVATE_KEY ? privateKeyToAccount(env.SELLER_SIGNER_PRIVATE_KEY as `0x${string}`).address : "0x0000000000000000000000000000000000000001";
  const payee = env.OWNER_ADDRESS ?? signer;

  // Northwind: the original demo seller gets its brand and a cleaner name.
  await db.update(schema.orgs).set({ name: "Northwind Commerce", brand: { logoUrl: "/assets/logos/northwind.png", tagline: "Order support for online stores, answered from the order record.", category: "support", accent: "#1b4dff" } }).where(eq(schema.orgs.slug, "northwind-support"));
  const [nw] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, "northwind-support"));
  if (nw) {
    const [prod] = await db.select().from(schema.products).where(eq(schema.products.orgId, nw.id));
    if (prod) await db.update(schema.products).set({ public: { ...(prod.public as Record<string, unknown>), summary: "Order status, delivery and tracking answers sourced from the store's order record; refunds go to a human.", category: "support" } }).where(eq(schema.products.id, prod.id));
  }

  for (const d of SELLERS) {
    let [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, d.slug));
    const brand = { logoUrl: d.logo, markUrl: d.logo.replace("/logos/", "/logos/mark-"), tagline: d.tagline, category: d.category, accent: d.accent };
    if (!org) [org] = await db.insert(schema.orgs).values({ id: id("org"), slug: d.slug, name: d.name, label: "sandbox", brand, ownerAddress: env.OWNER_ADDRESS, sellerSignerAddress: signer, payeeAddress: payee }).returning();
    else [org] = await db.update(schema.orgs).set({ name: d.name, brand, sellerSignerAddress: signer, payeeAddress: payee }).where(eq(schema.orgs.id, org.id)).returning();
    const orgId = org!.id;
    await ensureOrgSigner(orgId);
    const p = d.product;
    let [product] = await db.select().from(schema.products).where(eq(schema.products.orgId, orgId));
    const productId = product?.id ?? id("prod");
    const pub = {
      id: productId, slug: p.slug, name: p.name, summary: p.summary, category: d.category, billableUnit: p.billableUnit, unitLabel: p.unitLabel, supportedIntegrations: p.integrations, capabilities: p.capabilities,
      tiers: p.tiers.map((t) => ({ id: t.id, name: t.name, includedUnits: t.units, unitPrice: { num: toMicro(t.usd).toString(), den: "1" }, includes: t.includes })),
      maxUnitsPerDeal: p.maxUnits, termDays: p.termDays,
      refundPolicy: "Unused prepaid balance is refundable after the term ends plus a grace window, or as soon as the seller closes the term early.",
    };
    if (!product) [product] = await db.insert(schema.products).values({ id: productId, orgId, slug: p.slug, public: pub, starters: p.starters, adapter: "demo", payPerCallPrice: toMicro(p.perCall) }).returning();
    else await db.update(schema.products).set({ public: pub, starters: p.starters, adapter: "demo", payPerCallPrice: toMicro(p.perCall) }).where(eq(schema.products.id, productId));
    const costs = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, productId));
    if (!costs.length) await db.insert(schema.costModels).values({ id: id("cost"), orgId, productId, version: 1, variableCostPerUnit: toMicro(d.cost.variable), directCostPerDeal: toMicro(d.cost.direct), txCostBps: d.cost.bps, freshUntil: new Date(Date.now() + 30 * 86400 * 1000) });
    const pols = await db.select().from(schema.policies).where(eq(schema.policies.productId, productId));
    if (!pols.length) await db.insert(schema.policies).values({ id: id("pol"), orgId, productId, version: 1, minMarginBps: d.policy.marginBps, maxDiscountBps: d.policy.discountBps, approvalThreshold: toMicro(d.policy.approvalUsd), prepaidMinimum: toMicro(d.policy.minUsd), availableCapacityUnits: d.policy.capacity, quoteTtlSeconds: 6 * 3600, allowNonPositiveContribution: false });
    console.log(`demo seller ${d.slug} product ${productId}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
