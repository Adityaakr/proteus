import { and, desc, eq, inArray } from "drizzle-orm";
import { verifyMessage, type Address, type Hex } from "viem";
import { formatUsd, toMicro } from "@proteus/domain";
import { ensureOrgSigner } from "../chain/signer";
import { erc20Abi } from "../chain/abi";
import { publicClient, usdcAddress } from "../chain/client";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError, bigintsToStrings } from "../lib/http";
import { id, publicId } from "../lib/ids";
import { loadProductById, publicProduct } from "./catalog";
import { listDeals } from "./deals";
import { listNegotiations } from "./negotiation";

const LINK_NONCES = new Map<string, { nonce: string; expires: number }>();

export function linkMessage(address: string, nonce: string) {
  return `PROTEUS wallet link\naddress: ${address.toLowerCase()}\nnonce: ${nonce}`;
}

export function issueLinkNonce(userId: string) {
  const nonce = id("n", 16);
  LINK_NONCES.set(userId, { nonce, expires: Date.now() + 10 * 60_000 });
  return nonce;
}

export async function linkWallet(userId: string, address: Address, kind: "embedded" | "external", nonce: string, signature: Hex) {
  const n = LINK_NONCES.get(userId);
  if (!n || n.nonce !== nonce || n.expires < Date.now()) throw new HttpError(400, "link nonce missing or expired; request a new one");
  const ok = await verifyMessage({ address, message: linkMessage(address, nonce), signature });
  if (!ok) throw new HttpError(400, "signature does not prove control of that address");
  LINK_NONCES.delete(userId);
  const existing = await db.select().from(schema.walletLinks).where(eq(schema.walletLinks.userId, userId));
  const primary = existing.length === 0 || kind === "embedded";
  if (primary) await db.update(schema.walletLinks).set({ primary: false }).where(eq(schema.walletLinks.userId, userId));
  await db
    .insert(schema.walletLinks)
    .values({ id: id("wl"), userId, address: address.toLowerCase(), kind, primary, proof: signature })
    .onConflictDoUpdate({ target: [schema.walletLinks.userId, schema.walletLinks.address], set: { kind, primary, proof: signature } });
  return meView(userId);
}

export async function userWallets(userId: string) {
  return db.select().from(schema.walletLinks).where(eq(schema.walletLinks.userId, userId)).orderBy(desc(schema.walletLinks.primary), desc(schema.walletLinks.createdAt));
}

export async function userOrg(userId: string) {
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, userId));
  if (!m) return undefined;
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, m.orgId));
  return org ? { ...org, role: m.role } : undefined;
}

export async function meView(userId: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw new HttpError(404, "user not found");
  const wallets = await userWallets(userId);
  const org = await userOrg(userId);
  return {
    userId: u.id,
    email: u.email,
    wallets: wallets.map((w) => ({ address: w.address, kind: w.kind, primary: w.primary })),
    org: org ? { id: org.id, slug: org.slug, name: org.name, label: org.label, role: org.role, payee: org.payeeAddress } : undefined,
    labels: { network: "testnet", note: "Arc testnet. Testnet USDC has no value." },
  };
}

export async function walletView(userId: string) {
  const wallets = await userWallets(userId);
  const primary = wallets.find((w) => w.primary) ?? wallets[0];
  if (!primary) return { address: null, usdc: "0", native: "0", faucetUrl: "https://faucet.circle.com", chainId: env.CHAIN_ID, explorerUrl: null };
  const address = primary.address as Address;
  const [usdc, native] = await Promise.all([
    publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
    publicClient.getBalance({ address }),
  ]);
  return { address, usdc, usdcUsd: formatUsd(usdc), native: native.toString(), faucetUrl: "https://faucet.circle.com", chainId: env.CHAIN_ID, explorerUrl: `https://explorer.testnet.arc.io/address/${address}`, labels: { network: "testnet" } };
}

