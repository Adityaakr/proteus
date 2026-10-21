/**
 * ERC-8004 seller identity on Arc. Each seller's negotiating agent can be registered on Arc's IdentityRegistry,
 * owned by the seller's own wallet, with on-chain metadata naming its payee and its delegated Terms signer.
 * Proteus only serves the registration file and reads the chain; it never owns, operates or writes the identity.
 *
 * Before quoting, a registered seller's identity is checked against what Proteus is about to sign:
 * ownerOf(agentId) must still be the confirmed owner, and the on-chain payee and signer must equal Terms.payee and
 * Terms.seller. On a mismatch the quote is refused, so the chain, not Proteus' database, has the last word.
 */
import { and, eq } from "drizzle-orm";
import { getAddress, isAddressEqual, parseEventLogs, type Address, type Hex } from "viem";
import { AGENT_METADATA_KEYS, IDENTITY_REGISTRY_ABI, agentRegistryId, erc8004For, policyRegistryFor, productIdHash } from "@proteus/domain";
import { db, schema } from "../db";
import { env } from "../env";
import { HttpError } from "../lib/http";
import { publicClient } from "../chain/client";
import { ensureOrgSigner } from "../chain/signer";

type Org = typeof schema.orgs.$inferSelect;

const registry = () => erc8004For(env.CHAIN_ID).identity as Address;
/** Metadata values are the raw 20 address bytes, lowercase hex. */
const addrBytes = (a: string): Hex => getAddress(a).toLowerCase() as Hex;

export function agentURIFor(org: Pick<Org, "slug">, origin: string): string {
  return `${origin}/api/public/sellers/${org.slug}/agent.json`;
}

/** ERC-8004 registration file (type registration-v1) for a seller's agent. */
export async function registrationFile(slug: string, origin: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, slug));
  if (!org) throw new HttpError(404, "seller not found");
  const products = await db.select().from(schema.products).where(eq(schema.products.orgId, org.id));
  const brand = (org.brand as { logoUrl?: string; tagline?: string; website?: string } | null) ?? {};
  const image = brand.logoUrl && /^https:\/\//.test(brand.logoUrl) ? brand.logoUrl : brand.logoUrl?.startsWith("/") ? `${origin}${brand.logoUrl}` : undefined;
  const tagline = brand.tagline?.trim().replace(/[.!\s]+$/, "");
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: `${org.name} deal agent`,
    description: `${tagline ? `${tagline}. ` : ""}Negotiates within ${org.name}'s own pricing rules on Proteus AI; deals are prepaid in USDC into escrow on Arc and paid only for delivered units.`,
    ...(image ? { image } : {}),
    services: [
      { name: "web", endpoint: `${origin}/market/${org.slug}` },
      { name: "agent-skill", endpoint: `${origin}/api/public/agents/skill.md` },
      ...products.map((p) => ({ name: `openapi:${p.slug}`, endpoint: `${origin}/api/public/sellers/${org.slug}/products/${p.slug}/openapi.json` })),
      ...(brand.website ? [{ name: "website", endpoint: brand.website }] : []),
    ],
    x402Support: true,
    active: org.label === "live",
    registrations: org.agentId ? [{ agentId: Number(org.agentId), agentRegistry: agentRegistryId(env.CHAIN_ID) }] : [],
    supportedTrust: ["reputation"],
    // Proteus-specific, informative only; the authoritative values are the on-chain metadata keys.
    proteus: {
      escrow: env.ESCROW_ADDRESS ?? null,
      payee: org.payeeAddress,
      signer: org.sellerSignerAddress,
      signerCustody: "proteus-delegated",
      metadataKeys: AGENT_METADATA_KEYS,
    },
  };
}

/** What the seller's wallet passes to register(agentURI, metadata[]): one transaction, one prompt. */
export async function registrationInputs(orgId: string, origin: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "seller not found");
  if (org.label !== "live" || !org.ownerAddress) throw new HttpError(409, "Only a live seller with an owner wallet can register on Arc.");
  const signer = (await ensureOrgSigner(orgId)).address;
  return {
    chainId: env.CHAIN_ID,
    registry: registry(),
    agentURI: agentURIFor(org, origin),
    owner: getAddress(org.ownerAddress),
    payee: getAddress(org.payeeAddress),
    signer,
    metadata: [
      { metadataKey: AGENT_METADATA_KEYS.payee, metadataValue: addrBytes(org.payeeAddress) },
      { metadataKey: AGENT_METADATA_KEYS.signer, metadataValue: addrBytes(signer) },
    ],
    registered: org.agentId ? { agentId: org.agentId, owner: org.agentOwner, tx: org.agentRegisteredTx } : null,
  };
}

const readMetaAddress = async (agentId: bigint, key: string): Promise<Address | null> => {
  const v = (await publicClient.readContract({ address: registry(), abi: IDENTITY_REGISTRY_ABI, functionName: "getMetadata", args: [agentId, key] })) as Hex;
  return v && v.length === 42 ? getAddress(v) : null;
};

