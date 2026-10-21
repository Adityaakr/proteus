import { Star } from "lucide-react";
import { explorerBase, defaultChainId } from "@proteus/domain";
import type { SellerAgent, SellerStats } from "../lib/types";
import { ArcMark } from "../ui/Marks";
import m from "./market.module.css";

/** "On Arc · Agent #N": the seller's ERC-8004 identity, linked to the NFT on the Arc explorer. */
export function AgentBadge({ agent }: { agent: SellerAgent }) {
  const registry = agent.agentRegistry.split(":")[2];
  return (
    <a
      className={m.agentBadge}
      href={`${explorerBase(defaultChainId())}/token/${registry}/instance/${agent.agentId}`}
      target="_blank"
      rel="noreferrer"
      title="ERC-8004 agent identity on Arc, owned by the seller's own wallet. It publishes the seller's payee and signer; quotes are refused if they stop matching."
    >
      <ArcMark size={11} /> Agent #{agent.agentId}
    </a>
  );
}

/** Weighted average stars with the count behind it, or nothing when there are no verified ratings. */
export function RatingValue({ ratings }: { ratings: SellerStats["ratings"] }) {
  if (!ratings || ratings.count === 0) return <span className={m.ratingNone}>No ratings yet</span>;
  return (
    <span className={m.rating} title="Average stars from buyers of settled deals, weighted by USDC settled. Each rating is an ERC-8004 transaction on Arc.">
      <Star size={13} className={m.ratingStar} aria-hidden /> {ratings.average.toFixed(1)}
      <span className={m.ratingCount}> ({ratings.count})</span>
    </span>
  );
}
