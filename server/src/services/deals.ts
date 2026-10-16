import { and, asc, desc, eq } from "drizzle-orm";
import { type Address, type Hex } from "viem";
import { explorerAddress, explorerTx } from "@proteus/domain";
import { dealEscrowAbi, erc20Abi } from "../chain/abi";
import { escrowAddress, publicClient, sellerWalletClient, feeParams, usdcAddress } from "../chain/client";
import { getRelayer, relayerKind } from "../chain/relayer";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { apiKey, id } from "../lib/ids";
import { loadProductById } from "./catalog";

export async function loadDeal(dealId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal) throw new HttpError(404, "deal not found");
  return deal;
}

export function reviveTerms(t: Record<string, unknown>) {
  return {
    dealId: BigInt(String(t.dealId)),
    buyer: t.buyer as Address,
    seller: t.seller as Address,
    payee: t.payee as Address,
    usdc: t.usdc as Address,
    productId: t.productId as Hex,
    unitNum: BigInt(String(t.unitNum)),
    unitDen: BigInt(String(t.unitDen)),
    maxUnits: BigInt(String(t.maxUnits)),
    prepaid: BigInt(String(t.prepaid)),
    start: BigInt(String(t.start)),
    end: BigInt(String(t.end)),
    grace: BigInt(String(t.grace)),
    publicTermsHash: t.publicTermsHash as Hex,
    nonce: BigInt(String(t.nonce)),
    expiry: BigInt(String(t.expiry)),
  };
}

/** Buyer/seller-safe deal view (seller view adds private fields elsewhere). */
export async function dealView(dealId: string, opts: { apiKeyOnce?: string } = {}) {
  const deal = await loadDeal(dealId);
  const lp = await loadProductById(deal.productId);
  const txs = await db.select().from(schema.chainTxs).where(eq(schema.chainTxs.dealId, dealId)).orderBy(asc(schema.chainTxs.createdAt));
  const reqs = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.dealId, dealId)).orderBy(desc(schema.serviceRequests.createdAt));
  const billable = reqs.filter((r) => r.billable);
  const cumulativeUnits = billable.reduce((m, r) => (r.cumulativeUnits > m ? r.cumulativeUnits : m), 0n);
  const cumulativeCharged = billable.reduce((m, r) => (r.cumulativeCharged > m ? r.cumulativeCharged : m), 0n);
  const terms = reviveTerms(deal.terms as Record<string, unknown>);
  const refundableAt = deal.sellerClosedAt ? deal.sellerClosedAt : new Date(Number(terms.end + terms.grace) * 1000);
  const escrow = env.ESCROW_ADDRESS;
  const fundTx = txs.find((t) => t.kind === "fund");
  return {
    id: deal.id,
    publicId: deal.publicId,
    status: deal.status,
    chainId: env.CHAIN_ID,
    escrowAddress: escrow ?? null,
    usdcAddress,
    dealIdOnchain: deal.dealIdOnchain.toString(),
    terms: deal.terms,
    termsHash: deal.termsHash,
    publicTerms: deal.publicTerms,
    signatures: { buyer: deal.buyerSignature, seller: deal.sellerSignature },
    buyerAddress: deal.buyerAddress,
    sellerAddress: deal.sellerAddress,
    sellerPayee: deal.payeeAddress,
    funding: { txHash: deal.fundingTxHash ?? fundTx?.txHash ?? null, status: fundTx?.status ?? (deal.fundingTxHash ? "confirmed" : null), confirmedAt: deal.fundedAt, explorerUrl: deal.fundingTxHash ? explorerTx(deal.fundingTxHash) : fundTx ? explorerTx(fundTx.txHash) : null },
    balances: { deposit: deal.deposit, settled: deal.settled, refunded: deal.refunded, remaining: deal.deposit - deal.settled - deal.refunded, source: deal.balancesSource },
    service: {
      status: deal.serviceStatus,
      endpoint: `/api/services/${lp.product.slug}/execute`,
      apiKey: opts.apiKeyOnce ?? undefined,
      docsUrl: "/docs#service",
      adapter: lp.row.adapter,
      sampleStore: lp.row.adapter === "order-support" ? { label: "sample store (demo data)", orderIds: ["A1001", "A1002", "A1003"] } : undefined,
    },
    usage: { units: cumulativeUnits, charged: cumulativeCharged, accepted: deal.acceptedAmount, acceptedUnits: deal.acceptedUnits, settled: deal.settled, requests: reqs.length, billableRequests: billable.length },
    refundableAt,
    sellerClosedAt: deal.sellerClosedAt,
    refundTxHash: deal.refundTxHash,
    explorer: {
      escrow: escrow ? explorerAddress(escrow) : null,
      txs: txs.map((t) => ({ kind: t.kind, txHash: t.txHash, status: t.status, via: t.submittedVia, url: explorerTx(t.txHash), at: t.createdAt })),
    },
    labels: { network: "testnet", seller: lp.org.label, relayer: relayerKind() },
    createdAt: deal.createdAt,
  };
}

