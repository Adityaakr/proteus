/**
 * An autonomous buyer agent run against the Proteus AI MCP server, the way an AI client (Claude, Cursor) drives it:
 * the client spawns the server over stdio and calls tools in order. Arc testnet only.
 *
 *   PROTEUS_API_URL=http://localhost:8787 PROTEUS_BUYER_PRIVATE_KEY=0x... pnpm --filter @proteus/mcp exec tsx scripts/agent-run.ts
 *
 * Steps: list services -> negotiate a small trial -> a mandate that is too small is refused -> accept within the
 * mandate (seller verified on Arc) -> fund the USDC escrow -> call the service -> settle delivered usage.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const API = process.env.PROTEUS_API_URL ?? "http://localhost:8787";
const KEY = process.env.PROTEUS_BUYER_PRIVATE_KEY;
if (!KEY) throw new Error("PROTEUS_BUYER_PRIVATE_KEY is required (a testnet wallet with a little USDC).");
const SELLER = process.env.SELLER ?? "lumen-voice";
const PRODUCT = process.env.PRODUCT ?? "callback-booking";

async function connect(mandate: string) {
  const client = new Client({ name: "agent-run", version: "0.1.0" });
  await client.connect(new StdioClientTransport({ command: "pnpm", args: ["exec", "tsx", "src/index.ts"], env: { ...process.env, PROTEUS_API_URL: API, PROTEUS_BUYER_PRIVATE_KEY: KEY!, PROTEUS_MAX_PREPAID_USDC: mandate } as Record<string, string> }));
  return client;
}
async function call<T = Record<string, unknown>>(c: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const r = (await c.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  const t = r.content[0]?.text ?? "";
  if (r.isError) throw new Error(`${name}: ${t}`);
  try {
    return JSON.parse(t) as T;
  } catch {
    return { text: t } as T;
  }
}
const step = (s: string, v?: unknown) => console.log(`\n# ${s}${v === undefined ? "" : `\n${typeof v === "string" ? v : JSON.stringify(v, null, 2).slice(0, 900)}`}`);

// A tiny mandate first: the agent must refuse to sign above it.
const strict = await connect("0.01");
const tools = await strict.listTools();
step("tools", tools.tools.map((t) => t.name));
const market = await call<unknown[]>(strict, "proteus_list_services", {});
step("market listings", Array.isArray(market) ? market.length : market);
const neg = await call<{ negotiationId: string; reply: string; offers: { candidateId: string; tier: string; units: string; prepaid: string; status: string; withinMandate: boolean }[] }>(strict, "proteus_negotiate", {
  seller: SELLER,
  product: PRODUCT,
  message: "We are a small clinic. We want a trial of the smallest possible package, about 20 bookings, budget $5. What can you do?",
});
step("agent reply", neg.reply.split("\n")[0]);
step("offers", neg.offers);
const pick = [...neg.offers].filter((o) => o.status === "eligible").sort((a, b) => Number(a.prepaid.replace(/[$,]/g, "")) - Number(b.prepaid.replace(/[$,]/g, "")))[0];
if (!pick) throw new Error("no eligible offer");
try {
  await call(strict, "proteus_accept_offer", { negotiationId: neg.negotiationId, candidateId: pick.candidateId });
  throw new Error("FAIL: accepted above the mandate");
} catch (e) {
  step("mandate $0.01: refused as expected", (e as Error).message.split("\n")[0]);
}
await strict.close();

// Now a mandate that covers the trial.
const agent = await connect(String(Number(pick.prepaid.replace(/[$,]/g, "")) + 0.01));
const accepted = await call<{ dealId: string; prepaid: string; verification: unknown }>(agent, "proteus_accept_offer", { negotiationId: neg.negotiationId, candidateId: pick.candidateId });
step("accepted within mandate", accepted);
const funded = await call<{ dealId: string; status: string; approveTx: string; fundTx: string; serviceKey: string }>(agent, "proteus_fund_deal", { dealId: accepted.dealId });
step("funded", funded);
const used = await call(agent, "proteus_call_service", { dealId: accepted.dealId, product: PRODUCT, requestId: `agent-${Date.now()}`, input: { question: "Book a cleaning for Ana next Tuesday at 10am; her number is +1 555 0100.", name: "Ana", phone: "+15550100" } });
step("service call", used);
const settled = await call(agent, "proteus_settle_usage", { dealId: accepted.dealId });
step("settled", settled);
await agent.close();
console.log("\nAGENT RUN COMPLETE");
process.exit(0);
