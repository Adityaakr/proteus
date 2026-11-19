/**
 * The public seller API sandbox: a fixed demo seller with demo data, served from memory, so anyone can try the seller
 * API from the docs with a published key.
 *
 * Safety, by construction:
 * - This module uses no database, chain, wallet, notification or HTTP client code (a test runs every handler with those
 *   modules replaced by tripwires). It cannot read a real seller's data, touch Arc, move money or call a webhook.
 * - The fixtures are frozen constants. Reads return them; writes are dry runs that run the real API's checks
 *   (seller-api-rules.ts) against the fixtures and answer what would happen, so no visitor can change what another sees.
 * - The key is public and only works here: it is not a psk_test_/psk_live_ key, so the real seller API refuses it, and
 *   the sandbox refuses real keys without reading them further.
 * - The routes are mounted only on the Arc testnet deployment (see index.ts), and the data is labelled testnet.
 */
import { formatUnitPrice, formatUsd, mulDivFloor } from "@proteus/domain";
import { HttpError } from "../lib/http";
import { checkDealOpen, checkDeliveryInput, deliveryInputOf, parseListing, parseOrderStatus, parseOrderUpdateBody, parseTiers, planDelivery, ORDER_LABEL } from "./seller-api-rules";

/** The published sandbox key. Not a secret: it opens only this module's fixtures. */
export const SANDBOX_KEY = "psk_sandbox_demo_seller_testnet_read_only";
/** The sandbox mirrors /v1/seller/* under this prefix (relative to /api). */
export const SANDBOX_PREFIX = "/v1/sandbox/seller";
export const SANDBOX_READ_SCOPES = ["deals:read", "usage:read", "payments:read"] as const;
export const SANDBOX_DRY_RUN_SCOPES = ["products:write", "deliveries:write"] as const;

const ORIGIN = "https://ai.proteus.co.in";
const ORG = { id: "org_sandbox", slug: "sandbox-supply", name: "Sandbox Supply Co. (demo)", label: "sandbox" };
const AT = (d: string) => `2026-11-${d}T10:00:00.000Z`;
const BUYER = "0x1111111111111111111111111111111111111111";
const SELLER = "0x2222222222222222222222222222222222222222";
const PAYEE = "0x3333333333333333333333333333333333333333";
const TX = (n: number) => `0x${String(n).padStart(2, "0").repeat(32)}`;

interface FixtureTier { id: string; name: string; includedUnits: bigint; unitPrice: { num: bigint; den: bigint }; includes: string[] }
interface FixtureProduct { id: string; slug: string; name: string; active: boolean; unitLabel: string; maxUnitsPerDeal: bigint; tiers: FixtureTier[] }
interface FixtureDelivery { requestId: string; units: number; cumulativeUnits: bigint; note: string; at: string }
interface FixtureDeal {
  id: string; publicId: string; productId: string; status: "funded" | "active" | "closed"; dealIdOnchain: string;
  deposit: bigint; settled: bigint; refunded: bigint; maxUnits: bigint; unit: { num: bigint; den: bigint }; createdAt: string;
  deliveries: FixtureDelivery[];
}

const tier = (id: string, name: string, units: number, micro: number, includes: string[] = []): FixtureTier => ({ id, name, includedUnits: BigInt(units), unitPrice: { num: BigInt(micro), den: 1n }, includes });

const PRODUCTS: readonly FixtureProduct[] = Object.freeze([
  { id: "prd_sandbox_tees", slug: "custom-tees", name: "Custom tees", active: true, unitLabel: "tee", maxUnitsPerDeal: 500n, tiers: [tier("starter", "Starter", 1, 6_600_000), tier("bulk", "Bulk", 100, 6_500_000, ["Free sizing samples"])] },
  { id: "prd_sandbox_boxes", slug: "event-merch-box", name: "Event merch box", active: true, unitLabel: "box", maxUnitsPerDeal: 200n, tiers: [tier("team", "Team", 10, 15_000_000, ["Delivery", "Taxes"])] },
]);

