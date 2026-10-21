import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ARC_NETWORK_NAMES, defaultNetwork, explorerTx } from "@proteus/domain";
import type { Hex } from "viem";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage } from "../lib/api";
import { giveFeedback, waitForReceipt, walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { ExplorerLink, Notice } from "../ui/misc";
import f from "./fund.module.css";
import r from "./rate.module.css";

/**
 * Rate the seller once usage has settled. The buyer's own wallet posts giveFeedback on Arc's ERC-8004
 * ReputationRegistry; Proteus reads the transaction back and counts it only if it came from this deal's buyer,
 * for this seller's agent, tagged with this deal. The rating is public on chain and linked from the seller's page.
 */
export function RateSeller({ dealId }: { dealId: string }) {
  const { getWalletClient, mock } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["deal-rating", dealId], queryFn: () => api.dealRating(dealId), retry: false });
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [stage, setStage] = useState<"idle" | "signing" | "confirming">("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = q.data;
  if (!data || (!data.eligible && !data.existing)) return null;

  const submit = async () => {
    if (!data.args || stars < 1) return;
    if (mock) return setError("Mock mode does not send transactions.");
    setError(null);
    try {
      setStage("signing");
      const client = await getWalletClient();
      if (client.account && client.account.address.toLowerCase() !== data.buyer.toLowerCase()) throw new Error(`Rate from the wallet that funded this deal (${data.buyer.slice(0, 6)}…${data.buyer.slice(-4)}).`);
      const h = await giveFeedback(client, data.reputationRegistry, { ...data.args, stars });
      setHash(h);
      setStage("confirming");
      const rc = await waitForReceipt(h);
      if (rc.status !== "success") throw new Error("The rating transaction reverted on chain.");
      await api.confirmDealRating(dealId, h);
      await qc.invalidateQueries({ queryKey: ["deal-rating", dealId] });
    } catch (e) {
      setError(errorMessage(e) || walletErrorMessage(e));
    } finally {
      setStage("idle");
    }
  };

  const shown = hover || stars;
  return (
    <section className={f.section} aria-labelledby="h-rate">
      <div className={f.sectionHead}>
        <h2 id="h-rate" className={f.h2}>Rate the seller</h2>
        <span className={f.h2Sub}>Recorded on {ARC_NETWORK_NAMES[defaultNetwork()]}'s ERC-8004 reputation registry from your wallet. Only buyers of settled deals count.</span>
      </div>
      {data.existing ? (
        <div className={r.done}>
          <span className={r.stars} aria-label={`${data.existing.value} of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} className={n <= data.existing!.value ? r.on : r.off} />)}
          </span>
          <span className={f.fine}>Your rating is on chain <ExplorerLink href={explorerTx(data.existing.txHash)} hash={data.existing.txHash} /></span>
        </div>
      ) : (
        <>
          <div className={r.picker} role="radiogroup" aria-label="Stars" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={r.starBtn} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)} disabled={stage !== "idle"}>
                <Star size={26} className={n <= shown ? r.on : r.off} />
              </button>
            ))}
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          {hash && stage === "confirming" && <p className={f.fine}>Sent. Confirming on Arc… <ExplorerLink href={explorerTx(hash)} hash={hash} /></p>}
          <div>
            <ActionButton onClick={submit} disabled={stars < 1} loading={stage !== "idle"} loadingLabel={stage === "signing" ? "Confirm in your wallet" : "Confirming on Arc"}>
              Post rating on Arc
            </ActionButton>
          </div>
        </>
      )}
    </section>
  );
}
