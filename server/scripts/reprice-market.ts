/** Moves the listed example products to the lower end of market pricing. Idempotent; seed files carry the same numbers. */
import { and, eq } from "drizzle-orm";
import { toMicro } from "@proteus/domain";
import { db, schema } from "../src/db";

type Row = { org: string; slug: string; tiers: string[]; perCall: string; variable: string; direct: string; minUsd: string };
const ROWS: Row[] = [
  { org: "lantern-compliance", slug: "screening-checks", tiers: ["0.12", "0.08"], perCall: "0.20", variable: "0.03", direct: "5", minUsd: "10" },
  { org: "ledgerline", slug: "invoice-processing", tiers: ["0.25", "0.18"], perCall: "0.35", variable: "0.07", direct: "5", minUsd: "10" },
  { org: "lumen-voice", slug: "after-hours-answering", tiers: ["0.30", "0.22"], perCall: "0.40", variable: "0.09", direct: "5", minUsd: "10" },
  { org: "lumen-voice", slug: "ai-receptionist", tiers: ["0.50"], perCall: "0.70", variable: "0.16", direct: "5", minUsd: "10" },
  { org: "lumen-voice", slug: "callback-booking", tiers: ["0.15", "0.10"], perCall: "0.10", variable: "0.03", direct: "0", minUsd: "1" },
  { org: "orbit-labs", slug: "embeddings", tiers: ["0.02", "0.015"], perCall: "0.03", variable: "0.006", direct: "1", minUsd: "5" },
  { org: "orbit-labs", slug: "gpu-hours", tiers: ["1.90", "1.60"], perCall: "2.20", variable: "0.95", direct: "10", minUsd: "20" },
  { org: "orbit-labs", slug: "inference-capacity", tiers: ["0.30", "0.22"], perCall: "0.40", variable: "0.09", direct: "2", minUsd: "10" },
  { org: "pilotlight-ops", slug: "operator-tasks", tiers: ["0.60", "0.45"], perCall: "0.80", variable: "0.18", direct: "5", minUsd: "10" },
  { org: "tessera-vendors", slug: "vendor-evaluations", tiers: ["0.60", "0.45"], perCall: "0.80", variable: "0.18", direct: "2", minUsd: "10" },
];

async function main() {
  for (const r of ROWS) {
    const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, r.org));
    if (!org) { console.log(`skip ${r.org}: not seeded`); continue; }
    const [p] = await db.select().from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.slug, r.slug)));
    if (!p) { console.log(`skip ${r.org}/${r.slug}: no product`); continue; }
    const pub = p.public as { tiers: { unitPrice: { num: string; den: string } }[] };
    if (pub.tiers.length !== r.tiers.length) { console.log(`skip ${r.slug}: ${pub.tiers.length} tiers, table has ${r.tiers.length}`); continue; }
    pub.tiers = pub.tiers.map((t, i) => ({ ...t, unitPrice: { num: toMicro(r.tiers[i]!).toString(), den: "1" } }));
    await db.update(schema.products).set({ public: pub, payPerCallPrice: toMicro(r.perCall) }).where(eq(schema.products.id, p.id));
    const [cost] = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, p.id)).orderBy(schema.costModels.version);
    const costs = await db.select().from(schema.costModels).where(eq(schema.costModels.productId, p.id));
    const latestCost = costs.sort((a, b) => b.version - a.version)[0] ?? cost;
    if (latestCost) await db.update(schema.costModels).set({ variableCostPerUnit: toMicro(r.variable), directCostPerDeal: toMicro(r.direct) }).where(eq(schema.costModels.id, latestCost.id));
    const pols = await db.select().from(schema.policies).where(eq(schema.policies.productId, p.id));
    const latestPol = pols.sort((a, b) => b.version - a.version)[0];
    if (latestPol) await db.update(schema.policies).set({ prepaidMinimum: toMicro(r.minUsd) }).where(eq(schema.policies.id, latestPol.id));
    console.log(`repriced ${r.org}/${r.slug}: tiers ${r.tiers.join("/")}, per call ${r.perCall}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
