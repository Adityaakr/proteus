import { sql } from "drizzle-orm";
import { db } from "../db";

/** What a purged chat turn or order detail reads as afterwards. The row stays so counts, receipts and usage still add up. */
export const PURGED_TEXT = "[Removed after the retention period]";
export const PURGED_INPUT = { $purged: true } as const;

/**
 * Deletes buyer conversation text and order details once they are no longer needed:
 * - chats of negotiations quiet for `days` whose deals (if any) are all closed or never funded, past the same cutoff;
 * - order details of deals closed on chain at least `days` ago;
 * - WhatsApp reply addresses of buyers quiet for `days`, processed message ids after 7 days, expired links after a day.
 * Active, funded or disputed deals are never touched. Deal terms, amounts, receipts and on-chain records are kept.
 */
export async function purgeExpired(days: number, now = new Date()): Promise<{ turns: number; orderDetails: number }> {
  if (!Number.isInteger(days) || days < 7) throw new Error("retention must be at least 7 days");
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  // A negotiation is done when it has been quiet past the cutoff and EVERY deal on it is either closed past the cutoff
  // or was never funded and is older than the cutoff. One live deal (funded, active, disputed) keeps the whole chat.
  const turns = await db.execute(sql`
    update turns set content = ${PURGED_TEXT}, payload = null
    where content <> ${PURGED_TEXT} and negotiation_id in (
      select n.id from negotiations n
      where n.updated_at < ${cutoff}
        and not exists (
          select 1 from deals d where d.negotiation_id = n.id
            and not ((d.status = 'closed' and d.updated_at < ${cutoff}) or (d.status = 'awaiting_funding' and d.created_at < ${cutoff}))
        )
    )`);
  const orderDetails = await db.execute(sql`
    update service_requests set input = ${JSON.stringify(PURGED_INPUT)}::jsonb
    where not (input ? '$purged') and deal_id in (select id from deals where status = 'closed' and updated_at < ${cutoff})`);
  // WhatsApp: the sealed reply address of buyers quiet past the cutoff, processed message ids after a week, and expired links.
  await db.execute(sql`delete from whatsapp_sessions where last_inbound_at < ${cutoff}`);
  await db.execute(sql`delete from whatsapp_inbound where at < ${new Date(now.getTime() - 7 * 86_400_000)}`);
  await db.execute(sql`delete from whatsapp_links where expires_at < ${new Date(now.getTime() - 86_400_000)}`);
  return { turns: count(turns), orderDetails: count(orderDetails) };
}

function count(r: unknown): number {
  const x = r as { count?: number; rowCount?: number };
  return Number(x.count ?? x.rowCount ?? 0);
}
