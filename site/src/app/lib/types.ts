/**
 * Wire types for docs/api.md (v0). Money is integer micro-USDC as a decimal string ("1440000000" = $1,440);
 * fields ending in `Usd` are display decimals. Units are integer strings. Never parse money into JS numbers.
 */
import type { UsageAckBody } from "@proteus/domain";

export type MicroStr = string;
export type UnitsStr = string;
export type Hex = `0x${string}`;
export type Address = `0x${string}`;
export type IsoTime = string;
export type NetworkLabel = "testnet" | "sandbox" | "illustrative";
export type SellerLabel = "sandbox" | "live";

export interface Health {
  ok: boolean;
  network: NetworkLabel;
  chainId: number;
  escrowAddress: Address;
  usdcAddress: Address;
  agentAdapter: "rule-based" | "anthropic";
  relayer: "circle" | "viem" | "none";
}

export interface PublicTier {
  id: string;
  name: string;
  includedUnits: UnitsStr;
  unitPriceUsd: string;
  prepaidTotalUsd: string;
  includes: string[];
}

/** Public seller identity. Logo is an https URL, a site asset path or a small data URL. */
export interface SellerBrand {
  logoUrl?: string;
  /** Square icon for avatars; the wordmark stays in logoUrl. */
  markUrl?: string;
  tagline?: string;
  category?: string;
  website?: string;
  accent?: string;
  /** Verified by PROTEUS (platform-set). */
  verified?: boolean;
}

/** Real per-seller numbers from the deals table (micro-USDC strings). */
export interface SellerStats {
  dealsFunded: number;
  settled: MicroStr;
  inEscrow: MicroStr;
  since: IsoTime;
}

export type ServiceKind = "seller-endpoint" | "sample-store" | "example";

export type RequestFieldType = "text" | "textarea" | "number" | "file";
export interface RequestField {
  key: string;
  label: string;
  type: RequestFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}
export interface RequestSpec {
  intro?: string;
  fields: RequestField[];
}

export interface PublicProduct {
  slug: string;
  name: string;
  summary?: string | null;
  category?: string | null;
  maxUnitsPerDeal?: UnitsStr;
  payPerCallUsd?: string | null;
  service?: ServiceKind;
  request?: RequestSpec | null;
  billableUnit: string;
  unitLabel: string;
  capabilities: string[];
  supportedIntegrations: string[];
  tiers: PublicTier[];
  termDays: number;
  refundPolicy: string;
  starters: string[];
  network?: NetworkLabel;
}

export interface PublicSeller {
  slug: string;
  name: string;
  label: SellerLabel;
  brand?: SellerBrand;
  stats?: SellerStats;
  products: PublicProduct[];
  network?: NetworkLabel;
}

export interface UnitPriceWire {
  num: string;
  den: string;
}

export type CandidateStatus = "eligible" | "approval_required" | "rejected";
export type CandidateOrigin = "tier" | "budget_fit" | "requested_units" | "counter";

/** PublicCandidate from @proteus/domain over the wire (bigints as strings) plus display fields. */
export interface Offer {
  candidateId: string;
  tierId: string;
  tierName: string;
  units: UnitsStr;
  unitPrice: UnitPriceWire;
  prepaidTotal: MicroStr;
  overagePrice?: UnitPriceWire;
  includes: string[];
  supportedIntegrations: string[];
  unsupportedIntegrations: string[];
  status: CandidateStatus;
  origin: CandidateOrigin;
  origins: CandidateOrigin[];
  publicReasons: string[];
  unitPriceUsd: string;
  prepaidTotalUsd: string;
  overagePriceUsd?: string;
}

export interface WireRequirements {
  desiredUnits?: UnitsStr;
  budget?: MicroStr;
  integrations: string[];
  openQuestions: string[];
  assumptions: string[];
}

export type TurnRole = "buyer" | "agent" | "system";
export type TurnKind = "message" | "offers" | "decision" | "clarify";
export type CounterDecisionKind = "approved" | "approval_required" | "rejected";

