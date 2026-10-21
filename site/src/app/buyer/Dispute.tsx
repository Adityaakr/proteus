import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keccak256, toHex, type Hex } from "viem";
import { dealEscrowAbi, defaultChain, explorerAddress, explorerTx } from "@proteus/domain";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage } from "../lib/api";
import { waitForReceipt, walletErrorMessage } from "../lib/wallet";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { ExplorerLink, Notice, shortHex } from "../ui/misc";
import { Money } from "../ui/Money";
import f from "./fund.module.css";

/**
 * Open a dispute from the buyer's wallet when delivered work is wrong or missing. openDispute freezes the deal on the
 * escrow (no settlement, no refund) until the arbiter splits the unspent balance between seller and buyer.
 */
export function Dispute({ dealId }: { dealId: string }) {
  const { getWalletClient, mock } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["deal-dispute", dealId], queryFn: () => api.dealDispute(dealId), retry: false });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"signing" | "confirming" | null>(null);
  const [hash, setHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = q.data;
  if (!v || (!v.canOpen && !v.dispute)) return null;

  const submit = async () => {
    if (mock) return setError("Mock mode does not send transactions.");
    const text = reason.trim();
    if (text.length < 10) return setError("Describe what is wrong (at least 10 characters).");
    setError(null);
    try {
      setBusy("signing");
      const client = await getWalletClient();
      const h = await client.writeContract({ account: client.account!, chain: defaultChain(), address: v.escrow, abi: dealEscrowAbi, functionName: "openDispute", args: [BigInt(v.dealIdOnchain), keccak256(toHex(text))] });
      setHash(h);
      setBusy("confirming");
      if ((await waitForReceipt(h)).status !== "success") throw new Error("The dispute transaction reverted on chain.");
      await api.recordDispute(dealId, h, text);
      await qc.invalidateQueries({ queryKey: ["deal-dispute", dealId] });
    } catch (e) {
      setError(errorMessage(e) || walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const d = v.dispute;
  return (
    <section className={f.section} aria-labelledby="h-dispute">
      <div className={f.sectionHead}>
        <h2 id="h-dispute" className={f.h2}>{d ? (d.status === "open" ? "Dispute open" : "Dispute resolved") : "Something wrong?"}</h2>
        <span className={f.h2Sub}>
          Disputes are decided by the escrow's arbiter <a href={explorerAddress(v.arbiter)} target="_blank" rel="noreferrer">{shortHex(v.arbiter)}</a>, operated by Proteus AI. It can only split the unspent balance between you and the seller.
        </span>
      </div>
      {d ? (
        <>
          <p className={f.fine}>Opened by the {d.openedBy}: “{d.reason}” <ExplorerLink href={explorerTx(d.openTx)} hash={d.openTx} /></p>
          {d.status === "open" ? (
            <Notice tone="warn">The deal is frozen on the escrow: no settlement and no refund until the arbiter decides.</Notice>
          ) : (
            <Notice tone="success">
              Resolved: <Money micro={d.toSeller ?? "0"} /> to the seller, <Money micro={d.toBuyer ?? "0"} /> back to you. {d.resolveTx && <ExplorerLink href={explorerTx(d.resolveTx)} hash={d.resolveTx} />}
            </Notice>
          )}
        </>
      ) : !open ? (
        <div><ActionButton variant="secondary" size="sm" onClick={() => setOpen(true)}>Open a dispute</ActionButton></div>
      ) : (
        <>
          <Field label="What is wrong" multiline value={reason} onChange={(e) => setReason(e.target.value)} placeholder="2 of the 4 hoodies arrived with the wrong print; photos: https://…" maxLength={4000} />
          <p className={f.fine}>Only a hash of this text goes on chain; the text is kept with the deal for the arbiter. This freezes the deal until it is resolved.</p>
          {error && <Notice tone="danger">{error}</Notice>}
          {hash && busy === "confirming" && <p className={f.fine}>Confirming on Arc… <ExplorerLink href={explorerTx(hash)} hash={hash} /></p>}
          <div style={{ display: "flex", gap: 10 }}>
            <ActionButton variant="danger" onClick={submit} loading={busy !== null} loadingLabel={busy === "signing" ? "Confirm in your wallet" : "Confirming"}>Open dispute on Arc</ActionButton>
            <ActionButton variant="secondary" onClick={() => setOpen(false)} disabled={busy !== null}>Cancel</ActionButton>
          </div>
        </>
      )}
    </section>
  );
}
