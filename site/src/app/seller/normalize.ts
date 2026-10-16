/**
 * Normalizers from the wire (`/api/app/*`, typed loosely in lib/types.ts where the doc leaves shapes
 * open) to the view models in ./types. They accept both the documented fields and the variants the
 * shared mock returns, and never invent numbers: a missing value stays missing.
 */
import type * as W from "../lib/types";
import { usdToMicro } from "./format";
import type {
  Approval,
  DealDetail,
  DealSummary,
  Finance,
  JournalEntry,
  NegotiationDetail,
  NegotiationSummary,
  Overview,
  ProductWithPrivate,
  WireCandidate,
  WireTier,
} from "./types";

type Loose = Record<string, unknown>;
const str = (v: unknown): string | undefined => (v === undefined || v === null || v === "" ? undefined : String(v));
const isNumStr = (v: unknown) => typeof v === "string" && /^-?\d+$/.test(v);

function unitPriceFrom(raw: Loose, priceKey: string, usdKey: string): { num: string; den: string } | undefined {
  const p = raw[priceKey] as { num?: unknown; den?: unknown } | undefined;
  if (p && p.num !== undefined) return { num: String(p.num), den: String(p.den ?? "1") };
  const usd = str(raw[usdKey]);
  const micro = usd ? usdToMicro(usd) : undefined;
  return micro ? { num: micro, den: "1" } : undefined;
}

export function product(raw: W.ProductWithPrivate | Loose): ProductWithPrivate {
  const r = raw as Loose & W.ProductWithPrivate;
  const tiers: WireTier[] = ((r.tiers as unknown as Loose[]) ?? []).map((t) => ({
    id: String(t.id),
    name: String(t.name),
    includedUnits: String(t.includedUnits ?? "0"),
    unitPrice: unitPriceFrom(t, "unitPrice", "unitPriceUsd") ?? { num: "0", den: "1" },
    overagePrice: unitPriceFrom(t, "overagePrice", "overagePriceUsd"),
    includes: (t.includes as string[]) ?? [],
  }));
  const fresh = r.cost?.freshUntil;
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    adapter: typeof r.adapter === "string" ? r.adapter : undefined,
    active: typeof r.active === "boolean" ? r.active : true,
    service: (r.service as ProductWithPrivate["service"]) ?? undefined,
    billableUnit: String(r.billableUnit ?? ""),
    unitLabel: String(r.unitLabel ?? "unit"),
    supportedIntegrations: (r.supportedIntegrations as string[]) ?? [],
    capabilities: (r.capabilities as string[]) ?? [],
    tiers,
    maxUnitsPerDeal: String(r.maxUnitsPerDeal ?? "0"),
    termDays: Number(r.termDays ?? 30),
    refundPolicy: String(r.refundPolicy ?? ""),
    cost: {
      version: Number(r.cost?.version ?? 0),
      variableCostPerUnit: String(r.cost?.variableCostPerUnit ?? "0"),
      directCostPerDeal: String(r.cost?.directCostPerDeal ?? "0"),
      txCostBps: String(r.cost?.txCostBps ?? "0"),
      freshUntil: typeof fresh === "number" ? fresh : fresh ? Date.parse(String(fresh)) : 0,
    },
    policy: {
      version: Number(r.policy?.version ?? 0),
      minMarginBps: String(r.policy?.minMarginBps ?? "0"),
      maxDiscountBps: String(r.policy?.maxDiscountBps ?? "0"),
      approvalThreshold: String(r.policy?.approvalThreshold ?? "0"),
      prepaidMinimum: String(r.policy?.prepaidMinimum ?? "0"),
      availableCapacityUnits: String(r.policy?.availableCapacityUnits ?? "0"),
      quoteTtlSeconds: Number(r.policy?.quoteTtlSeconds ?? 0),
      allowNonPositiveContribution: Boolean(r.policy?.allowNonPositiveContribution),
    },
    previewCases: r.previewCases,
    labels: r.labels as ProductWithPrivate["labels"],
  };
}

