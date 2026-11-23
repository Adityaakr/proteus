import { SEARCH_MAX_LENGTH, filterBySearch, searchTerms } from "@proteus/domain";

/**
 * `?q=` on the dashboard's capped lists (newest 100 negotiations, newest 200 deals). Without a query a list returns
 * its newest rows as before; with one it searches every row the caller owns, up to `SEARCH_SCAN_LIMIT` of the newest,
 * and returns the newest matches up to the same cap. Matching is `filterBySearch` from @proteus/domain, the same rule
 * the dashboard applies as the buyer or seller types.
 */
export const SEARCH_SCAN_LIMIT = 5000;

/** The query from a `q` param: trimmed and capped, or undefined when blank. */
export function listQuery(raw: string | undefined | null): string | undefined {
  const q = raw?.slice(0, SEARCH_MAX_LENGTH).trim();
  return q && searchTerms(q).length ? q : undefined;
}

/** How many newest rows to read for a list: its usual cap, or the scan limit while searching. */
export const scanLimit = (q: string | undefined, cap: number) => (q ? SEARCH_SCAN_LIMIT : cap);

/** The newest `cap` rows matching the query (rows are already newest first). */
export function searchRows<T>(rows: T[], q: string | undefined, cap: number, fields: (row: T) => readonly (string | null | undefined)[]): T[] {
  return (q ? filterBySearch(rows, q, fields) : rows).slice(0, cap);
}