export async function myNegotiations(userId: string) {
  const wallets = (await userWallets(userId)).map((w) => w.address);
  const rows = await db.select().from(schema.negotiations).where(wallets.length ? inArray(schema.negotiations.buyerAddress, wallets) : eq(schema.negotiations.id, "__none__")).orderBy(desc(schema.negotiations.updatedAt)).limit(100);
  const out = [];
  for (const n of rows) {
    const lp = await loadProductById(n.productId);
    const cands = (n.candidates as Record<string, unknown>[]) ?? [];
    out.push({ id: n.id, publicId: n.publicId, status: n.status, sellerSlug: lp.org.slug, sellerName: lp.org.name, productSlug: lp.product.slug, productName: lp.product.name, offers: cands.filter((c) => c.status !== "rejected").length, updatedAt: n.updatedAt, createdAt: n.createdAt });
  }
  return out;
}

export async function myDeals(userId: string) {
  const wallets = (await userWallets(userId)).map((w) => w.address);
  const rows = await db.select().from(schema.deals).where(wallets.length ? inArray(schema.deals.buyerAddress, wallets) : eq(schema.deals.id, "__none__")).orderBy(desc(schema.deals.createdAt)).limit(100);
  const out = [];
  for (const d of rows) {
    const lp = await loadProductById(d.productId);
    out.push({ id: d.id, publicId: d.publicId, status: d.status, sellerName: lp.org.name, productName: lp.product.name, deposit: d.deposit, settled: d.settled, refunded: d.refunded, remaining: d.deposit - d.settled - d.refunded, balancesSource: d.balancesSource, createdAt: d.createdAt });
  }
  return out;
}

export async function myActivity(userId: string) {
  const wallets = (await userWallets(userId)).map((w) => w.address);
  const negotiations = await myNegotiations(userId);
  const deals = await myDeals(userId);
  const ppc = wallets.length ? await db.select().from(schema.payPerCallPayments).where(and(inArray(schema.payPerCallPayments.payer, wallets), eq(schema.payPerCallPayments.status, "settled"))) : [];
  const org = await userOrg(userId);
  const sell = org ? { negotiations: (await listNegotiations(org.id)).length, deals: await listDeals(org.id) } : undefined;
  return { negotiations, deals, payPerCall: { calls: ppc.length, spent: ppc.reduce((s, p) => s + p.amount, 0n) }, sell: sell ? { negotiations: sell.negotiations, dealsFunded: sell.deals.filter((d) => d.deposit > 0n).length, settled: sell.deals.reduce((s, d) => s + d.settled, 0n) } : undefined };
}

/** Does this user control the deal's buyer address? */
export async function userOwnsAddress(userId: string, address: string) {
  const wallets = await userWallets(userId);
  return wallets.some((w) => w.address.toLowerCase() === address.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Orgs and products                                                    */
/* ------------------------------------------------------------------ */

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "seller";
}

export async function createOrg(userId: string, name: string, slug?: string) {
  if (await userOrg(userId)) throw new HttpError(409, "you already have a seller account");
  const wallets = await userWallets(userId);
  const payee = wallets.find((w) => w.primary)?.address;
  if (!payee) throw new HttpError(409, "link a wallet first; payouts need a payee address");
  let s = slugify(slug ?? name);
  const taken = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, s));
  if (taken.length) s = `${s}-${id("", 3).replace("_", "")}`;
  const orgId = id("org");
  await db.insert(schema.orgs).values({ id: orgId, slug: s, name, label: "live", ownerAddress: payee, ownerUserId: userId, sellerSignerAddress: "0x0000000000000000000000000000000000000000", payeeAddress: payee });
  await db.insert(schema.memberships).values({ id: id("mem"), userId, orgId, role: "owner" });
  await ensureOrgSigner(orgId);
  const org = await userOrg(userId);
  return { id: orgId, slug: s, name, label: "live", role: "owner", payee, signer: org?.sellerSignerAddress };
}