export function candidate(raw: W.CandidateWithEconomics | Loose): WireCandidate {
  const c = raw as Loose & W.CandidateWithEconomics;
  return {
    candidateId: String(c.candidateId),
    tierId: String(c.tierId ?? ""),
    tierName: String(c.tierName ?? ""),
    units: String(c.units ?? "0"),
    unitPrice: unitPriceFrom(c, "unitPrice", "unitPriceUsd") ?? { num: "0", den: "1" },
    prepaidTotal: String(c.prepaidTotal ?? "0"),
    overagePrice: unitPriceFrom(c, "overagePrice", "overagePriceUsd"),
    includes: (c.includes as string[]) ?? [],
    supportedIntegrations: (c.supportedIntegrations as string[]) ?? [],
    unsupportedIntegrations: (c.unsupportedIntegrations as string[]) ?? [],
    status: c.status,
    rules: (c.rules as WireCandidate["rules"]) ?? [],
    origin: c.origin ?? "tier",
    origins: c.origins ?? [c.origin ?? "tier"],
    economics: {
      expectedRevenue: String(c.economics?.expectedRevenue ?? "0"),
      expectedVariableCost: String(c.economics?.expectedVariableCost ?? "0"),
      expectedTxCost: String(c.economics?.expectedTxCost ?? "0"),
      allocatedDirectCost: String(c.economics?.allocatedDirectCost ?? "0"),
      expectedContribution: String(c.economics?.expectedContribution ?? "0"),
      expectedContributionMarginBps: String(c.economics?.expectedContributionMarginBps ?? "0"),
      discountBps: String(c.economics?.discountBps ?? "0"),
    },
  };
}

export function overview(raw: W.SellerOverview | Loose): Overview {
  const o = raw as Loose & W.SellerOverview;
  return {
    quotes: Number(o.quotes ?? 0),
    approvalsPending: Number(o.approvalsPending ?? 0),
    dealsFunded: Number(o.dealsFunded ?? 0),
    fundedValue: String(o.fundedValue ?? "0"),
    earnedSettled: String(o.earnedSettled ?? "0"),
    pendingLiability: String(o.pendingLiability ?? "0"),
    refunded: String(o.refunded ?? "0"),
    usageUnits: String(o.usageUnits ?? "0"),
    labels: { network: (o.labels?.network as Overview["labels"]["network"]) ?? "testnet", seller: o.labels?.seller ?? "sandbox" },
  };
}

function buyerLabelOf(r: Loose): string | undefined {
  return str(r.buyerLabel) ?? str(r.buyerName) ?? (str(r.buyerAddress) ? `Buyer ${String(r.buyerAddress).slice(0, 6)}…${String(r.buyerAddress).slice(-4)}` : undefined);
}

export function negotiationSummary(raw: W.NegotiationSummary | Loose): NegotiationSummary {
  const n = raw as Loose;
  const best = str(n.bestOfferTotal) ?? (str(n.bestOfferUsd) ? usdToMicro(String(n.bestOfferUsd)) : undefined);
  return {
    id: String(n.id),
    publicId: String(n.publicId ?? n.id),
    productName: str(n.productName) ?? str(n.productSlug) ?? "",
    buyerLabel: buyerLabelOf(n) ?? `Buyer ${String(n.publicId ?? n.id).slice(-6)}`,
    status: (n.status as NegotiationSummary["status"]) ?? "open",
    updatedAt: String(n.updatedAt ?? n.createdAt ?? ""),
    turns: Number(n.turns ?? 0),
    bestOfferTotal: best,
    needsApproval: Boolean(n.needsApproval ?? n.approvalPending),
  };
}

