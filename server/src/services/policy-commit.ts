/**
 * Policy commitments. Every policy version gets a salted commitment (policyCommitment in @proteus/domain) the first
 * time it is needed; quotes carry it in their public terms, so the signed Terms bind each deal to one policy version.
 * For a seller registered on Arc (ERC-8004), the commitment is also written to ProteusPolicyRegistry: the seller's
 * delegated signer signs an EIP-712 PolicyCommit and the relayer submits commitBySig. The contract accepts it only if
 * that signer is the one the seller's own wallet published under `proteus.signer`, so the relayer cannot commit
 * anything on its own.
 */
import { and, eq, isNull } from "drizzle-orm";
import { createWalletClient, http, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { POLICY_COMMIT_TYPES, POLICY_REGISTRY_ABI, policyCommitment, policyRegistryDomain, policyRegistryFor, productIdHash } from "@proteus/domain";
import { db, schema } from "../db";
import { env, features } from "../env";
import { chain, feeParams, publicClient } from "../chain/client";
import { orgSignerAccount } from "../chain/signer";

type PolicyRow = typeof schema.policies.$inferSelect;
type Org = typeof schema.orgs.$inferSelect;

const randomSalt = (): Hex => toHex(crypto.getRandomValues(new Uint8Array(32)));

/** The salted commitment for one policy version; created once (idempotent under concurrency), then read back. */
export async function ensurePolicyCommit(row: PolicyRow, productSlug: string): Promise<{ salt: Hex; commit: Hex; productId: Hex }> {
  const productId = productIdHash(productSlug);
  if (row.salt && row.policyCommit) return { salt: row.salt as Hex, commit: row.policyCommit as Hex, productId };
  const salt = randomSalt();
  const commit = policyCommitment(
    {
      productId,
      version: row.version,
      minMarginBps: row.minMarginBps,
      maxDiscountBps: row.maxDiscountBps,
      approvalThreshold: row.approvalThreshold,
      prepaidMinimum: row.prepaidMinimum,
      availableCapacityUnits: row.availableCapacityUnits,
      quoteTtlSeconds: row.quoteTtlSeconds,
      allowNonPositiveContribution: row.allowNonPositiveContribution,
    },
    salt,
  );
  // Only the first writer wins; a concurrent caller reads the stored pair back.
  await db.update(schema.policies).set({ salt, policyCommit: commit }).where(and(eq(schema.policies.id, row.id), isNull(schema.policies.salt)));
  const [fresh] = await db.select().from(schema.policies).where(eq(schema.policies.id, row.id));
  return { salt: fresh!.salt as Hex, commit: fresh!.policyCommit as Hex, productId };
}

/**
 * Writes the commitment to ProteusPolicyRegistry for a registered seller, unless it is already there.
 * Returns the tx hash, or null when the seller is not registered or no relayer is configured.
 */
export async function publishPolicyCommit(org: Org, row: PolicyRow, productSlug: string): Promise<Hex | null> {
  if (!org.agentId || !env.RELAYER_PRIVATE_KEY || !features.viemRelayer) return null;
  if (row.commitTx) return row.commitTx as Hex;
  const { commit, productId } = await ensurePolicyCommit(row, productSlug);
  const registry = policyRegistryFor(env.CHAIN_ID);
  const agentId = BigInt(org.agentId);
  const onChain = (await publicClient.readContract({ address: registry, abi: POLICY_REGISTRY_ABI, functionName: "policyOf", args: [agentId, productId, BigInt(row.version)] })) as { commitment: Hex };
  if (onChain.commitment === commit) return null;
  const latest = (await publicClient.readContract({ address: registry, abi: POLICY_REGISTRY_ABI, functionName: "latestVersion", args: [agentId, productId] })) as bigint;
  if (latest >= BigInt(row.version)) {
    console.warn(`[policy-commit] ${org.slug}/${productSlug} v${row.version}: registry already at v${latest}; not re-committing`);
    return null;
  }
  const signer = await orgSignerAccount(org.id);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const signature = await signer.signTypedData({
    domain: policyRegistryDomain(env.CHAIN_ID),
    types: POLICY_COMMIT_TYPES,
    primaryType: "PolicyCommit",
    message: { agentId, productId, version: BigInt(row.version), commitment: commit, deadline },
  });
  const relayer = privateKeyToAccount(env.RELAYER_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({ account: relayer, chain, transport: http(env.ARC_RPC_URL) });
  const { request } = await publicClient.simulateContract({
    address: registry,
    abi: POLICY_REGISTRY_ABI,
    functionName: "commitBySig",
    args: [agentId, productId, BigInt(row.version), commit, deadline, signature],
    account: relayer,
    ...(await feeParams()),
  });
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") throw new Error(`commitBySig reverted (${hash})`);
  await db.update(schema.policies).set({ commitTx: hash }).where(eq(schema.policies.id, row.id));
  return hash;
}

/** Commit the latest policy version of every product a seller has; used right after it registers on Arc. */
export async function publishAllLatest(orgId: string): Promise<{ product: string; tx: Hex | null }[]> {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org?.agentId) return [];
  const products = await db.select().from(schema.products).where(eq(schema.products.orgId, orgId));
  const out: { product: string; tx: Hex | null }[] = [];
  for (const p of products) {
    const rows = await db.select().from(schema.policies).where(eq(schema.policies.productId, p.id));
    const latest = rows.sort((a, b) => b.version - a.version)[0];
    if (!latest) continue;
    try {
      out.push({ product: p.slug, tx: await publishPolicyCommit(org, latest, p.slug) });
    } catch (e) {
      console.warn(`[policy-commit] ${org.slug}/${p.slug}: ${(e as Error).message}`);
      out.push({ product: p.slug, tx: null });
    }
  }
  return out;
}