export interface Turn {
  id: string;
  role: TurnRole;
  content: string;
  createdAt: IsoTime;
  kind?: TurnKind;
  offers?: Offer[];
  decision?: { decision: CounterDecisionKind; reasons: string[]; alternative?: Offer };
}

export interface ActivityItem {
  at: IsoTime;
  label: string;
  state: "done" | "working";
}

export interface Negotiation {
  id: string;
  publicId: string;
  sellerSlug: string;
  sellerName?: string;
  sellerBrand?: SellerBrand;
  productSlug: string;
  productName?: string;
  productSummary?: string | null;
  termDays?: number;
  unitLabel?: string;
  labels?: { seller?: SellerLabel; network?: string; pricing?: string };
  status: "open" | "quoted" | "accepted" | "closed";
  requirements: WireRequirements;
  turns: Turn[];
  offers: Offer[];
  activity: ActivityItem[];
  network?: NetworkLabel;
}

/** EIP-712 Terms message, all uint/bigint fields as decimal strings. */
export interface TermsWire {
  dealId: string;
  buyer: Address;
  seller: Address;
  payee: Address;
  usdc: Address;
  productId: Hex;
  unitNum: string;
  unitDen: string;
  maxUnits: string;
  prepaid: MicroStr;
  start: string;
  end: string;
  grace: string;
  publicTermsHash: Hex;
  nonce: string;
  expiry: string;
}

export interface TypedDataField {
  name: string;
  type: string;
}

export interface TypedDataWire<P extends string = string, M = Record<string, unknown>> {
  domain: { name: string; version: string; chainId: number | string; verifyingContract: Address };
  types: Record<string, TypedDataField[]>;
  primaryType: P;
  message: M;
}

export interface PublicTerms {
  includes: string[];
  billableUnit: string;
  integrations: string[];
  refundPolicy: string;
  termDays: number;
  overage?: string;
}

export type QuoteStatus = "draft" | "approval_required" | "approved" | "declined" | "accepted" | "expired";

export interface Quote {
  id: string;
  negotiationId: string;
  status: QuoteStatus;
  offer: Offer;
  expiresAt: IsoTime;
  chainId: number;
  escrowAddress: Address;
  usdcAddress: Address;
  terms: TermsWire;
  typedData: TypedDataWire<"Terms", TermsWire>;
  publicTerms: PublicTerms;
  approval?: { id: string; status: "pending" | "approved" | "declined"; reason: string; decidedAt?: IsoTime };
  network?: NetworkLabel;
}

export type DealStatus = "awaiting_funding" | "funding_pending" | "funded" | "active" | "closed" | "disputed";

export interface Deal {
  id: string;
  publicId: string;
  status: DealStatus;
  chainId: number;
  escrowAddress: Address;
  usdcAddress: Address;
  dealIdOnchain: string;
  terms: TermsWire;
  publicTerms: PublicTerms;
  signatures: { buyer: Hex; seller: Hex };
  buyerAddress: Address;
  sellerPayee: Address;
  funding: { txHash?: Hex; confirmedAt?: IsoTime; explorerUrl?: string };
  balances: { deposit: MicroStr; settled: MicroStr; refunded: MicroStr; remaining: MicroStr; source: "chain" | "pending" };
  service: { status: "pending" | "provisioned" | "suspended"; endpoint: string; apiKey?: string; docsUrl: string; request?: RequestSpec | null; sampleStore?: { label: string; orderIds: string[] } };
  usage: { units: UnitsStr; charged: MicroStr; settled: MicroStr };
  refundableAt: IsoTime;
  explorer: { escrow: string; funding?: string; settlements: string[]; refund?: string };
  labels: { network: "testnet"; seller: SellerLabel };
  network?: NetworkLabel;
}

export type ReceiptStatus = "delivered" | "failed" | "handoff";

export interface Receipt {
  requestId: string;
  status: ReceiptStatus;
  units: UnitsStr;
  chargedCumulative: MicroStr;
  digest: Hex;
  createdAt: IsoTime;
  answerPreview: string;
}

