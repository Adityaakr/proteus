import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams, type Location } from "react-router-dom";

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

/** The search each rendered location has been moved to by writes that its next render has not shown yet. */
const written = new WeakMap<Location, string>();

/**
 * The search after setting `key` on top of every write already made from this rendered location, so several setters
 * fired before the router re-renders (a "Clear search and filters" click) all land. `changed` is false when the value
 * is already what the URL will hold, so the caller does not wait for an echo that never comes.
 */
export function writeParam(location: Location, key: string, value: string, fallback = ""): { search: string; changed: boolean } {
  const base = new URLSearchParams(written.get(location) ?? location.search);
  const search = withParam(base, key, value, fallback).toString();
  written.set(location, search);
  return { search, changed: (base.get(key) ?? fallback) !== (value || fallback) };
}

/**
 * One URL search param as state, e.g. `const [q, setQ] = useSearchParam("q")`. The value updates at once (an input
 * bound to it never drops keystrokes while the router catches up) and is mirrored into the URL. Typing replaces the
 * history entry instead of pushing one per keystroke, so Back leaves the page rather than undoing letters. A change
 * to the URL from elsewhere (a link, Back) wins.
 */
export function useSearchParam(key: string, fallback = ""): [string, (value: string) => void] {
  const location = useLocation();
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
  }, [location, fromUrl]);
  const set = useCallback(
    (v: string) => {
      setValue(v);
      const { search, changed } = writeParam(location, key, v, fallback);
      if (changed) pending.current.push(v || fallback);
      setParams(search, { replace: true });
    },
    [location, setParams, key, fallback],
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
