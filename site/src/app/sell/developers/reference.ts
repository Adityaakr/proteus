/**
 * The seller API reference, quickstart snippets, and which cards live on Developers versus Seller settings.
 * Plain data with no imports, so the pages render from it and tests check it (the server test checks the route table
 * against SELLER_API_REFERENCE so the docs never drift from the routes).
 */

export type ScopeId = "deals:read" | "usage:read" | "payments:read" | "products:write" | "deliveries:write";

export interface ApiRoute {
  method: "GET" | "POST" | "PATCH";
  path: string;
  /** null: any valid key. */
  scope: ScopeId | null;
  summary: string;
}

/** Paths are relative to /api. Keep in sync with SELLER_API in server/src/routes/developers.ts (a server test checks). */
export const SELLER_API_REFERENCE: ApiRoute[] = [
  { method: "GET", path: "/v1/seller/me", scope: null, summary: "The key's seller, name, environment and permissions" },
  { method: "GET", path: "/v1/seller/products", scope: null, summary: "Your products with public tiers, endpoint and docs links" },
  { method: "PATCH", path: "/v1/seller/products/:id/tiers", scope: "products:write", summary: "Replace a product's public price tiers" },
  { method: "PATCH", path: "/v1/seller/products/:id/listing", scope: "products:write", summary: "List or unlist a product in the market" },
  { method: "GET", path: "/v1/seller/deals", scope: "deals:read", summary: "Your deals, newest first, with balances" },
  { method: "GET", path: "/v1/seller/deals/:id", scope: "deals:read", summary: "One deal: terms, balances, usage and transactions" },
  { method: "POST", path: "/v1/seller/deals/:id/deliveries", scope: "deliveries:write", summary: "Record delivered units with proof (a signed receipt)" },
  { method: "POST", path: "/v1/seller/deals/:id/order-updates", scope: "deliveries:write", summary: "Post an order status update the buyer sees" },
  { method: "GET", path: "/v1/seller/usage", scope: "usage:read", summary: "Metered requests and delivery totals" },
  { method: "GET", path: "/v1/seller/payments", scope: "payments:read", summary: "Funded, settled, refunded and held totals" },
];

/** Section ids, in page order. Seller settings keeps brand, payout and alerts; the technical cards moved to Developers. */
export const DEVELOPERS_SECTIONS = [
  { id: "keys", label: "API keys" },
  { id: "webhooks", label: "Webhooks" },
  { id: "endpoints", label: "Products & endpoints" },
  { id: "catalog-sync", label: "Catalog sync" },
  { id: "embed", label: "Website embed" },
  { id: "signer", label: "Signer & identity" },
  { id: "quickstart", label: "Quickstart & reference" },
] as const;

export const SETTINGS_SECTIONS = ["moved-to-developers", "payout", "alerts", "whatsapp", "brand", "org"] as const;

/** What moved from Seller settings to Developers, for the "Moved to Developers" pointer. */
export const MOVED_TO_DEVELOPERS = [
  { label: "Website embed code", anchor: "embed" },
  { label: "Webhook and signing secret", anchor: "webhooks" },
  { label: "Seller signer key", anchor: "signer" },
  { label: "Agent identity on Arc", anchor: "signer" },
] as const;

export const DEVELOPERS_PATH = "/app/sell/developers";

/**
 * The public seller API sandbox: a demo seller with fixed demo data on the Arc testnet deployment. Its key is published
 * on purpose: reads return demo records and writes are dry runs that store nothing. Keep in sync with
 * server/src/services/sandbox.ts (a server test checks).
 */
export const SANDBOX = {
  key: "psk_sandbox_demo_seller_testnet_read_only",
  path: "/api/v1/sandbox/seller",
  baseUrl: "https://ai.proteus.co.in/api/v1/sandbox/seller",
  readScopes: ["deals:read", "usage:read", "payments:read"],
  ids: { product: "prd_sandbox_tees", deal: "deal_sandbox_active", settledDeal: "deal_sandbox_settled", closedDeal: "deal_sandbox_closed" },
} as const;

/** This deployment's origin in the browser (empty when rendered outside one). */
export const currentOrigin = () => (typeof window !== "undefined" ? window.location.origin : "");

export type SnippetLang = "bash" | "ts";

