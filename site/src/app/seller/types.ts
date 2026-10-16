/**
 * Wire types for the seller console (`/api/app/*`, docs/api.md).
 * Money is a string of integer micro-USDC, units are integer strings, bps are integer strings
 * (bigints serialized by the server). Parse with BigInt() only at the edge where math happens.
 */
import type { CandidateStatus, RuleId } from "@proteus/domain";

export type MicroStr = string;
export type IntStr = string;

export interface Labels {
  network: "testnet" | "sandbox" | "illustrative";
  seller: "sandbox" | "live";
}

export interface SessionOrg {
  org: { slug: string; name: string; label: "sandbox" | "live" };
}

export interface Overview {
  quotes: number;
  approvalsPending: number;
  dealsFunded: number;
  fundedValue: MicroStr;
  earnedSettled: MicroStr;
  pendingLiability: MicroStr;
  refunded: MicroStr;
  usageUnits: IntStr;
  labels: Labels;
  org?: SessionOrg["org"];
}

export interface WireUnitPrice {
  num: IntStr;
  den: IntStr;
}

export interface WireTier {
  id: string;
  name: string;
  includedUnits: IntStr;
  unitPrice: WireUnitPrice;
  overagePrice?: WireUnitPrice;
  includes: string[];
}

export interface WireCostModel {
  version: number;
  variableCostPerUnit: MicroStr;
  directCostPerDeal: MicroStr;
  txCostBps: IntStr;
  freshUntil: number;
}

export interface WirePolicy {
  version: number;
  minMarginBps: IntStr;
  maxDiscountBps: IntStr;
  approvalThreshold: MicroStr;
  prepaidMinimum: MicroStr;
  availableCapacityUnits: IntStr;
  quoteTtlSeconds: number;
  allowNonPositiveContribution: boolean;
}

export interface PreviewCase {
  label: string;
  desiredUnits?: IntStr;
  budget?: MicroStr;
}

export interface ProductWithPrivate {
  id: string;
  slug: string;
  name: string;
  billableUnit: string;
  unitLabel: string;
  supportedIntegrations: string[];
  capabilities: string[];
  tiers: WireTier[];
  maxUnitsPerDeal: IntStr;
  termDays: number;
  refundPolicy: string;
  cost: WireCostModel;
  policy: WirePolicy;
  previewCases?: PreviewCase[];
  labels?: Labels;
}

export interface WireEconomics {
  expectedRevenue: MicroStr;
  expectedVariableCost: MicroStr;
  expectedTxCost: MicroStr;
  allocatedDirectCost: MicroStr;
  expectedContribution: MicroStr;
  expectedContributionMarginBps: IntStr;
  discountBps: IntStr;
}

export interface WireCandidate {
  candidateId: string;
  tierId: string;
  tierName: string;
  units: IntStr;
  unitPrice: WireUnitPrice;
  prepaidTotal: MicroStr;
  overagePrice?: WireUnitPrice;
  includes: string[];
  supportedIntegrations: string[];
  unsupportedIntegrations: string[];
  status: CandidateStatus;
  rules: RuleId[];
  origin: "tier" | "budget_fit" | "requested_units" | "counter";
  origins: WireCandidate["origin"][];
  economics: WireEconomics;
}

export interface PreviewResult {
  candidates: WireCandidate[];
  policy?: WirePolicy;
}

export interface NegotiationSummary {
  id: string;
  publicId: string;
  productName: string;
  buyerLabel: string;
  status: "open" | "quoted" | "accepted" | "closed";
  updatedAt: string;
  turns: number;
  bestOfferTotal?: MicroStr;
  needsApproval: boolean;
}

export interface Turn {
  id: string;
  role: "buyer" | "agent" | "system";
  content: string;
  createdAt: string;
  kind?: "message" | "offers" | "decision" | "clarify";
  decision?: { decision: string; reasons: string[] };
}