export function negotiation(raw: W.SellerNegotiation | Loose): NegotiationDetail {
  const n = raw as Loose & W.SellerNegotiation;
  return {
    id: String(n.id),
    publicId: String(n.publicId ?? n.id),
    sellerSlug: String(n.sellerSlug ?? ""),
    productSlug: String(n.productSlug ?? ""),
    productName: str(n.productName),
    buyerLabel: buyerLabelOf(n) ?? `Buyer ${String(n.publicId ?? n.id).slice(-6)}`,
    status: n.status ?? "open",
    requirements: {
      desiredUnits: n.requirements?.desiredUnits,
      budget: n.requirements?.budget,
      integrations: n.requirements?.integrations ?? [],
      openQuestions: n.requirements?.openQuestions ?? [],
      assumptions: n.requirements?.assumptions ?? [],
    },
    turns: (n.turns ?? []).map((t) => ({ id: t.id, role: t.role, content: t.content, createdAt: t.createdAt, kind: t.kind, decision: t.decision ? { decision: t.decision.decision, reasons: t.decision.reasons ?? [] } : undefined })),
    candidates: (n.candidates ?? []).map(candidate),
    decisions: (n.decisions ?? []).map((d) => ({ ...d, ruleIds: (d.ruleIds ?? []) as NegotiationDetail["decisions"][number]["ruleIds"], privateBasis: (d.privateBasis ?? {}) as NegotiationDetail["decisions"][number]["privateBasis"] })),
    agentRuns: n.agentRuns ?? [],
    quotes: (n.quotes as NegotiationDetail["quotes"]) ?? undefined,
  };
}

export function approval(raw: W.Approval | Loose): Approval {
  const a = raw as Loose & W.Approval;
  const offer = a.offer as (Loose & W.Offer) | undefined;
  const econ = a.economics as W.EconomicsWire | undefined;
  const rules = (a.ruleIds ?? a.rules) as Approval["ruleIds"] | undefined;
  return {
    id: String(a.id),
    quoteId: String(a.quoteId ?? ""),
    negotiationId: str(a.negotiationId),
    candidateId: str(a.candidateId) ?? str(offer?.candidateId),
    status: (a.status as Approval["status"]) ?? "pending",
    buyer: buyerLabelOf(a) ?? "Buyer not yet identified",
    buyerAddress: str(a.buyerAddress),
    productName: str(a.productName) ?? "",
    tierName: str(a.tierName) ?? str(offer?.tierName) ?? "Package",
    units: str(a.units) ?? str(offer?.units) ?? "0",
    prepaidTotal: str(a.prepaidTotal) ?? str(offer?.prepaidTotal) ?? "0",
    marginBps: str(a.marginBps) ?? str(econ?.expectedContributionMarginBps),
    floorBps: str(a.floorBps),
    ruleIds: rules ?? (offer?.status === "approval_required" ? ["APPROVAL_THRESHOLD"] : []),
    expiresAt: str(a.expiresAt),
    reason: str(a.reason),
    decidedAt: str(a.decidedAt),
    createdAt: str(a.createdAt),
  };
}

export function dealSummary(raw: W.DealSummary | Loose): DealSummary {
  const d = raw as Loose & W.DealSummary;
  return {
    id: String(d.id),
    publicId: String(d.publicId ?? d.id),
    productName: str(d.productName) ?? str(d.productSlug) ?? "Deal",
    buyerAddress: str(d.buyerAddress),
    status: d.status,
    deposit: String(d.deposit ?? "0"),
    settled: String(d.settled ?? "0"),
    remaining: String(d.remaining ?? "0"),
    createdAt: String(d.createdAt ?? ""),
  };
}

const ACCOUNT_NAMES: Record<string, string> = {
  escrow_usdc: "Escrow USDC (asset)",
  deferred_revenue: "Deferred revenue (liability)",
  revenue: "Revenue earned",
  refunds: "Refunds",
  buyer_refund: "Refunded to buyer",
};
const accountName = (k: string) => ACCOUNT_NAMES[k] ?? k.replace(/_/g, " ").replace(/\busdc\b/gi, "USDC").replace(/^./, (c) => c.toUpperCase());

