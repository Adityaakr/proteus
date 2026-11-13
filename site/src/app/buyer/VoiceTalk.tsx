import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import f from "./fund.module.css";

/**
 * Talk to a voice service from the browser: the browser's own speech recognition turns the caller's words into the
 * request, the agent (Claude) answers, and the browser reads the caller-facing part of the answer aloud. Audio never
 * leaves the browser's speech engine as a file; Proteus receives only the transcript.
 */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The part of an answer a caller should hear: the reply, not the internal call note. */
export function callerPart(answer: string): string {
  const cut = answer.split(/\n\s*(?:Call note|Summary for the business|Caller:)/i)[0] ?? answer;
  return cut.replace(/^(What the caller hears|Reply to (?:the )?caller|Reply given)\s*:\s*/i, "").trim().slice(0, 900);
}

export function VoiceTalk({ onTranscript, reply, busy, label = "Talk as the caller" }: { onTranscript: (text: string) => void; reply: string | null; busy: boolean; label?: string }) {
  const [supported] = useState(() => typeof window !== "undefined" && Boolean(recognitionCtor()));
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [speak, setSpeak] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const awaitingReply = useRef(false);

  useEffect(() => {
    if (!reply || !awaitingReply.current) return;
    awaitingReply.current = false;
    if (!speak || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(callerPart(reply));
    u.rate = 1.02;
    speechSynthesis.speak(u);
  }, [reply, speak]);

  useEffect(() => () => {
    rec.current?.stop();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);

  if (!supported) return <p className={f.fine}>Voice works in Chrome, Edge and Safari. In this browser, type the caller's words instead.</p>;

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setErr(null);
    setHeard("");
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0]!.transcript;
        else interim += res[0]!.transcript;
      }
      setHeard((finalText + interim).trim());
    };
    r.onerror = (e) => setErr(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in the browser and try again." : `Voice input stopped (${e.error}).`);
    r.onend = () => {
      setListening(false);
      const text = finalText.trim();
      if (text) {
        awaitingReply.current = true;
        onTranscript(text);
      }
    };
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {listening ? (
          <button type="button" className={f.textBtn} onClick={() => rec.current?.stop()}><Square size={13} aria-hidden /> Stop and send</button>
        ) : (
          <button type="button" className={f.textBtn} onClick={start} disabled={busy}><Mic size={13} aria-hidden /> {label}</button>
        )}
        <button type="button" className={f.textBtn} onClick={() => setSpeak((s) => !s)} aria-pressed={speak}>
          {speak ? <Volume2 size={13} aria-hidden /> : <VolumeX size={13} aria-hidden />} {speak ? "Reply read aloud" : "Reply muted"}
        </button>
      </div>
      {(listening || heard) && <p className={f.fine} aria-live="polite">{listening ? "Listening… " : "Heard: "}{heard || "say what the caller would say"}</p>}
      {err && <p className={f.fine} role="alert">{err}</p>}
    </div>
  );
}
