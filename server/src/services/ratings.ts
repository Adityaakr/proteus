/**
 * Seller ratings on Arc's ERC-8004 ReputationRegistry. A buyer rates a seller after a deal settles by calling
 * giveFeedback from its own wallet; Proteus never posts feedback. The server counts a rating only after reading the
 * transaction from the chain and checking every field, so a seller cannot rate itself through Proteus (the registry
 * already rejects feedback from the agent's owner) and a rating cannot be attached to someone else's deal.
 *
 * A rating counts only after the integrity checks in rating-integrity.ts (buyer not linked to the seller), with one
 * vote per buyer and a neutral prior (rating-score.ts). This raises the cost of faking; it is not a proof: a seller can
 * still fund a second wallet from an exchange. Every rating, counted or not, links to its transaction.
 */
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getAddress, isAddressEqual, parseEventLogs, type Hex } from "viem";
import { REPUTATION_REGISTRY_ABI, erc8004For } from "@proteus/domain";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { publicClient } from "../chain/client";
import { LEGACY_OWN_WALLET_REASON, blockOf, buyerTier, checkBuyerLinks } from "./rating-integrity";
import { RATING_CHECKS_START, RATING_PRIOR, RATING_PRIOR_WEIGHT, ratedBeforeChecks, summarizeRatings, type RatingSummary } from "./rating-score";

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
  await db.insert(schema.sellerRatings).values(row).onConflictDoUpdate({ target: schema.sellerRatings.dealId, set: { value: row.value, weight: row.weight, txHash, createdAt: row.createdAt, linkStatus: "pending", linkReason: null, linkCheckedAt: null } });
  // The link check scans Arc (minutes on the public RPC), so it runs after the response; until it finishes the rating is "pending".
  void checkRating(dealId).catch((e) => console.error(`[ratings] check failed for ${dealId}: ${String((e as Error).message ?? e).slice(0, 160)}`));
  return { value: row.value, txHash, weight: row.weight.toString(), linkStatus: "pending" as const };
}

export type { RatingSummary } from "./rating-score";

/** Summaries per seller, computed by summarizeRatings (one vote per buyer, linked ratings excluded, neutral prior). */
export async function ratingSummaries(orgIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (!orgIds.length) return out;
  const rows = await db.select().from(schema.sellerRatings).where(inArray(schema.sellerRatings.orgId, orgIds));
  const byOrg = new Map<string, typeof rows>();
  for (const r of rows) byOrg.set(r.orgId, [...(byOrg.get(r.orgId) ?? []), r]);
  for (const [orgId, list] of byOrg) {
    const s = summarizeRatings(list);
    if (s) out.set(orgId, s);
  }
  return out;
}

/**
 * Runs the buyer tier and link checks for one rating and stores the result. Safe to call again: a failed scan leaves
 * the rating "pending" so the next sweep retries it.
 */
export async function checkRating(dealId: string) {
  const [rating] = await db.select().from(schema.sellerRatings).where(eq(schema.sellerRatings.dealId, dealId));
  if (!rating) return null;
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal) return null;
  const tier = await buyerTier(deal);
  const toBlock = await blockOf(rating.txHash as Hex);
  const fundedBlock = deal.fundingTxHash ? await blockOf(deal.fundingTxHash as Hex) : toBlock;
  const link = await checkBuyerLinks({ orgId: rating.orgId, buyerAddress: rating.buyerAddress, fundedBlock, toBlock });
  const set = { buyerTier: tier, linkStatus: link.linked ? "linked" : "clear", linkReason: link.linked ? link.reason : null, linkCheckedAt: new Date() };
  await db.update(schema.sellerRatings).set(set).where(eq(schema.sellerRatings.dealId, dealId));
  return set;
}

