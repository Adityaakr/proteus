/**
 * Typed client for docs/api.md (v0 plus the v1 account routes). Every route in the contract has a function here.
 * Money and units stay strings end to end; JSON is parsed with a guard that quotes any bare
 * integer too large for a JS number so precision is never lost.
 * Mock mode (VITE_MOCK=1, or localStorage "proteus:mock" = "1") routes the same calls to an
 * in-browser mock that returns data shaped exactly like the contract.
 */
import type * as T from "./types";
export type * from "./types";

const BASE = "/api";

export function isMock(): boolean {
  if (import.meta.env.VITE_MOCK === "1" || import.meta.env.VITE_MOCK === "true") return true;
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("proteus:mock") === "1";
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;
  constructor(status: number, message: string, body?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

/** Quote bare integer literals with more than 15 digits that sit outside JSON strings. */
export function parseJsonBigSafe<R = unknown>(text: string): R {
  if (!text) return undefined as R;
  let out = "";
  let i = 0;
  let inStr = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inStr) {
      out += ch;
      if (ch === "\\") {
        out += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inStr = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = i + 1;
      while (j < text.length && /[0-9.eE+-]/.test(text[j]!)) j++;
      const tok = text.slice(i, j);
      out += /^-?\d{16,}$/.test(tok) ? `"${tok}"` : tok;
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return JSON.parse(out) as R;
}

/** JSON.stringify that writes bigints as decimal strings. */
export function stringifyBigSafe(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val));
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Access token source for `Authorization: Bearer`. PrivyAppProvider registers Privy's
 * getAccessToken here; requests that pass their own Authorization header (service API keys) keep it.
 */
type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;
export function setAccessTokenGetter(fn: TokenGetter | null): void {
  tokenGetter = fn;
}
const DEV_USER_HEADER: Record<string, string> = import.meta.env.DEV && import.meta.env.VITE_DEV_USER ? { "x-dev-user": String(import.meta.env.VITE_DEV_USER) } : {};
async function authHeader(): Promise<Record<string, string>> {
  if (!tokenGetter) return { ...DEV_USER_HEADER };
  try {
    const t = await tokenGetter();
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export interface RequestOpts {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<R>(method: Method, path: string, opts: RequestOpts = {}): Promise<R> {
  if (isMock()) {
    const { mockRequest } = await import("./mock");
    return mockRequest<R>(method, path, opts.body === undefined ? undefined : JSON.parse(stringifyBigSafe(opts.body)), opts.headers ?? {});
  }
  const hasAuth = Object.keys(opts.headers ?? {}).some((k) => k.toLowerCase() === "authorization");
  const auth = hasAuth ? {} : await authHeader();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "include",
      signal: opts.signal,
      headers: { Accept: "application/json", ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...auth, ...opts.headers },
      body: opts.body !== undefined ? stringifyBigSafe(opts.body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "Could not reach the PROTEUS API. Check that the server is running.", e, "network");
  }
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = parseJsonBigSafe(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const obj = (data && typeof data === "object" ? data : {}) as { error?: string | { message?: string; code?: string }; message?: string; code?: string };
    const msg = typeof obj.error === "string" ? obj.error : obj.error?.message ?? obj.message ?? `Request failed (${res.status})`;
    const code = typeof obj.error === "object" ? obj.error?.code : obj.code;
    throw new ApiError(res.status, msg, data, code);
  }
  return data as R;
}

const enc = encodeURIComponent;

export const api = {
  /* Public */
  health: () => request<T.Health>("GET", "/health"),
  seller: (sellerSlug: string) => request<T.PublicSeller>("GET", `/public/sellers/${enc(sellerSlug)}`),
  product: (sellerSlug: string, productSlug: string) => request<T.PublicProduct>("GET", `/public/sellers/${enc(sellerSlug)}/products/${enc(productSlug)}`),

  /* Negotiation (buyer) */
  startNegotiation: (body: { sellerSlug: string; productSlug: string; buyerAddress?: string; mandateCap?: T.MicroStr }) =>
    request<T.Negotiation>("POST", "/negotiations", { body }),
  negotiation: (id: string) => request<T.Negotiation>("GET", `/negotiations/${enc(id)}`),
  sendMessage: (id: string, content: string) => request<T.Negotiation>("POST", `/negotiations/${enc(id)}/messages`, { body: { content } }),
  counter: (id: string, body: { candidateId: string; targetTotal?: T.MicroStr; targetUnits?: T.UnitsStr }) =>
    request<T.Negotiation>("POST", `/negotiations/${enc(id)}/counter`, { body }),
  createQuote: (id: string, candidateId: string) => request<T.Quote>("POST", `/negotiations/${enc(id)}/quotes`, { body: { candidateId } }),

  /* Quotes */
  quote: (id: string, buyer?: string) => request<T.Quote>("GET", `/quotes/${enc(id)}${buyer ? `?buyer=${enc(buyer)}` : ""}`),
  acceptQuote: (id: string, body: { buyerAddress: string; buyerSignature: string }) => request<T.Deal>("POST", `/quotes/${enc(id)}/accept`, { body }),
  rotateServiceKey: (dealId: string, body: { address: string; ts: number; signature: string }) => request<T.Deal>("POST", `/deals/${enc(dealId)}/service/rotate-key`, { body }),

  /* Deals (buyer) */
  deal: (id: string) => request<T.Deal>("GET", `/deals/${enc(id)}`),
  fundingIntent: (id: string, body: { txHash?: string } = {}) => request<T.Deal>("POST", `/deals/${enc(id)}/funding-intent`, { body }),
  usage: (id: string) => request<T.UsageResponse>("GET", `/deals/${enc(id)}/usage`),
  acknowledgeUsage: (id: string, body: T.UsageAckBody) => request<T.UsageAckResponse>("POST", `/deals/${enc(id)}/usage-acknowledgments`, { body }),
  requestRefund: (id: string) => request<T.RefundResponse>("POST", `/deals/${enc(id)}/refund-request`, { body: {} }),

  /* Service */
  execute: (productSlug: string, apiKey: string, body: { requestId: string; input: T.ExecuteInput }) =>
    request<T.ExecuteResponse>("POST", `/services/${enc(productSlug)}/execute`, { body, headers: { Authorization: `Bearer ${apiKey}` } }),

  /* Pay per call (x402). A 402 response throws ApiError with status 402 and body PayRequired. */
  payExecute: (sellerSlug: string, productSlug: string, body: T.PayExecuteBody) =>
    request<T.PayExecuteResponse>("POST", `/pay/${enc(sellerSlug)}/${enc(productSlug)}/execute`, { body }),

  /* Account (v1, Bearer auth) */
  me: () => request<T.MeResponse>("GET", "/me"),
  walletLinkNonce: () => request<{ nonce: string; [k: string]: unknown }>("GET", "/me/wallets/nonce"),
  linkWallet: (body: { address: string; kind: "embedded" | "external"; nonce: string; signature: string }) => request<T.MeResponse | { ok: boolean; [k: string]: unknown }>("POST", "/me/wallets/link", { body }),
  meWallet: () => request<T.MeWalletBalance>("GET", "/me/wallet"),
  updateMe: (body: { mode: T.AccountMode }) => request<T.MeResponse>("PATCH", "/me", { body }),
  meNegotiations: () => request<T.NegotiationSummary[]>("GET", "/me/negotiations"),
  meDeals: () => request<T.DealSummary[]>("GET", "/me/deals"),
  meActivity: () => request<T.MeActivity>("GET", "/me/activity"),
  createOrg: (body: { name: string; slug?: string; brand?: T.SellerBrand }) => request<T.MeOrg>("POST", "/orgs", { body }),
  market: () => request<T.MarketItem[]>("GET", "/market"),
  marketSellers: () => request<T.MarketSeller[]>("GET", "/market/sellers"),

  /* Review */
  reviewList: () => request<T.ReviewListItem[]>("GET", "/review"),
  reviewRecord: (publicId: string) => request<T.ReviewRecord>("GET", `/review/${enc(publicId)}`),

  /* Seller console */
  app: {
    sandboxSession: () => request<{ org: T.SellerOrg }>("POST", "/app/session/sandbox", { body: {} }),
    siweSession: (body: { message?: string; nonce: string; signature: string; address?: string }) => request<{ org: T.SellerOrg }>("POST", "/app/session/siwe", { body }),
    overview: () => request<T.SellerOverview>("GET", "/app/overview"),
    products: () => request<T.ProductWithPrivate[]>("GET", "/app/products"),
    product: (id: string) => request<T.ProductWithPrivate>("GET", `/app/products/${enc(id)}`),
    updatePolicy: (id: string, body: T.PolicyUpdate) => request<T.ProductWithPrivate>("PATCH", `/app/products/${enc(id)}/policy`, { body }),
    updateCost: (id: string, body: T.CostUpdate) => request<T.ProductWithPrivate>("PATCH", `/app/products/${enc(id)}/cost`, { body }),
    preview: (id: string, body: { desiredUnits?: T.UnitsStr; budget?: T.MicroStr }) =>
      request<{ candidates: T.CandidateWithEconomics[] }>("POST", `/app/products/${enc(id)}/preview`, { body }),
    negotiations: () => request<T.NegotiationSummary[]>("GET", "/app/negotiations"),
    negotiation: (id: string) => request<T.SellerNegotiation>("GET", `/app/negotiations/${enc(id)}`),
    approvals: () => request<T.Approval[]>("GET", "/app/approvals"),
    decideApproval: (id: string, body: T.ApprovalDecision) => request<T.Approval>("POST", `/app/approvals/${enc(id)}/decision`, { body }),
    deals: () => request<T.DealSummary[]>("GET", "/app/deals"),
    deal: (id: string) => request<T.SellerDeal>("GET", `/app/deals/${enc(id)}`),
    closeTerm: (id: string) => request<{ txHash: T.Hex }>("POST", `/app/deals/${enc(id)}/close-term`, { body: {} }),
    finance: () => request<T.SellerFinance>("GET", "/app/finance"),
    signer: () => request<T.SignerInfo>("GET", "/app/signer"),
    revokeSigner: () => request<{ revokedAt: T.IsoTime; note?: string; [k: string]: unknown }>("POST", "/app/signer/revoke", { body: {} }),
    createProduct: (body: T.ProductCreateBody) => request<T.ProductWithPrivate>("POST", "/app/products", { body }),
    setListing: (id: string, active: boolean) => request<T.ProductWithPrivate>("PATCH", `/app/products/${enc(id)}/listing`, { body: { active } }),
    deleteProduct: (id: string) => request<{ deleted: string }>("DELETE", `/app/products/${enc(id)}`),
    dashboard: () => request<import("../seller/console").Dashboard>("GET", "/app/dashboard"),
    customers: () => request<import("../seller/console").Customer[]>("GET", "/app/customers"),
    usage: () => request<import("../seller/console").Usage>("GET", "/app/usage"),
    insights: () => request<import("../seller/console").Insights>("GET", "/app/insights"),
    updateOrg: (body: { name?: string; brand?: Partial<T.SellerBrand> }) => request<{ slug: string; name: string; label: T.SellerLabel; brand: T.SellerBrand }>("PATCH", "/app/org", { body }),
  },
};

/** Client generated request id for idempotent service calls (min 8 chars per the contract). */
export function newRequestId(prefix = "req"): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rnd}`;
}

/** True for 401/403 from the API (the account routes before the server verifies Privy tokens). */
export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

/** Query keys shared by buyer and seller pages. */
export const qk = {
  health: ["health"] as const,
  seller: (s: string) => ["seller", s] as const,
  product: (s: string, p: string) => ["product", s, p] as const,
  negotiation: (id: string) => ["negotiation", id] as const,
  quote: (id: string) => ["quote", id] as const,
  deal: (id: string) => ["deal", id] as const,
  usage: (id: string) => ["usage", id] as const,
  review: ["review"] as const,
  me: ["me"] as const,
  meWallet: ["me", "wallet"] as const,
  meNegotiations: ["me", "negotiations"] as const,
  meDeals: ["me", "deals"] as const,
  meActivity: ["me", "activity"] as const,
  market: ["market"] as const,
  marketSellers: ["market", "sellers"] as const,
  balances: (address: string) => ["balances", address.toLowerCase()] as const,
  record: (id: string) => ["record", id] as const,
};
