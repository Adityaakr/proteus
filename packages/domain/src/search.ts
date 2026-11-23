/**
 * Plain-text list search shared by the dashboard (instant, in the browser) and the API (`?q=` on capped lists), so a
 * query matches the same rows in both places. Case and accents are ignored; every word of the query must appear in
 * at least one of the row's fields, in any order ("polo vintage" finds "Vintage Zip Polo").
 */

/** The longest query the API accepts; longer input is cut, never rejected. */
export const SEARCH_MAX_LENGTH = 100;

/** Lower-case, accents stripped, whitespace collapsed. */
export function normalizeSearchText(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The words of a query, normalized; an empty or blank query has none. */
export function searchTerms(query: string | null | undefined): string[] {
  if (!query) return [];
  const q = normalizeSearchText(query.slice(0, SEARCH_MAX_LENGTH));
  return q ? q.split(" ") : [];
}

type Field = string | number | null | undefined | false | readonly (string | null | undefined)[];

/** True when every term appears somewhere in the fields. No terms matches everything. */
export function matchesSearch(fields: readonly Field[], terms: readonly string[]): boolean {
  if (!terms.length) return true;
  const hay = normalizeSearchText(fields.flat().filter((f) => f !== null && f !== undefined && f !== false).join(" \u0001 "));
  return terms.every((t) => hay.includes(t));
}

/** The rows matching a query, in their original order. */
export function filterBySearch<T>(rows: readonly T[], query: string | null | undefined, fields: (row: T) => readonly Field[]): T[] {
  const terms = searchTerms(query);
  return terms.length ? rows.filter((r) => matchesSearch(fields(r), terms)) : [...rows];
}
