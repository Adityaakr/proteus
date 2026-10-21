/**
 * Pay-per-call through Circle Gateway batching on Arc testnet, against the running API (default http://localhost:8787):
 * deposit USDC into the GatewayWallet once -> ask for the price (HTTP 402 lists the exact and the gateway schemes) ->
 * sign EIP-3009 under the GatewayWallet domain -> Gateway verifies, the service runs, Gateway settles in a batch ->
 * a retry with the same request id is a replay and is not charged again.
 *
 * Testnet only. Run: pnpm --filter server exec tsx scripts/x402-gateway-e2e.ts
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { getAddress, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../src/env";
import { TRANSFER_WITH_AUTH_TYPES } from "../src/services/x402";

if (env.CHAIN_ID === 5042) throw new Error("x402-gateway-e2e runs on Arc testnet only.");
const KEY = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!KEY) throw new Error("DEPLOYER_PRIVATE_KEY is required (testnet buyer).");
const API = process.env.PROTEUS_API_URL ?? "http://localhost:8787";
const SELLER = process.env.SELLER ?? "lumen-voice";
const PRODUCT = process.env.PRODUCT ?? "after-hours-answering";
const buyer = privateKeyToAccount(KEY);
const log = (k: string, v: unknown) => console.log(`${k.padEnd(30)} ${typeof v === "string" ? v : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`);
const assert = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`FAIL ${what}`);
  console.log(`ok   ${what}`);
};
const post = async (body: unknown) => {
  const r = await fetch(`${API}/api/pay/${SELLER}/${PRODUCT}/execute`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: (await r.json()) as Record<string, any> };
};

const gw = new GatewayClient({ chain: "arcTestnet", privateKey: KEY, rpcUrl: env.ARC_RPC_URL });
const requestId = `gw-e2e-${Date.now()}`;
const input = { question: process.env.QUESTION ?? "What are your after-hours rates for a dental clinic?" };

// 1. Price: 402 with both schemes.
const quote = await post({ requestId, payer: buyer.address, input });
assert(quote.status === 402, "unpaid call answers HTTP 402");
const g = quote.data.gateway as { signing: { domain: { name: string; version: string; chainId: string; verifyingContract: Address } }; minValiditySeconds: number; payTo: Address } | undefined;
assert(Boolean(g), "402 offers the Circle Gateway batched scheme next to exact");
const accepts = (quote.data.accepts as { extra: { name: string } }[]).map((a) => a.extra.name);
log("accepts", accepts);
const price = BigInt((quote.data.accepts as { amount: string }[])[0]!.amount);
log("price (micro-USDC)", price);

// 2. Gateway balance: deposit once if it cannot cover two calls.
let bal = await gw.getBalance();
log("buyer Gateway balance", bal.formattedAvailable);
if (bal.available < price * 2n) {
  const need = price * 2n - bal.available;
  const cents = (need + 9_999n) / 10_000n; // round up to whole cents
  const dep = await gw.deposit(`${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`);
  log("deposit tx (buyer, one time)", dep.depositTxHash);
  for (let i = 0; i < 60 && bal.available < price * 2n; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    bal = await gw.getBalance();
  }
  log("buyer Gateway balance", bal.formattedAvailable);
}
assert(bal.available >= price, "Gateway balance covers the call");
const payeeBefore = await gw.getBalance(g!.payTo).then((b) => b.total).catch(() => null);

// 3. Sign under the GatewayWallet domain, valid for Gateway's minimum window.
const now = Math.floor(Date.now() / 1000);
const authorization = { from: buyer.address, to: getAddress(g!.payTo), value: price.toString(), validAfter: "0", validBefore: String(now + g!.minValiditySeconds + 600), nonce: quote.data.nonce as Hex };
const d = g!.signing.domain;
const signature = await buyer.signTypedData({ domain: { name: d.name, version: d.version, chainId: Number(d.chainId), verifyingContract: d.verifyingContract }, types: TRANSFER_WITH_AUTH_TYPES, primaryType: "TransferWithAuthorization", message: { ...authorization, value: price, validAfter: 0n, validBefore: BigInt(authorization.validBefore) } });
const paid = await post({ requestId, payer: buyer.address, input, payment: { scheme: "gateway", signature, authorization } });
log("paid call", { status: paid.status, payment: paid.data.payment, answer: String(paid.data.answer ?? paid.data.error ?? "").slice(0, 80) });
assert(paid.status === 200 && paid.data.payment?.status === "settled", "Gateway verified and settled the call");
assert(Boolean(paid.data.payment?.gatewayTransferId), "Gateway returned a transfer id");

// 4. Same request id again: a replay, not a second charge.
const again = await post({ requestId, payer: buyer.address, input, payment: { scheme: "gateway", signature, authorization } });
assert(again.status === 200 && again.data.payment?.replay === true, "retry with the same request id is a replay (not charged twice)");

// 5. Tampered amount is refused before Gateway is asked.
const bad = await post({ requestId: `${requestId}-x`, payer: buyer.address, input, payment: { scheme: "gateway", signature, authorization: { ...authorization, value: "1" } } });
assert(bad.status === 400, "an authorization for another amount is refused");

const t = await gw.getTransferById(paid.data.payment.gatewayTransferId).catch((e) => ({ error: String((e as Error).message).slice(0, 120) }));
log("Gateway transfer", t);
const payeeAfter = await gw.getBalance(g!.payTo).then((b) => b.total).catch(() => null);
log("seller payee Gateway balance", { before: payeeBefore, after: payeeAfter });
console.log(`\nALL CHECKS PASSED on Arc testnet (request ${toHex(requestId).slice(0, 10)}…)`);
process.exit(0);
