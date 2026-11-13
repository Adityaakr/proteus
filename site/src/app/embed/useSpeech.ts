import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser speech: recognition in, synthesis out. Recognition in Chrome and Edge runs on Google's speech service and
 * in Safari on the device; Brave, Arc and some Chromium builds ship the API but block the service, which surfaces as
 * a "network" error. Every failure becomes a plain sentence, and typing always works.
 */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const ctor = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const SPEECH_ERRORS: Record<string, string> = {
  network: "Voice isn't available in this browser (it blocks the speech service). Use Chrome, Edge or Safari, or type your message.",
  "not-allowed": "Microphone access is blocked. Allow it in your browser, or type your message.",
  "service-not-allowed": "Voice isn't available in this browser. Use Chrome, Edge or Safari, or type your message.",
  "no-speech": "I didn't catch that. Tap the mic and try again.",
  "audio-capture": "No microphone was found. Type your message instead.",
};

export function useSpeech(onFinal: (text: string) => void) {
  const [supported] = useState(() => Boolean(ctor()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return setError("Voice isn't available in this browser. Type your message instead.");
    setError(null);
    setInterim("");
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const r = new C();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = 0; i < e.results.length; i++) {
        const x = e.results[i]!;
        if (x.isFinal) finalText += x[0]!.transcript;
        else live += x[0]!.transcript;
      }
      setInterim((finalText + live).trim());
    };
    r.onerror = (e) => setError(SPEECH_ERRORS[e.error] ?? "Voice stopped. Type your message instead.");
    r.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText.trim()) onFinal(finalText.trim());
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [onFinal]);

  const stop = useCallback(() => rec.current?.stop(), []);
  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}

/** Reads text aloud with the browser's voice. */
export function speak(text: string) {
  if (typeof speechSynthesis === "undefined" || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 900));
  u.rate = 1.02;
  speechSynthesis.speak(u);
}