let sweeping = false;
/** Checks every rating still pending (new ratings, and ratings stored before the checks existed). */
export async function sweepPendingRatings() {
  if (sweeping) return;
  sweeping = true;
  try {
    // Pending ratings, plus ratings stored with the old catch-all reason (re-checked once so team-account links say so).
    const pending = await db.select({ dealId: schema.sellerRatings.dealId }).from(schema.sellerRatings).where(or(eq(schema.sellerRatings.linkStatus, "pending"), eq(schema.sellerRatings.linkReason, LEGACY_OWN_WALLET_REASON)));
    for (const p of pending) {
      try {
        const r = await checkRating(p.dealId);
        if (r) console.log(`[ratings] ${p.dealId}: ${r.linkStatus} (${r.buyerTier})`);
      } catch (e) {
        console.error(`[ratings] check failed for ${p.dealId}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
    }
  } finally {
    sweeping = false;
  }
}

/** Every verified rating for a seller, newest first, with whether it counts and why, and its Arc transaction. */
export async function sellerRatingList(orgId: string) {
  return db
    .select({
      value: schema.sellerRatings.value,
      buyer: schema.sellerRatings.buyerAddress,
      buyerTier: schema.sellerRatings.buyerTier,
      linkStatus: schema.sellerRatings.linkStatus,
      linkReason: schema.sellerRatings.linkReason,
      txHash: schema.sellerRatings.txHash,
      weight: schema.sellerRatings.weight,
      createdAt: schema.sellerRatings.createdAt,
    })
    .from(schema.sellerRatings)
    .where(eq(schema.sellerRatings.orgId, orgId))
    .orderBy(sql`${schema.sellerRatings.createdAt} desc`);
}

const RATING_METHOD = [
  "Only the deal's own buyer can rate, from their own wallet, after USDC has settled on chain; the ERC-8004 registry rejects feedback from the seller's agent wallet.",
  "Each rating is checked for links between buyer and seller: the buyer wallet is a seller wallet, the seller's wallets sent USDC to the buyer on Arc, or both sides' USDC was bridged in from the same source wallet. Linked ratings stay listed but do not count.",
  "One vote per buyer per seller (the latest). Verified buyers (WhatsApp, or a Proteus account with an email) weigh 1; wallet-only buyers weigh 0.5.",
  `The score starts every seller at a neutral ${RATING_PRIOR} worth ${RATING_PRIOR_WEIGHT} buyers, so a few ratings cannot make a perfect score.`,
  `The checks apply to ratings given from ${RATING_CHECKS_START.toISOString()} on. Earlier ratings found linked still count and are marked "counted_before_checks" with the reason, so the exception stays visible.`,
  "Limits: a seller can still fund a second wallet from an exchange; the checks raise the cost of faking, they do not prove independence.",
];

/** Public view: summary, method, each rating with its status, and the trusted reviewers to pass to getSummary. */
export async function publicRatings(org: typeof schema.orgs.$inferSelect) {
  const list = await sellerRatingList(org.id);
  const summary = summarizeRatings(list.map((r) => ({ buyerAddress: r.buyer, value: r.value, buyerTier: r.buyerTier, linkStatus: r.linkStatus, weight: r.weight, createdAt: r.createdAt })));
  // Only buyers that passed the check are trusted reviewers; a rating counted before the checks is not one.
  const trustedReviewers = [...new Set(list.filter((r) => r.linkStatus === "clear").map((r) => getAddress(r.buyer)))];
  return {
    seller: org.slug,
    agentId: org.agentId,
    summary,
    method: RATING_METHOD,
    ratings: list.map((r) => ({
      stars: r.value,
      buyer: r.buyer,
      buyerTier: r.buyerTier,
      status: r.linkStatus === "clear" ? "counted" : ratedBeforeChecks(r) ? "counted_before_checks" : r.linkStatus === "linked" ? "linked_to_seller" : "checking",
      reason: r.linkReason,
      txHash: r.txHash,
      settled: r.weight,
      createdAt: r.createdAt,
    })),
    trustedReviewers,
    verifyOnChain: org.agentId
      ? {
          chainId: env.CHAIN_ID,
          reputationRegistry: erc8004For(env.CHAIN_ID).reputation,
          call: "getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)",
          args: { agentId: org.agentId, clientAddresses: trustedReviewers, tag1: RATING_TAG, tag2: "" },
          note: trustedReviewers.length
            ? "Returns the count and plain average of these buyers' feedback tagged proteus-deal. Our score additionally keeps one vote per buyer, weights verified buyers and applies the neutral prior."
            : "No trusted reviewers yet. ERC-8004 getSummary requires at least one client address (an empty list reverts).",
        }
      : null,
  };
}
