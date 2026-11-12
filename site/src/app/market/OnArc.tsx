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
      // The registration transaction is the proof and opens on every Arc explorer; NFT instance pages do not exist on mainnet.
      href={agent.registeredTx ? `${explorerBase(defaultChainId())}/tx/${agent.registeredTx}` : `${explorerBase(defaultChainId())}/address/${registry}`}
      target="_blank"
      rel="noreferrer"
      title="ERC-8004 agent identity on Arc, owned by the seller's own wallet. It publishes the seller's payee and signer; quotes are refused if they stop matching."
    >
      <ArcMark size={11} /> Agent #{agent.agentId}
    </a>
  );
}

/** Average stars with the number of distinct buyers behind it. Linked and pending ratings never count. */
export function RatingValue({ ratings }: { ratings: SellerStats["ratings"] }) {
  if (!ratings || ratings.count === 0) {
    if (ratings?.pending) return <span className={m.ratingNone} title="A new rating is being checked for links between buyer and seller.">Rating being checked</span>;
    return <span className={m.ratingNone}>No ratings yet</span>;
  }
  const buyers = `${ratings.count} buyer${ratings.count === 1 ? "" : "s"}`;
  const title = [
    `Average of ${buyers}: one vote per buyer, from buyers of settled deals, each an ERC-8004 transaction on Arc.`,
    ratings.verifiedBuyers ? `${ratings.verifiedBuyers} verified (WhatsApp or an account with an email).` : "",
    ratings.excluded ? `${ratings.excluded} rating${ratings.excluded === 1 ? "" : "s"} linked to the seller not counted.` : "",
    ratings.beforeChecks ? `${ratings.beforeChecks} counted rating${ratings.beforeChecks === 1 ? " was" : "s were"} given before link checks existed and ${ratings.beforeChecks === 1 ? "is" : "are"} linked to the seller.` : "",
    `Ranking score ${ratings.score.toFixed(2)} (starts at a neutral 3.5 until more buyers rate).`,
  ].filter(Boolean).join(" ");
  return (
    <span className={m.rating} title={title}>
      <Star size={13} className={m.ratingStar} aria-hidden /> {ratings.average.toFixed(1)}
      <span className={m.ratingCount}> · {buyers}</span>
    </span>
  );
}
