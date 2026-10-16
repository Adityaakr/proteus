import { useState } from "react";
import { FlaskConical, KeyRound, Wallet } from "lucide-react";
import { ActionButton, Card, KeyValue, LoadingCard, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { PageHeader } from "../../seller/parts/PageHeader";
import { errorMessage } from "../../seller/transport";
import { dateTime } from "../../seller/format";
import { useMe, useRevokeSigner, useSigner } from "../hooks";
import { useAuth } from "../v1";
import { REVOKE_NOTE, type RevokeSignerResponse } from "../types";
import s from "../sell.module.css";

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
        <Notice tone="info" title="Demo seller">
          <span className={s.row}>
            <StatusTag network="sandbox" label="Demo seller" icon={<FlaskConical size={12} />} />
            This is the seeded demo seller with a sample order store. Its deals run on Arc testnet for real but never count toward live totals.
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

      <Card title="Payout address" subtitle="Settled USDC is paid to your PROTEUS account wallet." actions={<StatusTag network="testnet" label="Arc testnet" />}>
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

      {me?.org && (
        <Card title="Seller org">
          <KeyValue
            items={[
              { k: "Name", v: me.org.name },
              { k: "Slug", v: <MonoValue value={me.org.slug} /> },
              { k: "Label", v: <StatusTag network={sandbox ? "sandbox" : "live"} label={sandbox ? "Demo seller" : "Live seller"} /> },
              { k: "Your role", v: "Owner" },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
