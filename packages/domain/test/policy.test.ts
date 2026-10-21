import { describe, expect, it } from "vitest";
import { keccak256, pad, toHex } from "viem";
import { POLICY_REGISTRY, policyCommitment, policyRegistryFor } from "../src";

describe("policy commitment", () => {
  const fields = {
    productId: keccak256(toHex("invoice-processing")),
    version: 3,
    minMarginBps: 2500,
    maxDiscountBps: 1500,
    approvalThreshold: 500_000_000n,
    prepaidMinimum: 50_000_000n,
    availableCapacityUnits: 10_000n,
    quoteTtlSeconds: 21600,
    allowNonPositiveContribution: false,
  };

  it("matches the Solidity golden vector (contracts/test/PolicyCommitment.t.sol)", () => {
    expect(policyCommitment(fields, pad("0xbeef", { size: 32 }))).toBe("0x6efc66ef2885839b175f24716f1b25436f7a027dd72f76fb15d642324ae8b66d");
  });

  it("changes with the salt, so a policy cannot be recovered by guessing its fields", () => {
    expect(policyCommitment(fields, pad("0x01", { size: 32 }))).not.toBe(policyCommitment(fields, pad("0x02", { size: 32 })));
  });

  it("changes with any policy field", () => {
    const salt = pad("0xbeef", { size: 32 });
    expect(policyCommitment({ ...fields, minMarginBps: 2501 }, salt)).not.toBe(policyCommitment(fields, salt));
  });

  it("resolves the registry per network", () => {
    expect(policyRegistryFor(5042)).toBe(POLICY_REGISTRY.mainnet);
    expect(policyRegistryFor(5042002)).toBe(POLICY_REGISTRY.testnet);
  });
});
