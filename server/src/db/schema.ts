import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Money columns are bigint micro-USDC. JSON columns that carry money store strings.
 * Every seller-scoped row carries org_id. Commercial records are append-only: policy/cost versions,
 * decisions, receipts, acceptances, chain txs and journal entries are never updated after insert
 * (status fields on quotes/deals are the exception and are the only mutable commercial state).
 */

/** People. Keyed by the Privy DID. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  privyDid: text("privy_did").notNull().unique(),
  email: text("email"),
  /** What the person came to do: "buy" or "sell". Chosen once after sign-in; switchable in the shell. */
  mode: text("mode"),
  /** Set when an invite code was bound to this account. Null means the account is locked out of the product. */
  accessGrantedAt: timestamp("access_granted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Invite codes. Only an HMAC of the code is stored; the plaintext is shown once at generation and never
 * again. A code grants access to `maxUses` accounts, stops at `expiresAt`, and can be revoked at any time.
 */
export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  label: text("label"),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Which account used which invite. One row per account: access is granted once. */
export const inviteRedemptions = pgTable("invite_redemptions", {
  id: text("id").primaryKey(),
  inviteId: text("invite_id").notNull().references(() => invites.id),
  userId: text("user_id").notNull().references(() => users.id).unique(),
  ip: text("ip"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Wallet addresses a user proved control of (embedded or external). */
export const walletLinks = pgTable(
  "wallet_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    address: text("address").notNull(),
    kind: text("kind").notNull().default("embedded"), // embedded | external
    primary: boolean("primary").notNull().default(true),
    proof: text("proof"), // signature over the link message
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallet_links_user_address").on(t.userId, t.address), index("wallet_links_address").on(t.address)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    orgId: text("org_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_org").on(t.userId, t.orgId)],
);

/** Per-org delegated seller signer (server-held, encrypted at rest). Signs Terms and Delivery only. */
export const orgSigners = pgTable("org_signers", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  address: text("address").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  scope: text("scope").notNull().default("terms+delivery"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/** x402 pay-per-call payments. Unique per (payer, requestId): a retry never settles twice. */
export const payPerCallPayments = pgTable(
  "pay_per_call_payments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull(),
    payer: text("payer").notNull(),
    requestId: text("request_id").notNull(),
    resource: text("resource").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    nonce: text("nonce").notNull(),
    status: text("status").notNull().default("quoted"), // quoted | verified | executed | settled | failed
    paymentId: text("payment_id"),
    settleTxHash: text("settle_tx_hash"),
    response: jsonb("response"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ppc_payer_request").on(t.payer, t.requestId)],
);

export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** "sandbox" rows are excluded from live counters and labeled everywhere. */
  label: text("label").notNull().default("sandbox"),
  ownerAddress: text("owner_address"),
  ownerUserId: text("owner_user_id"),
  /** Public identity: { logoUrl?, tagline?, category?, website?, accent? }. logoUrl is an https URL, a site asset path or a small data URL. */
  brand: jsonb("brand"),
  /** Seller signer (delegated, server-held for the sandbox seller). */
  sellerSignerAddress: text("seller_signer_address").notNull(),
  payeeAddress: text("payee_address").notNull(),
  /** ERC-8004 identity of this seller's agent on Arc, owned by the seller's own wallet (null until registered). */
  agentId: text("agent_id"),
  /** The identity's owner when it was confirmed; quotes are refused if ownerOf(agentId) has moved since. */
  agentOwner: text("agent_owner"),
  agentRegisteredTx: text("agent_registered_tx"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => orgs.id),
    slug: text("slug").notNull(),
    /** Public product definition (domain Product with bigints as strings). */
    public: jsonb("public").notNull(),
    /** Suggested buyer starters, public. */
    starters: jsonb("starters").notNull().default([]),
    /** Service adapter key: "http" (the seller's own HTTPS endpoint) or "order-support" (first-party sample store, demo). */
    adapter: text("adapter").notNull(),
    /** For adapter "http": { url, authHeader?, secretEnc? }. The secret is AES-GCM encrypted and never returned by the API. */
    upstream: jsonb("upstream"),
    /** Pay-per-call price in micro-USDC (x402); null = prepaid deals only. */
    payPerCallPrice: bigint("pay_per_call_price", { mode: "bigint" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_org_slug").on(t.orgId, t.slug)],
);

/** Append-only private cost model versions. */
export const costModels = pgTable(
  "cost_models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull().references(() => products.id),
    version: integer("version").notNull(),
    variableCostPerUnit: bigint("variable_cost_per_unit", { mode: "bigint" }).notNull(),
    directCostPerDeal: bigint("direct_cost_per_deal", { mode: "bigint" }).notNull(),
    txCostBps: integer("tx_cost_bps").notNull(),
    freshUntil: timestamp("fresh_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cost_models_product_version").on(t.productId, t.version)],
);

/** Append-only commercial policy versions. */
export const policies = pgTable(
  "policies",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull().references(() => products.id),
    version: integer("version").notNull(),
    minMarginBps: integer("min_margin_bps").notNull(),
    maxDiscountBps: integer("max_discount_bps").notNull(),
    approvalThreshold: bigint("approval_threshold", { mode: "bigint" }).notNull(),
    prepaidMinimum: bigint("prepaid_minimum", { mode: "bigint" }).notNull(),
    availableCapacityUnits: bigint("available_capacity_units", { mode: "bigint" }).notNull(),
    quoteTtlSeconds: integer("quote_ttl_seconds").notNull(),
    allowNonPositiveContribution: boolean("allow_non_positive_contribution").notNull().default(false),
    /** 32-byte random salt for this version's commitment (hex). Kept private unless the seller reveals the version. */
    salt: text("salt"),
    /** policyCommitment(fields, salt) from @proteus/domain; carried in every quote's public terms. */
    policyCommit: text("policy_commit"),
    /** ProteusPolicyRegistry commitBySig transaction, once this version is on chain for the seller's ERC-8004 agent. */
    commitTx: text("commit_tx"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("policies_product_version").on(t.productId, t.version)],
);

export const negotiations = pgTable(
  "negotiations",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull(),
    buyerAddress: text("buyer_address"),
    status: text("status").notNull().default("open"),
    /** domain Requirements, bigints as strings. */
    requirements: jsonb("requirements").notNull(),
    /** Latest candidate set snapshot (full, with economics). Private. */
    candidates: jsonb("candidates").notNull().default([]),
    /** Buyer-visible activity for ReasoningText/AgentActivity. */
    activity: jsonb("activity").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("negotiations_org").on(t.orgId)],
);

export const turns = pgTable(
  "turns",
  {
    id: text("id").primaryKey(),
    negotiationId: text("negotiation_id").notNull().references(() => negotiations.id),
    seq: integer("seq").notNull(),
    role: text("role").notNull(), // buyer | agent | system
    kind: text("kind").notNull().default("message"), // message | offers | decision | clarify
    content: text("content").notNull(),
    /** Public payload (offers / decision) as stored for buyers. */
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("turns_negotiation_seq").on(t.negotiationId, t.seq)],
);

/** Append-only decision log: every candidate set, counter evaluation, quote, approval, blocked injection. */
export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    negotiationId: text("negotiation_id").notNull(),
    kind: text("kind").notNull(),
    ruleIds: jsonb("rule_ids").notNull().default([]),
    candidateId: text("candidate_id"),
    summary: text("summary").notNull(),
    privateBasis: jsonb("private_basis").notNull(),
    publicExplanation: text("public_explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decisions_negotiation").on(t.negotiationId)],
);

/** Agent runs: adapter used, steps, duration. Seller-visible only. */
export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  negotiationId: text("negotiation_id").notNull(),
  adapter: text("adapter").notNull(),
  steps: jsonb("steps").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  negotiationId: text("negotiation_id").notNull(),
  productId: text("product_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  /** Full candidate snapshot incl. economics (private). */
  candidate: jsonb("candidate").notNull(),
  /** Offer-level public terms (plaintext behind publicTermsHash). */
  publicTerms: jsonb("public_terms").notNull(),
  /** EIP-712 Terms message, bigints as strings. */
  terms: jsonb("terms").notNull(),
  termsHash: text("terms_hash").notNull(),
  dealIdOnchain: bigint("deal_id_onchain", { mode: "bigint" }).notNull(),
  status: text("status").notNull().default("draft"),
  costVersion: integer("cost_version").notNull(),
  policyVersion: integer("policy_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  quoteId: text("quote_id").notNull().references(() => quotes.id),
  reason: text("reason").notNull(),
  ruleIds: jsonb("rule_ids").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | declined | expired
  decisionReason: text("decision_reason"),
  decidedBy: text("decided_by"),
  ownerSignature: text("owner_signature"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull(),
    negotiationId: text("negotiation_id").notNull(),
    quoteId: text("quote_id").notNull().references(() => quotes.id),
    dealIdOnchain: bigint("deal_id_onchain", { mode: "bigint" }).notNull().unique(),
    buyerAddress: text("buyer_address").notNull(),
    sellerAddress: text("seller_address").notNull(),
    payeeAddress: text("payee_address").notNull(),
    terms: jsonb("terms").notNull(),
    publicTerms: jsonb("public_terms").notNull(),
    termsHash: text("terms_hash").notNull(),
    buyerSignature: text("buyer_signature").notNull(),
    sellerSignature: text("seller_signature").notNull(),
    status: text("status").notNull().default("awaiting_funding"),
    fundingTxHash: text("funding_tx_hash"),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    /** Balances as last reconciled from chain events. */
    deposit: bigint("deposit", { mode: "bigint" }).notNull().default(sql`0`),
    settled: bigint("settled", { mode: "bigint" }).notNull().default(sql`0`),
    refunded: bigint("refunded", { mode: "bigint" }).notNull().default(sql`0`),
    balancesSource: text("balances_source").notNull().default("pending"),
    lastReconciledBlock: bigint("last_reconciled_block", { mode: "bigint" }).notNull().default(sql`0`),
    /** Service credential hash (sha256 of the bearer key). Key shown once. */
    apiKeyHash: text("api_key_hash"),
    serviceStatus: text("service_status").notNull().default("pending"),
    /** Cumulative accepted (buyer-signed) usage. */
    acceptedUnits: bigint("accepted_units", { mode: "bigint" }).notNull().default(sql`0`),
    acceptedAmount: bigint("accepted_amount", { mode: "bigint" }).notNull().default(sql`0`),
    acceptedNonce: bigint("accepted_nonce", { mode: "bigint" }).notNull().default(sql`0`),
    sellerClosedAt: timestamp("seller_closed_at", { withTimezone: true }),
    refundTxHash: text("refund_tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deals_org").on(t.orgId), index("deals_buyer").on(t.buyerAddress)],
);

/** Every metered service request. Unique per (deal, requestId): retries never double charge. */
export const serviceRequests = pgTable(
  "service_requests",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dealId: text("deal_id").notNull().references(() => deals.id),
    requestId: text("request_id").notNull(),
    status: text("status").notNull(), // delivered | failed | handoff
    billable: boolean("billable").notNull(),
    units: integer("units").notNull(),
    /** Cumulative billable units after this request (0 if not billable). */
    cumulativeUnits: bigint("cumulative_units", { mode: "bigint" }).notNull(),
    cumulativeCharged: bigint("cumulative_charged", { mode: "bigint" }).notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output").notNull(),
    evidenceDigest: text("evidence_digest").notNull(),
    sellerSignature: text("seller_signature"),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("service_requests_deal_request").on(t.dealId, t.requestId)],
);

/** Buyer-signed cumulative acceptances and their settlement state. */
export const usageAcceptances = pgTable(
  "usage_acceptances",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    dealId: text("deal_id").notNull().references(() => deals.id),
    nonce: bigint("nonce", { mode: "bigint" }).notNull(),
    cumulativeUnits: bigint("cumulative_units", { mode: "bigint" }).notNull(),
    cumulativeAmount: bigint("cumulative_amount", { mode: "bigint" }).notNull(),
    receiptsRoot: text("receipts_root").notNull(),
    expiry: bigint("expiry", { mode: "bigint" }).notNull(),
    buyerSignature: text("buyer_signature").notNull(),
    sellerDeliverySignature: text("seller_delivery_signature").notNull(),
    settlementTxHash: text("settlement_tx_hash"),
    status: text("status").notNull().default("submitted"), // submitted | confirmed | failed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usage_acceptances_deal_nonce").on(t.dealId, t.nonce)],
);

/** Onchain transactions we sent or observed. Unique by tx hash. */
export const chainTxs = pgTable(
  "chain_txs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id"),
    dealId: text("deal_id"),
    kind: text("kind").notNull(), // fund | settle | refund | close_term | approve
    txHash: text("tx_hash").notNull(),
    submittedVia: text("submitted_via").notNull(), // buyer-wallet | circle | viem
    status: text("status").notNull().default("pending"), // pending | confirmed | failed
    blockNumber: bigint("block_number", { mode: "bigint" }),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("chain_txs_hash").on(t.txHash)],
);

/** Onchain events observed by the reconciler. Unique by (txHash, logIndex). */
export const chainEvents = pgTable(
  "chain_events",
  {
    id: text("id").primaryKey(),
    dealIdOnchain: bigint("deal_id_onchain", { mode: "bigint" }).notNull(),
    name: text("name").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    args: jsonb("args").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chain_events_tx_log").on(t.txHash, t.logIndex)],
);

/** Append-only double-entry journal. Each entry has balanced lines in `lines`. */
export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  dealId: text("deal_id"),
  kind: text("kind").notNull(), // funding | earned | settlement | refund
  memo: text("memo").notNull(),
  /** [{ account, debit, credit }] micro strings. */
  lines: jsonb("lines").notNull(),
  evidence: jsonb("evidence").notNull(), // { txHash?, requestIds?, acceptanceId? }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  kind: text("kind").notNull(), // sandbox | siwe
  address: text("address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sample store for the first-party order-support adapter. Explicitly labeled demo data. */
export const sampleOrders = pgTable("sample_orders", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  orderId: text("order_id").notNull().unique(),
  email: text("email").notNull(),
  status: text("status").notNull(),
  carrier: text("carrier"),
  tracking: text("tracking"),
  eta: text("eta"),
  items: jsonb("items").notNull(),
  total: text("total").notNull(),
});

/**
 * Buyer ratings of sellers, each one an ERC-8004 ReputationRegistry giveFeedback transaction on Arc that the server
 * verified: posted by the deal's buyer address, for the seller's agentId, tagged ("proteus-deal", <on-chain dealId>),
 * on a deal with settled USDC. One rating per deal; a newer verified rating replaces the older one.
 */
export const sellerRatings = pgTable("seller_ratings", {
  dealId: text("deal_id").primaryKey(),
  orgId: text("org_id").notNull(),
  agentId: text("agent_id").notNull(),
  buyerAddress: text("buyer_address").notNull(),
  /** 1 to 5 stars (ERC-8004 value with valueDecimals 0). */
  value: integer("value").notNull(),
  /** USDC settled on the deal when the rating was verified (micro), used as the rating's weight. */
  weight: bigint("weight", { mode: "bigint" }).notNull(),
  txHash: text("tx_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
