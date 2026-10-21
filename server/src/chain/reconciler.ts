import { and, eq, inArray } from "drizzle-orm";
import { parseEventLogs, type Hex } from "viem";
import { db, schema } from "../db";
import { env, features } from "../env";
import { id } from "../lib/ids";
import { postJournal } from "../services/journal";
import { dealEscrowAbi } from "./abi";
import { escrowAddress, publicClient } from "./client";
import { withRpcRetry } from "./relayer";

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

/**
 * One shared, chunked scan of DealEscrow logs per tick (not one per deal): Arc's public RPC refuses eth_getLogs spans of
 * roughly 10,000 blocks and rate-limits bursts, so per-deal scans from each deal's last block both failed and flooded it.
 * The cursor starts at the oldest open deal's last reconciled block and advances at most SCAN_SPAN x SCAN_CHUNKS blocks
 * per tick; event rows are unique by (txHash, logIndex), so the 30-block overlap is idempotent.
 */
const SCAN_SPAN = 2000n;
const SCAN_CHUNKS = 5;
const OVERLAP = 30n;
let cursor: bigint | null = null;

async function scanEscrow(rows: (typeof schema.deals.$inferSelect)[], latest: bigint) {
  if (cursor === null) {
    const starts = rows.map((d) => (d.lastReconciledBlock > 0n ? d.lastReconciledBlock : latest - 5000n));
    cursor = starts.reduce((m, x) => (x < m ? x : m), latest);
    if (cursor < 0n) cursor = 0n;
  }
  // Never lag more than two ticks of scanning behind the head: older history is skipped with a warning (balances and
  // status are still read from the contract for every open deal), so new events are never delayed by a long backlog.
  const maxLag = SCAN_SPAN * BigInt(SCAN_CHUNKS) * 2n;
  if (latest > maxLag && cursor < latest - maxLag) {
    console.warn(`[reconciler] log cursor ${cursor} is more than ${maxLag} blocks behind ${latest}; resuming at ${latest - maxLag}`);
    cursor = latest - maxLag;
  }
  let from = cursor > OVERLAP ? cursor - OVERLAP : 0n;
  const out: ReturnType<typeof parseEventLogs<typeof dealEscrowAbi>> = [];
  for (let i = 0; i < SCAN_CHUNKS && from <= latest; i++) {
    const to = from + SCAN_SPAN - 1n < latest ? from + SCAN_SPAN - 1n : latest;
    const logs = await withRpcRetry(() => publicClient.getLogs({ address: escrowAddress(), fromBlock: from, toBlock: to }));
    out.push(...parseEventLogs({ abi: dealEscrowAbi, logs }));
    cursor = to + 1n;
    from = to + 1n;
  }
  return { events: out, scannedTo: (cursor ?? latest + 1n) - 1n };
}

async function reconcileDeals(): Promise<number> {
  const rows = await db.select().from(schema.deals).where(inArray(schema.deals.status, ["awaiting_funding", "funding_pending", "funded", "active", "disputed"]));
  if (!rows.length) return 0;
  const latest = await publicClient.getBlockNumber();
  let scan: Awaited<ReturnType<typeof scanEscrow>> | null = null;
  try {
    scan = await scanEscrow(rows, latest);
  } catch (e) {
    // Balances and status below still come from the contract; the next tick retries the scan from the same cursor.
    console.warn("[reconciler] log scan", String((e as Error).message).slice(0, 160));
  }
  let n = 0;
  for (const deal of rows) {
    try {
      for (const ev of scan?.events ?? []) {
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
      // Read balances at the scanned head so a lagging node cannot report a stale zero after we saw the funding event.
      const [deposit, settled, refunded] = (await withRpcRetry(() => publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "balances", args: [deal.dealIdOnchain], blockNumber: latest }))) as readonly [bigint, bigint, bigint, bigint];
      const onchain = (await withRpcRetry(() => publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "getDeal", args: [deal.dealIdOnchain], blockNumber: latest }))) as { status: number; sellerClosed: boolean };
      const statusMap: Record<number, string | undefined> = { 0: undefined, 1: "active", 2: "disputed", 3: "closed" };
      const next = statusMap[onchain.status];
      await db
        .update(schema.deals)
        .set({
          deposit,
          settled,
          refunded,
          balancesSource: deposit > 0n ? "chain" : "pending",
          ...(scan ? { lastReconciledBlock: scan.scannedTo } : {}),
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
  } else if (name === "DisputeOpened") {
    // The reason text is stored by recordDispute; here the deal only freezes (status comes from the contract below).
    await db.update(schema.deals).set({ status: "disputed", updatedAt: new Date() }).where(eq(schema.deals.id, deal.id));
  } else if (name === "DisputeResolved") {
    const toSeller = amount("toSeller");
    const toBuyer = amount("toBuyer");
    if (toSeller + toBuyer > 0n) {
      await postJournal({
        orgId: deal.orgId,
        dealId: deal.id,
        kind: "dispute_resolution",
        memo: "Arbiter split the unspent balance between seller payee and buyer",
        lines: [
          { account: "customer_liability", debit: toSeller + toBuyer, credit: 0n },
          { account: "escrow_usdc", debit: 0n, credit: toSeller + toBuyer },
        ],
        evidence: { txHash, toSeller: toSeller.toString(), toBuyer: toBuyer.toString() },
      });
    }
    await db.update(schema.disputes).set({ status: "resolved", toSeller, toBuyer, resolveTx: txHash, resolvedAt: new Date() }).where(eq(schema.disputes.dealId, deal.id));
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
