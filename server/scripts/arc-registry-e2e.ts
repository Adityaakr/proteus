/**
 * End-to-end check of the Arc seller registry, through the same server services the app uses, on Arc testnet.
 *
 *   1. A throwaway live seller (owned by the testnet deployer key) publishes a product.
 *   2. It registers its agent on the ERC-8004 IdentityRegistry: register(agentURI, [proteus.payee, proteus.signer]).
 *   3. confirmRegistration reads it back from the chain; publishAllLatest commits policy v1 to ProteusPolicyRegistry
 *      via commitBySig (seller signer signs EIP-712, relayer submits). The on-chain commitment must equal the stored one.
 *   4. The seller edits its policy (v2); a quote commits v2 on chain and its public terms bind {version, commitment,
 *      sellerAgent}, and publicTermsHash covers them.
 *   5. A candidate priced under v1 is refused after the edit (stale offer); a payee that no longer matches the chain is refused.
 *
 * Testnet only. Prints every transaction. Exits non-zero on any mismatch. Run: pnpm --filter server exec tsx scripts/arc-registry-e2e.ts
 */
import { eq } from "drizzle-orm";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IDENTITY_REGISTRY_ABI, POLICY_REGISTRY_ABI, getQuoteCandidates, policyRegistryFor, productIdHash, publicTermsHash } from "@proteus/domain";
import { env } from "../src/env";
import { db, schema } from "../src/db";
import { chain, feeParams, publicClient } from "../src/chain/client";
import { assertAgentBinding, confirmRegistration, policyLog, registrationInputs } from "../src/services/agent-registry";
import { publishAllLatest } from "../src/services/policy-commit";
import { confirmRating, ratingInputs } from "../src/services/ratings";
import { sellerStats } from "../src/services/brand";
import { REPUTATION_REGISTRY_ABI } from "@proteus/domain";
import { createProduct } from "../src/services/accounts";
import { evaluationContext, loadProductById } from "../src/services/catalog";
import { startNegotiation } from "../src/services/negotiation";
import { createQuote } from "../src/services/quotes";
import { bigintsToStrings } from "../src/lib/http";
import { id } from "../src/lib/ids";

if (env.CHAIN_ID === 5042) throw new Error("arc-registry-e2e runs on Arc testnet only.");
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY is required (testnet).");
const owner = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const registry = policyRegistryFor(env.CHAIN_ID);
const log = (k: string, v: unknown) => console.log(`${k.padEnd(34)} ${typeof v === "string" ? v : JSON.stringify(v)}`);
const assert = (ok: boolean, what: string) => {
  if (!ok) {
    console.error(`FAIL: ${what}`);
    process.exit(1);
  }
  console.log(`ok   ${what}`);
};

const stamp = Date.now().toString(36);
const orgId = `org_e2e_${stamp}`;
const slug = `arc-e2e-${stamp}`;

// 1. Seller and product
await db.insert(schema.orgs).values({ id: orgId, slug, name: `Arc e2e ${stamp}`, label: "live", ownerAddress: owner.address, payeeAddress: owner.address, sellerSignerAddress: "0x0000000000000000000000000000000000000000" });
const productId = await createProduct(orgId, {
  name: "E2E invoice processing",
  slug: "e2e-invoices",
  unitLabel: "invoice",
  billableUnit: "one invoice turned into an approval-ready record",
  capabilities: [],
  supportedIntegrations: [],
  tiers: [{ name: "Starter", includedUnits: "100", unitPriceUsd: "0.50", includes: [] }],
  maxUnitsPerDeal: "1000",
  termDays: 30,
  refundPolicy: "Unused prepaid balance is refunded after the term.",
  cost: { variableCostPerUnitUsd: "0.10", directCostPerDealUsd: "0", txCostBps: 50 },
  policy: { minMarginBps: 2000, maxDiscountBps: 1500, approvalThresholdUsd: "1000", prepaidMinimumUsd: "1", availableCapacityUnits: "10000", quoteTtlSeconds: 3600 },
  adapter: "http",
  upstream: { url: "https://example.com/proteus-e2e" },
} as never);
log("seller / product", `${slug} / ${productId}`);

// 2. Register on ERC-8004 from the owner wallet
const inputs = await registrationInputs(orgId, "https://ai.proteus.co.in");
const wallet = createWalletClient({ account: owner, chain, transport: http(env.ARC_RPC_URL) });
const regTx = await wallet.writeContract({ address: inputs.registry, abi: IDENTITY_REGISTRY_ABI, functionName: "register", args: [inputs.agentURI, inputs.metadata], ...(await feeParams()) });
log("register tx", regTx);

