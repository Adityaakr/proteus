import { z } from "zod";

/** Zod schemas for API payloads shared by server and web. Money crosses the wire as decimal strings or micro strings. */

export const MicroString = z.string().regex(/^\d+$/, "integer micro-USDC string");
export const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const HexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);

export const NetworkLabel = z.enum(["sandbox", "testnet", "mainnet", "illustrative"]);
export type NetworkLabel = z.infer<typeof NetworkLabel>;

export const StartNegotiationBody = z.object({
  sellerSlug: z.string().min(1),
  productSlug: z.string().min(1),
  buyerAddress: AddressSchema.optional(),
  /** Optional buyer-agent mandate, micro-USDC cap. */
  mandateCap: MicroString.optional(),
});

export const MessageBody = z.object({
  content: z.string().min(1).max(4000),
});

export const CounterBody = z.object({
  candidateId: z.string().min(1),
  targetTotal: MicroString.optional(),
  targetUnits: z.string().regex(/^\d+$/).optional(),
});

export const AcceptBody = z.object({
  buyerAddress: AddressSchema,
  /** Buyer's EIP-712 signature over Terms. */
  buyerSignature: HexSchema,
});

export const UsageAckBody = z.object({
  /** Buyer's EIP-712 signature over Acceptance. */
  buyerSignature: HexSchema,
  cumulativeUnits: z.string().regex(/^\d+$/),
  cumulativeAmount: MicroString,
  receiptsRoot: HexSchema,
  nonce: z.string().regex(/^\d+$/),
  expiry: z.string().regex(/^\d+$/),
});

export const ServiceExecuteBody = z.object({
  /** Canonical client request id; retries with the same id never double-charge. */
  requestId: z.string().min(8).max(128),
  input: z.object({
    orderId: z.string().optional(),
    email: z.string().optional(),
    question: z.string().min(1).max(2000),
  }),
});

export const ApprovalDecisionBody = z.object({
  decision: z.enum(["approve", "decline"]),
  reason: z.string().max(500).optional(),
  /** Owner wallet signature over the decision digest. */
  ownerSignature: HexSchema.optional(),
});

export const PolicyUpdateBody = z.object({
  minMarginBps: z.number().int().min(0).max(10000).optional(),
  maxDiscountBps: z.number().int().min(0).max(10000).optional(),
  approvalThreshold: MicroString.optional(),
  prepaidMinimum: MicroString.optional(),
  availableCapacityUnits: z.string().regex(/^\d+$/).optional(),
  quoteTtlSeconds: z.number().int().min(60).max(7 * 86400).optional(),
});

export const CostUpdateBody = z.object({
  variableCostPerUnit: MicroString,
  directCostPerDeal: MicroString.optional(),
  txCostBps: z.number().int().min(0).max(10000).optional(),
});

export type StartNegotiationBody = z.infer<typeof StartNegotiationBody>;
export type MessageBody = z.infer<typeof MessageBody>;
export type CounterBody = z.infer<typeof CounterBody>;
export type AcceptBody = z.infer<typeof AcceptBody>;
export type UsageAckBody = z.infer<typeof UsageAckBody>;
export type ServiceExecuteBody = z.infer<typeof ServiceExecuteBody>;
export type ApprovalDecisionBody = z.infer<typeof ApprovalDecisionBody>;
export type PolicyUpdateBody = z.infer<typeof PolicyUpdateBody>;
export type CostUpdateBody = z.infer<typeof CostUpdateBody>;
