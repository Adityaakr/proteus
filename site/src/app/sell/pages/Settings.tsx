import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BrandFields, EMPTY_BRAND, brandFromState, validateBrandState, type BrandFormState } from "../BrandFields";
import { Field } from "../../ui/Field";
import { v1 } from "../v1";
import type { MeOrg } from "../types";
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
        <Notice tone="info" title="Example seller">
          <span className={s.row}>
            <StatusTag network="sandbox" label="Example seller" icon={<FlaskConical size={12} />} />
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