/** Record a buyer-submitted funding tx, or relay createAndFundDeal with both signatures. */
export async function fundingIntent(dealId: string, txHash?: Hex) {
  const deal = await loadDeal(dealId);
  if (!["awaiting_funding", "funding_pending"].includes(deal.status)) throw new HttpError(409, `deal is ${deal.status}`);
  const terms = reviveTerms(deal.terms as Record<string, unknown>);
  if (txHash) {
    await db.insert(schema.chainTxs).values({ id: id("tx"), orgId: deal.orgId, dealId, kind: "fund", txHash, submittedVia: "buyer-wallet" }).onConflictDoNothing();
    await db.update(schema.deals).set({ status: "funding_pending", fundingTxHash: txHash, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
    return dealView(dealId);
  }
  // Relayer path: requires the buyer's USDC allowance to the escrow.
  const allowance = (await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [terms.buyer, escrowAddress()] })) as bigint;
  if (allowance < terms.prepaid) throw new HttpError(409, "buyer has not approved enough USDC for the escrow", { required: terms.prepaid.toString(), allowance: allowance.toString() });
  const balance = (await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [terms.buyer] })) as bigint;
  if (balance < terms.prepaid) throw new HttpError(409, "buyer USDC balance is below the prepaid amount", { required: terms.prepaid.toString(), balance: balance.toString() });
  const relayer = getRelayer();
  const { txHash: hash } = await relayer.submit("createAndFundDeal", [terms, deal.buyerSignature as Hex, deal.sellerSignature as Hex]);
  await db.insert(schema.chainTxs).values({ id: id("tx"), orgId: deal.orgId, dealId, kind: "fund", txHash: hash, submittedVia: relayer.kind }).onConflictDoNothing();
  await db.update(schema.deals).set({ status: "funding_pending", fundingTxHash: hash, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  return dealView(dealId);
}

/** Provision the service once funding is confirmed: mint an API key (returned once). */
export async function provisionIfFunded(dealId: string): Promise<string | undefined> {
  const deal = await loadDeal(dealId);
  if (!["funded", "active"].includes(deal.status)) return undefined;
  if (deal.apiKeyHash) return undefined;
  const { key, hash } = apiKey();
  const updated = await db
    .update(schema.deals)
    .set({ apiKeyHash: hash, serviceStatus: "provisioned", status: "active", updatedAt: new Date() })
    .where(and(eq(schema.deals.id, dealId), eq(schema.deals.serviceStatus, "pending")))
    .returning({ id: schema.deals.id });
  return updated.length ? key : undefined;
}

/** Refund unused balance (anyone may call; funds go to the buyer). */
export async function requestRefund(dealId: string) {
  const deal = await loadDeal(dealId);
  if (!["funded", "active"].includes(deal.status)) throw new HttpError(409, `deal is ${deal.status}`);
  const refundableAt = (await publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "refundableAt", args: [deal.dealIdOnchain] })) as bigint;
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < refundableAt) return { status: "too_early" as const, refundableAt: new Date(Number(refundableAt) * 1000) };
  const relayer = getRelayer();
  const { txHash } = await relayer.submit("refundUnused", [deal.dealIdOnchain]);
  await db.insert(schema.chainTxs).values({ id: id("tx"), orgId: deal.orgId, dealId, kind: "refund", txHash, submittedVia: relayer.kind }).onConflictDoNothing();
  return { status: "submitted" as const, refundableAt: new Date(Number(refundableAt) * 1000), txHash };
}

/** Seller ends the term early (must be sent by the seller signer itself). */
export async function sellerCloseTerm(orgId: string, dealId: string) {
  const deal = await loadDeal(dealId);
  if (deal.orgId !== orgId) throw new HttpError(404, "deal not found");
  if (!["funded", "active"].includes(deal.status)) throw new HttpError(409, `deal is ${deal.status}`);
  const wallet = sellerWalletClient();
  const fees = await feeParams();
  const { request } = await publicClient.simulateContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "sellerCloseTerm", args: [deal.dealIdOnchain], account: wallet.account, ...fees });
  const txHash = await wallet.writeContract(request);
  await db.insert(schema.chainTxs).values({ id: id("tx"), orgId, dealId, kind: "close_term", txHash, submittedVia: "viem" }).onConflictDoNothing();
  await db.update(schema.deals).set({ sellerClosedAt: new Date(), updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  return { txHash };
}

export async function listDeals(orgId: string) {
  const rows = await db.select().from(schema.deals).where(eq(schema.deals.orgId, orgId)).orderBy(desc(schema.deals.createdAt)).limit(200);
  return rows.map((d) => ({ id: d.id, publicId: d.publicId, status: d.status, buyerAddress: d.buyerAddress, deposit: d.deposit, settled: d.settled, refunded: d.refunded, remaining: d.deposit - d.settled - d.refunded, balancesSource: d.balancesSource, fundingTxHash: d.fundingTxHash, createdAt: d.createdAt }));
}