/** Accepts either per-line entries ({account, debit, credit} amounts) or paired entries ({debit: account, credit: account, amount}). */
export function journal(rows: (W.JournalEntry | Loose)[] | undefined): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const raw of rows ?? []) {
    const j = raw as Loose;
    const base = {
      at: String(j.at ?? ""),
      dealPublicId: str(j.dealPublicId) ?? str(j.publicId),
      memo: String(j.memo ?? j.kind ?? ""),
      txHash: str(j.txHash),
      explorerUrl: str(j.explorerUrl),
    };
    if (str(j.account)) {
      out.push({ id: String(j.id), account: accountName(String(j.account)), debit: isNumStr(j.debit) ? String(j.debit) : "0", credit: isNumStr(j.credit) ? String(j.credit) : "0", ...base });
    } else if (isNumStr(j.amount)) {
      const amt = String(j.amount);
      if (str(j.debit)) out.push({ id: `${j.id}_dr`, account: accountName(String(j.debit)), debit: amt, credit: "0", ...base });
      if (str(j.credit)) out.push({ id: `${j.id}_cr`, account: accountName(String(j.credit)), debit: "0", credit: amt, ...base });
    }
  }
  return out;
}

export function deal(raw: W.SellerDeal | Loose): DealDetail {
  const d = raw as Loose & W.SellerDeal;
  const econ = d.economics as Loose | undefined;
  return {
    id: String(d.id),
    publicId: String(d.publicId ?? d.id),
    status: d.status,
    productName: str((d as Loose).productName),
    chainId: Number(d.chainId ?? 0),
    escrowAddress: String(d.escrowAddress ?? ""),
    usdcAddress: String(d.usdcAddress ?? ""),
    dealIdOnchain: String(d.dealIdOnchain ?? ""),
    terms: (d.terms ?? {}) as unknown as Record<string, string>,
    publicTerms: {
      includes: d.publicTerms?.includes ?? [],
      billableUnit: d.publicTerms?.billableUnit ?? "",
      integrations: d.publicTerms?.integrations ?? [],
      refundPolicy: d.publicTerms?.refundPolicy ?? "",
      termDays: d.publicTerms?.termDays ?? 0,
    },
    signatures: { buyer: String(d.signatures?.buyer ?? ""), seller: String(d.signatures?.seller ?? "") },
    buyerAddress: String(d.buyerAddress ?? ""),
    sellerPayee: String(d.sellerPayee ?? ""),
    funding: d.funding ?? {},
    balances: d.balances ?? { deposit: "0", settled: "0", refunded: "0", remaining: "0", source: "pending" },
    usage: d.usage ?? { units: "0", charged: "0", settled: "0" },
    refundableAt: String(d.refundableAt ?? ""),
    explorer: d.explorer ?? { escrow: "", settlements: [] },
    labels: { network: "testnet", seller: d.labels?.seller ?? "sandbox" },
    economics: econ && econ.expectedRevenue !== undefined ? (econ as DealDetail["economics"]) : undefined,
    journal: journal(d.journal),
    chainTxs: ((d.chainTxs as Loose[] | undefined) ?? []).map((t) => ({ kind: String(t.kind), txHash: String(t.txHash), at: String(t.at ?? ""), amount: str(t.amount), explorerUrl: str(t.explorerUrl), status: str(t.status) })),
    network: str((d as Loose).network),
  };
}

export function finance(raw: W.SellerFinance | Loose): Finance {
  const f = raw as Loose & W.SellerFinance;
  const disc = (f.reconciliation?.discrepancies ?? []) as unknown[];
  return {
    funded: String(f.funded ?? "0"),
    earned: String(f.earned ?? f.settled ?? "0"),
    settled: String(f.settled ?? "0"),
    liability: String(f.liability ?? "0"),
    refunded: String(f.refunded ?? "0"),
    journal: journal(f.journal),
    reconciliation: {
      lastRunAt: str(f.reconciliation?.lastRunAt),
      discrepancies: disc.map((x, i) => (typeof x === "string" ? { id: String(i), summary: x } : { id: str((x as Loose).id) ?? String(i), summary: str((x as Loose).summary) ?? str((x as Loose).message) ?? JSON.stringify(x) })),
    },
  };
}