/* ---------------------------------------------------------------- example builders */

const KEY_VAR = "PROTEUS_SELLER_KEY";
const AUTH = `-H "Authorization: Bearer $${KEY_VAR}"`;

/** A JSON value as a TypeScript object literal: identifier keys unquoted, indented by `pad`. */
export function tsLiteral(value: unknown, pad = ""): string {
  return JSON.stringify(value, null, 2)
    .replace(/"([A-Za-z_$][\w$]*)":/g, "$1:")
    .split("\n")
    .map((line, i) => (i ? pad + line : line))
    .join("\n");
}

/** A request as curl. GETs stay on one line plus the key; bodies are pretty JSON so no line runs off the block. */
export function curlOf(method: string, url: string, body?: unknown): string {
  if (method === "GET" || body === undefined) return `curl ${url} \\\n  ${AUTH}`;
  const json = JSON.stringify(body, null, 2).split("\n").map((l, i) => (i ? "  " + l : l)).join("\n");
  return `curl -X ${method} ${url} \\\n  ${AUTH} \\\n  -H "Content-Type: application/json" \\\n  -d '${json}'`;
}

/** The same request with fetch. Assumes `base` and `headers` from quickstart step 1; `result` names the parsed JSON. */
export function fetchOf(method: string, path: string, result: string, body?: unknown): string {
  if (method === "GET" || body === undefined) return `const ${result} = await fetch(\`\${base}${path}\`, { headers })\n  .then((r) => r.json());`;
  return `const ${result} = await fetch(\`\${base}${path}\`, {\n  method: "${method}",\n  headers: { ...headers, "Content-Type": "application/json" },\n  body: JSON.stringify(${tsLiteral(body, "  ")}),\n}).then((r) => r.json());`;
}

/** Example bodies for the write endpoints. Each one passes the API's own checks (a server test runs them). */
export const EXAMPLE_BODIES = {
  tiers: { tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }, { name: "Bulk", includedUnits: "100", unitPriceUsd: "6.50" }] },
  listing: { active: false },
  delivery: { requestId: "order-1042-shipped", units: 1, note: "Shipped by courier", proofUrl: "https://track.example/1042" },
  orderUpdate: { status: "shipped", note: "Two boxes by courier", trackingUrl: "https://track.example/1042" },
} as const;

/** Quickstart steps for the seller API, as curl and TypeScript. `base` is the API base URL, e.g. https://host/api/v1/seller. */
export function quickstartSnippets(base: string, env: "test" | "live") {
  return [
    {
      id: "verify",
      title: "1. Check the key",
      route: "GET /v1/seller/me",
      body: "Send the key as a bearer token. The answer names the key, its environment and its permissions.",
      bash: `export ${KEY_VAR}=psk_${env}_…\n\ncurl ${base}/me \\\n  ${AUTH}`,
      ts: `const base = "${base}";\nconst headers = { Authorization: \`Bearer \${process.env.${KEY_VAR}}\` };\n\nconst me = await fetch(\`\${base}/me\`, { headers }).then((r) => r.json());\nconsole.log(me.key.scopes); // ["deals:read", …]`,
    },
    {
      id: "deals",
      title: "2. Read your deals",
      route: "GET /v1/seller/deals",
      body: "Needs `deals:read`. Amounts are micro-USDC strings: `6600000` is $6.60.",
      bash: curlOf("GET", `${base}/deals`),
      ts: `const { deals } = await fetch(\`\${base}/deals\`, { headers }).then((r) => r.json());\nfor (const d of deals) console.log(d.publicId, d.status, d.settled, d.remaining);`,
    },
    {
      id: "deliver",
      title: "3. Report a delivery",
      route: "POST /v1/seller/deals/:id/deliveries",
      body: "Needs `deliveries:write`. Records delivered units as a signed receipt the buyer then countersigns. The same `requestId` never records twice, so retries are safe.",
      bash: curlOf("POST", `${base}/deals/DEAL_ID/deliveries`, EXAMPLE_BODIES.delivery),
      ts: fetchOf("POST", "/deals/${dealId}/deliveries", "receipt", EXAMPLE_BODIES.delivery),
    },
    {
      id: "prices",
      title: "4. Update prices",
      route: "PATCH /v1/seller/products/:id/tiers",
      body: "Needs `products:write`. Replaces the public tiers buyers see; deals already signed keep their prices.",
      bash: curlOf("PATCH", `${base}/products/PRODUCT_ID/tiers`, EXAMPLE_BODIES.tiers),
      ts: fetchOf("PATCH", "/products/${productId}/tiers", "product", EXAMPLE_BODIES.tiers),
    },
  ];
}

