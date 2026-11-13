import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { CopyButton, Notice } from "../ui/misc";
import f from "./fund.module.css";
import d from "./deal.module.css";

/** Where the buyer hears about this deal: order updates for a shopper, new customer requests for a business. */
export function NotifySettings({ dealId, apiKey, forBusiness }: { dealId: string; apiKey: string | null; forBusiness: boolean }) {
  const q = useQuery({ queryKey: ["deal-notify", dealId], queryFn: () => api.dealNotifications(dealId, apiKey), retry: false });
  const [email, setEmail] = useState("");
  const [chat, setChat] = useState("");
  const [hook, setHook] = useState("");
  useEffect(() => {
    if (!q.data) return;
    setEmail(q.data.email ?? "");
    setChat(q.data.telegramChatId ?? "");
    setHook(q.data.webhookUrl ?? "");
  }, [q.data]);
  const save = useMutation({ mutationFn: () => api.saveDealNotifications(dealId, { email: email || null, telegramChatId: chat || null, webhookUrl: hook || null }, apiKey) });
  if (q.isError) return null;
  const ch = q.data?.channels;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <section className={f.section} aria-labelledby="h-notify">
      <div className={f.sectionHead}>
        <h2 id="h-notify" className={f.h2}>Get updates</h2>
        <span className={f.h2Sub}>{forBusiness ? "Hear about every new customer request the moment it arrives, with urgent ones flagged." : "Hear about every step of your order: accepted, in production, shipped, delivered."}</span>
      </div>
      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ch?.email && <Field label="Email" placeholder="you@business.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />}
        {ch?.telegram && <Field label="Telegram chat id" hint={q.data?.telegramBot ?? undefined} placeholder="123456789" value={chat} onChange={(e) => setChat(e.target.value.replace(/[^\d-]/g, ""))} maxLength={24} />}
        <Field label="Webhook URL" hint="We POST each update as signed JSON. Connect Zapier or Make to send it to Slack, a Google Sheet, your calendar or your CRM." placeholder="https://hooks.zapier.com/hooks/catch/…" value={hook} onChange={(e) => setHook(e.target.value.trim())} maxLength={500} />
        {!ch?.email && !ch?.telegram && <p className={f.fine}>Email and Telegram are not switched on for this deployment yet; the webhook works now.</p>}
        {save.error && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {save.data?.webhookSecret && (
          <>
            <span className={f.label}>Webhook signing secret, shown once</span>
            <div className={d.secret}>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{save.data.webhookSecret}</span>
              <CopyButton value={save.data.webhookSecret} label="Copy secret" />
            </div>
            <p className={f.fine}>Verify the X-Proteus-Signature header (t=…,v1=HMAC-SHA256 of "t.body") with it.</p>
          </>
        )}
        {save.isSuccess && !save.data?.webhookSecret && <Notice tone="success">Saved.</Notice>}
        <div className={f.actions}><ActionButton type="submit" size="sm" loading={save.isPending} loadingLabel="Saving">Save</ActionButton></div>
      </form>
    </section>
  );
}
