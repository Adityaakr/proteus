/**
 * End-to-end check of seller-confirmed delivery (physical goods) on Arc testnet, through the server services the app uses:
 * quote -> buyer signs Terms -> USDC escrow funded -> seller records a delivery batch with proof -> buyer countersigns the
 * cumulative usage -> relayer settles -> the seller is paid exactly delivered units x unit price. Over-delivery is refused.
 *
 * Testnet only. Every transaction is real and printed. Run: pnpm --filter server exec tsx scripts/delivery-e2e.ts
 */
import { eq } from "drizzle-orm";
import { createWalletClient, erc20Abi, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ACCEPTANCE_TYPES, TERMS_TYPES, domain, getQuoteCandidates } from "@proteus/domain";
import { env } from "../src/env";
import { db, schema } from "../src/db";
import { chain, escrowAddress, feeParams, publicClient, usdcAddress } from "../src/chain/client";
import { reconcileOnce } from "../src/chain/reconciler";
import { createProduct } from "../src/services/accounts";
import { evaluationContext, loadProductById } from "../src/services/catalog";
import { startNegotiation } from "../src/services/negotiation";
import { acceptQuote, createQuote, quoteView } from "../src/services/quotes";
import { fundingIntent, loadDeal } from "../src/services/deals";
import { fundGasless, permitRequest } from "../src/services/gasless";
import { confirmDelivery } from "../src/services/delivery";
import { acknowledgeUsage, pendingAcceptance } from "../src/services/usage";
import { bigintsToStrings } from "../src/lib/http";
import { ensureOrgSigner } from "../src/chain/signer";

if (env.CHAIN_ID === 5042) throw new Error("delivery-e2e runs on Arc testnet only.");
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY is required (testnet buyer).");
const buyer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const sellerOwner = privateKeyToAccount(generatePrivateKey()).address;
const log = (k: string, v: unknown) => console.log(`${k.padEnd(30)} ${typeof v === "string" ? v : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`);
const assert = (ok: boolean, what: string) => {
  if (!ok) {
    console.error(`FAIL: ${what}`);
    process.exit(1);
  }
  console.log(`ok   ${what}`);
};
const toBig = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) ? BigInt(v) : v]));
async function until<T>(what: string, f: () => Promise<T | undefined>, ms = 120_000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await reconcileOnce().catch(() => {});
    const v = await f();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 6000));
  }
  throw new Error(`timed out: ${what}`);
}

const stamp = Date.now().toString(36);
const orgId = `org_dlv_${stamp}`;
const slug = `merch-e2e-${stamp}`;
await db.insert(schema.orgs).values({ id: orgId, slug, name: `Merch e2e ${stamp}`, label: "live", ownerAddress: sellerOwner, payeeAddress: sellerOwner, sellerSignerAddress: "0x0000000000000000000000000000000000000000" });
const productId = await createProduct(orgId, {
  name: "Custom hoodie",
  slug: "custom-hoodie",
  unitLabel: "hoodie",
  billableUnit: "one custom-printed hoodie delivered to the buyer's address",
  capabilities: [],
  supportedIntegrations: [],
  tiers: [{ name: "Team pack", includedUnits: "10", unitPriceUsd: "0.05", includes: [] }],
  maxUnitsPerDeal: "100",
  termDays: 30,
  refundPolicy: "Unused prepaid balance is refunded after the term.",
  cost: { variableCostPerUnitUsd: "0.01", directCostPerDealUsd: "0", txCostBps: 50 },
  policy: { minMarginBps: 1000, maxDiscountBps: 1500, approvalThresholdUsd: "1000", prepaidMinimumUsd: "0.1", availableCapacityUnits: "1000", quoteTtlSeconds: 3600 },
  adapter: "http",
  upstream: { url: "https://example.com/proteus-physical" },
} as never);
await ensureOrgSigner(orgId); // the publish flow creates it; this script inserts the org directly
log("seller / product", `${slug} / custom-hoodie`);

