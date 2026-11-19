import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, KeyRound } from "lucide-react";
import type { Hex } from "viem";
import { ARC_NETWORK_NAMES, defaultNetwork, explorerAddress, explorerTx } from "@proteus/domain";
import { ActionButton, Card, KeyValue, LoadingCard, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { dateTime } from "../../seller/format";
import { registerAgent, waitForReceipt, walletErrorMessage } from "../../lib/wallet";
import { useMe, useRevokeSigner, useSigner } from "../hooks";
import { REVOKE_NOTE, type RevokeSignerResponse } from "../types";
import { useAuth, v1 } from "../v1";
import s from "../sell.module.css";

/** The server-held key that signs Terms and Delivery for the org (moved here from Seller settings). */
export function SignerCard() {
  const { me } = useMe();
  const signer = useSigner(Boolean(me?.org));
  const revoke = useRevokeSigner();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RevokeSignerResponse | null>(null);
  return (
    <Card
      title="Seller signer"
      subtitle="A server-held key that signs Terms and Delivery for your org. The payee is pinned to your wallet when terms are signed."
      actions={signer.data ? <StatusTag tone={signer.data.revokedAt ? "danger" : "success"} label={signer.data.revokedAt ? "Revoked" : "Active"} icon={<KeyRound size={12} />} /> : undefined}
    >
      {!me?.org ? (
        <p className="body3">You do not have a seller org yet. Publishing your first product creates the org and its signer.</p>
      ) : signer.isPending ? (
        <LoadingCard label="Loading signer" />
      ) : signer.isError ? (
        <Notice tone="danger">{errorMessage(signer.error)}</Notice>
      ) : (
        <div className={s.fields}>
          <KeyValue
            items={[
              { k: "Address", v: <MonoValue value={signer.data.address} copy label="signer address" /> },
              { k: "Scope", v: "Signs Terms and Delivery only" },
              { k: "Created", v: dateTime(signer.data.createdAt) },
              ...(signer.data.revokedAt ? [{ k: "Revoked", v: dateTime(signer.data.revokedAt) }] : []),
            ]}
          />
          {signer.data.revokedAt ? (
            <Notice tone="warn" title="Signer revoked">
              {result?.note ?? result?.message ?? (signer.data as { note?: string }).note ?? REVOKE_NOTE}
            </Notice>
          ) : confirming ? (
            <div className={s.confirm} role="group" aria-label="Confirm signer revocation">
              <p className={`body3 ${s.strong}`}>Revoke this signer?</p>
              <p className="body3">{(signer.data as { note?: string }).note ?? REVOKE_NOTE} Your agent cannot issue new terms until a new signer is issued.</p>
              {revoke.isError && <Notice tone="danger">{errorMessage(revoke.error)}</Notice>}
              <div className={s.row}>
                <ActionButton variant="danger" loading={revoke.isPending} loadingLabel="Revoking" onClick={() => revoke.mutate(undefined, { onSuccess: (r) => { setResult(r); setConfirming(false); } })}>
                  Revoke signer
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => setConfirming(false)} disabled={revoke.isPending}>
                  Keep signer
                </ActionButton>
              </div>
            </div>
          ) : (
            <div>
              <ActionButton variant="danger" onClick={() => setConfirming(true)}>
                Revoke
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * ERC-8004 identity on Arc. The seller's own wallet registers its agent in one transaction, publishing the payee and the
 * delegated signer as on-chain metadata; Proteus reads them back and refuses to quote if they ever stop matching.
 */
/** `onRegistered` runs once the server has confirmed the identity from chain and committed each product's policy. */
export function AgentIdentityCard({ onRegistered }: { onRegistered?: (r: { agentId: string; tx: string; policies?: { product: string; tx: string | null }[] }) => void | Promise<void> } = {}) {
  const qc = useQueryClient();
  const auth = useAuth();
  const q = useQuery({ queryKey: ["sell", "agent"], queryFn: () => v1.app.agent(), retry: false });
  const [stage, setStage] = useState<"idle" | "signing" | "confirming">("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const network = ARC_NETWORK_NAMES[defaultNetwork()];
  const reg = q.data;
  const registered = reg?.registered;

  const register = async () => {
    if (!reg) return;
    setError(null);
    try {
      setStage("signing");
      const client = await auth.getWalletClient();
      const signerAddr = client.account?.address;
      if (signerAddr && signerAddr.toLowerCase() !== reg.owner.toLowerCase()) throw new Error(`Switch to your owner wallet ${reg.owner.slice(0, 6)}…${reg.owner.slice(-4)}; the identity must belong to it.`);
      const h = await registerAgent(client, reg.registry, reg.agentURI, reg.metadata);
      setHash(h);
      setStage("confirming");
      const r = await waitForReceipt(h);
      if (r.status !== "success") throw new Error("The registration transaction reverted on chain.");
      const confirmed = await v1.app.confirmAgent(h);
      await onRegistered?.(confirmed);
      await qc.invalidateQueries({ queryKey: ["sell", "agent"] });
    } catch (e) {
      setError(errorMessage(e) || walletErrorMessage(e));
    } finally {
      setStage("idle");
    }
  };

  return (
    <Card
      title="Agent identity on Arc"
      subtitle={`Register your deal agent on ${network}'s ERC-8004 registry. Your wallet owns it, and it publishes where you are paid and which key signs for you, so buyers and their agents can check both before they sign.`}
      actions={registered ? <StatusTag tone="success" label={`Agent #${registered.agentId}`} icon={<BadgeCheck size={12} />} /> : undefined}
    >
      {q.isPending ? (
        <LoadingCard label="Loading identity" />
      ) : q.isError ? (
        <Notice tone="info">{errorMessage(q.error)}</Notice>
      ) : reg ? (
        <div className={s.fields}>
          <KeyValue
            items={[
              { k: "Owner", v: <MonoValue value={reg.owner} copy label="owner wallet" /> },
              { k: "Payee", v: <MonoValue value={reg.payee} copy label="payee" /> },
              { k: "Signer", v: <MonoValue value={reg.signer} copy label="signer" /> },
              { k: "Registry", v: <a href={explorerAddress(reg.registry)} target="_blank" rel="noreferrer"><MonoValue value={reg.registry} short /></a> },
              ...(registered?.tx ? [{ k: "Registered", v: <a href={explorerTx(registered.tx)} target="_blank" rel="noreferrer"><MonoValue value={registered.tx} short /></a> }] : []),
            ]}
          />
          {registered ? (
            <p className={s.hint}>Quotes check this identity on chain before your signer countersigns. If the owner, payee or signer stops matching, quoting pauses until it is fixed.</p>
          ) : (
            <>
              {error && <Notice tone="danger">{error}</Notice>}
              {hash && stage === "confirming" && <p className={s.hint}>Sent. Waiting for confirmation… <a href={explorerTx(hash)} target="_blank" rel="noreferrer">View</a></p>}
              <div className={s.row}>
                <ActionButton onClick={register} loading={stage !== "idle"} loadingLabel={stage === "signing" ? "Confirm in your wallet" : "Confirming on Arc"}>
                  Register on Arc
                </ActionButton>
              </div>
              <p className={s.hint}>One transaction from your wallet, a few cents of USDC in gas. Proteus never owns or controls the identity.</p>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

