/**
 * Production start: explain the environment before anything runs, wait for Postgres, sync the schema,
 * bootstrap an empty market, then serve the API and the built site. Every failure prints why.
 */
import { spawnSync } from "node:child_process";
import postgres from "postgres";

function fail(msg: string): never {
  console.error(`\n[start] ${msg}\n`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set. On Railway, add the Postgres plugin to THIS service and reference its DATABASE_URL in the service variables. If you see this on a service that is not the API (for example a site or domain service), delete that service: only @proteus/server should run.");
let host = "";
try {
  const u = new URL(url);
  host = u.hostname;
  console.log(`[start] database ${u.hostname}:${u.port || "5432"}/${u.pathname.replace("/", "")} as ${u.username || "?"}`);
} catch {
  fail("DATABASE_URL is not a valid postgres:// URL.");
}
if (process.env.NODE_ENV === "production" && (host === "localhost" || host === "127.0.0.1")) fail("DATABASE_URL points at localhost; in production reference the Postgres plugin's URL.");
for (const k of ["ESCROW_ADDRESS", "RELAYER_PRIVATE_KEY", "SELLER_SIGNER_PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "SESSION_SECRET", "OPENROUTER_API_KEY"]) {
  if (!process.env[k]) console.warn(`[start] ${k} is not set${k === "ESCROW_ADDRESS" ? ": the reconciler and funding stay off" : k === "OPENROUTER_API_KEY" ? ": negotiation falls back to the rule-based adapter and Proteus-run services refuse unbilled" : ""}`);
}
if (process.env.PRIVY_DEV_BYPASS === "1" && process.env.NODE_ENV === "production") console.warn("[start] PRIVY_DEV_BYPASS is set in production; it is ignored");

async function waitForDb() {
  const deadline = Date.now() + 90_000;
  let attempt = 0;
  while (true) {
    attempt++;
    const sql = postgres(url!, { max: 1, connect_timeout: 10 });
    try {
      await sql`select 1`;
      await sql.end();
      console.log(`[start] postgres reachable (attempt ${attempt})`);
      return;
    } catch (e) {
      await sql.end().catch(() => {});
      const msg = String((e as Error).message ?? e);
      if (Date.now() > deadline) fail(`postgres is not reachable after 90s: ${msg}. Check DATABASE_URL and that the Postgres plugin is in the same project.`);
      console.log(`[start] waiting for postgres (${msg.slice(0, 80)})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function run(label: string, cmd: string, args: string[]) {
  console.log(`[start] ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) fail(`${label} failed (exit ${r.status}). The output above is the reason.`);
}

async function main() {
  await waitForDb();
  run("syncing the schema (drizzle-kit push)", "npx", ["drizzle-kit", "push", "--force"]);
  run("bootstrapping the market", "npx", ["tsx", "scripts/bootstrap.ts"]);
  console.log("[start] starting the API");
  await import("../src/index");
}
main().catch((e) => fail(String((e as Error).stack ?? e)));
