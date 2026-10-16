/**
 * Removes the seeded demo sellers so the market only lists real businesses. Orgs with deals are never
 * deleted (their records are on chain); their products are hidden from the market instead.
 */
import { eq, inArray } from "drizzle-orm";
import { db, schema, sql } from "../src/db";

const DEMO_SLUGS = ["harbor-logistics", "kaidata", "meridian-legal", "vantage-api", "orbit-labs", "tidewater-health"];
const HIDE_SLUGS = ["northwind-support"];

async function main() {
  const orgs = await db.select().from(schema.orgs).where(inArray(schema.orgs.slug, DEMO_SLUGS));
  for (const org of orgs) {
    const deals = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.orgId, org.id));
    if (deals.length) {
      await db.update(schema.products).set({ active: false }).where(eq(schema.products.orgId, org.id));
      console.log(`${org.slug}: has ${deals.length} deals, products hidden instead of deleted`);
      continue;
    }
    const negs = await db.select({ id: schema.negotiations.id }).from(schema.negotiations).where(eq(schema.negotiations.orgId, org.id));
    const negIds = negs.map((n) => n.id);
    if (negIds.length) {
      await db.delete(schema.turns).where(inArray(schema.turns.negotiationId, negIds));
      await db.delete(schema.decisions).where(inArray(schema.decisions.negotiationId, negIds));
      await db.delete(schema.quotes).where(inArray(schema.quotes.negotiationId, negIds));
      await db.delete(schema.negotiations).where(inArray(schema.negotiations.id, negIds));
    }
    await db.delete(schema.approvals).where(eq(schema.approvals.orgId, org.id));
    for (const t of [schema.agentRuns, schema.journalEntries, schema.sessions, schema.sampleOrders, schema.orgSigners, schema.memberships, schema.policies, schema.costModels, schema.products] as const) {
      await db.delete(t).where(eq((t as typeof schema.products).orgId, org.id));
    }
    await db.delete(schema.orgs).where(eq(schema.orgs.id, org.id));
    console.log(`${org.slug}: removed`);
  }
  for (const slug of HIDE_SLUGS) {
    const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, slug));
    if (org) {
      await db.update(schema.products).set({ active: false }).where(eq(schema.products.orgId, org.id));
      console.log(`${slug}: products hidden from the market (historical deals kept)`);
    }
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
