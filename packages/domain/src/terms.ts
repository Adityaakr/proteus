import { hashTypedData, keccak256, toHex, type Address, type Hex } from "viem";

/**
 * EIP-712 structures shared by the contract (contracts/src/DealEscrow.sol), the server and the web app.
 * Any change here must be mirrored in the Solidity type hashes and covered by a cross-check test.
 */

export const EIP712_NAME = "ProteusDealEscrow";
export const EIP712_VERSION = "1";

export const TERMS_TYPES = {
  Terms: [
    { name: "dealId", type: "uint256" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "payee", type: "address" },
    { name: "usdc", type: "address" },
    { name: "productId", type: "bytes32" },
    { name: "unitNum", type: "uint256" },
    { name: "unitDen", type: "uint256" },
    { name: "maxUnits", type: "uint256" },
    { name: "prepaid", type: "uint256" },
    { name: "start", type: "uint64" },
    { name: "end", type: "uint64" },
    { name: "grace", type: "uint64" },
    { name: "publicTermsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export const ACCEPTANCE_TYPES = {
  Acceptance: [
    { name: "dealId", type: "uint256" },
    { name: "termsHash", type: "bytes32" },
    { name: "cumulativeAmount", type: "uint256" },
    { name: "cumulativeUnits", type: "uint256" },
    { name: "receiptsRoot", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export const DELIVERY_TYPES = {
  Delivery: [
    { name: "dealId", type: "uint256" },
    { name: "receiptsRoot", type: "bytes32" },
    { name: "cumulativeUnits", type: "uint256" },
  ],
} as const;

export interface Terms {
  dealId: bigint;
  buyer: Address;
  seller: Address;
  payee: Address;
  usdc: Address;
  productId: Hex; // bytes32
  unitNum: bigint;
  unitDen: bigint;
  maxUnits: bigint;
  prepaid: bigint;
  start: bigint;
  end: bigint;
  grace: bigint;
  publicTermsHash: Hex;
  nonce: bigint;
  expiry: bigint;
}

export interface Acceptance {
  dealId: bigint;
  termsHash: Hex;
  cumulativeAmount: bigint;
  cumulativeUnits: bigint;
  receiptsRoot: Hex;
  nonce: bigint;
  expiry: bigint;
}

export interface Delivery {
  dealId: bigint;
  receiptsRoot: Hex;
  cumulativeUnits: bigint;
}

export function domain(chainId: number, verifyingContract: Address) {
  return { name: EIP712_NAME, version: EIP712_VERSION, chainId, verifyingContract } as const;
}

export function hashTerms(chainId: number, verifyingContract: Address, terms: Terms): Hex {
  return hashTypedData({ domain: domain(chainId, verifyingContract), types: TERMS_TYPES, primaryType: "Terms", message: terms });
}

export function hashAcceptance(chainId: number, verifyingContract: Address, a: Acceptance): Hex {
  return hashTypedData({ domain: domain(chainId, verifyingContract), types: ACCEPTANCE_TYPES, primaryType: "Acceptance", message: a });
}

export function hashDelivery(chainId: number, verifyingContract: Address, d: Delivery): Hex {
  return hashTypedData({ domain: domain(chainId, verifyingContract), types: DELIVERY_TYPES, primaryType: "Delivery", message: d });
}

/** bytes32 id for a product slug (keccak of utf8). */
export function productIdHash(slug: string): Hex {
  return keccak256(toHex(slug));
}

/**
 * Public terms hash: keccak of the canonical JSON of buyer-visible terms (included capability list,
 * billable unit definition, refund policy text, integrations). Stored onchain as a commitment; the
 * plaintext lives offchain in the deal record and on the public record page.
 */
export function publicTermsHash(publicTerms: Record<string, unknown>): Hex {
  const canonical = JSON.stringify(sortKeys(publicTerms));
  return keccak256(toHex(canonical));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  if (typeof v === "bigint") return v.toString();
  return v;
}

/**
 * Receipts root: keccak over the sorted list of receipt digests. Simple and verifiable offchain;
 * the contract only needs a stable commitment both parties signed.
 */
export function receiptsRoot(receiptDigests: Hex[]): Hex {
  if (receiptDigests.length === 0) return ("0x" + "0".repeat(64)) as Hex;
  const sorted = [...receiptDigests].sort();
  return keccak256(("0x" + sorted.map((h) => h.slice(2)).join("")) as Hex);
}