export interface AcceptanceWire {
  dealId: string;
  termsHash: Hex;
  cumulativeAmount: MicroStr;
  cumulativeUnits: UnitsStr;
  receiptsRoot: Hex;
  nonce: string;
  expiry: string;
}

export interface UsageResponse {
  receipts: Receipt[];
  cumulativeUnits: UnitsStr;
  cumulativeCharged: MicroStr;
  settledOnchain: MicroStr;
  pendingAcceptance?: { typedData: TypedDataWire<"Acceptance", AcceptanceWire>; acceptance: AcceptanceWire };
}

export type { UsageAckBody };

export interface UsageAckResponse {
  /** txHash can be absent while the settlement is queued (and always in mock mode). */
  settlement: { txHash?: Hex; status: string };
  deal: Deal;
}

export interface RefundResponse {
  status: "submitted" | "too_early";
  refundableAt: IsoTime;
  txHash?: Hex;
}

/** Free-form request body for a service call. The product's request spec says which keys the seller expects. */
export type ExecuteInput = Record<string, unknown>;

export interface ExecuteResponse {
  requestId: string;
  status: ReceiptStatus;
  billable: boolean;
  units: UnitsStr;
  answer: string;
  source: { store: string; orderId?: string; fields: string[] };
  receipt: { digest: Hex; sellerSignature: Hex };
  deal: { cumulativeUnits: UnitsStr; cumulativeCharged: MicroStr; remaining: MicroStr };
}

/* Review (public, redacted) */
export interface ReviewListItem {
  publicId: string;
  sellerLabel: SellerLabel;
  productName: string;
  status: string;
  fundedUsd: string;
  settledUsd: string;
  refundedUsd: string;
  network: NetworkLabel;
  createdAt: IsoTime;
}

export type ReviewEventKind = "quote" | "accept" | "fund" | "service" | "usage_accept" | "settle" | "refund";

export interface ReviewRecord {
  timeline: { at: IsoTime; kind: ReviewEventKind; summary: string; txHash?: Hex; explorerUrl?: string }[];
  termsHash: Hex;
  publicTerms: PublicTerms;
  balances: Deal["balances"];
  labels: { network: NetworkLabel; seller: SellerLabel };
}

/* Seller console (/api/app/*). Shapes the doc leaves open are typed loosely on purpose. */
export interface SellerOrg {
  slug: string;
  name: string;
  label: SellerLabel;
}

export interface SellerOverview {
  quotes: number;
  approvalsPending: number;
  dealsFunded: number;
  fundedValue: MicroStr;
  earnedSettled: MicroStr;
  pendingLiability: MicroStr;
  refunded: MicroStr;
  usageUnits: UnitsStr;
  labels: { network: NetworkLabel; seller: SellerLabel };
}

export interface EconomicsWire {
  expectedRevenue: MicroStr;
  expectedVariableCost: MicroStr;
  expectedTxCost: MicroStr;
  allocatedDirectCost: MicroStr;
  expectedContribution: MicroStr;
  expectedContributionMarginBps: string;
  discountBps: string;
}

export type CandidateWithEconomics = Omit<Offer, "publicReasons"> & { rules: string[]; economics: EconomicsWire; publicReasons?: string[] };

export interface ProductWithPrivate extends PublicProduct {
  id: string;
  maxUnitsPerDeal: UnitsStr;
  cost: { version: number; variableCostPerUnit: MicroStr; directCostPerDeal: MicroStr; txCostBps: number; freshUntil: number | IsoTime };
  policy: {
    version: number;
    minMarginBps: number;
    maxDiscountBps: number;
    approvalThreshold: MicroStr;
    prepaidMinimum: MicroStr;
    availableCapacityUnits: UnitsStr;
    quoteTtlSeconds: number;
    allowNonPositiveContribution?: boolean;
  };
  previewCases?: { label: string; desiredUnits?: UnitsStr; budget?: MicroStr }[];
  [k: string]: unknown;
}

