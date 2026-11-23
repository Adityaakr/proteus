import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The params with `key` set to `value`, or removed when the value is empty or the default. Other params are kept, so a
 * search and a filter (or ?buyer=) live side by side in the URL.
 */
export function withParam(params: URLSearchParams, key: string, value: string, fallback = ""): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!value || value === fallback) next.delete(key);
  else next.set(key, value);
  return next;
}

/**
 * One URL search param as state, e.g. `const [q, setQ] = useSearchParam("q")`. The value updates at once (an input
 * bound to it never drops keystrokes while the router catches up) and is mirrored into the URL. Typing replaces the
 * history entry instead of pushing one per keystroke, so Back leaves the page rather than undoing letters. A change
 * to the URL from elsewhere (a link, Back) wins.
 */
export function useSearchParam(key: string, fallback = ""): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(key) ?? fallback;
  const [value, setValue] = useState(fromUrl);
  // Values this hook wrote that the URL has not shown yet; the URL echoing one of them is not a change to adopt.
  const pending = useRef<string[]>([]);
  useEffect(() => {
    const i = pending.current.indexOf(fromUrl);
    if (i >= 0) pending.current = pending.current.slice(i + 1);
    else {
      pending.current = [];
      setValue(fromUrl);
    }
  }, [fromUrl]);
  const set = useCallback(
    (v: string) => {
      setValue(v);
      pending.current.push(v || fallback);
      setParams((p) => withParam(p, key, v, fallback), { replace: true });
    },
    [setParams, key, fallback],
  );
  return [value, set];
}

/** A param restricted to known values; anything else in the URL reads as the fallback. */
export function useSearchParamOf<V extends string>(key: string, allowed: readonly V[], fallback: V): [V, (value: V) => void] {
  const [raw, set] = useSearchParam(key, fallback);
  return [(allowed as readonly string[]).includes(raw) ? (raw as V) : fallback, set as (v: V) => void];
}

/** The value once it has stopped changing for `ms`; for queries that go to the server while the list filters instantly. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
