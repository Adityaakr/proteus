/**
 * Rating integrity: decides whether a verified on-chain rating counts toward a seller's score.
 *
 * A seller can never rate itself from its own agent wallet (the ERC-8004 registry rejects that), but it could buy from
 * itself through a second wallet. These checks look for links between the deal's buyer and the seller, using only what
 * Proteus already knows and what is public on Arc:
 *   - account: the buyer wallet is one of the seller's wallets (owner, payee, quote signer, team members' wallets)
 *   - funding: the seller's wallets sent USDC to the buyer wallet on Arc (one hop), from 14 days before funding to the rating
 *   - bridge: the buyer's and the seller's USDC were bridged in with Circle CCTP from the same source wallet
 * A linked rating stays public but does not count. The checks raise the cost of faking; they are not a proof that a
 * clear rating is independent (a seller can still fund a second wallet from an exchange), which is why the score also
 * counts one vote per buyer, starts from a neutral prior and shows how many buyers stand behind it.
 *
 * Buyer tier: "verified" when the buyer reached the seller through WhatsApp (a phone number verified by Meta) or holds a
 * Proteus account with a verified email; otherwise "wallet". Verified buyers count fully, wallet-only buyers count half.
 */
import { eq, inArray } from "drizzle-orm";
import { decodeEventLog, getAddress, isAddressEqual, parseAbiItem, type Address, type Hex } from "viem";
import { db, schema } from "../db";
import { publicClient, usdcAddress } from "../chain/client";

export type BuyerTier = "verified" | "wallet";
export type LinkCheck = { linked: false } | { linked: true; reason: string };

/** Arc's RPC serves eth_getLogs over at most 10,000 blocks; Arc makes about 2 blocks a second. */
const LOG_CHUNK = 9_000n;
const BLOCKS_PER_DAY = 172_800n;
const LOOKBACK_DAYS = 14n;
/**
 * One request at a time with a pause: the relayer and the reconciler share this RPC, so the scan stays under its rate
 * limit instead of hitting it. A check covers about two million blocks; on the public RPC it can take up to half an hour.
 */
const SCAN_CONCURRENCY = 1;
const SCAN_PAUSE_MS = 200;

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const MESSAGE_RECEIVED = parseAbiItem("event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)");
const ZERO: Address = "0x0000000000000000000000000000000000000000";

const lower = (a: string) => a.toLowerCase();

/** The seller's own wallets (owner, payee, quote signers) and wallets linked to Proteus accounts on its team. */
export async function sellerWalletSets(orgId: string): Promise<{ own: Address[]; team: Address[] }> {
  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) return { own: [], team: [] };
  const own = new Set<string>([org.payeeAddress, org.sellerSignerAddress, org.ownerAddress ?? ""].filter(Boolean).map(lower));
  for (const s of await db.select({ address: schema.orgSigners.address }).from(schema.orgSigners).where(eq(schema.orgSigners.orgId, orgId))) own.add(lower(s.address));
  const team = new Set<string>();
  const members = await db.select({ userId: schema.memberships.userId }).from(schema.memberships).where(eq(schema.memberships.orgId, orgId));
  if (members.length) {
    const links = await db.select({ address: schema.walletLinks.address }).from(schema.walletLinks).where(inArray(schema.walletLinks.userId, members.map((m) => m.userId)));
    for (const l of links) if (!own.has(lower(l.address))) team.add(lower(l.address));
  }
  return { own: [...own].map((a) => getAddress(a)), team: [...team].map((a) => getAddress(a)) };
}

/** Every wallet Proteus knows belongs to the seller or its team. */
export async function sellerWallets(orgId: string): Promise<Address[]> {
  const { own, team } = await sellerWalletSets(orgId);
  return [...own, ...team];
}