const DEALS: readonly FixtureDeal[] = Object.freeze([
  {
    id: "deal_sandbox_active", publicId: "d_sandbox_a1", productId: "prd_sandbox_tees", status: "active", dealIdOnchain: "101",
    deposit: 66_000_000n, settled: 13_200_000n, refunded: 0n, maxUnits: 10n, unit: { num: 6_600_000n, den: 1n }, createdAt: AT("18"),
    deliveries: [{ requestId: "order-2001-batch-1", units: 2, cumulativeUnits: 2n, note: "First two tees shipped by courier", at: AT("19") }],
  },
  {
    id: "deal_sandbox_settled", publicId: "d_sandbox_b2", productId: "prd_sandbox_tees", status: "active", dealIdOnchain: "102",
    deposit: 6_600_000n, settled: 6_600_000n, refunded: 0n, maxUnits: 1n, unit: { num: 6_600_000n, den: 1n }, createdAt: AT("12"),
    deliveries: [{ requestId: "order-1042-shipped", units: 1, cumulativeUnits: 1n, note: "Shipped by courier", at: AT("13") }],
  },
  {
    id: "deal_sandbox_closed", publicId: "d_sandbox_c3", productId: "prd_sandbox_boxes", status: "closed", dealIdOnchain: "103",
    deposit: 300_000_000n, settled: 150_000_000n, refunded: 150_000_000n, maxUnits: 20n, unit: { num: 15_000_000n, den: 1n }, createdAt: AT("02"),
    deliveries: [{ requestId: "boxes-batch-1", units: 10, cumulativeUnits: 10n, note: "Ten boxes delivered to the venue", at: AT("05") }],
  },
]);

/** Ids to try in the docs and the Developers page. */
export const SANDBOX_IDS = { product: PRODUCTS[0]!.id, deal: DEALS[0]!.id, settledDeal: DEALS[1]!.id, closedDeal: DEALS[2]!.id } as const;

/* ---------------------------------------------------------------- auth */

/** Accepts only the public sandbox key. A real key is refused without being looked up, logged or echoed. */
export function sandboxAuth(authorization: string | undefined) {
  const presented = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!presented) throw new HttpError(401, `Send the sandbox key as Authorization: Bearer ${SANDBOX_KEY}.`);
  if (/^psk_(test|live)_/.test(presented)) throw new HttpError(401, "This is a real seller API key. The sandbox takes only the public sandbox key; send your own key to /api/v1/seller instead.");
  if (presented !== SANDBOX_KEY) throw new HttpError(401, `Unknown sandbox key. Use ${SANDBOX_KEY}.`);
}

/* ---------------------------------------------------------------- views (the real API's shapes) */

const productOut = (p: FixtureProduct, tiers: FixtureTier[] = p.tiers, active = p.active) => ({
  id: p.id, slug: p.slug, name: p.name, active, unitLabel: p.unitLabel,
  tiers: tiers.map((t) => ({ id: t.id, name: t.name, includedUnits: t.includedUnits.toString(), unitPriceUsd: formatUnitPrice(t.unitPrice.num, t.unitPrice.den), prepaidTotalUsd: formatUsd(mulDivFloor(t.includedUnits, t.unitPrice.num, t.unitPrice.den)), includes: t.includes })),
  payPerCallUsd: null,
  endpoint: `${ORIGIN}/api/services/${p.slug}/execute`,
  docsUrl: `${ORIGIN}/docs/${ORG.slug}/${p.slug}`,
});

const charged = (d: FixtureDeal, units: bigint) => mulDivFloor(units, d.unit.num, d.unit.den);
const deliveredUnits = (d: FixtureDeal) => d.deliveries.reduce((m, x) => (x.cumulativeUnits > m ? x.cumulativeUnits : m), 0n);
const remaining = (d: FixtureDeal) => d.deposit - d.settled - d.refunded;
/** What the seller pages show: a funded deal whose whole deposit settled reads "settled" (seller-reports.ts). */
const effectiveStatus = (d: FixtureDeal) => ((d.status === "funded" || d.status === "active") && d.settled > 0n && remaining(d) === 0n ? "settled" : d.status);

const dealSummary = (d: FixtureDeal) => ({
  id: d.id, publicId: d.publicId, status: effectiveStatus(d), chainStatus: d.status, buyerAddress: BUYER,
  deposit: d.deposit, settled: d.settled, refunded: d.refunded, remaining: remaining(d), balancesSource: "chain", fundingTxHash: TX(Number(d.dealIdOnchain) - 100), createdAt: d.createdAt,
});