export interface ProductCreateInput {
  name: string;
  slug?: string;
  unitLabel: string;
  billableUnit: string;
  capabilities: string[];
  supportedIntegrations: string[];
  tiers: { name: string; includedUnits: string; unitPriceUsd: string; includes: string[] }[];
  maxUnitsPerDeal: string;
  termDays: number;
  refundPolicy: string;
  cost: { variableCostPerUnitUsd: string; directCostPerDealUsd: string; txCostBps: number };
  policy: { minMarginBps: number; maxDiscountBps: number; approvalThresholdUsd: string; prepaidMinimumUsd: string; availableCapacityUnits: string; quoteTtlSeconds: number };
  payPerCall?: { priceUsd: string };
  adapter?: string;
}

export async function createProduct(orgId: string, input: ProductCreateInput) {
  if (!input.tiers.length) throw new HttpError(400, "at least one tier is required");
  const productId = id("prod");
  const slug = slugify(input.slug ?? input.name);
  const pub = {
    id: productId,
    slug,
    name: input.name,
    billableUnit: input.billableUnit,
    unitLabel: input.unitLabel,
    supportedIntegrations: input.supportedIntegrations,
    capabilities: input.capabilities,
    tiers: input.tiers.map((t, i) => ({ id: slugify(t.name) || `tier-${i}`, name: t.name, includedUnits: t.includedUnits, unitPrice: { num: toMicro(t.unitPriceUsd).toString(), den: "1" }, includes: t.includes })),
    maxUnitsPerDeal: input.maxUnitsPerDeal,
    termDays: input.termDays,
    refundPolicy: input.refundPolicy,
  };
  await db.insert(schema.products).values({ id: productId, orgId, slug, public: pub, starters: [`We need about ${input.tiers[0]!.includedUnits} ${input.unitLabel}s a month. What can you offer?`], adapter: input.adapter ?? "order-support", payPerCallPrice: input.payPerCall ? toMicro(input.payPerCall.priceUsd) : null });
  await db.insert(schema.costModels).values({ id: id("cost"), orgId, productId, version: 1, variableCostPerUnit: toMicro(input.cost.variableCostPerUnitUsd), directCostPerDeal: toMicro(input.cost.directCostPerDealUsd), txCostBps: input.cost.txCostBps, freshUntil: new Date(Date.now() + 30 * 86400 * 1000) });
  await db.insert(schema.policies).values({ id: id("pol"), orgId, productId, version: 1, minMarginBps: input.policy.minMarginBps, maxDiscountBps: input.policy.maxDiscountBps, approvalThreshold: toMicro(input.policy.approvalThresholdUsd), prepaidMinimum: toMicro(input.policy.prepaidMinimumUsd), availableCapacityUnits: BigInt(input.policy.availableCapacityUnits), quoteTtlSeconds: input.policy.quoteTtlSeconds });
  // Give new sellers the same labeled sample store so the service endpoint works immediately.
  const samples = await db.select().from(schema.sampleOrders).where(eq(schema.sampleOrders.orgId, orgId));
  if (!samples.length) {
    const [sandbox] = await db.select().from(schema.orgs).where(eq(schema.orgs.label, "sandbox"));
    if (sandbox) {
      const rows = await db.select().from(schema.sampleOrders).where(eq(schema.sampleOrders.orgId, sandbox.id));
      for (const r of rows) await db.insert(schema.sampleOrders).values({ ...r, id: id("ord"), orgId, orderId: `${r.orderId}-${slug.slice(0, 4).toUpperCase()}` }).onConflictDoNothing();
    }
  }
  return productId;
}

/** Public market listing across sellers. */
export async function marketList() {
  const rows = await db.select().from(schema.products).where(eq(schema.products.active, true));
  const out = [];
  for (const r of rows) {
    const lp = await loadProductById(r.id);
    const pub = publicProduct(lp);
    out.push({ sellerSlug: lp.org.slug, sellerName: lp.org.name, sellerLabel: lp.org.label, productSlug: pub.slug, name: pub.name, unitLabel: pub.unitLabel, capabilities: pub.capabilities, startingTierUsd: pub.tiers[0]?.prepaidTotalUsd ?? null, perCallUsd: r.payPerCallPrice ? formatUsd(r.payPerCallPrice, 4) : null, ...bigintsToStrings({}) });
  }
  return out;
}

export { publicId };
