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
  /** Where the first negotiation started: "all" from the store's own button (no product chosen), else its product. */
  scope?: "all" | "product";
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

/**
 * Opens a store conversation. `scope: "all"`: no product chosen yet, so the conversation is on all products (the
 * negotiation is on `productSlug` only so it has somewhere to live) until a message names one. Later messages may
 * move it to another product.
 */
export async function startStoreChat(sellerSlug: string, productSlug: string, buyerAddress?: string, prior: string[] = [], scope: "all" | "product" = "product") {
  const n = await api.startNegotiation({ sellerSlug, productSlug, buyerAddress, store: prior.length ? "continue" : "open" });
  setStoreChain(n.id, { seller: sellerSlug, prior, ...(prior.length ? {} : { scope }) });
  return n;
}
