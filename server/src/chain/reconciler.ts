import { and, eq, inArray } from "drizzle-orm";
import { parseEventLogs, type Hex } from "viem";
import { db, schema } from "../db";
import { env, features } from "../env";
import { id } from "../lib/ids";
import { postJournal } from "../services/journal";
import { dealEscrowAbi } from "./abi";
import { escrowAddress, publicClient } from "./client";

/**
 * Reconciler: the only writer of deal balances. It reads the chain, never the other way round.
 *  1. Pending chain_txs: fetch receipts; mark confirmed/failed.
 *  2. For every deal with a known onchain id: read `balances(dealId)` and scan DealEscrow events
 *     since the last reconciled block; record each event once (unique tx+logIndex); post journal
 *     entries for funding, settlement and refund from those events; update deal status.
 * Idempotent: rerunning never double-posts (event uniqueness) and balances are overwritten from chain.
 */
let running = false;

export async function reconcileOnce(): Promise<{ txs: number; deals: number }> {
  if (!features.escrow) return { txs: 0, deals: 0 };
  if (running) return { txs: 0, deals: 0 };
  running = true;
  try {
    const txs = await reconcilePendingTxs();
    const deals = await reconcileDeals();
    return { txs, deals };
  } finally {
    running = false;
  }
}

async function reconcilePendingTxs(): Promise<number> {
  const pending = await db.select().from(schema.chainTxs).where(eq(schema.chainTxs.status, "pending"));
  let n = 0;
  for (const tx of pending) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: tx.txHash as Hex });
      await db
        .update(schema.chainTxs)
        .set({ status: receipt.status === "success" ? "confirmed" : "failed", blockNumber: receipt.blockNumber, confirmedAt: new Date() })
        .where(eq(schema.chainTxs.id, tx.id));
      n++;
    } catch {
      // not mined yet (or dropped); the deal-level scan will catch the event when it lands.
    }
  }
  return n;
}

async function reconcileDeals(): Promise<number> {
  const rows = await db.select().from(schema.deals).where(inArray(schema.deals.status, ["awaiting_funding", "funding_pending", "funded", "active", "disputed"]));
  if (!rows.length) return 0;
  const latest = await publicClient.getBlockNumber();
  let n = 0;
  for (const deal of rows) {
    try {
      const fromBlock = deal.lastReconciledBlock > 0n ? deal.lastReconciledBlock + 1n : latest - 5000n > 0n ? latest - 5000n : 0n;
      const logs = await publicClient.getLogs({ address: escrowAddress(), fromBlock, toBlock: latest });
      const parsed = parseEventLogs({ abi: dealEscrowAbi, logs });
      for (const ev of parsed) {
        const args = ev.args as Record<string, unknown>;
        if (String(args.dealId) !== deal.dealIdOnchain.toString()) continue;
        const inserted = await db
          .insert(schema.chainEvents)
          .values({ id: id("ev"), dealIdOnchain: deal.dealIdOnchain, name: ev.eventName, txHash: ev.transactionHash, logIndex: ev.logIndex, blockNumber: ev.blockNumber, args: JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) })
          .onConflictDoNothing()
          .returning({ id: schema.chainEvents.id });
        if (!inserted.length) continue; // already processed
        await applyEvent(deal, ev.eventName, args, ev.transactionHash);
      }
      // Authoritative balances from the contract.
      const [deposit, settled, refunded] = (await publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "balances", args: [deal.dealIdOnchain] })) as readonly [bigint, bigint, bigint, bigint];
      const onchain = (await publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "getDeal", args: [deal.dealIdOnchain] })) as { status: number; sellerClosed: boolean };
      const statusMap: Record<number, string | undefined> = { 0: undefined, 1: "active", 2: "disputed", 3: "closed" };
      const next = statusMap[onchain.status];
      await db
        .update(schema.deals)
        .set({
          deposit,
          settled,
          refunded,
          balancesSource: deposit > 0n ? "chain" : "pending",
          lastReconciledBlock: latest,
          ...(next ? { status: next } : {}),
          ...(onchain.sellerClosed && !deal.sellerClosedAt ? { sellerClosedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.deals.id, deal.id));
      n++;
    } catch (e) {
      console.warn("[reconciler] deal", deal.id, String((e as Error).message).slice(0, 160));
    }
  }
  return n;
}

async function applyEvent(deal: typeof schema.deals.$inferSelect, name: string, args: Record<string, unknown>, txHash: string) {
  const amount = (k: string) => BigInt(String(args[k] ?? "0"));
  if (name === "DealFunded") {
    await db.update(schema.deals).set({ status: "funded", fundingTxHash: txHash, fundedAt: new Date() }).where(and(eq(schema.deals.id, deal.id), inArray(schema.deals.status, ["awaiting_funding", "funding_pending"])));
    await postJournal({ orgId: deal.orgId, dealId: deal.id, kind: "funding", memo: "Buyer funded deal escrow (customer liability, not revenue)", lines: [{ account: "escrow_usdc", debit: amount("deposit"), credit: 0n }, { account: "customer_liability", debit: 0n, credit: amount("deposit") }], evidence: { txHash } });
    await db.update(schema.chainTxs).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(schema.chainTxs.txHash, txHash));
  } else if (name === "SellerSettled") {
    const amt = amount("amount");
    await postJournal({ orgId: deal.orgId, dealId: deal.id, kind: "settlement", memo: "Accepted usage settled to seller payee", lines: [{ account: "customer_liability", debit: amt, credit: 0n }, { account: "escrow_usdc", debit: 0n, credit: amt }], evidence: { txHash } });
    await db.update(schema.usageAcceptances).set({ status: "confirmed" }).where(and(eq(schema.usageAcceptances.dealId, deal.id), eq(schema.usageAcceptances.settlementTxHash, txHash)));
  } else if (name === "RefundIssued") {
    const amt = amount("amount");
    await postJournal({ orgId: deal.orgId, dealId: deal.id, kind: "refund", memo: "Unused balance refunded to buyer", lines: [{ account: "customer_liability", debit: amt, credit: 0n }, { account: "escrow_usdc", debit: 0n, credit: amt }], evidence: { txHash } });
    await db.update(schema.deals).set({ refundTxHash: txHash }).where(eq(schema.deals.id, deal.id));
  }
}

export function startReconciler() {
  if (!features.escrow) {
    console.log("[reconciler] disabled: ESCROW_ADDRESS not set");
    return;
  }
  const tick = () => reconcileOnce().catch((e) => console.warn("[reconciler]", String((e as Error).message).slice(0, 200)));
  setTimeout(tick, 2000);
  setInterval(tick, env.RECONCILE_INTERVAL_MS);
  console.log(`[reconciler] every ${env.RECONCILE_INTERVAL_MS}ms against ${env.ESCROW_ADDRESS}`);
}