/** Verifying X-Proteus-Signature on a webhook receiver (Node). */
export const WEBHOOK_VERIFY_TS = `import { createHmac, timingSafeEqual } from "node:crypto";

// header: the X-Proteus-Signature value, "t=<unix>,v1=<hex>"; rawBody: the request body exactly as received.
export function verifyProteus(header: string, rawBody: string, secret: string, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return parts.v1?.length === expected.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}`;

export const ERRORS_REFERENCE = [
  { status: "401", meaning: "Missing, unknown, revoked or expired key, or a key from the other environment (test keys only work on testnet, live keys only on mainnet)." },
  { status: "403", meaning: "The key lacks the permission this endpoint needs. The body names it in details.required." },
  { status: "404", meaning: "The deal or product is not yours, or does not exist." },
  { status: "400 / 409", meaning: "The request was refused; the error field says why in plain words." },
];

/* ---------------------------------------------------------------- public docs (/docs/seller-api and friends) */

/** The public docs pages for the seller API, linked from the Developers page. */
export const SELLER_API_DOCS = { guide: "/docs/seller-api", reference: "/docs/seller-api-reference", webhooks: "/docs/seller-webhooks" } as const;

/** Key permissions as the dashboard shows them. Keep in sync with SCOPE_INFO in server/src/services/api-keys.ts (a server test checks). */
export const SCOPES_REFERENCE: { id: ScopeId; label: string; description: string }[] = [
  { id: "deals:read", label: "Read deals", description: "List deals and read one deal's terms, balances and status." },
  { id: "usage:read", label: "Read usage", description: "Metered requests, delivered units and receipts." },
  { id: "payments:read", label: "Read payments", description: "Funded, settled, refunded and held totals." },
  { id: "products:write", label: "Write products and prices", description: "Change public price tiers and list or unlist a product." },
  { id: "deliveries:write", label: "Write delivery reports", description: "Record delivered units with proof and post order updates." },
];

/** Key rules. Keep in sync with server/src/services/api-keys.ts (a server test checks the overlap hours). */
export const KEY_RULES = { overlapDefaultHours: 24, overlapMaxHours: 72, maxWorkingKeys: 20, nameMaxChars: 60 } as const;

/**
 * Webhook events and the fields in each event's `data`. Keep in sync with WEBHOOK_EVENTS in server/src/services/notify.ts
 * (a server test checks the events and titles); the fields come from where each event is queued.
 */
export const WEBHOOK_EVENTS_REFERENCE: { event: string; title: string; data: string }[] = [
  { event: "deal_funded", title: "A buyer funded a deal", data: "deal, amountUsdc (the deposit), txHash, explorer, link" },
  { event: "usage_settled", title: "Delivered usage was settled to you", data: "deal, amountUsdc (paid to you), txHash, explorer, link" },
  { event: "refund_issued", title: "Unused balance was refunded to a buyer", data: "deal, amountUsdc (refunded), txHash, explorer, link" },
  { event: "dispute_opened", title: "A buyer opened a dispute", data: "deal, txHash, explorer, link" },
  { event: "dispute_resolved", title: "A dispute was resolved", data: "deal, toSellerUsdc, toBuyerUsdc, txHash, explorer, link" },
  { event: "approval_required", title: "An offer needs your approval", data: "product, tier, units, amountUsdc, link" },
  { event: "order_details", title: "A buyer sent order details", data: "deal, product, link" },
  { event: "whatsapp_human", title: "A WhatsApp buyer asked for a person", data: "channel, link" },
];