/** Reads the registration transaction from the chain and stores the agentId, after checking owner, payee and signer. */
export async function confirmRegistration(orgId: string, txHash: Hex) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "seller not found");
  if (!org.ownerAddress) throw new HttpError(409, "This seller has no owner wallet.");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (receipt.status !== "success") throw new HttpError(409, "The registration transaction reverted on chain.");
  const [ev] = parseEventLogs({ abi: IDENTITY_REGISTRY_ABI, eventName: "Registered", logs: receipt.logs.filter((l) => isAddressEqual(l.address, registry())) });
  if (!ev) throw new HttpError(409, "No ERC-8004 Registered event from the Arc IdentityRegistry in that transaction.");
  const agentId = ev.args.agentId;
  const owner = (await publicClient.readContract({ address: registry(), abi: IDENTITY_REGISTRY_ABI, functionName: "ownerOf", args: [agentId] })) as Address;
  if (!isAddressEqual(owner, getAddress(org.ownerAddress))) throw new HttpError(409, `The agent is owned by ${owner}, not this seller's owner wallet ${org.ownerAddress}.`);
  const [payee, signer] = await Promise.all([readMetaAddress(agentId, AGENT_METADATA_KEYS.payee), readMetaAddress(agentId, AGENT_METADATA_KEYS.signer)]);
  if (!payee || !isAddressEqual(payee, getAddress(org.payeeAddress))) throw new HttpError(409, "The on-chain payee does not match this seller's payout address.");
  if (!signer || !isAddressEqual(signer, getAddress(org.sellerSignerAddress))) throw new HttpError(409, "The on-chain signer does not match this seller's current signer.");
  await db.update(schema.orgs).set({ agentId: agentId.toString(), agentOwner: owner, agentRegisteredTx: txHash }).where(and(eq(schema.orgs.id, orgId)));
  bindingCache.delete(orgId);
  return { agentId: agentId.toString(), owner, payee, signer, tx: txHash };
}

/* ---------------------------------------------------------------- quote-time check */

const bindingCache = new Map<string, { at: number; ok: true } | { at: number; ok: false; reason: string }>();
const TTL_MS = 60_000;

/**
 * For a registered seller: refuse to quote unless the chain still says this owner, this payee and this signer.
 * Unregistered sellers pass (registration is optional). A chain read failure does not block quoting.
 */
export async function assertAgentBinding(org: Org): Promise<void> {
  if (!org.agentId) return;
  const hit = bindingCache.get(org.id);
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (!hit.ok) throw new HttpError(409, hit.reason);
    return;
  }
  let reason: string | null = null;
  try {
    const id = BigInt(org.agentId);
    const [owner, payee, signer] = await Promise.all([
      publicClient.readContract({ address: registry(), abi: IDENTITY_REGISTRY_ABI, functionName: "ownerOf", args: [id] }) as Promise<Address>,
      readMetaAddress(id, AGENT_METADATA_KEYS.payee),
      readMetaAddress(id, AGENT_METADATA_KEYS.signer),
    ]);
    if (org.agentOwner && !isAddressEqual(owner, getAddress(org.agentOwner))) reason = "This seller's on-chain agent identity changed owner; quoting is paused until the seller confirms it again.";
    else if (!payee || !isAddressEqual(payee, getAddress(org.payeeAddress))) reason = "This seller's on-chain payee no longer matches its payout address; quoting is paused until they match.";
    else if (!signer || !isAddressEqual(signer, getAddress(org.sellerSignerAddress))) reason = "This seller's on-chain signer no longer matches its current signer; the seller needs to update it on Arc.";
  } catch (e) {
    console.warn(`[agent-registry] could not read agent ${org.agentId} for ${org.slug}: ${(e as Error).message}`);
    return;
  }
  bindingCache.set(org.id, reason ? { at: Date.now(), ok: false, reason } : { at: Date.now(), ok: true });
  if (reason) throw new HttpError(409, reason);
}

/* ---------------------------------------------------------------- public policy log */

/**
 * A seller's policy commitments, newest first, with where each one is on chain. Fields and salts stay private; this
 * lists only what is already public in quotes and on ProteusPolicyRegistry, so anyone can cross-check the two.
 */
export async function policyLog(slug: string) {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, slug));
  if (!org) throw new HttpError(404, "seller not found");
  const products = await db.select().from(schema.products).where(eq(schema.products.orgId, org.id));
  const out = [];
  for (const p of products) {
    const rows = await db.select().from(schema.policies).where(eq(schema.policies.productId, p.id));
    out.push({
      product: p.slug,
      productId: productIdHash(p.slug),
      versions: rows
        .sort((a, b) => b.version - a.version)
        .map((r) => ({ version: r.version, commitment: r.policyCommit, committedOnChainTx: r.commitTx, createdAt: r.createdAt })),
    });
  }
  return {
    seller: org.slug,
    chainId: env.CHAIN_ID,
    sellerAgent: org.agentId ? { agentRegistry: agentRegistryId(env.CHAIN_ID), agentId: org.agentId } : null,
    policyRegistry: policyRegistryFor(env.CHAIN_ID),
    howToVerify: "For any version with committedOnChainTx, call policyOf(agentId, productId, version) on policyRegistry and compare `commitment`. Each quote's public terms carry the same {version, commitment}, and publicTermsHash is inside the EIP-712 Terms the escrow verifies.",
    products: out,
  };
}
