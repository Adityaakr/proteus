/**
 * Consulting on a store conversation: the buyer asked something open ("suggest me some good merch") instead of about
 * one product. The agent recommends two to four of the seller's listed products, each with a reason and its "from"
 * price, and asks what is still unknown. No product is chosen, no offer is priced and the negotiation's requirements
 * are left alone: the buyer picks a product (or names one) to get offers from that product's rules.
 *
 * The exchange is kept in the negotiation the conversation is in (turn kind "consult", picks in its payload), so the
 * seller sees it and a reload shows it.
 */
import { eq } from "drizzle-orm";
import { consult, consultText, routeMessage } from "@proteus/domain";
import { getAgentAdapter, redactPersonalData, type ConversationTurn } from "../agent";
import { db, schema } from "../db";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { sealJson, sealText } from "../lib/vault";
import { loadNegotiation, negotiationView } from "./negotiation";
import { storeCatalog } from "./storefront";

export async function addConsultMessage(negId: string, content: string, current?: string) {
  const { neg, turnRows, lp } = await loadNegotiation(negId);
  if (neg.status === "accepted" || neg.status === "closed") throw new HttpError(409, "negotiation is closed");
  const started = Date.now();
  const { products } = await storeCatalog(lp.org.slug);
  const seq = (turnRows.at(-1)?.seq ?? 0) + 1;
  await db.insert(schema.turns).values({ id: id("turn"), negotiationId: negId, seq, role: "buyer", content: await sealText(lp.org.id, content) });

  const convo: ConversationTurn[] = [...turnRows.map((t) => ({ role: t.role as ConversationTurn["role"], content: redactPersonalData(t.content) })), { role: "buyer", content: redactPersonalData(content) }];
  const buyerTexts = convo.filter((t) => t.role === "buyer" && !t.content.startsWith("Counteroffer:")).map((t) => t.content);
  // The server routes again rather than trusting the client for which products the message pointed at.
  const d = routeMessage(content, products, { current, sellerName: lp.org.name });
  const pointed = d.mode === "consult" ? d.slugs : [];
  const exclude = d.mode === "consult" ? d.exclude : [];
  const fallback = consult(lp.org.name, products, buyerTexts, { pointed, exclude });
  const adapter = getAgentAdapter();
  const { result, steps } = await adapter.consult({ sellerName: lp.org.name, products, turns: convo, fallback, pointed, exclude });

  await db.insert(schema.turns).values({
    id: id("turn"),
    negotiationId: negId,
    seq: seq + 1,
    role: "agent",
    kind: "consult",
    content: await sealText(lp.org.id, consultText(result)),
    payload: { consult: result },
  });
  await db.insert(schema.agentRuns).values({ id: id("run"), orgId: lp.org.id, negotiationId: negId, adapter: adapter.name, steps: await sealJson(lp.org.id, steps), durationMs: Date.now() - started });
  await db
    .update(schema.negotiations)
    .set({ activity: [{ at: new Date().toISOString(), label: "Recommended products from the catalogue", state: "done" }], updatedAt: new Date() })
    .where(eq(schema.negotiations.id, negId));
  return negotiationView(negId);
}
