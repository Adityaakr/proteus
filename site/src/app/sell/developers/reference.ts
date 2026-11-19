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

/** Quickstart steps for the seller API, as curl and TypeScript. `base` is the API base URL, e.g. https://host/api/v1/seller. */
export function quickstartSnippets(base: string, env: "test" | "live") {
  const keyVar = "PROTEUS_SELLER_KEY";
  const sample = `psk_${env}_…`;
  return [
    {
      id: "verify",
      title: "1. Check the key",
      body: "Every request sends the key as a bearer token. This answers with the key's name, environment and permissions.",
      bash: `export ${keyVar}=${sample}\n\ncurl ${base}/me \\\n  -H "Authorization: Bearer $${keyVar}"`,
      ts: `const base = "${base}";\nconst headers = { Authorization: \`Bearer \${process.env.${keyVar}}\` };\n\nconst me = await fetch(\`\${base}/me\`, { headers }).then((r) => r.json());\nconsole.log(me.key.scopes); // ["deals:read", ...]`,
    },
    {
      id: "deals",
      title: "2. Read your deals",
      body: "Needs deals:read. Amounts are micro-USDC strings: 6600000 is $6.60.",
      bash: `curl ${base}/deals \\\n  -H "Authorization: Bearer $${keyVar}"`,
      ts: `const { deals } = await fetch(\`\${base}/deals\`, { headers }).then((r) => r.json());\nfor (const d of deals) console.log(d.publicId, d.status, d.settled, d.remaining);`,
    },
    {
      id: "deliver",
      title: "3. Report a delivery",
      body: "Needs deliveries:write. Records delivered units with proof as a signed receipt the buyer then accepts; requestId makes retries safe.",
      bash: `curl -X POST ${base}/deals/DEAL_ID/deliveries \\\n  -H "Authorization: Bearer $${keyVar}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"requestId":"order-1042-shipped","units":1,"note":"Shipped by courier","proofUrl":"https://track.example/1042"}'`,
      ts: `await fetch(\`\${base}/deals/\${dealId}/deliveries\`, {\n  method: "POST",\n  headers: { ...headers, "Content-Type": "application/json" },\n  body: JSON.stringify({ requestId: "order-1042-shipped", units: 1, note: "Shipped by courier", proofUrl: "https://track.example/1042" }),\n});`,
    },
    {
      id: "prices",
      title: "4. Update prices",
      body: "Needs products:write. Replaces the public tiers buyers see; deals already signed keep their prices.",
      bash: `curl -X PATCH ${base}/products/PRODUCT_ID/tiers \\\n  -H "Authorization: Bearer $${keyVar}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"tiers":[{"name":"Starter","includedUnits":"1","unitPriceUsd":"6.60"},{"name":"Bulk","includedUnits":"100","unitPriceUsd":"6.50"}]}'`,
      ts: `await fetch(\`\${base}/products/\${productId}/tiers\`, {\n  method: "PATCH",\n  headers: { ...headers, "Content-Type": "application/json" },\n  body: JSON.stringify({ tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }] }),\n});`,
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

export interface EndpointExample {
  method: ApiRoute["method"];
  path: string;
  /** What to send, in plain words, or null when there is no body. */
  body: string | null;
  bash: string;
  ts: string;
  /** A trimmed sample response. */
  response: string;
}

/**
 * One curl and one TypeScript example per seller API route, with a sample response. The TypeScript assumes `base` and
 * `headers` from quickstart step 1. `base` is the API base URL, e.g. https://host/api/v1/seller.
 */
export function endpointExamples(base: string): EndpointExample[] {
  const auth = `-H "Authorization: Bearer $PROTEUS_SELLER_KEY"`;
  const json = `-H "Content-Type: application/json"`;
  const post = (method: string, path: string, body: string) => `curl -X ${method} ${base}${path} \\\n  ${auth} \\\n  ${json} \\\n  -d '${body}'`;
  const write = (method: string, path: string, body: string) => `await fetch(\`\${base}${path}\`, {\n  method: "${method}",\n  headers: { ...headers, "Content-Type": "application/json" },\n  body: JSON.stringify(${body}),\n}).then((r) => r.json());`;
  return [
    {
      method: "GET", path: "/v1/seller/me", body: null,
      bash: `curl ${base}/me \\\n  ${auth}`,
      ts: `const me = await fetch(\`\${base}/me\`, { headers }).then((r) => r.json());`,
      response: `{\n  "orgId": "org_…",\n  "key": { "id": "key_…", "name": "Order sync", "env": "test", "scopes": ["deals:read", "deliveries:write"] },\n  "network": "testnet"\n}`,
    },
    {
      method: "GET", path: "/v1/seller/products", body: null,
      bash: `curl ${base}/products \\\n  ${auth}`,
      ts: `const { products } = await fetch(\`\${base}/products\`, { headers }).then((r) => r.json());`,
      response: `{\n  "products": [{\n    "id": "prd_…", "slug": "custom-tees", "name": "Custom oversized tees", "active": true, "unitLabel": "tee",\n    "tiers": [{ "id": "starter", "name": "Starter", "includedUnits": "1", "unitPriceUsd": "$6.60", "prepaidTotalUsd": "$6.60", "includes": [] }],\n    "payPerCallUsd": null,\n    "endpoint": "https://…/api/services/custom-tees/execute",\n    "docsUrl": "https://…/docs/your-store/custom-tees"\n  }]\n}`,
    },
    {
      method: "PATCH", path: "/v1/seller/products/:id/tiers", body: "tiers: 1 to 6 of { name, includedUnits (whole number, each tier its own, at most the product's units per deal), unitPriceUsd (dollars as a string, up to 6 decimals, more than 0), includes? (up to 8 short strings) }. Replaces every tier.",
      bash: post("PATCH", "/products/PRODUCT_ID/tiers", `{"tiers":[{"name":"Starter","includedUnits":"1","unitPriceUsd":"6.60"},{"name":"Bulk","includedUnits":"100","unitPriceUsd":"6.50"}]}`),
      ts: write("PATCH", "/products/${productId}/tiers", `{ tiers: [{ name: "Starter", includedUnits: "1", unitPriceUsd: "6.60" }, { name: "Bulk", includedUnits: "100", unitPriceUsd: "6.50" }] }`),
      response: `{ "id": "prd_…", "slug": "custom-tees", "active": true, "tiers": [{ "name": "Starter", "includedUnits": "1", "unitPriceUsd": "$6.60", … }, { "name": "Bulk", "includedUnits": "100", "unitPriceUsd": "$6.50", … }], … }`,
    },
    {
      method: "PATCH", path: "/v1/seller/products/:id/listing", body: "active: true to list the product in the market, false to hide it. Existing deals keep working.",
      bash: post("PATCH", "/products/PRODUCT_ID/listing", `{"active":false}`),
      ts: write("PATCH", "/products/${productId}/listing", `{ active: false }`),
      response: `{ "id": "prd_…", "slug": "custom-tees", "active": false, … }`,
    },
    {
      method: "GET", path: "/v1/seller/deals", body: null,
      bash: `curl ${base}/deals \\\n  ${auth}`,
      ts: `const { deals } = await fetch(\`\${base}/deals\`, { headers }).then((r) => r.json());`,
      response: `{\n  "deals": [{\n    "id": "deal_…", "publicId": "d_…", "status": "active", "chainStatus": "active", "buyerAddress": "0x…",\n    "deposit": "6600000", "settled": "0", "refunded": "0", "remaining": "6600000",\n    "balancesSource": "chain", "fundingTxHash": "0x…", "createdAt": "2026-11-20T10:00:00.000Z"\n  }]\n}`,
    },
    {
      method: "GET", path: "/v1/seller/deals/:id", body: null,
      bash: `curl ${base}/deals/DEAL_ID \\\n  ${auth}`,
      ts: `const deal = await fetch(\`\${base}/deals/\${dealId}\`, { headers }).then((r) => r.json());`,
      response: `{\n  "id": "deal_…", "publicId": "d_…", "status": "active", "chainStatus": "active",\n  "terms": { … }, "termsHash": "0x…", "buyerAddress": "0x…", "sellerPayee": "0x…",\n  "funding": { "txHash": "0x…", "status": "confirmed", "explorerUrl": "https://…" },\n  "balances": { "deposit": "6600000", "settled": "0", "refunded": "0", "remaining": "6600000", "source": "chain" },\n  …\n}`,
    },
    {
      method: "POST", path: "/v1/seller/deals/:id/deliveries", body: "requestId (4 to 80 of letters, digits . _ : -; the same id again returns the first receipt), units (whole number from 1), note (3 to 2000 characters: what was delivered), proofUrl? (https link). The deal must be funded or active, and the units must fit the agreement and the prepaid balance.",
      bash: post("POST", "/deals/DEAL_ID/deliveries", `{"requestId":"order-1042-shipped","units":1,"note":"Shipped by courier","proofUrl":"https://track.example/1042"}`),
      ts: write("POST", "/deals/${dealId}/deliveries", `{ requestId: "order-1042-shipped", units: 1, note: "Shipped by courier", proofUrl: "https://track.example/1042" }`),
      response: `{\n  "requestId": "order-1042-shipped", "status": "delivered", "billable": true, "units": 1,\n  "receipt": { "digest": "0x…", "sellerSignature": "0x…", "at": "2026-11-20T10:00:00.000Z" },\n  "deal": { "cumulativeUnits": "1", "cumulativeCharged": "6600000", "remaining": "0" },\n  …\n}`,
    },
    {
      method: "POST", path: "/v1/seller/deals/:id/order-updates", body: "status: accepted, in_production, shipped, out_for_delivery, delayed (note required: why and the new date) or note (note required); note? (up to 1000 characters); trackingUrl? (https link). The deal must be funded or active.",
      bash: post("POST", "/deals/DEAL_ID/order-updates", `{"status":"shipped","note":"Two boxes by courier","trackingUrl":"https://track.example/1042"}`),
      ts: write("POST", "/deals/${dealId}/order-updates", `{ status: "shipped", note: "Two boxes by courier", trackingUrl: "https://track.example/1042" }`),
      response: `{ "id": "du_…", "status": "shipped", "label": "Shipped" }`,
    },
    {
      method: "GET", path: "/v1/seller/usage", body: null,
      bash: `curl ${base}/usage \\\n  ${auth}`,
      ts: `const { totals, requests } = await fetch(\`\${base}/usage\`, { headers }).then((r) => r.json());`,
      response: `{\n  "totals": { "requests": 12, "delivered": 11, "handoff": 0, "failed": 1, "billableUnits": 11, "avgLatencyMs": 840 },\n  "requests": [{ "requestId": "order-1042-shipped", "dealId": "deal_…", "dealPublicId": "d_…", "productName": "Custom oversized tees", "status": "delivered", "billable": true, "units": 1, "cumulativeCharged": "6600000", "signed": true, "at": "2026-11-20T10:00:00.000Z", … }]\n}`,
    },
    {
      method: "GET", path: "/v1/seller/payments", body: null,
      bash: `curl ${base}/payments \\\n  ${auth}`,
      ts: `const payments = await fetch(\`\${base}/payments\`, { headers }).then((r) => r.json());`,
      response: `{\n  "funded": "13200000", "settled": "6600000", "earnedUnsettled": "0", "liability": "6600000", "refunded": "0",\n  "reconciliation": { "lastRunAt": "2026-11-20T10:00:00.000Z", "discrepancies": [] },\n  "labels": { "network": "testnet", "note": "Deposits are customer liabilities until usage is accepted and settled. Unused balances are never seller revenue." }\n}`,
    },
  ];
}