// 1. Offer, quote, buyer signs Terms, seller countersigns
const lp = await loadProductById(productId);
const neg = (await startNegotiation(slug, "custom-hoodie", buyer.address)) as { id: string };
const cands = getQuoteCandidates(evaluationContext(lp), { desiredUnits: 10n, integrations: [], notes: [], openQuestions: [] } as never).filter((c) => c.status === "eligible");
assert(cands.length > 0, "an eligible offer exists for 10 hoodies");
await db.update(schema.negotiations).set({ candidates: bigintsToStrings(cands) as never }).where(eq(schema.negotiations.id, neg.id));
const quote = (await createQuote(neg.id, cands[0]!.candidateId)) as { id: string };
const qv = (await quoteView(quote.id, buyer.address)) as unknown as { typedData: { message: Record<string, unknown> }; terms: Record<string, unknown> };
const terms = toBig(qv.typedData.message);
const buyerSig = await buyer.signTypedData({ domain: domain(env.CHAIN_ID, escrowAddress()), types: TERMS_TYPES, primaryType: "Terms", message: terms as never });
const dealId = await acceptQuote(quote.id, buyer.address as Address, buyerSig);
// The test seller exists only for this run; unlist it once the deal exists so it never stays in the market.
await db.update(schema.products).set({ active: false }).where(eq(schema.products.id, productId));
const prepaid = terms.prepaid as bigint;
log("deal", { dealId, prepaid, units: terms.maxUnits });

// 2. Fund the escrow. Default: buyer approves USDC, relayer funds. GASLESS=1: buyer only signs a USDC permit and
//    the relayer submits permit + createAndFundDeal in one Multicall3 transaction; the buyer's nonce must not move.
const wallet = createWalletClient({ account: buyer, chain, transport: http(env.ARC_RPC_URL) });
let funding: { funding?: { txHash?: string } };
if (process.env.GASLESS === "1") {
  const nonceBefore = await publicClient.getTransactionCount({ address: buyer.address });
  const req = await permitRequest(dealId);
  const signature = await buyer.signTypedData({ domain: req.domain, types: req.types, primaryType: "Permit", message: { ...req.message, value: BigInt(req.message.value), nonce: BigInt(req.message.nonce), deadline: BigInt(req.message.deadline) } });
  funding = (await fundGasless(dealId, { deadline: req.message.deadline, signature })) as typeof funding;
  log("permit signed (buyer, no tx)", { value: req.message.value, deadline: req.message.deadline });
  const nonceAfter = await publicClient.getTransactionCount({ address: buyer.address });
  assert(nonceAfter === nonceBefore, `buyer sent no transaction (nonce ${nonceBefore} -> ${nonceAfter})`);
} else {
  const approveTx = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [escrowAddress(), prepaid], ...(await feeParams()) });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  log("approve tx (buyer)", approveTx);
  funding = (await fundingIntent(dealId)) as typeof funding;
}
log("fund tx (relayer)", funding.funding?.txHash ?? "?");
await until("deal funded", async () => {
  const d = await loadDeal(dealId);
  return ["funded", "active"].includes(d.status) && d.deposit === prepaid ? d : undefined;
});
assert(true, "escrow funded on chain");

// 3. Seller records a delivery batch with proof
const r = await confirmDelivery(orgId, dealId, { units: 4, note: "4 custom hoodies printed and shipped in one box", proofUrl: "https://tracking.example.com/PRX-4", requestId: "batch-1" }, sellerOwner);
assert(r.units === 4 && r.status === "delivered", "delivery batch recorded as a signed receipt (4 units)");
const again = await confirmDelivery(orgId, dealId, { units: 4, note: "4 custom hoodies printed and shipped in one box", proofUrl: "https://tracking.example.com/PRX-4", requestId: "batch-1" }, sellerOwner);
assert(again.deal.cumulativeUnits === r.deal.cumulativeUnits, "same batch key is idempotent (not recorded twice)");
try {
  await confirmDelivery(orgId, dealId, { units: 7, note: "too many", requestId: "batch-2" }, sellerOwner);
  assert(false, "over-delivery beyond the agreement is refused");
} catch (e) {
  assert(/agreement covers/.test((e as Error).message), "over-delivery beyond the agreement is refused");
}
try {
  await confirmDelivery("org_someone_else", dealId, { units: 1, note: "not my deal", requestId: "batch-x" }, sellerOwner);
  assert(false, "another seller cannot record deliveries on this deal");
} catch (e) {
  assert(/not found/.test((e as Error).message), "another seller cannot record deliveries on this deal");
}

