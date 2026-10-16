/**
 * Typed client for docs/api.md (v0). Every route in the contract has a function here.
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

type Method = "GET" | "POST" | "PATCH";

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
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "include",
      signal: opts.signal,
      headers: { Accept: "application/json", ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...opts.headers },
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

  /* Deals (buyer) */
  deal: (id: string) => request<T.Deal>("GET", `/deals/${enc(id)}`),
  fundingIntent: (id: string, body: { txHash?: string } = {}) => request<T.Deal>("POST", `/deals/${enc(id)}/funding-intent`, { body }),
  usage: (id: string) => request<T.UsageResponse>("GET", `/deals/${enc(id)}/usage`),
  acknowledgeUsage: (id: string, body: T.UsageAckBody) => request<T.UsageAckResponse>("POST", `/deals/${enc(id)}/usage-acknowledgments`, { body }),
  requestRefund: (id: string) => request<T.RefundResponse>("POST", `/deals/${enc(id)}/refund-request`, { body: {} }),

  /* Service */
  execute: (productSlug: string, apiKey: string, body: { requestId: string; input: T.ExecuteInput }) =>
    request<T.ExecuteResponse>("POST", `/services/${enc(productSlug)}/execute`, { body, headers: { Authorization: `Bearer ${apiKey}` } }),

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
  },
};

/** Client generated request id for idempotent service calls (min 8 chars per the contract). */
export function newRequestId(prefix = "req"): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rnd}`;
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
  record: (id: string) => ["record", id] as const,
};