export interface NegotiationSummary {
  id: string;
  publicId: string;
  sellerSlug?: string;
  sellerName?: string;
  sellerLabel?: SellerLabel;
  sellerBrand?: SellerBrand;
  productName?: string;
  productSlug: string;
  status: Negotiation["status"];
  createdAt: IsoTime;
  updatedAt?: IsoTime;
  turns?: number;
  bestOfferUsd?: string;
  [k: string]: unknown;
}

export interface DecisionLog {
  id: string;
  at: IsoTime;
  kind: "candidates" | "counter" | "quote" | "approval" | "injection_blocked";
  ruleIds: string[];
  candidateId?: string;
  summary: string;
  privateBasis: Record<string, unknown>;
  publicExplanation: string;
}

export interface AgentRun {
  id: string;
  at: IsoTime;
  adapter: string;
  steps: { at: IsoTime; label: string; state: "done" | "working" | "blocked"; detail?: string }[];
  durationMs: number;
}

export type SellerNegotiation = Negotiation & { candidates: CandidateWithEconomics[]; decisions: DecisionLog[]; agentRuns: AgentRun[] };

export interface Approval {
  id: string;
  quoteId: string;
  status: "pending" | "approved" | "declined";
  reason: string;
  createdAt: IsoTime;
  decidedAt?: IsoTime;
  offer?: Offer;
  economics?: EconomicsWire;
  [k: string]: unknown;
}

export interface DealSummary {
  id: string;
  publicId: string;
  status: DealStatus;
  productSlug?: string;
  deposit: MicroStr;
  settled: MicroStr;
  remaining: MicroStr;
  createdAt: IsoTime;
  [k: string]: unknown;
}

export interface JournalEntry {
  id: string;
  at: IsoTime;
  kind: string;
  debit?: string;
  credit?: string;
  amount: MicroStr;
  memo: string;
  txHash?: Hex;
  [k: string]: unknown;
}

export type SellerDeal = Deal & { economics: EconomicsWire | Record<string, unknown>; journal: JournalEntry[]; chainTxs: { kind: string; txHash: Hex; at: IsoTime; explorerUrl?: string }[] };

export interface SellerFinance {
  funded: MicroStr;
  earned: MicroStr;
  settled: MicroStr;
  liability: MicroStr;
  refunded: MicroStr;
  journal: JournalEntry[];
  reconciliation: { lastRunAt: IsoTime | null; discrepancies: unknown[] };
}

export interface PolicyUpdate {
  minMarginBps?: number;
  maxDiscountBps?: number;
  approvalThreshold?: MicroStr;
  prepaidMinimum?: MicroStr;
  availableCapacityUnits?: UnitsStr;
  quoteTtlSeconds?: number;
}

export interface CostUpdate {
  variableCostPerUnit: MicroStr;
  directCostPerDeal?: MicroStr;
  txCostBps?: number;
}

export interface ApprovalDecision {
  decision: "approve" | "decline";
  reason?: string;
  ownerSignature?: Hex;
}

/* ------------------------------------------------------------------ */
/* v1 additions: accounts, dashboard, pay per call (docs/api.md)       */
/* ------------------------------------------------------------------ */

export interface MeWallet {
  address: Address;
  /** Server field name. `type` is accepted too (earlier draft of the contract). */
  kind?: "embedded" | "external";
  type?: "embedded" | "external";
  primary: boolean;
}

export function walletKind(w: MeWallet): "embedded" | "external" {
  return w.kind ?? w.type ?? "embedded";
}

/** The exact message signed (personal_sign) to link a wallet to the account. */
export function walletLinkMessage(address: string, nonce: string): string {
  return `PROTEUS wallet link\naddress: ${address}\nnonce: ${nonce}`;
}

export interface MeOrg {
  id: string;
  slug: string;
  name: string;
  label: SellerLabel;
  role: "owner";
  brand?: SellerBrand;
}

