import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { VoiceTalk } from "../buyer/VoiceTalk";
import t from "./talk.module.css";

/**
 * A business's page for its own customers, shared as a link or embedded on its website: they type or speak, the
 * business's AI assistant (Claude) answers, and the full note goes to the business's inbox. No sign-in.
 */
export default function CustomerTalk() {
  const { token = "" } = useParams();
  const page = useQuery({ queryKey: ["talk", token], queryFn: () => api.talkPage(token), retry: false });
  const [values, setValues] = useState<Record<string, string>>({});
  const [reply, setReply] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (v: Record<string, string>) => api.talkSend(token, v),
    onSuccess: (r) => setReply(r.reply),
  });

  if (page.isLoading) return <main className={t.page}><div className={t.card}><p className={t.intro}>Loading…</p></div></main>;
  if (page.isError) return <main className={t.page}><div className={t.card}><p className={t.error}>{errorMessage(page.error)}</p></div></main>;
  const p = page.data!;
  const missing = p.fields.find((f) => f.required && !values[f.key]?.trim());
  const submit = (e?: FormEvent, v = values) => {
    e?.preventDefault();
    if (p.fields.some((f) => f.required && !v[f.key]?.trim())) return;
    setReply(null);
    send.mutate(v);
  };
  const messageKey = p.fields.find((f) => f.key === "question")?.key;

  return (
    <main className={t.page}>
      <div className={t.card}>
        <h1 className={t.business}>{p.business}</h1>
        <p className={t.intro}>{p.intro}</p>
        <form className={t.form} onSubmit={submit} noValidate>
          {p.fields.map((f) => (
            <label key={f.key} className={t.label}>
              {f.label}{!f.required && " (optional)"}
              {f.key === "question" ? (
                <textarea className={t.input} rows={3} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [f.key]: e.target.value }))} maxLength={2000} />
              ) : (
                <input className={t.input} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [f.key]: e.target.value }))} maxLength={200} autoComplete={f.key === "phone" ? "tel" : f.key === "name" || f.key === "customer" ? "name" : undefined} inputMode={f.key === "phone" ? "tel" : undefined} />
              )}
            </label>
          ))}
          {p.voice && messageKey && (
            <VoiceTalk
              label="Speak instead of typing"
              busy={send.isPending}
              reply={reply}
              onTranscript={(text) => {
                const v = { ...values, [messageKey]: text };
                setValues(v);
                submit(undefined, v);
              }}
            />
          )}
          <button className={t.send} type="submit" disabled={Boolean(missing) || send.isPending}>{send.isPending ? "Sending…" : "Send"}</button>
        </form>
        {send.isError && <p className={t.error}>{errorMessage(send.error)}</p>}
        {reply && <div className={t.reply} aria-live="polite">{reply}</div>}
        <p className={t.foot}>Answered by {p.business}'s AI assistant. Your details go only to {p.business}.</p>
      </div>
    </main>
  );
}