export interface DecisionLog {
  id: string;
  at: string;
  kind: "candidates" | "counter" | "quote" | "approval" | "injection_blocked";
  ruleIds: RuleId[];
  candidateId?: string;
  summary: string;
  privateBasis: Partial<WireEconomics> & Record<string, unknown>;
  publicExplanation: string;
}

export interface AgentRun {
  id: string;
  at: string;
  adapter: string;
  service?: { kind: "http"; url: string | null; authHeader: string | null; hasSecret: boolean } | { kind: "sample-store" };
  steps: { at: string; label: string; state: "done" | "working" | "blocked"; detail?: string }[];
  durationMs: number;
}

export interface NegotiationDetail {
  id: string;
  publicId: string;
  sellerSlug: string;
  productSlug: string;
  productName?: string;
  buyerLabel?: string;
  status: NegotiationSummary["status"];
  requirements: {
    desiredUnits?: IntStr;
    budget?: MicroStr;
    integrations: string[];
    openQuestions: string[];
    assumptions: string[];
  };
  turns: Turn[];
  candidates: WireCandidate[];
  decisions: DecisionLog[];
  agentRuns: AgentRun[];
  quotes?: { id: string; status: string; candidateId: string; approvalId?: string; expiresAt: string }[];
}

export interface Approval {
  id: string;
  quoteId: string;
  negotiationId?: string;
  candidateId?: string;
  status: "pending" | "approved" | "declined" | "expired";
  buyer: string;
  buyerAddress?: string;
  productName: string;
  tierName: string;
  units: IntStr;
  prepaidTotal: MicroStr;
  marginBps?: IntStr;
  floorBps?: IntStr;
  ruleIds: RuleId[];
  expiresAt?: string;
  reason?: string;
  decidedAt?: string;
  createdAt?: string;
}

export interface DealSummary {
  id: string;
  publicId: string;
  productName: string;
  buyerAddress?: string;
  status: DealStatus;
  deposit: MicroStr;
  settled: MicroStr;
  remaining: MicroStr;
  createdAt: string;
}

export type DealStatus = "awaiting_funding" | "funding_pending" | "funded" | "active" | "closed" | "disputed";

export interface JournalEntry {
  id: string;
  at: string;
  dealPublicId?: string;
  account: string;
  memo: string;
  debit: MicroStr;
  credit: MicroStr;
  txHash?: string;
  explorerUrl?: string;
}

export interface DealDetail {
  id: string;
  publicId: string;
  status: DealStatus;
  productName?: string;
  chainId: number;
  escrowAddress: string;
  usdcAddress: string;
  dealIdOnchain: IntStr;
  terms: Record<string, string>;
  publicTerms: { includes: string[]; billableUnit: string; integrations: string[]; refundPolicy: string; termDays: number };
  signatures: { buyer: string; seller: string };
  buyerAddress: string;
  sellerPayee: string;
  funding: { txHash?: string; confirmedAt?: string; explorerUrl?: string };
  balances: { deposit: MicroStr; settled: MicroStr; refunded: MicroStr; remaining: MicroStr; source: "chain" | "pending" };
  usage: { units: IntStr; charged: MicroStr; settled: MicroStr };
  refundableAt: string;
  explorer: { escrow: string; funding?: string; settlements: string[]; refund?: string };
  labels: Labels;
  economics?: Partial<WireEconomics>;
  journal: JournalEntry[];
  chainTxs: { kind: string; txHash: string; at: string; amount?: MicroStr; explorerUrl?: string; status?: string }[];
  /** "illustrative" when the data did not come from a chain (mock mode). */
  network?: string;
}

export interface Finance {
  funded: MicroStr;
  earned: MicroStr;
  settled: MicroStr;
  liability: MicroStr;
  refunded: MicroStr;
  journal: JournalEntry[];
  reconciliation: { lastRunAt?: string; discrepancies: { id?: string; summary: string }[] };
  labels?: Labels;
}
