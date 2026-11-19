/** Wire types for the Developers page (GET/POST /api/app/developers/*). Times are ISO strings. */

export type KeyEnv = "test" | "live";
export type ApiScope = "deals:read" | "usage:read" | "payments:read" | "products:write" | "deliveries:write";
export type KeyState = "active" | "expiring" | "expired" | "revoked";

export interface ApiKey {
  id: string;
  name: string;
  env: KeyEnv;
  /** Prefix and last 4 characters only, e.g. "psk_live_Ab3x••••••••9fQz". The full key is never returned again. */
  masked: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  /** Set while an old key is inside its overlap window after a regenerate. */
  expiresAt: string | null;
  revokedAt: string | null;
  replacedBy: string | null;
  state: KeyState;
}

export interface DevelopersOverview {
  env: KeyEnv;
  network: "testnet" | "mainnet";
  /** The other network's deployment, where the other environment's keys are managed. */
  peer: { network: "testnet" | "mainnet"; env: KeyEnv; url: string } | null;
  apiBase: string;
  scopes: { id: ApiScope; label: string; description: string }[];
  overlap: { defaultHours: number; maxHours: number };
  keys: ApiKey[];
}

/** Create and regenerate answer with the full key once, in `secret`. */
export interface KeyReveal {
  key: ApiKey;
  secret: string;
  previous?: ApiKey;
}

export interface WebhookDelivery {
  id: string;
  at: string;
  event: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

export interface WebhookSettings {
  url: string | null;
  hasSecret: boolean;
  events: { event: string; title: string }[];
  signature: string;
  deliveries: WebhookDelivery[];
  /** Returned once, when a secret is created or regenerated. */
  secret?: string | null;
}

export interface WebhookTestResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}
