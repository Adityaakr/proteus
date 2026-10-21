import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BrandFields, EMPTY_BRAND, brandFromState, validateBrandState, type BrandFormState } from "../BrandFields";
import { Field } from "../../ui/Field";
import { v1 } from "../v1";
import type { MeOrg } from "../types";
import { BadgeCheck, FlaskConical, KeyRound, Wallet } from "lucide-react";
import { ActionButton, Card, KeyValue, LoadingCard, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { PageHeader } from "../../seller/parts/PageHeader";
import { errorMessage } from "../../seller/transport";
import { dateTime } from "../../seller/format";
import { useMe, useRevokeSigner, useSigner } from "../hooks";
import { useAuth } from "../v1";
import { REVOKE_NOTE, type RevokeSignerResponse } from "../types";
import s from "../sell.module.css";
import { ARC_NETWORK_NAMES, defaultNetwork, explorerAddress, explorerTx } from "@proteus/domain";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { registerAgent, waitForReceipt, walletErrorMessage } from "../../lib/wallet";

export default function Settings() {
  const { me } = useMe();
  const auth = useAuth();
  const signer = useSigner(Boolean(me?.org));
  const revoke = useRevokeSigner();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RevokeSignerResponse | null>(null);
  const payout = me?.wallets.find((w) => w.primary)?.address ?? me?.wallets[0]?.address ?? auth.wallet?.address;
  const sandbox = me?.org?.label === "sandbox";

  return (
    <div className={s.page}>
      <PageHeader description="Your seller org, the key that signs on its behalf, and where payouts go." />

      {sandbox && (
        <Notice tone="info" title="Example seller">
          <span className={s.row}>
            <StatusTag network="sandbox" label="Example seller" icon={<FlaskConical size={12} />} />
            This is the seeded demo seller with a sample order store. Its deals run on {ARC_NETWORK_NAMES[defaultNetwork()]} for real but never count toward live totals.
          </span>
        </Notice>
      )}

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

      <Card title="Payout address" subtitle="Settled USDC is paid to your Proteus AI account wallet." actions={<StatusTag network={defaultNetwork()} label={ARC_NETWORK_NAMES[defaultNetwork()]} />}>
        {payout ? (
          <div className={s.fields}>
            <span className={s.row}>
              <Wallet size={16} aria-hidden style={{ color: "var(--c-dark-60)" }} />
              <MonoValue value={payout} copy label="payout address" />
            </span>
            <p className={s.hint}>Read only. This is the owner's wallet, so it changes only if the owner account changes.</p>
          </div>
        ) : (
          <p className="body3">Sign in to see your wallet address.</p>
        )}
      </Card>

      {me?.org && !sandbox && <AgentIdentityCard />}

      {me?.org && <BrandCard org={me.org} />}

      {me?.org && (
        <Card title="Seller org">
          <KeyValue
            items={[
              { k: "Name", v: me.org.name },
              { k: "Slug", v: <MonoValue value={me.org.slug} /> },
              { k: "Label", v: <StatusTag network={sandbox ? "sandbox" : "live"} label={sandbox ? "Example seller" : "Live seller"} /> },
              { k: "Your role", v: "Owner" },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

function BrandCard({ org }: { org: MeOrg }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const [name, setName] = useState(org.name);
  const [b, setB] = useState<BrandFormState>({ ...EMPTY_BRAND, logoUrl: org.brand?.logoUrl ?? "", markUrl: org.brand?.markUrl ?? "", tagline: org.brand?.tagline ?? "", category: org.brand?.category ?? "", website: org.brand?.website ?? "" });
  const errors = validateBrandState(b);
  const save = useMutation({
    mutationFn: () => {
      const brand = brandFromState(b);
      // Empty strings clear a field on the server.
      const patch = { logoUrl: brand.logoUrl ?? "", markUrl: brand.markUrl ?? "", tagline: brand.tagline ?? "", category: brand.category ?? "", website: brand.website ?? "" };
      return v1.app.updateOrg({ name: name.trim() !== org.name ? name.trim() : undefined, brand: patch });
    },
    onSuccess: () => {
      auth.refetchMe();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["market"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
    },
  });
  return (
    <Card title="Brand" subtitle="How buyers see you in the market, on your product pages and in every negotiation.">
      <div className={s.fields}>
        <Field label="Business name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <BrandFields name={name} value={b} onChange={setB} errors={errors} />
        {save.isError && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {save.isSuccess && !save.isPending && <Notice tone="success">Brand saved.</Notice>}
        <div className={s.row}>
          <ActionButton onClick={() => save.mutate()} loading={save.isPending} loadingLabel="Saving" disabled={Object.keys(errors).length > 0 || name.trim().length < 2}>
            Save brand
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}

/**
 * ERC-8004 identity on Arc. The seller's own wallet registers its agent in one transaction, publishing the payee and the
 * delegated signer as on-chain metadata; Proteus reads them back and refuses to quote if they ever stop matching.
 */
function AgentIdentityCard() {
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
      await v1.app.confirmAgent(h);
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