function dealDetail(d: FixtureDeal) {
  const p = PRODUCTS.find((x) => x.id === d.productId)!;
  const units = deliveredUnits(d);
  const fund = TX(Number(d.dealIdOnchain) - 100);
  return {
    id: d.id, publicId: d.publicId, status: effectiveStatus(d), chainStatus: d.status, chainId: 5042002,
    escrowAddress: "0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46", usdcAddress: "0x3600000000000000000000000000000000000000", dealIdOnchain: d.dealIdOnchain,
    terms: { maxUnits: d.maxUnits.toString(), unitPrice: { num: d.unit.num.toString(), den: d.unit.den.toString() }, prepaid: d.deposit.toString(), termDays: 30, graceSeconds: 259200 },
    termsHash: `0x${"ab".repeat(32)}`, buyerAddress: BUYER, sellerAddress: SELLER, sellerPayee: PAYEE,
    funding: { txHash: fund, status: "confirmed", confirmedAt: d.createdAt, explorerUrl: `https://explorer.testnet.arc.io/tx/${fund}` },
    balances: { deposit: d.deposit, settled: d.settled, refunded: d.refunded, remaining: remaining(d), source: "chain" },
    service: { status: "active", endpoint: `/api/services/${p.slug}/execute`, docsUrl: `/docs/${ORG.slug}/${p.slug}`, sellerDelivered: true },
    usage: { units, charged: charged(d, units), accepted: d.settled, acceptedUnits: d.settled / d.unit.num, settled: d.settled, requests: d.deliveries.length, billableRequests: d.deliveries.length },
    createdAt: d.createdAt,
    labels: { network: "testnet", seller: ORG.label, data: "sandbox (demo data, nothing is stored)" },
  };
}

function usage() {
  const rows = DEALS.flatMap((d) => d.deliveries.map((x) => ({ d, x }))).sort((a, b) => b.x.at.localeCompare(a.x.at));
  return {
    totals: { requests: rows.length, delivered: rows.length, handoff: 0, failed: 0, billableUnits: rows.reduce((s, r) => s + r.x.units, 0), avgLatencyMs: 0 },
    requests: rows.map(({ d, x }) => ({
      id: `sr_${x.requestId}`, requestId: x.requestId, dealId: d.id, dealPublicId: d.publicId, buyerAddress: BUYER, productName: PRODUCTS.find((p) => p.id === d.productId)!.name,
      status: "delivered", billable: true, units: x.units, cumulativeUnits: x.cumulativeUnits, cumulativeCharged: charged(d, x.cumulativeUnits), latencyMs: 0, signed: true, at: x.at,
    })),
  };
}

function payments() {
  const sum = (f: (d: FixtureDeal) => bigint) => DEALS.reduce((s, d) => s + f(d), 0n);
  const earnedUnsettled = sum((d) => (charged(d, deliveredUnits(d)) > d.settled ? charged(d, deliveredUnits(d)) - d.settled : 0n));
  return {
    funded: sum((d) => d.deposit), settled: sum((d) => d.settled), earnedUnsettled, liability: sum((d) => d.deposit - d.settled - d.refunded), refunded: sum((d) => d.refunded),
    reconciliation: { lastRunAt: AT("20"), discrepancies: [] },
    labels: { network: "testnet", note: "Deposits are customer liabilities until usage is accepted and settled. Unused balances are never seller revenue." },
  };
}

/* ---------------------------------------------------------------- handlers */

const product = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new HttpError(404, "product not found");
  return p;
};
const deal = (id: string) => {
  const d = DEALS.find((x) => x.id === id);
  if (!d) throw new HttpError(404, "deal not found");
  return d;
};

/** A dry run's answer: what the real endpoint would return and do. Nothing is stored, signed or sent. */
const dryRun = (status: number, wouldReturn: unknown, wouldHappen: string[]) => ({ dryRun: true, persisted: false, status, wouldReturn, wouldHappen });

export type SandboxRequest = { params: Record<string, string>; body: unknown };