// 3. Confirm from chain, then commit v1 on ProteusPolicyRegistry
const confirmed = await confirmRegistration(orgId, regTx);
log("agentId", confirmed.agentId);
const published = await publishAllLatest(orgId);
log("policy v1 commitBySig tx", published[0]?.tx ?? "none");
assert(Boolean(published[0]?.tx), "policy v1 committed on chain via commitBySig");
const pid = productIdHash("e2e-invoices");
const v1Row = (await db.select().from(schema.policies).where(eq(schema.policies.productId, productId)))[0]!;
const onV1 = (await publicClient.readContract({ address: registry, abi: POLICY_REGISTRY_ABI, functionName: "policyOf", args: [BigInt(confirmed.agentId), pid, 1n] })) as { commitment: Hex; authorizedBy: Hex };
assert(onV1.commitment === v1Row.policyCommit, "on-chain v1 commitment equals the stored commitment");
assert(onV1.authorizedBy.toLowerCase() === confirmed.signer.toLowerCase(), "v1 authorized by the signer the seller published (not the relayer)");

// A candidate priced under v1, kept to prove a stale offer is refused later
let lp = await loadProductById(productId);
const neg1 = await startNegotiation(slug, "e2e-invoices", owner.address);
const negId1 = (neg1 as { id?: string; negotiationId?: string }).id ?? (neg1 as { negotiationId?: string }).negotiationId!;
const req = { desiredUnits: 100n, budget: undefined, integrations: [], notes: [], openQuestions: [] };
const v1Cands = getQuoteCandidates(evaluationContext(lp), req as never).filter((c) => c.status !== "rejected");
await db.update(schema.negotiations).set({ candidates: bigintsToStrings(v1Cands) as never }).where(eq(schema.negotiations.id, negId1));

// 4. Seller edits its policy -> v2
await db.insert(schema.policies).values({ ...v1Row, id: id("pol"), version: 2, minMarginBps: 2200, salt: null, policyCommit: null, commitTx: null, createdAt: new Date() });
lp = await loadProductById(productId);
assert(lp.policy.version === 2, "policy edited to v2");

// 5a. Stale v1 offer is refused
try {
  await createQuote(negId1, v1Cands[0]!.candidateId);
  assert(false, "stale v1 offer refused after the policy edit");
} catch (e) {
  assert(/updated its pricing rules/.test((e as Error).message), "stale v1 offer refused after the policy edit");
}

// 4b. A fresh v2 offer: quote commits v2 on chain and binds it in the public terms
const neg2 = await startNegotiation(slug, "e2e-invoices", owner.address);
const negId2 = (neg2 as { id?: string; negotiationId?: string }).id ?? (neg2 as { negotiationId?: string }).negotiationId!;
const v2Cands = getQuoteCandidates(evaluationContext(lp), req as never).filter((c) => c.status !== "rejected");
await db.update(schema.negotiations).set({ candidates: bigintsToStrings(v2Cands) as never }).where(eq(schema.negotiations.id, negId2));
await createQuote(negId2, v2Cands[0]!.candidateId);
const [quote] = await db.select().from(schema.quotes).where(eq(schema.quotes.negotiationId, negId2));
const pt = quote!.publicTerms as { publicTermsVersion: number; chainId: number; network: string; sellerAgent: { agentId: string } | null; policy: { version: number; commitment: Hex; registry: string } };
log("quote public terms", { publicTermsVersion: pt.publicTermsVersion, network: pt.network, sellerAgent: pt.sellerAgent, policy: pt.policy });
const v2Row = (await db.select().from(schema.policies).where(eq(schema.policies.productId, productId))).find((r) => r.version === 2)!;
assert(pt.publicTermsVersion === 2 && pt.network === "Arc testnet" && pt.chainId === 5042002, "public terms v2 with the correct network");
assert(pt.sellerAgent?.agentId === confirmed.agentId, "public terms name the seller's ERC-8004 agent");
assert(pt.policy.version === 2 && pt.policy.commitment === v2Row.policyCommit, "public terms bind policy v2 and its commitment");
log("policy v2 commitBySig tx", v2Row.commitTx ?? "none");
const onV2 = (await publicClient.readContract({ address: registry, abi: POLICY_REGISTRY_ABI, functionName: "policyOf", args: [BigInt(confirmed.agentId), pid, 2n] })) as { commitment: Hex };
assert(onV2.commitment === v2Row.policyCommit, "v2 commitment is on chain before any funding");
assert(publicTermsHash(pt as never) !== publicTermsHash({ ...pt, policy: { ...pt.policy, commitment: "0x00" } } as never), "publicTermsHash changes if the policy commitment changes");