/** "verified" when the deal came through WhatsApp or the buyer wallet belongs to a Proteus account with an email. */
export async function buyerTier(deal: { negotiationId: string; buyerAddress: string }): Promise<BuyerTier> {
  const [wa] = await db.select({ id: schema.whatsappSessions.id }).from(schema.whatsappSessions).where(eq(schema.whatsappSessions.negotiationId, deal.negotiationId)).limit(1);
  if (wa) return "verified";
  const owners = await db.select({ userId: schema.walletLinks.userId }).from(schema.walletLinks).where(eq(schema.walletLinks.address, lower(deal.buyerAddress)));
  if (!owners.length) return "wallet";
  const users = await db.select({ email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, owners.map((o) => o.userId)));
  return users.some((u) => Boolean(u.email)) ? "verified" : "wallet";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** getLogs with backoff: Arc's public RPC answers "rate limit exceeded" (-32005) under bursts. */
async function getTransferLogs(args: { from?: Address[]; to: Address[] }, fromBlock: bigint, toBlock: bigint) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await publicClient.getLogs({ address: usdcAddress, event: TRANSFER, args: { from: args.from, to: args.to }, fromBlock, toBlock });
    } catch (e) {
      if (attempt >= 6) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/** USDC Transfer logs matching from/to filters over [fromBlock, toBlock], scanned in chunks the RPC accepts. */
async function transfers(args: { from?: Address[]; to: Address[] }, fromBlock: bigint, toBlock: bigint) {
  const ranges: [bigint, bigint][] = [];
  for (let b = fromBlock; b <= toBlock; b += LOG_CHUNK) ranges.push([b, b + LOG_CHUNK - 1n > toBlock ? toBlock : b + LOG_CHUNK - 1n]);
  const out: { from: Address; to: Address; tx: Hex }[] = [];
  for (let i = 0; i < ranges.length; i += SCAN_CONCURRENCY) {
    const batch = await Promise.all(ranges.slice(i, i + SCAN_CONCURRENCY).map(([a, b]) => getTransferLogs(args, a, b)));
    for (const logs of batch) for (const l of logs) out.push({ from: l.args.from!, to: l.args.to!, tx: l.transactionHash! });
    await sleep(SCAN_PAUSE_MS);
  }
  return out;
}

/** The source-chain wallet that burned USDC for a CCTP mint transaction on Arc, or null when it is not a CCTP mint. */
async function cctpDepositor(tx: Hex): Promise<string | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: tx });
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: [MESSAGE_RECEIVED], data: log.data, topics: log.topics });
      // Burn message body: version (4) | burnToken (32) | mintRecipient (32) | amount (32) | messageSender (32) | ...
      const body = ev.args.messageBody;
      if (body.length >= 2 + 132 * 2) return `${ev.args.sourceDomain}:${("0x" + body.slice(2 + 100 * 2, 2 + 132 * 2)).toLowerCase()}`;
    } catch {
      /* not a MessageReceived log */
    }
  }
  return null;
}

/** Source wallets (domain:sender) behind every CCTP mint into these Arc wallets in the window. */
export async function bridgeSources(wallets: Address[], fromBlock: bigint, toBlock: bigint) {
  return sourcesOf((await transfers({ from: [ZERO], to: wallets }, fromBlock, toBlock)).map((m) => m.tx));
}

async function sourcesOf(mintTxs: Hex[]) {
  const out = new Set<string>();
  for (const tx of new Set(mintTxs)) {
    const src = await cctpDepositor(tx);
    if (src) out.add(src);
  }
  return out;
}

/**
 * Looks for links between a deal's buyer and its seller. `fromBlock` should sit before the deal was funded;
 * the scan covers 14 days before it up to `toBlock` (the rating's block).
 */
export async function checkBuyerLinks(input: { orgId: string; buyerAddress: string; fundedBlock: bigint; toBlock: bigint }): Promise<LinkCheck> {
  const buyer = getAddress(input.buyerAddress);
  const { own, team } = await sellerWalletSets(input.orgId);
  if (team.some((w) => isAddressEqual(w, buyer))) return { linked: true, reason: TEAM_ACCOUNT_REASON };
  return linksOnChain({ buyer, seller: [...own, ...team], fundedBlock: input.fundedBlock, toBlock: input.toBlock });
}

export const TEAM_ACCOUNT_REASON = "The buyer wallet is connected to a Proteus account on the seller's team.";
/** Reason text used before team-account links were reported separately; such ratings are re-checked once. */
export const LEGACY_OWN_WALLET_REASON = "The buyer wallet is one of the seller's own wallets.";

/** The chain part of the link check, given the seller's wallets (exported for tests against real Arc data). */
export async function linksOnChain(input: { buyer: Address; seller: Address[]; fundedBlock: bigint; toBlock: bigint }): Promise<LinkCheck> {
  const { buyer, seller } = input;
  if (seller.some((w) => isAddressEqual(w, buyer))) return { linked: true, reason: "The buyer wallet is the seller's owner, payee or signer wallet." };

  const start = input.fundedBlock > LOOKBACK_DAYS * BLOCKS_PER_DAY ? input.fundedBlock - LOOKBACK_DAYS * BLOCKS_PER_DAY : 0n;
  // One scan for the buyer: USDC from any seller wallet (funding) or from the zero address (CCTP mints).
  const inbound = await transfers({ from: [...seller, ZERO], to: [buyer] }, start, input.toBlock);
  if (inbound.some((t) => seller.some((w) => isAddressEqual(w, t.from)))) return { linked: true, reason: "The seller's wallet sent USDC to the buyer wallet on Arc." };

  const buyerSources = await sourcesOf(inbound.filter((t) => isAddressEqual(t.from, ZERO)).map((t) => t.tx));
  if (buyerSources.size && seller.length) {
    const sellerSources = await bridgeSources(seller, start, input.toBlock);
    for (const s of buyerSources) if (sellerSources.has(s)) return { linked: true, reason: "The buyer's and the seller's USDC were bridged to Arc from the same source wallet." };
  }
  return { linked: false };
}

/** Block number of a transaction, used to bound the scan. */
export async function blockOf(tx: Hex) {
  return (await publicClient.getTransactionReceipt({ hash: tx })).blockNumber;
}