export type AccountMode = "buy" | "sell";

export interface MeResponse {
  userId: string;
  /** Chosen once after sign-in; null until the person picks Buy or Sell. */
  mode?: AccountMode | null;
  email?: string;
  wallets: MeWallet[];
  org?: MeOrg;
  labels: { network: "testnet" };
}

export interface MeWalletBalance {
  address: Address;
  /** micro-USDC (6 decimals, ERC-20 view of the native balance). */
  usdc: MicroStr;
  /** native balance in wei (18 decimals), as a decimal string. */
  native: string;
  faucetUrl: string;
  chainId: number;
  explorerUrl: string;
}

export interface MeActivity {
  negotiations: NegotiationSummary[];
  deals: DealSummary[];
  payPerCall: { calls: number; spent: MicroStr };
}

export interface SignerInfo {
  address: Address;
  scope: "terms+delivery";
  createdAt: IsoTime;
  revokedAt?: IsoTime;
}

export interface ProductCreateBody {
  name: string;
  slug?: string;
  unitLabel: string;
  billableUnit: string;
  capabilities: string[];
  supportedIntegrations: string[];
  tiers: { name: string; includedUnits: UnitsStr | number; unitPriceUsd: string; includes: string[] }[];
  maxUnitsPerDeal: UnitsStr | number;
  termDays: number;
  refundPolicy: string;
  cost: { variableCostPerUnitUsd: string; directCostPerDealUsd: string; txCostBps: number };
  policy: { minMarginBps: number; maxDiscountBps: number; approvalThresholdUsd: string; prepaidMinimumUsd: string; availableCapacityUnits: UnitsStr | number; quoteTtlSeconds: number };
  payPerCall?: { priceUsd: string };
  summary?: string;
  category?: string;
  request?: { intro?: string; fields: { key?: string; label: string; type: RequestFieldType; required?: boolean; placeholder?: string; hint?: string }[] };
  /** "http": the seller's own HTTPS endpoint (real). "order-support": first-party sample store (demo). */
  adapter?: "http" | "order-support";
  upstream?: { url: string; authHeader?: string; secret?: string };
}

export interface MarketItem {
  sellerSlug: string;
  sellerName: string;
  sellerLabel: SellerLabel;
  sellerBrand?: SellerBrand;
  productSlug: string;
  name: string;
  summary?: string | null;
  category?: string | null;
  unitLabel: string;
  termDays?: number;
  startingTierUsd: string;
  perCallUsd?: string;
}

export interface MarketSellerProduct {
  slug: string;
  name: string;
  summary?: string | null;
  category?: string | null;
  unitLabel: string;
  capabilities: string[];
  termDays: number;
  tiers: number;
  startingTierUsd: string | null;
  bestUnitPriceUsd: string | null;
  perCallUsd: string | null;
  service: ServiceKind;
}

export interface MarketSeller {
  slug: string;
  name: string;
  label: SellerLabel;
  brand: SellerBrand;
  stats?: SellerStats;
  products: MarketSellerProduct[];
}

export interface PayAccept {
  scheme: "exact";
  network: string;
  asset: Address;
  payTo: Address;
  /** micro-USDC */
  amount: MicroStr;
  maxTimeoutSeconds: number;
  resource: string;
  extra: { name: string; version: string };
}

/** Body of the 402 response from POST /api/pay/:seller/:product/execute. */
export interface PayRequired {
  x402Version: number;
  accepts: PayAccept[];
  requestId: string;
  nonce?: Hex;
}

export interface PayAuthorization {
  from: Address;
  to: Address;
  value: MicroStr;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export interface PayExecuteBody {
  requestId: string;
  input: ExecuteInput;
  payer?: Address;
  payment?: { signature: Hex; authorization: PayAuthorization };
}

export type PayExecuteResponse = Partial<ExecuteResponse> & {
  requestId: string;
  answer: string;
  status: ReceiptStatus;
  payment: { paymentId: string; settleTxHash?: Hex; status: "settled" | "pending" };
};
