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
