import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { revokeOrgSigner, signerView, sweepCollector } from "../chain/signer";
import { json } from "../lib/http";
import { createOrg, createProduct, issueLinkNonce, linkWallet, marketList, marketSellers, meView, myActivity, myDeals, myNegotiations, userOrg, walletView, type ProductCreateInput } from "../services/accounts";
import { auth, requireAuth } from "./auth";
import { requireSession, session } from "./session";
import { CATEGORIES, updateBrand } from "../services/brand";

export const meRoutes = new Hono();

meRoutes.get("/market", async (c) => json(c, await marketList()));
meRoutes.get("/market/sellers", async (c) => json(c, await marketSellers()));
meRoutes.get("/market/categories", (c) => json(c, CATEGORIES));

meRoutes.use("/me", requireAuth);
meRoutes.use("/me/*", requireAuth);
meRoutes.use("/orgs", requireAuth);

meRoutes.get("/me", async (c) => json(c, await meView(auth(c).userId)));
meRoutes.get("/me/wallet", async (c) => json(c, await walletView(auth(c).userId)));
meRoutes.get("/me/wallets/nonce", async (c) => json(c, { nonce: issueLinkNonce(auth(c).userId), message: "Sign: PROTEUS wallet link\\naddress: <address>\\nnonce: <nonce>" }));

const LinkBody = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), kind: z.enum(["embedded", "external"]).default("embedded"), nonce: z.string().min(4), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) });
meRoutes.post("/me/wallets/link", async (c) => {
  const b = LinkBody.parse(await c.req.json());
  return json(c, await linkWallet(auth(c).userId, b.address as Address, b.kind, b.nonce, b.signature as Hex));
});

meRoutes.get("/me/negotiations", async (c) => json(c, await myNegotiations(auth(c).userId)));
meRoutes.get("/me/deals", async (c) => json(c, await myDeals(auth(c).userId)));
meRoutes.get("/me/activity", async (c) => json(c, await myActivity(auth(c).userId)));

const BrandBody = z.object({ logoUrl: z.string().max(100_000).optional(), tagline: z.string().max(140).optional(), category: z.string().max(32).optional(), website: z.string().max(200).optional(), accent: z.string().max(7).optional() });
const OrgBody = z.object({ name: z.string().min(2).max(80), slug: z.string().min(2).max(40).optional(), brand: BrandBody.optional() });
meRoutes.post("/orgs", async (c) => {
  const b = OrgBody.parse(await c.req.json());
  return json(c, await createOrg(auth(c).userId, b.name, b.slug, b.brand), 201);
});
meRoutes.patch("/app/org", requireSession, async (c) => {
  const b = z.object({ name: z.string().min(2).max(80).optional(), brand: BrandBody.optional() }).parse(await c.req.json());
  return json(c, await updateBrand(session(c).orgId, b));
});

/* Seller-side additions (session = privy org owner or sandbox cookie) */
meRoutes.get("/app/signer", requireSession, async (c) => json(c, await signerView(session(c).orgId)));
meRoutes.post("/app/signer/revoke", requireSession, async (c) => json(c, await revokeOrgSigner(session(c).orgId)));
meRoutes.post("/app/signer/sweep", requireSession, async (c) => json(c, await sweepCollector(session(c).orgId)));

const Tier = z.object({ name: z.string().min(1), includedUnits: z.string().regex(/^\d+$/), unitPriceUsd: z.string().regex(/^\d+(\.\d+)?$/), includes: z.array(z.string()).default([]) });
const ProductBody = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().optional(),
  unitLabel: z.string().min(1).max(30),
  billableUnit: z.string().min(5).max(300),
  capabilities: z.array(z.string()).default([]),
  supportedIntegrations: z.array(z.string()).default([]),
  tiers: z.array(Tier).min(1),
  maxUnitsPerDeal: z.string().regex(/^\d+$/),
  termDays: z.number().int().min(1).max(365),
  refundPolicy: z.string().min(5).max(500),
  cost: z.object({ variableCostPerUnitUsd: z.string().regex(/^\d+(\.\d+)?$/), directCostPerDealUsd: z.string().regex(/^\d+(\.\d+)?$/).default("0"), txCostBps: z.number().int().min(0).max(10000).default(50) }),
  policy: z.object({ minMarginBps: z.number().int().min(0).max(10000), maxDiscountBps: z.number().int().min(0).max(10000), approvalThresholdUsd: z.string().regex(/^\d+(\.\d+)?$/), prepaidMinimumUsd: z.string().regex(/^\d+(\.\d+)?$/), availableCapacityUnits: z.string().regex(/^\d+$/), quoteTtlSeconds: z.number().int().min(60).max(7 * 86400).default(6 * 3600) }),
  payPerCall: z.object({ priceUsd: z.string().regex(/^\d+(\.\d+)?$/) }).optional(),
  summary: z.string().max(160).optional(),
  category: z.string().max(32).optional(),
  adapter: z.enum(["http", "order-support"]).optional(),
  upstream: z.object({ url: z.string().min(8).max(2048), authHeader: z.string().max(64).optional(), secret: z.string().max(4096).optional() }).optional(),
});
meRoutes.post("/app/products", requireSession, async (c) => {
  const b = ProductBody.parse(await c.req.json()) as ProductCreateInput;
  const productId = await createProduct(session(c).orgId, b);
  return json(c, { id: productId }, 201);
});

export { userOrg };