// 4. Buyer countersigns the cumulative usage; relayer settles
const p = await pendingAcceptance(dealId);
assert(Boolean(p.pendingAcceptance), "buyer sees the delivery as usage to sign");
const acc = toBig((p.pendingAcceptance as unknown as { acceptance: Record<string, unknown> }).acceptance) as Record<string, bigint | Hex>;
const ackSig = await buyer.signTypedData({ domain: domain(env.CHAIN_ID, escrowAddress()), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: acc as never });
const settled = (await acknowledgeUsage(dealId, { buyerSignature: ackSig, cumulativeUnits: acc.cumulativeUnits as bigint, cumulativeAmount: acc.cumulativeAmount as bigint, receiptsRoot: acc.receiptsRoot as Hex, nonce: acc.nonce as bigint, expiry: acc.expiry as bigint })) as { txHash?: string };
log("settle tx (relayer)", settled.txHash ?? JSON.stringify(settled));
const expected = acc.cumulativeAmount as bigint;
const done = await until("settlement on chain", async () => {
  const d = await loadDeal(dealId);
  return d.settled === expected ? d : undefined;
});
log("settled to seller (micro-USDC)", done.settled);
assert(done.settled === 4n * 50_000n, "seller paid exactly 4 x $0.05 from escrow");

// 5. Dispute (run with DISPUTE=1): the buyer disputes the rest; the arbiter splits the unspent balance.
//    On this testnet run the deployer key is both the buyer and the escrow's arbiter.
if (process.env.DISPUTE === "1") {
  const { keccak256, toHex } = await import("viem");
  const { dealEscrowAbi } = await import("../src/chain/abi");
  const { recordDispute, disputeView } = await import("../src/services/disputes");
  const reason = "2 of the remaining hoodies arrived with the wrong print; photos at https://example.com/photos";
  const before = await loadDeal(dealId);
  const openTx = await wallet.writeContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "openDispute", args: [before.dealIdOnchain, keccak256(toHex(reason))], ...(await feeParams()) });
  log("openDispute tx (buyer)", openTx);
  const v = await recordDispute(dealId, openTx, reason);
  assert(v.dispute?.status === "open" && v.dispute.openedBy === "buyer", "dispute recorded from the on-chain event with the buyer's reason");
  let mismatchRejected = false;
  try {
    await recordDispute(dealId, openTx, "a different reason than the one hashed on chain");
  } catch (e) {
    mismatchRejected = /does not match the hash/.test((e as Error).message);
  }
  assert(mismatchRejected, "a reason that does not match the on-chain hash is rejected");
  const remaining = before.deposit - before.settled - before.refunded;
  const toSeller = 100_000n; // $0.10 for partially usable work
  const toBuyer = remaining - toSeller;
  const arbiterWallet = wallet;
  const { request } = await publicClient.simulateContract({ account: buyer, address: escrowAddress(), abi: dealEscrowAbi, functionName: "resolveDispute", args: [before.dealIdOnchain, toSeller, toBuyer], ...(await feeParams()) });
  const resolveTx = await arbiterWallet.writeContract(request);
  log("resolveDispute tx (arbiter)", resolveTx);
  const after = await until("dispute resolution reconciled", async () => {
    const d = await disputeView(dealId);
    return d.dispute?.status === "resolved" ? d : undefined;
  });
  assert(after.dispute?.toSeller === toSeller && after.dispute.toBuyer === toBuyer, "reconciler recorded the arbiter's split");
  const journal = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.dealId, dealId));
  assert(journal.some((j) => j.kind === "dispute_resolution"), "dispute payout posted to the journal (was missing before)");
  const final = await loadDeal(dealId);
  assert(final.deposit === final.settled + final.refunded, "escrow fully distributed: deposit = settled + refunded");
}

console.log("\nALL CHECKS PASSED on Arc testnet");
process.exit(0);
