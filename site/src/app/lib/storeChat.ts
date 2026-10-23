/**
 * Store-wide deal desk conversations. A buyer who starts from a seller's store page talks to the whole store: each
 * negotiation is still about one product (its rules price the offers), and when the buyer moves to another product
 * the conversation continues in that product's negotiation. The chain of earlier negotiations is kept per tab, so
 * the page can show the whole conversation; nothing here is trusted by the server.
 */
import { api } from "./api";

export interface StoreChain {
  seller: string;
  /** Earlier negotiations in this store conversation, oldest first. */
  prior: string[];
}

const key = (negotiationId: string) => `proteus:store-chat:${negotiationId}`;

export function storeChain(negotiationId: string): StoreChain | null {
  try {
    const v = sessionStorage.getItem(key(negotiationId));
    return v ? (JSON.parse(v) as StoreChain) : null;
  } catch {
    return null;
  }
}

export function setStoreChain(negotiationId: string, chain: StoreChain) {
  try {
    sessionStorage.setItem(key(negotiationId), JSON.stringify(chain));
  } catch {
    /* without storage the conversation still works, product by product */
  }
}

/** Opens a store conversation on one product; later messages may move it to another. */
export async function startStoreChat(sellerSlug: string, productSlug: string, buyerAddress?: string, prior: string[] = []) {
  const n = await api.startNegotiation({ sellerSlug, productSlug, buyerAddress });
  setStoreChain(n.id, { seller: sellerSlug, prior });
  return n;
}
