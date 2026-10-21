/**
 * Disputes on DealEscrow. A party opens one from its own wallet (openDispute(dealId, keccak256(reason))); the deal
 * freezes: no settlement and no refund until the arbiter resolves it. The arbiter can only split the unspent balance
 * between the seller's payee and the buyer (resolveDispute). The reason text lives here; only its hash is on chain,
 * and the server stores it only after reading the DisputeOpened event and matching the hash.
 */
import { eq } from "drizzle-orm";
import { isAddressEqual, keccak256, parseEventLogs, toHex, type Address, type Hex } from "viem";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { dealEscrowAbi } from "../chain/abi";
import { escrowAddress, publicClient } from "../chain/client";
import { loadDeal } from "./deals";

export const reasonHash = (reason: string): Hex => keccak256(toHex(reason.trim()));

export async function disputeView(dealId: string) {
  const deal = await loadDeal(dealId);
  const [d] = await db.select().from(schema.disputes).where(eq(schema.disputes.dealId, dealId));
  const arbiter = (await publicClient.readContract({ address: escrowAddress(), abi: dealEscrowAbi, functionName: "arbiter" })) as Address;
  return {
    canOpen: ["funded", "active"].includes(deal.status) && !d,
    escrow: escrowAddress(),
    dealIdOnchain: deal.dealIdOnchain.toString(),
    buyer: deal.buyerAddress,
    arbiter,
    dispute: d ? { status: d.status, openedBy: d.openedBy, reason: d.reason, openTx: d.openTx, toSeller: d.toSeller, toBuyer: d.toBuyer, resolveTx: d.resolveTx, createdAt: d.createdAt, resolvedAt: d.resolvedAt } : null,
  };
}

/** Called after the party's openDispute transaction confirms: verifies the event and stores the reason text. */
export async function recordDispute(dealId: string, txHash: Hex, reason: string) {
  const text = reason.trim();
  if (text.length < 10 || text.length > 4000) throw new HttpError(400, "Describe the problem (10 to 4000 characters).");
  const deal = await loadDeal(dealId);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (receipt.status !== "success") throw new HttpError(409, "The dispute transaction reverted on chain.");
  const [ev] = parseEventLogs({ abi: dealEscrowAbi, eventName: "DisputeOpened", logs: receipt.logs.filter((l) => isAddressEqual(l.address, escrowAddress())) }) as unknown as { args: { dealId: bigint; by: Address; reasonHash: Hex } }[];
  if (!ev || ev.args.dealId !== deal.dealIdOnchain) throw new HttpError(409, "No DisputeOpened event for this deal in that transaction.");
  if (ev.args.reasonHash !== reasonHash(text)) throw new HttpError(409, "The reason does not match the hash recorded on chain.");
  const by = isAddressEqual(ev.args.by, deal.buyerAddress as Address) ? "buyer" : "seller";
  await db.insert(schema.disputes).values({ dealId, orgId: deal.orgId, openedBy: by, reason: text, reasonHash: ev.args.reasonHash, openTx: txHash }).onConflictDoNothing();
  await db.update(schema.deals).set({ status: "disputed", updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  return disputeView(dealId);
}