// 5b. Payee drift is refused
const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
try {
  await assertAgentBinding({ ...org!, id: `${orgId}_drift`, payeeAddress: "0x000000000000000000000000000000000000dEaD" });
  assert(false, "quote refused when the on-chain payee no longer matches");
} catch (e) {
  assert(/payee/.test((e as Error).message), "quote refused when the on-chain payee no longer matches");
}

const plog = await policyLog(slug);
log("public policy log", plog.products[0]!.versions.map((v) => ({ v: v.version, onChain: Boolean(v.committedOnChainTx) })));
assert(plog.products[0]!.versions.every((v) => v.committedOnChainTx), "public policy log shows every version on chain");

// 6. Ratings on ERC-8004 ReputationRegistry. The deal row below is a local test fixture (a settled deal for this
//    test seller); the feedback transaction and its verification are real and on chain.
if (!process.env.RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY is required to act as the test buyer.");
const buyer = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as Hex);
const dealId = id("deal");
await db.insert(schema.deals).values({
  id: dealId, publicId: `d_e2e_${stamp}`, orgId, productId, negotiationId: negId2, quoteId: quote!.id, publicTerms: pt, dealIdOnchain: BigInt(Date.now()), buyerAddress: buyer.address,
  sellerAddress: confirmed.signer, payeeAddress: owner.address, terms: {}, termsHash: `0x${"ab".repeat(32)}`, buyerSignature: "0x", sellerSignature: "0x",
  status: "active", deposit: 2_000_000n, settled: 1_000_000n, refunded: 0n,
} as never);
const ri = await ratingInputs(dealId, "https://ai.proteus.co.in");
assert(ri.eligible && ri.args !== null, "settled deal with a registered seller is ratable");
const buyerWallet = createWalletClient({ account: buyer, chain, transport: http(env.ARC_RPC_URL) });
const a = ri.args!;
const fbTx = await buyerWallet.writeContract({ address: ri.reputationRegistry as Hex, abi: REPUTATION_REGISTRY_ABI, functionName: "giveFeedback", args: [BigInt(a.agentId), 5n, 0, a.tag1, a.tag2, a.endpoint, a.feedbackURI, a.feedbackHash as Hex], ...(await feeParams()) });
log("giveFeedback tx (buyer)", fbTx);
const rated = await confirmRating(dealId, fbTx);
assert(rated.value === 5, "server verified the on-chain rating (5 stars) from the deal's buyer");
const stats = (await sellerStats([orgId])).get(orgId)!;
log("seller stats", { dealsFunded: stats.dealsFunded, settled: stats.settled.toString(), ratings: stats.ratings && { ...stats.ratings, settledBehind: stats.ratings.settledBehind.toString() } });
assert(stats.ratings?.count === 1 && stats.ratings.average === 5, "seller card shows the verified rating");
// A feedback tx for another deal tag must not count for this deal.
const wrongTx = await buyerWallet.writeContract({ address: ri.reputationRegistry as Hex, abi: REPUTATION_REGISTRY_ABI, functionName: "giveFeedback", args: [BigInt(a.agentId), 1n, 0, a.tag1, "999", a.endpoint, a.feedbackURI, a.feedbackHash as Hex], ...(await feeParams()) });
try {
  await confirmRating(dealId, wrongTx);
  assert(false, "feedback tagged for a different deal is rejected");
} catch (e) {
  assert(/No NewFeedback/.test((e as Error).message), "feedback tagged for a different deal is rejected");
}
// The seller's own wallet cannot rate itself (the ERC-8004 registry refuses it).
try {
  await publicClient.simulateContract({ account: owner, address: ri.reputationRegistry as Hex, abi: REPUTATION_REGISTRY_ABI, functionName: "giveFeedback", args: [BigInt(a.agentId), 5n, 0, a.tag1, a.tag2, a.endpoint, a.feedbackURI, a.feedbackHash as Hex] });
  assert(false, "seller cannot rate its own agent");
} catch {
  assert(true, "seller cannot rate its own agent");
}

console.log("\nALL CHECKS PASSED on Arc testnet");
process.exit(0);
