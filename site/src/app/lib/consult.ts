/**
 * Store conversations move between "all products" (the agent recommends, turn kind "consult") and one product (that
 * product's agent negotiates). These helpers read which one a thread is on from its turns, and where the thread
 * changed between them, so the chat can show a visible "Now on: Hoodies · change" marker instead of a silent switch.
 */
import type { ConsultPayload, Turn } from "./types";

export type Scope = "all" | "product";

/** What an agent turn was answering: a recommendation (all products) or one product. Buyer and system turns: null. */
export const turnScope = (t: Turn): Scope | null => (t.role !== "agent" ? null : t.kind === "consult" || t.consult ? "all" : "product");

/** The scope a thread is on now: its latest agent reply after the buyer's first message, else where it started. */
export function threadScope(turns: readonly Turn[], start: Scope): Scope {
  const first = turns.findIndex((t) => t.role === "buyer");
  if (first === -1) return start;
  for (let i = turns.length - 1; i > first; i--) {
    const s = turnScope(turns[i]!);
    if (s) return s;
  }
  return start;
}

export type ThreadItem = { kind: "turn"; turn: Turn } | { kind: "marker"; scope: Scope; key: string };

/**
 * The turns with a marker wherever the thread changed scope: before the buyer message whose reply was on the other
 * scope. A thread that starts on `start` gets no marker for it (the chat shows where it starts on its own).
 */
export function withMarkers(turns: readonly Turn[], start: Scope): ThreadItem[] {
  const out: ThreadItem[] = [];
  let scope = start;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role === "buyer") {
      const reply = turns.slice(i + 1).find((x) => x.role !== "buyer");
      const s = reply ? turnScope(reply) : null;
      if (s && s !== scope) {
        out.push({ kind: "marker", scope: s, key: `marker-${t.id}` });
        scope = s;
      }
    }
    out.push({ kind: "turn", turn: t });
  }
  return out;
}

/** The recommendation the buyer can act on: the latest agent turn, when it is one. */
export function openConsult(turns: readonly Turn[]): ConsultPayload | null {
  const last = [...turns].reverse().find((t) => t.role === "agent");
  return last?.consult ?? null;
}
