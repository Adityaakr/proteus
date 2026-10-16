import { Hono } from "hono";
import { env } from "../env";
import { HttpError } from "../lib/http";

/**
 * Same-origin, read-only JSON-RPC relay to Arc testnet. The browser reads balances and receipts through
 * this when its direct request to the public RPC is blocked (CORS, bot challenge, corporate proxy).
 * Only read methods pass; nothing here signs or submits transactions.
 */
const READ_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getLogs",
  "eth_getCode",
  "net_version",
]);

interface RpcReq { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }

function reject(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export const rpcRoutes = new Hono();

rpcRoutes.post("/rpc", async (c) => {
  let body: RpcReq | RpcReq[];
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(400, "invalid json");
  }
  const batch = Array.isArray(body);
  const reqs: RpcReq[] = batch ? (body as RpcReq[]) : [body as RpcReq];
  if (reqs.length === 0 || reqs.length > 20) throw new HttpError(400, "batch size must be 1..20");
  const bad = reqs.find((r) => !r || typeof r.method !== "string" || !READ_METHODS.has(r.method));
  if (bad) {
    const resp = reqs.map((r) => (r && typeof r.method === "string" && READ_METHODS.has(r.method) ? null : reject(r?.id, -32601, "method not relayed")));
    if (resp.every(Boolean)) return c.json(batch ? resp : resp[0]);
    throw new HttpError(400, "unsupported method in batch");
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  try {
    const upstream = await fetch(env.ARC_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await upstream.text();
    if (!upstream.ok) return c.body(JSON.stringify(batch ? reqs.map((r) => reject(r.id, -32000, `upstream rpc ${upstream.status}`)) : reject(reqs[0]?.id, -32000, `upstream rpc ${upstream.status}`)), 502, { "content-type": "application/json" });
    return c.body(text, 200, { "content-type": "application/json" });
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "upstream rpc timed out" : "upstream rpc unreachable";
    const payload = batch ? reqs.map((r) => reject(r.id, -32000, msg)) : reject(reqs[0]?.id, -32000, msg);
    return c.body(JSON.stringify(payload), 502, { "content-type": "application/json" });
  } finally {
    clearTimeout(timer);
  }
});
