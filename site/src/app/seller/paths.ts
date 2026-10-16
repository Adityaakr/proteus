/** Base path of the sell side of the dashboard. Every internal seller link is built from this. */
export const SELL = "/app/sell";
export const sellPath = (...parts: string[]) => [SELL, ...parts.map((p) => encodeURIComponent(p))].join("/");
