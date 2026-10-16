import { useEffect, useRef, useState } from "react";
import { useBalances } from "./useBalances";

const POLL_MS = 3000;
const POLL_WINDOW_MS = 90_000;

/**
 * Watches the account balance for an incoming deposit: polls every 3 s for up to 90 s after `start()`,
 * stops the moment the USDC balance changes. `result` is "arrived" (with the delta) or "none".
 */
export function useDepositWatch() {
  const [pollUntil, setPollUntil] = useState(0);
  const watching = pollUntil > Date.now();
  const q = useBalances({ poll: watching ? POLL_MS : false });
  const startUsdc = useRef<bigint | null>(null);
  const [result, setResult] = useState<{ kind: "arrived"; delta: bigint } | { kind: "none" } | null>(null);

  useEffect(() => {
    if (!watching) return;
    const t = window.setTimeout(() => {
      setPollUntil(0);
      setResult((r) => r ?? { kind: "none" });
    }, pollUntil - Date.now());
    return () => window.clearTimeout(t);
  }, [watching, pollUntil]);

  useEffect(() => {
    if (!watching || startUsdc.current === null || !q.data) return;
    if (q.data.usdc !== startUsdc.current) {
      setPollUntil(0);
      setResult({ kind: "arrived", delta: q.data.usdc - startUsdc.current });
    }
  }, [q.data, watching]);

  const start = () => {
    startUsdc.current = q.data?.usdc ?? 0n;
    setResult(null);
    setPollUntil(Date.now() + POLL_WINDOW_MS);
    void q.refetch();
  };
  const stop = () => setPollUntil(0);
  const reset = () => {
    setPollUntil(0);
    setResult(null);
  };

  return { q, watching, result, start, stop, reset, pollMs: watching ? POLL_MS : false } as const;
}
