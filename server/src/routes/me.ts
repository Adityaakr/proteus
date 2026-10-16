import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { revokeOrgSigner, signerView, sweepCollector } from "../chain/signer";
import { json } from "../lib/http";
import { createOrg, createProduct, issueLinkNonce, linkWallet, marketList, meView, myActivity, myDeals, myNegotiations, userOrg, walletView, type ProductCreateInput } from "../services/accounts";
import { auth, requireAuth } from "./auth";
import { requireSession, session } from "./session";

export const meRoutes = new Hono();

meRoutes.get("/market", async (c) => json(c, await marketList()));

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

const OrgBody = z.object({ name: z.string().min(2).max(80), slug: z.string().min(2).max(40).optional() });
meRoutes.post("/orgs", async (c) => {
  const b = OrgBody.parse(await c.req.json());
  return json(c, await createOrg(auth(c).userId, b.name, b.slug), 201);
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
  adapter: z.string().optional(),
});
meRoutes.post("/app/products", requireSession, async (c) => {
  const b = ProductBody.parse(await c.req.json()) as ProductCreateInput;
  const productId = await createProduct(session(c).orgId, b);
  return json(c, { id: productId }, 201);
});

export { userOrg };
