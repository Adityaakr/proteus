import { loadProductById } from "./catalog";

/** Product names by id, loaded once per distinct product; a product that no longer loads reads "Product". */
export async function productNamesById(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of Array.from(new Set(ids))) {
    try {
      out.set(id, (await loadProductById(id)).product.name);
    } catch {
      out.set(id, "Product");
    }
  }
  return out;
}
