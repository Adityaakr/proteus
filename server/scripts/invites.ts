/**
 * Invite admin from a shell with database access (local, or `railway run` against the hosted database):
 *   tsx scripts/invites.ts generate 100 --label hackathon [--uses 1] [--expires 90]   prints the codes once
 *   tsx scripts/invites.ts list                                                          status of every code
 *   tsx scripts/invites.ts revoke <inv_id | code>
 * Codes are never stored in plaintext; save the generate output somewhere safe.
 */
import { sql } from "../src/db";
import { listInvites, mintInvites, revokeInvite } from "../src/services/invites";

function opt(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "generate") {
    const codes = await mintInvites({ count: Number(arg ?? 1), label: opt("label"), maxUses: opt("uses") ? Number(opt("uses")) : undefined, expiresInDays: opt("expires") ? Number(opt("expires")) : undefined });
    for (const c of codes) console.log(c);
    console.error(`\n${codes.length} invite code(s) minted${opt("label") ? ` with label "${opt("label")}"` : ""}. They are shown once.`);
  } else if (cmd === "list") {
    const rows = await listInvites();
    for (const r of rows) console.log(`${r.id}  ${r.status.padEnd(7)}  ${r.uses}/${r.maxUses}  ${r.label ?? "-"}  ${r.redeemedBy.map((u) => u.email ?? u.userId).join(", ")}`);
    console.error(`\n${rows.length} invite(s)`);
  } else if (cmd === "revoke" && arg) {
    console.log((await revokeInvite(arg)) ? "revoked" : "not found");
  } else {
    console.error("usage: invites.ts generate <n> [--label x] [--uses n] [--expires days] | list | revoke <id|code>");
    process.exitCode = 1;
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
