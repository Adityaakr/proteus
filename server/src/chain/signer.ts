import { and, eq, isNull } from "drizzle-orm";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { db, schema } from "../db";
import { env } from "../env";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { chain } from "./client";

/**
 * Per-org delegated seller signer. Server-held, encrypted at rest, scope: signs Terms and Delivery
 * digests and sends `sellerCloseTerm`. It never holds buyer funds. The org's payee is pinned to the
 * owner's wallet when terms are built, so a leaked signer cannot redirect payouts.
 * The sandbox seller's signer comes from SELLER_SIGNER_PRIVATE_KEY so local runs stay reproducible.
 */
export async function ensureOrgSigner(orgId: string): Promise<{ address: Address; created: boolean }> {
  const [active] = await db.select().from(schema.orgSigners).where(and(eq(schema.orgSigners.orgId, orgId), isNull(schema.orgSigners.revokedAt)));
  if (active) return { address: active.address as Address, created: false };
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "org not found");
  const key = org.label === "sandbox" && env.SELLER_SIGNER_PRIVATE_KEY ? (env.SELLER_SIGNER_PRIVATE_KEY as Hex) : generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  await db.insert(schema.orgSigners).values({ id: id("sig"), orgId, address, encryptedKey: encryptSecret(key) });
  await db.update(schema.orgs).set({ sellerSignerAddress: address }).where(eq(schema.orgs.id, orgId));
  return { address, created: true };
}

export async function orgSignerAccount(orgId: string) {
  const [active] = await db.select().from(schema.orgSigners).where(and(eq(schema.orgSigners.orgId, orgId), isNull(schema.orgSigners.revokedAt)));
  if (!active) throw new HttpError(409, "this seller has no active signer; the owner must create one in settings");
  return privateKeyToAccount(decryptSecret(active.encryptedKey) as Hex);
}

export async function orgWalletClient(orgId: string) {
  const account = await orgSignerAccount(orgId);
  return createWalletClient({ account, chain, transport: http(env.ARC_RPC_URL) });
}

export async function revokeOrgSigner(orgId: string) {
  const now = new Date();
  await db.update(schema.orgSigners).set({ revokedAt: now }).where(and(eq(schema.orgSigners.orgId, orgId), isNull(schema.orgSigners.revokedAt)));
  return { revokedAt: now, note: "Revocation stops this key from signing new terms or deliveries. Deals it already signed keep accepting it on chain until they close." };
}

/** Sweep pay-per-call receipts (ERC-20 USDC held by the collection signer) to the org payee. */
export async function sweepCollector(orgId: string) {
  const { erc20Abi } = await import("./abi");
  const { publicClient, usdcAddress, feeParams } = await import("./client");
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) throw new HttpError(404, "org not found");
  const wallet = await orgWalletClient(orgId);
  const balance = (await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [wallet.account.address] })) as bigint;
  // Keep 0.05 USDC for gas (native and ERC-20 share one balance on Arc).
  const reserve = 50_000n;
  if (balance <= reserve) return { swept: 0n, balance, note: "nothing to sweep beyond the gas reserve" };
  const amount = balance - reserve;
  const fees = await feeParams();
  const { request } = await publicClient.simulateContract({ address: usdcAddress, abi: erc20Abi, functionName: "transfer", args: [org.payeeAddress as Address, amount], account: wallet.account, ...fees });
  const txHash = await wallet.writeContract(request);
  return { swept: amount, balance, txHash, payee: org.payeeAddress };
}

export async function signerView(orgId: string) {
  const [active] = await db.select().from(schema.orgSigners).where(and(eq(schema.orgSigners.orgId, orgId), isNull(schema.orgSigners.revokedAt)));
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  return { address: active?.address ?? null, scope: active?.scope ?? null, createdAt: active?.createdAt ?? null, revokedAt: null, payee: org?.payeeAddress ?? null, note: "Server-held key that signs Terms and Delivery digests on your behalf. It cannot move funds. Payouts always go to your payee address." };
}
