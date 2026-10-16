/**
 * First-boot bootstrap for a hosted API: on an empty database it seeds the example sellers, their request
 * specs and prices, marks the three best as verified, and hides the rest from the market. Idempotent: a
 * database that already has the sellers is left alone. Run after `drizzle-kit push`.
 */
import { spawnSync } from "node:child_process";
import { eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "../src/db";

const KEEP = ["orbit-labs", "tessera-vendors", "pilotlight-ops", "ledgerline", "lantern-compliance", "lumen-voice"];
const VERIFIED = ["orbit-labs", "ledgerline", "lumen-voice"];

function run(script: string) {
  const r = spawnSync("npx", ["tsx", `scripts/${script}`], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`${script} failed with ${r.status}`);
}

async function main() {
  const present = await db.select({ slug: schema.orgs.slug }).from(schema.orgs).where(inArray(schema.orgs.slug, KEEP));
  if (present.length === 0) {
    console.log("[bootstrap] empty market, seeding example sellers");
    run("seed-example-sellers.ts");
    run("add-orbit-products.ts");
    run("set-request-specs.ts");
    run("reprice-market.ts");
    const extra = await db.select({ id: schema.orgs.id, slug: schema.orgs.slug }).from(schema.orgs).where(notInArray(schema.orgs.slug, KEEP));
    for (const o of extra) await db.update(schema.products).set({ active: false }).where(eq(schema.products.orgId, o.id));
    for (const o of await db.select().from(schema.orgs).where(inArray(schema.orgs.slug, VERIFIED))) {
      await db.update(schema.orgs).set({ brand: { ...((o.brand as Record<string, unknown>) ?? {}), verified: true } }).where(eq(schema.orgs.id, o.id));
    }
    console.log(`[bootstrap] seeded; hid ${extra.length} extra sellers; verified ${VERIFIED.join(", ")}`);
  } else {
    console.log(`[bootstrap] market already seeded (${present.map((p) => p.slug).join(", ")}), nothing to do`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error("[bootstrap] failed", e);
  process.exit(1);
});
