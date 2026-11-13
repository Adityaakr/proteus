import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { speak, useSpeech } from "./useSpeech";
import e from "./embed.module.css";
import t from "./talk.module.css";

type Msg = { role: "customer" | "assistant"; text: string };

const newSession = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "F";

/**
 * A business's front desk for its own customers, shared as a link or embedded on its website. A real conversation:
 * the assistant (Claude) asks for what it needs one question at a time, then books or takes the message. The
 * customer can type or speak; replies can be read aloud. One finished request is billed to the business, once.
 */
export default function CustomerTalk() {
  const { token = "" } = useParams();
  const page = useQuery({ queryKey: ["talk", token], queryFn: () => api.talkPage(token), retry: false });
  const [session, setSession] = useState(newSession);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aloud, setAloud] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const spokeRef = useRef(false);

  const name = page.data?.business || "Front desk";

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, done]);

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const clean = text.trim();
      if (!clean || busy || done) return;
      setErr(null);
      setDraft("");
      const next: Msg[] = [...msgs, { role: "customer", text: clean }];
      setMsgs(next);
      setBusy(true);
      try {
        const r = await api.talkSend(token, { sessionId: session, messages: next });
        setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
        if (r.done) setDone(true);
        if (aloud || viaVoice) {
          spokeRef.current = true;
          speak(r.reply);
        }
      } catch (x) {
        setErr(errorMessage(x));
        setMsgs((m) => m.slice(0, -1));
        setDraft(clean);
      } finally {
        setBusy(false);
      }
    },
    [busy, done, msgs, session, token, aloud],
  );

  const onVoice = useCallback((text: string) => void send(text, true), [send]);
  const voice = useSpeech(onVoice);

  const restart = () => {
    setSession(newSession());
    setMsgs([]);
    setDone(false);
    setErr(null);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    void send(draft);
  };

  const accent = useMemo(() => ({ "--accent": "var(--c-blue, #2b4cf5)" }) as CSSProperties, []);

  if (page.isLoading) return <main className={e.root} style={accent}><p className={e.empty}>Loading…</p></main>;
  if (page.isError) return <main className={e.root} style={accent}><p className={e.empty}>{errorMessage(page.error)}</p></main>;
  const p = page.data!;
  const showStarters = msgs.length === 0 && p.starters.length > 0;

  return (
    <main className={e.root} style={accent}>
      <header className={e.head}>
        <span className={t.avatar} aria-hidden>{initialOf(name)}</span>
        <div className={e.headText}>
          <strong>{name}</strong>
          <span><i className={t.dot} aria-hidden /> AI assistant · replies in seconds</span>
        </div>
        <button type="button" className={e.close} onClick={() => setAloud((a) => !a)} aria-pressed={aloud} aria-label={aloud ? "Stop reading replies aloud" : "Read replies aloud"} title={aloud ? "Replies are read aloud" : "Read replies aloud"}>
          {aloud ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </header>

      <div className={e.body} ref={bodyRef} aria-live="polite">
        <div className={e.msgAgent}>{p.greeting}</div>
        {p.hours && msgs.length === 0 && <p className={t.hours}>Open: {p.hours}</p>}
        {showStarters && (
          <div className={t.chips}>
            {p.starters.map((s) => (
              <button key={s} type="button" className={t.chip} onClick={() => void send(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "customer" ? e.msgMe : e.msgAgent}>{m.text}</div>
        ))}
        {busy && <div className={e.msgAgent}><span className={e.typing}><i /><i /><i /></span></div>}
        {done && (
          <div className={t.doneCard}>
            <span className={t.doneIcon} aria-hidden><Check size={14} strokeWidth={3} /></span>
            <div>
              <strong>Request sent to {name}</strong>
              <p>They have your details and will follow up. You can close this page.</p>
              <button type="button" className={t.linkBtn} onClick={restart}>Start a new request</button>
            </div>
          </div>
        )}
      </div>

      {(err || voice.error) && (
        <p className={t.notice} role="alert">
          {err ?? voice.error}
          {voice.error && <button type="button" className={t.linkBtn} onClick={voice.clearError}>Dismiss</button>}
        </p>
      )}

      <form className={e.composer} onSubmit={submit}>
        <input
          value={voice.listening ? voice.interim || "Listening…" : draft}
          onChange={(ev) => setDraft(ev.target.value)}
          placeholder={done ? "Request sent" : "Type your message"}
          aria-label="Your message"
          disabled={done || voice.listening}
          maxLength={1500}
          enterKeyHint="send"
        />
        {p.voice && voice.supported && !done && (
          <button type="button" onClick={voice.listening ? voice.stop : voice.start} disabled={busy} className={voice.listening ? t.micLive : t.mic} aria-label={voice.listening ? "Stop and send" : "Speak your message"} title={voice.listening ? "Stop and send" : "Speak"}>
            {voice.listening ? <Square size={15} /> : <Mic size={17} />}
          </button>
        )}
        <button type="submit" disabled={busy || done || voice.listening || !draft.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
      <p className={e.foot}>AI assistant for {name}. Your details go only to {name}.</p>
    </main>
  );
}
