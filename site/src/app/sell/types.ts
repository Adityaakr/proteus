/** v1 wire types used by the sell side (docs/api.md "v1 additions"), from the shared client. */
export type { MeResponse as Me, MeOrg, MeWallet, SignerInfo as Signer, ProductCreateBody, MarketItem } from "../lib/types";

export interface RevokeSignerResponse {
  revokedAt: string;
  note?: string;
  message?: string;
  [k: string]: unknown;
}

/** Honest default text when the API response does not carry its own note. */
export const REVOKE_NOTE =
  "Revoking stops future signing only. Deals that are already funded keep accepting this key for their Delivery and settlement, because the escrow contract checks the signer recorded in their Terms.";
