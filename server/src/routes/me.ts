import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { revokeOrgSigner, signerView, sweepCollector } from "../chain/signer";
import { json } from "../lib/http";
import { createOrg, createProduct, issueLinkNonce, linkWallet, setPrimaryWallet, marketList, marketSellers, meView, myActivity, myDeals, myNegotiations, userOrg, walletView, type ProductCreateInput } from "../services/accounts";
import { auth, requireAuth } from "./auth";
import { requireSession, session } from "./session";
import { CATEGORIES, updateBrand } from "../services/brand";
import { confirmRegistration, registrationInputs } from "../services/agent-registry";
import { publishAllLatest } from "../services/policy-commit";
import { embedSettings, setEmbedDomains } from "../services/embed";
import { saveSettings as saveNotifySettings, sendTest as sendTestNotification, settingsView as notifySettings } from "../services/notify";
import { env } from "../env";

export const meRoutes = new Hono();

meRoutes.get("/market", async (c) => json(c, await marketList()));
meRoutes.get("/market/sellers", async (c) => json(c, await marketSellers()));
meRoutes.get("/market/categories", (c) => json(c, CATEGORIES));

meRoutes.use("/me", requireAuth);
meRoutes.use("/me/*", requireAuth);
meRoutes.use("/orgs", requireAuth);

meRoutes.get("/me", async (c) => json(c, await meView(auth(c).userId)));
meRoutes.patch("/me", async (c) => {
  const b = z.object({ mode: z.enum(["buy", "sell"]) }).parse(await c.req.json());
  await db.update(schema.users).set({ mode: b.mode }).where(eq(schema.users.id, auth(c).userId));
  return json(c, await meView(auth(c).userId));
});
meRoutes.get("/me/wallet", async (c) => json(c, await walletView(auth(c).userId)));
meRoutes.get("/me/wallets/nonce", async (c) => json(c, { nonce: issueLinkNonce(auth(c).userId), message: "Sign: PROTEUS wallet link\\naddress: <address>\\nnonce: <nonce>" }));

const LinkBody = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), kind: z.enum(["embedded", "external"]).default("embedded"), nonce: z.string().min(4), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) });
meRoutes.post("/me/wallets/link", async (c) => {
  const b = LinkBody.parse(await c.req.json());
  return json(c, await linkWallet(auth(c).userId, b.address as Address, b.kind, b.nonce, b.signature as Hex));
});

meRoutes.patch("/me/wallets/primary", async (c) => {
  const b = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }).parse(await c.req.json());
  return json(c, await setPrimaryWallet(auth(c).userId, b.address as Address));
});

meRoutes.get("/me/negotiations", async (c) => json(c, await myNegotiations(auth(c).userId)));
meRoutes.get("/me/deals", async (c) => json(c, await myDeals(auth(c).userId)));
meRoutes.get("/me/activity", async (c) => json(c, await myActivity(auth(c).userId)));

const BrandBody = z.object({ logoUrl: z.string().max(100_000).optional(), markUrl: z.string().max(100_000).optional(), tagline: z.string().max(140).optional(), category: z.string().max(32).optional(), website: z.string().max(200).optional(), accent: z.string().max(7).optional(), socials: z.object({ x: z.string().max(200).optional(), instagram: z.string().max(200).optional(), farcaster: z.string().max(200).optional() }).optional() });
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

/* Embedded deal agent: which sites may show it. */
meRoutes.get("/app/notifications", requireSession, async (c) => json(c, await notifySettings(session(c).orgId)));
meRoutes.put("/app/notifications", requireSession, async (c) => {
  const b = z.object({ email: z.string().max(254).nullable().optional(), telegramChatId: z.string().max(24).nullable().optional(), webhookUrl: z.string().max(500).nullable().optional() }).parse(await c.req.json());
  return json(c, await saveNotifySettings(session(c).orgId, b));
});
meRoutes.post("/app/notifications/test", requireSession, async (c) => json(c, await sendTestNotification(session(c).orgId)));
meRoutes.get("/app/embed", requireSession, async (c) => json(c, await embedSettings(session(c).orgId)));
meRoutes.put("/app/embed", requireSession, async (c) => {
  const { domains } = z.object({ domains: z.array(z.string().max(200)).max(10) }).parse(await c.req.json());
  return json(c, await setEmbedDomains(session(c).orgId, domains));
});

/* ERC-8004 identity on Arc: the seller's own wallet registers; the server only prepares inputs and confirms from the chain. */
const publicOrigin = (c: { req: { url: string } }) => env.WEB_ORIGIN || new URL(c.req.url).origin;
meRoutes.get("/app/agent", requireSession, async (c) => json(c, await registrationInputs(session(c).orgId, publicOrigin(c))));
meRoutes.post("/app/agent/confirm", requireSession, async (c) => {
  const { txHash } = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).parse(await c.req.json());
  const confirmed = await confirmRegistration(session(c).orgId, txHash as Hex);
  // Now that the seller's signer is published on chain, commit each product's current policy version to ProteusPolicyRegistry.
  const policies = await publishAllLatest(session(c).orgId);
  return json(c, { ...confirmed, policies });
});

const Units = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((v) => String(v));
const Tier = z.object({ name: z.string().min(1), includedUnits: Units, unitPriceUsd: z.string().regex(/^\d+(\.\d+)?$/), includes: z.array(z.string()).default([]) });
const ProductBody = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().optional(),
  unitLabel: z.string().min(1).max(30),
  billableUnit: z.string().min(5).max(300),
  capabilities: z.array(z.string()).default([]),
  supportedIntegrations: z.array(z.string()).default([]),
  tiers: z.array(Tier).min(1),
  maxUnitsPerDeal: Units,
  termDays: z.number().int().min(1).max(365),
  refundPolicy: z.string().min(5).max(500),
  cost: z.object({ variableCostPerUnitUsd: z.string().regex(/^\d+(\.\d+)?$/), directCostPerDealUsd: z.string().regex(/^\d+(\.\d+)?$/).default("0"), txCostBps: z.number().int().min(0).max(10000).default(50) }),
  policy: z.object({ minMarginBps: z.number().int().min(0).max(10000), maxDiscountBps: z.number().int().min(0).max(10000), approvalThresholdUsd: z.string().regex(/^\d+(\.\d+)?$/), prepaidMinimumUsd: z.string().regex(/^\d+(\.\d+)?$/), availableCapacityUnits: Units, quoteTtlSeconds: z.number().int().min(60).max(7 * 86400).default(6 * 3600) }),
  payPerCall: z.object({ priceUsd: z.string().regex(/^\d+(\.\d+)?$/) }).optional(),
  summary: z.string().max(160).optional(),
  category: z.string().max(32).optional(),
  request: z.object({ intro: z.string().max(200).optional(), fields: z.array(z.object({ key: z.string().max(32).optional(), label: z.string().min(1).max(60), type: z.enum(["text", "textarea", "number", "file"]), required: z.boolean().optional(), placeholder: z.string().max(120).optional(), hint: z.string().max(160).optional() })).max(6) }).optional(),
  adapter: z.enum(["http", "order-support"]).optional(),
  upstream: z.object({ url: z.string().min(8).max(2048), authHeader: z.string().max(64).optional(), secret: z.string().max(4096).optional() }).optional(),
});
meRoutes.post("/app/products", requireSession, async (c) => {
  const b = ProductBody.parse(await c.req.json()) as ProductCreateInput;
  const productId = await createProduct(session(c).orgId, b);
  return json(c, { id: productId }, 201);
});

export { userOrg };
