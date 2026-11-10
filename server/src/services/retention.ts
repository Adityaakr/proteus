import { sql } from "drizzle-orm";
import { db } from "../db";

/** What a purged chat turn or order detail reads as afterwards. The row stays so counts, receipts and usage still add up. */
export const PURGED_TEXT = "[Removed after the retention period]";
export const PURGED_INPUT = { $purged: true } as const;

/**
 * Deletes buyer conversation text and order details once they are no longer needed:
 * - chats of negotiations with no deal that have been quiet for `days`;
 * - chats and order details of deals closed on chain at least `days` ago.
 * Active, funded or disputed deals are never touched. Deal terms, amounts, receipts and on-chain records are kept.
 */
export async function purgeExpired(days: number, now = new Date()): Promise<{ turns: number; orderDetails: number }> {
  if (!Number.isInteger(days) || days < 7) throw new Error("retention must be at least 7 days");
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const turns = await db.execute(sql`
    update turns set content = ${PURGED_TEXT}, payload = null
    where content <> ${PURGED_TEXT} and negotiation_id in (
      select n.id from negotiations n left join deals d on d.negotiation_id = n.id
      where (d.id is null and n.updated_at < ${cutoff})
         or (d.status = 'closed' and d.updated_at < ${cutoff})
    )`);
  const orderDetails = await db.execute(sql`
    update service_requests set input = ${JSON.stringify(PURGED_INPUT)}::jsonb
    where not (input ? '$purged') and deal_id in (select id from deals where status = 'closed' and updated_at < ${cutoff})`);
  return { turns: count(turns), orderDetails: count(orderDetails) };
}

function count(r: unknown): number {
  const x = r as { count?: number; rowCount?: number };
  return Number(x.count ?? x.rowCount ?? 0);
}
