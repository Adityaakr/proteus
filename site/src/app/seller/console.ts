/** Seller console v2 payloads (dashboard, customers, usage, insights). Money is micro-USDC strings. */
import type { Address, IsoTime, MicroStr, SellerLabel } from "../lib/types";

export interface DashboardAttention {
  id: string;
  quoteId: string;
  negotiationId: string;
  buyerAddress: Address | null;
  productName: string;
  tierName: string;
  units: string;
  prepaidTotal: MicroStr;
  marginBps: string;
  reason: string;
  ruleIds: string[];
  createdAt: IsoTime;
}
export interface DashboardDeal {
  id: string;
  publicId: string;
  buyerAddress: Address;
  productName: string;
  deposit: MicroStr;
  settled: MicroStr;
  status: string;
  createdAt: IsoTime;
}
export interface Dashboard {
  revenueEarned: MicroStr;
  fulfilledDeals: number;
  activeNegotiations: number;
  needsAttention: number;
  marginBps: number | null;
  marginBasis: "accepted" | "quoted" | "none";
  fundsHeld: MicroStr;
  refunded: MicroStr;
  dealsFunded: number;
  attention: DashboardAttention[];
  recentDeals: DashboardDeal[];
  labels: { seller: SellerLabel; network: string };
}
export interface Customer {
  address: Address;
  negotiations: number;
  deals: number;
  funded: MicroStr;
  settled: MicroStr;
  inEscrow: MicroStr;
  products: string[];
  lastActivity: IsoTime;
  firstSeen: IsoTime;
}
export interface UsageRow {
  id: string;
  requestId: string;
  dealId: string;
  dealPublicId: string | null;
  buyerAddress: Address | null;
  productName: string;
  status: "delivered" | "failed" | "handoff";
  billable: boolean;
  units: number;
  cumulativeUnits: string;
  cumulativeCharged: MicroStr;
  latencyMs: number;
  signed: boolean;
  at: IsoTime;
}
export interface Usage {
  totals: { requests: number; delivered: number; handoff: number; failed: number; billableUnits: number; avgLatencyMs: number };
  requests: UsageRow[];
}
export interface InsightPoint {
  day: string;
  negotiations: number;
  dealsFunded: number;
  funded: MicroStr;
  settled: MicroStr;
  requests: number;
  billableUnits: number;
}
export interface Insights {
  days: number;
  series: InsightPoint[];
  conversion: { negotiations: number; quoted: number; funded: number; closed: number };
  delivery: { requests: number; delivered: number; handoff: number; failed: number };
}
