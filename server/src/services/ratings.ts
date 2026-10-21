/**
 * Seller ratings on Arc's ERC-8004 ReputationRegistry. A buyer rates a seller after a deal settles by calling
 * giveFeedback from its own wallet; Proteus never posts feedback. The server counts a rating only after reading the
 * transaction from the chain and checking every field, so a seller cannot rate itself through Proteus (the registry
 * already rejects feedback from the agent's owner) and a rating cannot be attached to someone else's deal.
 *
 * Shown as a weighted average, weighted by USDC settled, next to the count and the total settled behind it. This is a
 * cost-to-fake, not a proof: a seller can still fund a deal from a second wallet. Every rating links to its transaction.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { getAddress, isAddressEqual, parseEventLogs, type Hex } from "viem";
import { REPUTATION_REGISTRY_ABI, erc8004For } from "@proteus/domain";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { publicClient } from "../chain/client";

export const RATING_TAG = "proteus-deal";

async function ratableDeal(dealId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal) throw new HttpError(404, "deal not found");
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, deal.orgId));
  if (!org) throw new HttpError(404, "seller not found");
  return { deal, org };
}

/** Everything a buyer's wallet (or a buyer agent) passes to giveFeedback for this deal, plus any rating already verified. */
export async function ratingInputs(dealId: string, origin: string) {
  const { deal, org } = await ratableDeal(dealId);
  const [existing] = await db.select().from(schema.sellerRatings).where(eq(schema.sellerRatings.dealId, dealId));
  const eligible = Boolean(org.agentId) && deal.settled > 0n && org.label === "live";
  return {
    eligible,
    reason: !org.agentId ? "This seller has not registered its agent on Arc yet." : deal.settled === 0n ? "Ratings open once some usage has settled on chain." : org.label !== "live" ? "Example sellers cannot be rated." : null,
    reputationRegistry: erc8004For(env.CHAIN_ID).reputation,
    buyer: deal.buyerAddress,
    args: org.agentId
      ? {
          agentId: org.agentId,
          valueDecimals: 0,
          tag1: RATING_TAG,
          tag2: deal.dealIdOnchain.toString(),
          endpoint: `${origin}/api/public/sellers/${org.slug}/agent.json`,
          feedbackURI: `${origin}/api/review/${deal.publicId}`,
          feedbackHash: deal.termsHash,
        }
      : null,
    existing: existing ? { value: existing.value, txHash: existing.txHash, createdAt: existing.createdAt } : null,
  };
}

/** Reads a giveFeedback transaction from the chain and stores it as this deal's rating if every field checks out. */
export async function confirmRating(dealId: string, txHash: Hex) {
  const { deal, org } = await ratableDeal(dealId);
  if (!org.agentId) throw new HttpError(409, "This seller has no agent identity on Arc.");
  if (deal.settled === 0n) throw new HttpError(409, "Ratings open once some usage has settled on chain.");
  const reputation = erc8004For(env.CHAIN_ID).reputation;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (receipt.status !== "success") throw new HttpError(409, "The feedback transaction reverted on chain.");
  const events = parseEventLogs({ abi: REPUTATION_REGISTRY_ABI, eventName: "NewFeedback", logs: receipt.logs.filter((l) => isAddressEqual(l.address, reputation)) });
  const ev = events.find((e) => e.args.agentId === BigInt(org.agentId!) && e.args.tag1 === RATING_TAG && e.args.tag2 === deal.dealIdOnchain.toString());
  if (!ev) throw new HttpError(409, `No NewFeedback for agent ${org.agentId} tagged (${RATING_TAG}, ${deal.dealIdOnchain}) in that transaction.`);
  if (!isAddressEqual(ev.args.clientAddress, getAddress(deal.buyerAddress))) throw new HttpError(409, "The feedback was not posted by this deal's buyer.");
  if (ev.args.valueDecimals !== 0 || ev.args.value < 1n || ev.args.value > 5n) throw new HttpError(409, "A rating must be a whole number of stars from 1 to 5.");
  const row = { dealId, orgId: org.id, agentId: org.agentId, buyerAddress: deal.buyerAddress, value: Number(ev.args.value), weight: deal.settled, txHash, createdAt: new Date() };
  await db.insert(schema.sellerRatings).values(row).onConflictDoUpdate({ target: schema.sellerRatings.dealId, set: { value: row.value, weight: row.weight, txHash, createdAt: row.createdAt } });
  return { value: row.value, txHash, weight: row.weight.toString() };
}

export interface RatingSummary {
  count: number;
  /** Average stars weighted by USDC settled, two decimals. */
  average: number;
  /** Micro-USDC settled across the rated deals. */
  settledBehind: bigint;
}

export async function ratingSummaries(orgIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (!orgIds.length) return out;
  const rows = await db
    .select({
      orgId: schema.sellerRatings.orgId,
      n: sql<number>`count(*)`,
      weighted: sql<string>`coalesce(sum(${schema.sellerRatings.value} * ${schema.sellerRatings.weight}), 0)`,
      weight: sql<string>`coalesce(sum(${schema.sellerRatings.weight}), 0)`,
    })
    .from(schema.sellerRatings)
    .where(inArray(schema.sellerRatings.orgId, orgIds))
    .groupBy(schema.sellerRatings.orgId);
  for (const r of rows) {
    const w = BigInt(r.weight);
    if (w === 0n) continue;
    out.set(r.orgId, { count: Number(r.n), average: Math.round(Number((BigInt(r.weighted) * 100n) / w)) / 100, settledBehind: w });
  }
  return out;
}

/** Every verified rating for a seller, newest first, each with its Arc transaction. */
export async function sellerRatingList(orgId: string) {
  return db
    .select({ value: schema.sellerRatings.value, buyer: schema.sellerRatings.buyerAddress, txHash: schema.sellerRatings.txHash, weight: schema.sellerRatings.weight, createdAt: schema.sellerRatings.createdAt })
    .from(schema.sellerRatings)
    .where(and(eq(schema.sellerRatings.orgId, orgId)))
    .orderBy(sql`${schema.sellerRatings.createdAt} desc`);
}
