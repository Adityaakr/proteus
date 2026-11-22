/** One finished part of a chat that moved across products: the product it was about and what was said. */
export interface ConversationPart<T> {
  product: string;
  turns: T[];
}

/**
 * Moves a chat from its current negotiation to a new one. The negotiation it leaves joins the history only once the
 * new one exists, so a failed start leaves the chat as it was and a retry does not repeat the history.
 */
export async function switchNegotiation<N, T>(
  from: N | null,
  history: readonly ConversationPart<T>[],
  start: () => Promise<N>,
  part: (n: N) => ConversationPart<T>,
): Promise<{ next: N; history: ConversationPart<T>[] }> {
  const next = await start();
  return { next, history: from ? [...history, part(from)] : [...history] };
}