/** One handler per seller API route, keyed "METHOD /v1/seller/…" like SELLER_API. */
export const SANDBOX_HANDLERS: Record<string, (req: SandboxRequest) => unknown> = {
  "GET /v1/seller/me": () => ({ orgId: ORG.id, key: { id: "key_sandbox", name: "Public sandbox key", env: "test", scopes: [...SANDBOX_READ_SCOPES] }, network: "testnet", sandbox: { seller: ORG.name, dryRunScopes: [...SANDBOX_DRY_RUN_SCOPES], note: "Demo data. Reads return fixed demo records; writes are dry runs that store nothing." } }),
  "GET /v1/seller/products": () => ({ products: PRODUCTS.map((p) => productOut(p)) }),
  "PATCH /v1/seller/products/:id/tiers": ({ params, body }) => {
    const p = product(params.id!);
    const tiers = parseTiers({ tiers: p.tiers.map((t) => ({ id: t.id })), maxUnitsPerDeal: p.maxUnitsPerDeal.toString() }, (body ?? {}) as { tiers?: unknown });
    const next = tiers.map((t) => ({ id: t.id, name: t.name, includedUnits: BigInt(t.includedUnits), unitPrice: { num: BigInt(t.unitPrice.num), den: 1n }, includes: t.includes }));
    return dryRun(200, productOut(p, next), [
      `Replace the ${p.tiers.length} public price tier${p.tiers.length === 1 ? "" : "s"} of ${p.name} with ${next.length}: ${next.map((t) => `${t.name} from ${t.includedUnits} at ${formatUnitPrice(t.unitPrice.num, t.unitPrice.den)} per ${p.unitLabel}`).join("; ")}.`,
      "New quotes use these prices; deals already signed keep theirs.",
    ]);
  },
  "PATCH /v1/seller/products/:id/listing": ({ params, body }) => {
    const p = product(params.id!);
    const active = parseListing(((body ?? {}) as { active?: unknown }).active);
    return dryRun(200, productOut(p, p.tiers, active), [active ? `List ${p.name} in the market.` : `Hide ${p.name} from the market. Existing deals and keys keep working.`]);
  },
  "GET /v1/seller/deals": () => ({ deals: DEALS.map(dealSummary) }),
  "GET /v1/seller/deals/:id": ({ params }) => dealDetail(deal(params.id!)),
  "POST /v1/seller/deals/:id/deliveries": ({ params, body }) => {
    const input = deliveryInputOf((body ?? {}) as Parameters<typeof deliveryInputOf>[0]);
    const note = checkDeliveryInput(input);
    const d = deal(params.id!);
    checkDealOpen(d.status, "deliveries can be recorded");
    const prepaid = d.deposit;
    const existing = d.deliveries.find((x) => x.requestId === input.requestId);
    if (existing) {
      return dryRun(201, receipt(d, existing.requestId, existing.units, existing.note, existing.cumulativeUnits, input.proofUrl, existing.at), [`requestId ${input.requestId} was already recorded on this deal, so the API returns the first receipt again and records nothing.`]);
    }
    const plan = planDelivery(deliveredUnits(d), BigInt(input.units), { maxUnits: d.maxUnits, unitNum: d.unit.num, unitDen: d.unit.den, prepaid });
    return dryRun(201, receipt(d, input.requestId, input.units, note, plan.cumulativeUnits, input.proofUrl, new Date().toISOString()), [
      `Record ${input.units} delivered unit${input.units === 1 ? "" : "s"} on ${d.publicId}: ${plan.cumulativeUnits} of ${d.maxUnits} in all, ${formatUsd(plan.cumulativeCharged)} of the ${formatUsd(prepaid)} prepaid.`,
      "Sign the receipt with the seller signer so the buyer can check it before countersigning.",
      "Nothing is paid until the buyer countersigns the cumulative total; then the relayer settles it on Arc.",
    ]);
  },
  "POST /v1/seller/deals/:id/order-updates": ({ params, body }) => {
    const b = (body ?? {}) as { status?: unknown; note?: unknown; trackingUrl?: unknown };
    const status = parseOrderStatus(b);
    const d = deal(params.id!);
    checkDealOpen(d.status, "updates can be posted");
    const data = parseOrderUpdateBody(status, b);
    return dryRun(201, { id: "du_dry_run", status, label: ORDER_LABEL[status] }, [
      `Post "${ORDER_LABEL[status]}" to the buyer's order page for ${d.publicId}${data.note ? ` with the note "${data.note}"` : ""}${data.url ? " and a tracking link" : ""}.`,
      "Alert the buyer on the channels they chose for this deal (webhook, Telegram or email).",
    ]);
  },
  "GET /v1/seller/usage": () => usage(),
  "GET /v1/seller/payments": () => payments(),
};

function receipt(d: FixtureDeal, requestId: string, units: number, note: string, cumulativeUnits: bigint, proofUrl: string | undefined, at: string) {
  const cumulativeCharged = charged(d, cumulativeUnits);
  return {
    requestId, status: "delivered", billable: true, units, answer: note,
    source: { store: "seller-confirmed", fields: proofUrl ? ["proofUrl"] : [], proofUrl: proofUrl ?? null, confirmedBy: "api-key:key_sandbox" },
    receipt: { digest: null, sellerSignature: null, at },
    chargedCumulative: cumulativeCharged, createdAt: at, answerPreview: note.slice(0, 120),
    deal: { cumulativeUnits, cumulativeCharged, remaining: d.deposit - cumulativeCharged },
    latencyMs: 0,
    labels: { data: "sandbox (dry run: not signed or stored)", network: "testnet" },
  };
}
