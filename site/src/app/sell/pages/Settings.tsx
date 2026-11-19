import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandFields, EMPTY_BRAND, brandFromState, validateBrandState, type BrandFormState } from "../BrandFields";
import { Field } from "../../ui/Field";
import { v1 } from "../v1";
import type { MeOrg } from "../types";
import { Bell, FlaskConical, MessageCircle, Wallet } from "lucide-react";
import { ActionButton, Card, KeyValue, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { PageHeader } from "../../seller/parts/PageHeader";
import { errorMessage } from "../../seller/transport";
import { dateTime } from "../../seller/format";
import { useMe } from "../hooks";
import { useAuth } from "../v1";
import s from "../sell.module.css";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";
import { randomPin, runEmbeddedSignup } from "../whatsapp/embeddedSignup";
import { MovedToDevelopers } from "../developers/MovedToDevelopers";
import { SETTINGS_SECTIONS } from "../developers/reference";

/** Seller settings: brand, payout, alerts and the WhatsApp number. The technical cards live on Developers. */
export default function Settings() {
  const { me } = useMe();
  const auth = useAuth();
  const payout = me?.wallets.find((w) => w.primary)?.address ?? me?.wallets[0]?.address ?? auth.wallet?.address;
  const sandbox = me?.org?.label === "sandbox";
  const org = me?.org;

  const sections: Record<(typeof SETTINGS_SECTIONS)[number], ReactNode> = {
    "moved-to-developers": org ? <MovedToDevelopers /> : null,
    payout: (
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
    ),
    alerts: org && !sandbox ? <AlertsCard /> : null,
    whatsapp: org && !sandbox ? <WhatsAppCard /> : null,
    brand: org ? <BrandCard org={org} /> : null,
    org: org ? (
      <Card title="Seller org">
        <KeyValue
          items={[
            { k: "Name", v: org.name },
            { k: "Slug", v: <MonoValue value={org.slug} /> },
            { k: "Label", v: <StatusTag network={sandbox ? "sandbox" : "live"} label={sandbox ? "Example seller" : "Live seller"} /> },
            { k: "Your role", v: "Owner" },
          ]}
        />
      </Card>
    ) : null,
  };

  return (
    <div className={s.page}>
      <PageHeader description="Your brand, where payouts go, and how you hear about deals." />

      {sandbox && (
        <Notice tone="info" title="Example seller">
          <span className={s.row}>
            <StatusTag network="sandbox" label="Example seller" icon={<FlaskConical size={12} />} />
            This is the seeded demo seller with a sample order store. Its deals run on {ARC_NETWORK_NAMES[defaultNetwork()]} for real but never count toward live totals.
          </span>
        </Notice>
      )}

      {SETTINGS_SECTIONS.map((id) => (sections[id] ? <div key={id} style={{ display: "contents" }}>{sections[id]}</div> : null))}
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

/** Email and Telegram alerts. The webhook moved to Developers; saving here leaves it as it is. */
function AlertsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sell", "notifications"], queryFn: () => v1.app.notifications(), retry: false });
  const [draft, setDraft] = useState<{ email: string; telegramChatId: string } | null>(null);
  const save = useMutation({
    mutationFn: (b: { email: string; telegramChatId: string }) => v1.app.setNotifications({ email: b.email || null, telegramChatId: b.telegramChatId || null }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sell", "notifications"] }); setDraft(null); },
  });
  const test = useMutation({ mutationFn: () => v1.app.testNotification() });
  if (!q.data) return null;
  const cur = draft ?? { email: q.data.email ?? "", telegramChatId: q.data.telegramChatId ?? "" };
  const set = (k: keyof typeof cur) => (e: { target: { value: string } }) => setDraft({ ...cur, [k]: e.target.value });
  const configured = Boolean(q.data.email || q.data.telegramChatId);
  return (
    <Card title="Email and Telegram alerts" subtitle="Hear about deals as they happen: funded, usage settled, refunds, disputes and offers waiting for your approval. Messages link to the Arc transaction; the chain stays the record." actions={<StatusTag tone={configured ? "success" : "neutral"} label={configured ? "On" : "Off"} icon={<Bell size={12} />} />}>
      <div className={s.fields}>
        <Field label="Email" value={cur.email} onChange={set("email")} placeholder="you@yourshop.com" disabled={!q.data.channels.email} />
        {!q.data.channels.email && <p className={s.hint}>Email is not enabled on this deployment yet (needs SMTP). Use Telegram, or a webhook on the Developers page.</p>}
        <Field label="Telegram chat id" value={cur.telegramChatId} onChange={set("telegramChatId")} placeholder="123456789" disabled={!q.data.channels.telegram} />
        {!q.data.channels.telegram && <p className={s.hint}>Telegram is not enabled on this deployment yet (needs a bot token).</p>}
        {save.isError && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {save.isSuccess && draft === null && <Notice tone="success">Saved.</Notice>}
        {test.data && (test.data.ok ? <Notice tone="success">Test sent to every channel.</Notice> : <Notice tone="danger">{test.data.errors.join("; ")}</Notice>)}
        {test.isError && <Notice tone="danger">{errorMessage(test.error)}</Notice>}
        <div className={s.row}>
          <ActionButton onClick={() => save.mutate(cur)} loading={save.isPending} loadingLabel="Saving" disabled={draft === null}>Save</ActionButton>
          <ActionButton variant="secondary" onClick={() => test.mutate()} loading={test.isPending} loadingLabel="Sending" disabled={!configured || draft !== null}>Send a test</ActionButton>
        </div>
      </div>
    </Card>
  );
}

function WhatsAppCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sell", "whatsapp"], queryFn: () => v1.app.whatsapp(), retry: false });
  const [form, setForm] = useState({ phoneNumberId: "", accessToken: "", displayPhone: "" });
  const connect = useMutation({
    mutationFn: () => v1.app.connectWhatsapp({ phoneNumberId: form.phoneNumberId.replace(/\D/g, ""), accessToken: form.accessToken.replace(/[\s\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, ""), displayPhone: form.displayPhone.trim() || undefined }),
    onSuccess: (d) => { qc.setQueryData(["sell", "whatsapp"], d); setForm({ phoneNumberId: "", accessToken: "", displayPhone: "" }); },
  });
  const disconnect = useMutation({ mutationFn: () => v1.app.disconnectWhatsapp(), onSuccess: (d) => qc.setQueryData(["sell", "whatsapp"], d) });
  const [pin, setPin] = useState(randomPin);
  const [manual, setManual] = useState(false);
  const signup = useMutation({
    mutationFn: async () => {
      const r = await runEmbeddedSignup(q.data!.signup!);
      return v1.app.completeWhatsappSignup({ ...r, pin: r.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ? undefined : pin });
    },
    onSuccess: (d) => qc.setQueryData(["sell", "whatsapp"], d),
  });
  if (!q.data) return null;
  const a = q.data;
  return (
    <Card
      title="WhatsApp"
      subtitle="Customers chat with your deal agent on your own WhatsApp Business number. Offers come from your rules; paying opens a secure page that works for 30 minutes. Your costs, buyers' phone numbers and wallet details never appear in the chat or reach the AI."
      actions={<StatusTag tone={a.connected ? "success" : "neutral"} label={a.connected ? "Connected" : "Off"} icon={<MessageCircle size={12} />} />}
    >
      <div className={s.fields}>
        {!a.platformReady && <Notice tone="info">WhatsApp is not switched on for this deployment yet. You can save your number now; messages start once it is.</Notice>}
        {a.connected ? (
          <>
            <KeyValue
              items={[
                { k: "Number", v: a.displayPhone ?? <span className={s.mono}>{a.phoneNumberId}</span> },
                { k: "Phone number ID", v: <MonoValue value={a.phoneNumberId ?? ""} copy label="phone number id" /> },
                { k: "Webhook URL", v: <MonoValue value={a.webhookUrl} copy label="webhook url" /> },
                ...(a.connectedAt ? [{ k: "Connected", v: dateTime(a.connectedAt) }] : []),
              ]}
            />
            <p className={s.hint}>Every chat opens with a note that the buyer is talking to your AI agent. Buyers can reply HUMAN to reach your team (you get a notification and can answer from the negotiation page) or STOP to opt out.</p>
            {disconnect.isError && <Notice tone="danger">{errorMessage(disconnect.error)}</Notice>}
            <div className={s.row}>
              <ActionButton variant="secondary" onClick={() => disconnect.mutate()} loading={disconnect.isPending} loadingLabel="Disconnecting">Disconnect</ActionButton>
            </div>
          </>
        ) : a.signup && !manual ? (
          <>
            <p className={s.hint}>Meta opens a window where you log in with Facebook, pick your business and choose a number. Use the number you already have in the WhatsApp Business app (you keep using the app on your phone) or add a new one. Proteus never sees your Facebook password and does not copy your past chats.</p>
            <Field label="PIN for a new number (6 digits)" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" hint="Only used if you add a new number: it becomes the number's WhatsApp two-step verification PIN. Save it somewhere safe." />
            {signup.isError && <Notice tone="danger">{errorMessage(signup.error)}</Notice>}
            <div className={s.row}>
              <ActionButton onClick={() => signup.mutate()} loading={signup.isPending} loadingLabel="Connecting" disabled={pin.length !== 6}>Connect WhatsApp</ActionButton>
              <ActionButton variant="secondary" onClick={() => setManual(true)}>Connect manually</ActionButton>
            </div>
          </>
        ) : (
          <>
            <p className={s.hint}>In Meta's WhatsApp Manager, open your number and copy its <strong>Phone number ID</strong> and a <strong>permanent access token</strong> (a system user token with whatsapp_business_messaging). The token is encrypted with your own key and never shown again.</p>
            <Field label="Phone number ID" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="106540352242922" inputMode="numeric" />
            <Field label="Access token" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="EAAG…" type="password" autoComplete="off" />
            <Field label="Number shown to you (optional)" value={form.displayPhone} onChange={(e) => setForm({ ...form, displayPhone: e.target.value })} placeholder="+91 98765 43210" />
            {connect.isError && <Notice tone="danger">{errorMessage(connect.error)}</Notice>}
            <div className={s.row}>
              <ActionButton onClick={() => connect.mutate()} loading={connect.isPending} loadingLabel="Connecting" disabled={!form.phoneNumberId.trim() || !form.accessToken.trim()}>Connect WhatsApp</ActionButton>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

