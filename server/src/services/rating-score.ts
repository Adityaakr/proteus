/**
 * How a seller's rating is computed from verified ERC-8004 feedback (pure; no database or chain access).
 *
 * - Only ratings whose buyer passed the link check ("clear") count. Linked and pending ratings are listed, not counted.
 * - Ratings given before the checks existed (RATING_CHECKS_START) still count even if linked, and are reported as
 *   such: the rule applies from launch on, and the earlier exception stays visible rather than hidden.
 * - One vote per buyer per seller: the buyer's latest rating. Fifty deals from one wallet are one vote.
 * - Verified buyers (WhatsApp or a Proteus account with an email) weigh 1, wallet-only buyers weigh 0.5.
 * - `average` is the weighted mean of those votes. `score` starts every seller at a neutral 3.5 worth three verified
 *   buyers, so one or two ratings cannot make a perfect score; it moves toward the average as real buyers add up.
 */
export const RATING_PRIOR = 3.5;
export const RATING_PRIOR_WEIGHT = 3;
export const TIER_WEIGHT = { verified: 1, wallet: 0.5 } as const;
/** When the link check went live. Earlier ratings that turn out linked still count, flagged as given before the checks. */
export const RATING_CHECKS_START = new Date("2026-11-12T20:00:00Z");

/** Whether a linked rating predates the checks and therefore still counts. */
export const ratedBeforeChecks = (r: { linkStatus: string; createdAt: Date }) => r.linkStatus === "linked" && r.createdAt < RATING_CHECKS_START;

export interface RatingRow {
  buyerAddress: string;
  value: number;
  buyerTier: string | null;
  linkStatus: string;
  /** Micro-USDC settled on the rated deal. */
  weight: bigint;
  createdAt: Date;
}

export interface RatingSummary {
  /** Distinct buyers whose rating counts. */
  count: number;
  /** Of those, buyers verified through WhatsApp or an account with an email. */
  verifiedBuyers: number;
  /** Weighted mean stars of the counted votes, two decimals. */
  average: number;
  /** The average pulled toward a neutral 3.5 until enough buyers rate, two decimals. Use it to rank sellers. */
  score: number;
  /** Ratings left out because the buyer is linked to the seller. */
  excluded: number;
  /** Counted ratings whose buyer is linked to the seller but which were given before the checks existed. */
  beforeChecks: number;
  /** Ratings still being checked. */
  pending: number;
  /** Micro-USDC settled across the deals behind the counted votes. */
  settledBehind: bigint;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeRatings(rows: RatingRow[]): RatingSummary | null {
  if (!rows.length) return null;
  const latestByBuyer = new Map<string, RatingRow>();
  let excluded = 0;
  let pending = 0;
  let beforeChecks = 0;
  for (const r of rows) {
    if (r.linkStatus === "linked" && !ratedBeforeChecks(r)) { excluded++; continue; }
    if (ratedBeforeChecks(r)) beforeChecks++;
    else if (r.linkStatus !== "clear") { pending++; continue; }
    const key = r.buyerAddress.toLowerCase();
    const prev = latestByBuyer.get(key);
    if (!prev || r.createdAt > prev.createdAt) latestByBuyer.set(key, r);
  }
  let sumW = 0;
  let sumWV = 0;
  let verifiedBuyers = 0;
  let settledBehind = 0n;
  for (const r of latestByBuyer.values()) {
    const w = r.buyerTier === "verified" ? TIER_WEIGHT.verified : TIER_WEIGHT.wallet;
    if (r.buyerTier === "verified") verifiedBuyers++;
    sumW += w;
    sumWV += w * r.value;
    settledBehind += r.weight;
  }
  const count = latestByBuyer.size;
  return {
    count,
    verifiedBuyers,
    average: count ? round2(sumWV / sumW) : 0,
    score: round2((RATING_PRIOR * RATING_PRIOR_WEIGHT + sumWV) / (RATING_PRIOR_WEIGHT + sumW)),
    excluded,
    beforeChecks,
    pending,
    settledBehind,
  };
}
