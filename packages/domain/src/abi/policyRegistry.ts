import { encodeAbiParameters, keccak256, toHex, type Hex } from "viem";
import { ARC_MAINNET_CHAIN_ID } from "../arc";

/**
 * ProteusPolicyRegistry (contracts/src/ProteusPolicyRegistry.sol): append-only on-chain log of seller pricing-policy
 * commitments, keyed by the seller's ERC-8004 agentId. Same source on both networks; addresses differ.
 *   Arc mainnet  0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B  (deploy tx 0xd0b7f81eb77c468d9c1f461ede14e0bac0042ca0b3d5aa88274a48153df35597, Sourcify exact match)
 *   Arc testnet  0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A  (deploy tx 0xe053f0985e0068b179d303a1bac100c72a87e02e87f0fed1bf93cd046a98f117, Blockscout verified)
 */
export const POLICY_REGISTRY = {
  mainnet: "0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B",
  testnet: "0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A",
} as const;

export function policyRegistryFor(chainId: number): Hex {
  return chainId === ARC_MAINNET_CHAIN_ID ? POLICY_REGISTRY.mainnet : POLICY_REGISTRY.testnet;
}

/** EIP-712 domain and type the agent's `proteus.signer` signs for commitBySig. */
export const policyRegistryDomain = (chainId: number) => ({ name: "ProteusPolicyRegistry", version: "1", chainId, verifyingContract: policyRegistryFor(chainId) }) as const;
export const POLICY_COMMIT_TYPES = {
  PolicyCommit: [
    { name: "agentId", type: "uint256" },
    { name: "productId", type: "bytes32" },
    { name: "version", type: "uint64" },
    { name: "commitment", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** The private policy fields a commitment covers. Unit costs are never part of it. */
export interface PolicyFields {
  /** keccak256(utf8(productSlug)), the same value as Terms.productId. */
  productId: Hex;
  version: number;
  minMarginBps: number;
  maxDiscountBps: number;
  /** micro-USDC */
  approvalThreshold: bigint;
  /** micro-USDC */
  prepaidMinimum: bigint;
  availableCapacityUnits: bigint;
  quoteTtlSeconds: number;
  allowNonPositiveContribution: boolean;
}

export const POLICY_PREIMAGE_TYPE =
  "ProteusPolicy(bytes32 productId,uint64 version,uint32 minMarginBps,uint32 maxDiscountBps,uint256 approvalThreshold,uint256 prepaidMinimum,uint256 availableCapacityUnits,uint32 quoteTtlSeconds,bool allowNonPositiveContribution,bytes32 salt)";

/**
 * The salted commitment to one policy version:
 *   keccak256(abi.encode(keccak256(POLICY_PREIMAGE_TYPE), productId, version, minMarginBps, maxDiscountBps,
 *     approvalThreshold, prepaidMinimum, availableCapacityUnits, quoteTtlSeconds, allowNonPositiveContribution, salt))
 * The 32-byte random salt stops anyone from brute-forcing the small integer space of a policy to recover the seller's
 * margins. Revealing the fields plus the salt lets anyone recompute the commitment and compare it with the chain.
 */
export function policyCommitment(p: PolicyFields, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, { type: "bytes32" }, { type: "uint64" }, { type: "uint32" }, { type: "uint32" }, { type: "uint256" },
        { type: "uint256" }, { type: "uint256" }, { type: "uint32" }, { type: "bool" }, { type: "bytes32" },
      ],
      [
        keccak256(toHex(POLICY_PREIMAGE_TYPE)), p.productId, BigInt(p.version), p.minMarginBps, p.maxDiscountBps, p.approvalThreshold,
        p.prepaidMinimum, p.availableCapacityUnits, p.quoteTtlSeconds, p.allowNonPositiveContribution, salt,
      ],
    ),
  );
}

export const POLICY_REGISTRY_ABI = [
  {
    type: "function",
    name: "commitBySig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "productId", type: "bytes32" },
      { name: "version", type: "uint64" },
      { name: "commitment", type: "bytes32" },
      { name: "deadline", type: "uint64" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "policyOf",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "productId", type: "bytes32" },
      { name: "version", type: "uint64" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "commitment", type: "bytes32" },
          { name: "committedAt", type: "uint64" },
          { name: "authorizedBy", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "latestVersion",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "productId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
  { type: "function", name: "publishedSigner", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  {
    type: "event",
    name: "PolicyCommitted",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "productId", type: "bytes32", indexed: true },
      { name: "version", type: "uint64", indexed: true },
      { name: "commitment", type: "bytes32", indexed: false },
      { name: "authorizedBy", type: "address", indexed: false },
    ],
  },
] as const;