export interface ApiParam {
  name: string;
  in: "path" | "body";
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointExample {
  method: ApiRoute["method"];
  path: string;
  /** A short name, as a heading: "Record a delivery". */
  title: string;
  /** One or two sentences: what it does and anything to know before calling it. */
  description: string;
  /** The HTTP status of a successful call. */
  status: 200 | 201;
  params: ApiParam[];
  /** The example body (also the try-it default), or null when the endpoint takes none. */
  example: Record<string, unknown> | null;
  /** Statuses this endpoint can answer besides success, and when. */
  errors: { status: string; when: string }[];
  bash: string;
  ts: string;
  /** A trimmed sample response. */
  response: string;
}

const ID_PRODUCT: ApiParam = { name: "id", in: "path", type: "string", required: true, description: "The product's `id` (`prd_…`) from `GET /products`, not its slug." };
const ID_DEAL: ApiParam = { name: "id", in: "path", type: "string", required: true, description: "The deal's `id` (`deal_…`) from `GET /deals`, not its public id (`d_…`)." };
const E401 = { status: "401", when: "The key is missing, unknown, revoked, expired or from the other environment." };
const e403 = (scope: ScopeId) => ({ status: "403", when: `The key lacks \`${scope}\`.` });

/**
 * Every seller API route with its parameters, errors, a curl and a TypeScript example and a sample response. The
 * TypeScript assumes `base` and `headers` from quickstart step 1. `base` is the API base URL, e.g.
 * https://host/api/v1/seller. Parameters and errors follow server/src/services/seller-api-rules.ts.
 */
export function endpointExamples(base: string): EndpointExample[] {
  const get = (path: string, result: string) => ({ bash: curlOf("GET", `${base}${path}`), ts: fetchOf("GET", path, result) });
  const write = (method: string, curlPath: string, tsPath: string, result: string, body: Record<string, unknown>) => ({ bash: curlOf(method, `${base}${curlPath}`, body), ts: fetchOf(method, tsPath, result, body) });
  return [
    {
      method: "GET", path: "/v1/seller/me", title: "Retrieve the key", status: 200, example: null, params: [],
      description: "The seller this key belongs to, with the key's name, environment and permissions. Works with any valid key: use it to check a key before anything else.",
      errors: [E401],
      ...get("/me", "me"),
      response: `{\n  "orgId": "org_…",\n  "key": {\n    "id": "key_…",\n    "name": "Order sync",\n    "env": "test",\n    "scopes": ["deals:read", "deliveries:write"]\n  },\n  "network": "testnet"\n}`,
    },
    {
      method: "GET", path: "/v1/seller/products", title: "List products", status: 200, example: null, params: [],
      description: "Your products, newest first, with the public price tiers buyers see, the service endpoint and the product's docs page. Works with any valid key.",
      errors: [E401],
      ...get("/products", "{ products }"),
      response: `{\n  "products": [{\n    "id": "prd_…",\n    "slug": "custom-tees",\n    "name": "Custom oversized tees",\n    "active": true,\n    "unitLabel": "tee",\n    "tiers": [{\n      "id": "starter",\n      "name": "Starter",\n      "includedUnits": "1",\n      "unitPriceUsd": "$6.60",\n      "prepaidTotalUsd": "$6.60",\n      "includes": []\n    }],\n    "payPerCallUsd": null,\n    "endpoint": "https://…/api/services/custom-tees/execute",\n    "docsUrl": "https://…/docs/your-store/custom-tees"\n  }]\n}`,
    },
    {
      method: "PATCH", path: "/v1/seller/products/:id/tiers", title: "Replace price tiers", status: 200, example: { ...EXAMPLE_BODIES.tiers },
      description: "Replaces every public price tier of a product and returns the product. New quotes use the new prices; deals already signed keep theirs.",
      params: [
        ID_PRODUCT,
        { name: "tiers", in: "body", type: "array", required: true, description: "1 to 6 tiers. They are sorted by `includedUnits`." },
        { name: "tiers[].name", in: "body", type: "string", required: true, description: "Shown to buyers; up to 40 characters are kept." },
        { name: "tiers[].includedUnits", in: "body", type: "string", required: true, description: "A whole number from 1, at most the product's units per deal. Each tier needs its own quantity." },
        { name: "tiers[].unitPriceUsd", in: "body", type: "string", required: true, description: "Dollars per unit, more than 0, up to 6 decimals: `\"6.60\"`." },
        { name: "tiers[].includes", in: "body", type: "string[]", required: false, description: "Up to 8 short lines (60 characters each) listing what the tier includes." },
      ],
      errors: [{ status: "400", when: "A tier breaks a rule above; the message names the tier and the rule." }, E401, e403("products:write"), { status: "404", when: "No product with this id belongs to your seller." }],
      ...write("PATCH", "/products/PRODUCT_ID/tiers", "/products/${productId}/tiers", "product", EXAMPLE_BODIES.tiers),
      response: `{\n  "id": "prd_…",\n  "slug": "custom-tees",\n  "active": true,\n  "tiers": [\n    { "name": "Starter", "unitPriceUsd": "$6.60", … },\n    { "name": "Bulk", "unitPriceUsd": "$6.50", … }\n  ],\n  …\n}`,
    },
    {
      method: "PATCH", path: "/v1/seller/products/:id/listing", title: "List or unlist a product", status: 200, example: { ...EXAMPLE_BODIES.listing },
      description: "Shows a product in the market or hides it, and returns the product. Hidden products keep their existing deals and keys working.",
      params: [ID_PRODUCT, { name: "active", in: "body", type: "boolean", required: true, description: "`true` lists the product, `false` hides it." }],
      errors: [{ status: "400", when: "`active` is not `true` or `false`." }, E401, e403("products:write"), { status: "404", when: "No product with this id belongs to your seller." }],
      ...write("PATCH", "/products/PRODUCT_ID/listing", "/products/${productId}/listing", "product", EXAMPLE_BODIES.listing),
      response: `{ "id": "prd_…", "slug": "custom-tees", "active": false, … }`,
    },
    {
      method: "GET", path: "/v1/seller/deals", title: "List deals", status: 200, example: null, params: [],
      description: "Your newest 200 deals with their balances in micro-USDC. `status` is what the console shows (`settled` once the whole deposit is paid out); `chainStatus` is the escrow contract's.",
      errors: [E401, e403("deals:read")],
      ...get("/deals", "{ deals }"),
      response: `{\n  "deals": [{\n    "id": "deal_…",\n    "publicId": "d_…",\n    "status": "active",\n    "chainStatus": "active",\n    "buyerAddress": "0x…",\n    "deposit": "6600000",\n    "settled": "0",\n    "refunded": "0",\n    "remaining": "6600000",\n    "balancesSource": "chain",\n    "fundingTxHash": "0x…",\n    "createdAt": "2026-11-20T10:00:00.000Z"\n  }]\n}`,
    },
    {
      method: "GET", path: "/v1/seller/deals/:id", title: "Retrieve a deal", status: 200, example: null, params: [ID_DEAL],
      description: "One deal: its signed terms and hash, balances, funding transaction, usage so far and every transaction on Arc.",
      errors: [E401, e403("deals:read"), { status: "404", when: "No deal with this id belongs to your seller." }],
      ...get("/deals/DEAL_ID", "deal"),
      response: `{\n  "id": "deal_…",\n  "publicId": "d_…",\n  "status": "active",\n  "chainStatus": "active",\n  "terms": { … },\n  "termsHash": "0x…",\n  "buyerAddress": "0x…",\n  "sellerPayee": "0x…",\n  "funding": {\n    "txHash": "0x…",\n    "status": "confirmed",\n    "explorerUrl": "https://…"\n  },\n  "balances": {\n    "deposit": "6600000",\n    "settled": "0",\n    "refunded": "0",\n    "remaining": "6600000",\n    "source": "chain"\n  },\n  …\n}`,
    },
    {
      method: "POST", path: "/v1/seller/deals/:id/deliveries", title: "Record a delivery", status: 201, example: { ...EXAMPLE_BODIES.delivery },
      description: "Records delivered units with proof as a receipt signed by your seller signer. The buyer countersigns the running total, and only then does the escrow pay. Sending the same `requestId` again returns the first receipt instead of recording twice.",
      params: [
        ID_DEAL,
        { name: "requestId", in: "body", type: "string", required: true, description: "Your idempotency key: 4 to 80 letters, digits, `.`, `_`, `:` or `-`." },
        { name: "units", in: "body", type: "integer", required: true, description: "Units delivered in this batch, 1 to 1,000,000. The running total must fit the agreement and the prepaid balance." },
        { name: "note", in: "body", type: "string", required: true, description: "What was delivered, 3 to 2000 characters. The buyer sees it on the receipt." },
        { name: "proofUrl", in: "body", type: "string", required: false, description: "An https link to proof: tracking page, signed delivery note or shared folder." },
      ],
      errors: [{ status: "400", when: "A field breaks a rule above." }, E401, e403("deliveries:write"), { status: "404", when: "No deal with this id belongs to your seller." }, { status: "409", when: "The deal is not funded or active, or the units would exceed the agreement or the prepaid balance." }],
      ...write("POST", "/deals/DEAL_ID/deliveries", "/deals/${dealId}/deliveries", "receipt", EXAMPLE_BODIES.delivery),
      response: `{\n  "requestId": "order-1042-shipped",\n  "status": "delivered",\n  "billable": true,\n  "units": 1,\n  "receipt": {\n    "digest": "0x…",\n    "sellerSignature": "0x…",\n    "at": "2026-11-20T10:00:00.000Z"\n  },\n  "deal": {\n    "cumulativeUnits": "1",\n    "cumulativeCharged": "6600000",\n    "remaining": "0"\n  },\n  …\n}`,
    },
    {
      method: "POST", path: "/v1/seller/deals/:id/order-updates", title: "Post an order update", status: 201, example: { ...EXAMPLE_BODIES.orderUpdate },
      description: "Posts a status to the buyer's order page and alerts the buyer on the channels they chose. For goods and other work you deliver yourself.",
      params: [
        ID_DEAL,
        { name: "status", in: "body", type: "string", required: true, description: "One of `accepted`, `in_production`, `shipped`, `out_for_delivery`, `delayed` or `note`." },
        { name: "note", in: "body", type: "string", required: false, description: "Up to 1000 characters. Required for `delayed` (why, and the new date) and for `note`." },
        { name: "trackingUrl", in: "body", type: "string", required: false, description: "An https tracking link." },
      ],
      errors: [{ status: "400", when: "Unknown status, a missing note, or a tracking link that is not https." }, E401, e403("deliveries:write"), { status: "404", when: "No deal with this id belongs to your seller." }, { status: "409", when: "The deal is not funded or active." }],
      ...write("POST", "/deals/DEAL_ID/order-updates", "/deals/${dealId}/order-updates", "update", EXAMPLE_BODIES.orderUpdate),
      response: `{ "id": "du_…", "status": "shipped", "label": "Shipped" }`,
    },
    {
      method: "GET", path: "/v1/seller/usage", title: "List usage", status: 200, example: null, params: [],
      description: "Totals and your newest 300 metered requests and delivery reports, each with its deal, units, running charge and whether its receipt is signed.",
      errors: [E401, e403("usage:read")],
      ...get("/usage", "{ totals, requests }"),
      response: `{\n  "totals": {\n    "requests": 12,\n    "delivered": 11,\n    "handoff": 0,\n    "failed": 1,\n    "billableUnits": 11,\n    "avgLatencyMs": 840\n  },\n  "requests": [{\n    "requestId": "order-1042-shipped",\n    "dealId": "deal_…",\n    "dealPublicId": "d_…",\n    "productName": "Custom oversized tees",\n    "status": "delivered",\n    "billable": true,\n    "units": 1,\n    "cumulativeCharged": "6600000",\n    "signed": true,\n    "at": "2026-11-20T10:00:00.000Z",\n    …\n  }]\n}`,
    },
    {
      method: "GET", path: "/v1/seller/payments", title: "Retrieve payments", status: 200, example: null, params: [],
      description: "Money across all your deals, in micro-USDC: funded, settled to you, delivered but not yet settled, still held for buyers, and refunded.",
      errors: [E401, e403("payments:read")],
      ...get("/payments", "payments"),
      response: `{\n  "funded": "13200000",\n  "settled": "6600000",\n  "earnedUnsettled": "0",\n  "liability": "6600000",\n  "refunded": "0",\n  "reconciliation": {\n    "lastRunAt": "2026-11-20T10:00:00.000Z",\n    "discrepancies": []\n  },\n  "labels": {\n    "network": "testnet",\n    "note": "Deposits are customer liabilities until …"\n  }\n}`,
    },
  ];
}
