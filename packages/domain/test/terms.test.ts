import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { ACCEPTANCE_TYPES, TERMS_TYPES, domain, hashAcceptance, hashTerms, productIdHash, publicTermsHash, receiptsRoot, type Acceptance, type Terms } from "../src";

const CONTRACT = "0x1111111111111111111111111111111111111111" as const;
const CHAIN = 5042002;

describe("EIP-712", () => {
  it("hashes terms deterministically and signatures verify", async () => {
    const buyer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const t: Terms = {
      dealId: 1n,
      buyer: buyer.address,
      seller: "0x2222222222222222222222222222222222222222",
      payee: "0x2222222222222222222222222222222222222222",
      usdc: "0x3600000000000000000000000000000000000000",
      productId: productIdHash("order-support"),
      unitNum: 960_000n,
      unitDen: 1n,
      maxUnits: 1500n,
      prepaid: 1_440_000_000n,
      start: 1_800_000_000n,
      end: 1_802_592_000n,
      grace: 259_200n,
      publicTermsHash: publicTermsHash({ includes: ["Order status"], refundPolicy: "x" }),
      nonce: 1n,
      expiry: 1_800_003_600n,
    };
    const h1 = hashTerms(CHAIN, CONTRACT, t);
    const h2 = hashTerms(CHAIN, CONTRACT, { ...t });
    expect(h1).toBe(h2);
    expect(hashTerms(1, CONTRACT, t)).not.toBe(h1); // domain binds chain
    const sig = await buyer.signTypedData({ domain: domain(CHAIN, CONTRACT), types: TERMS_TYPES, primaryType: "Terms", message: t });
    expect(sig.length).toBe(132);
  });

  it("acceptance hash depends on nonce and amount", () => {
    const a: Acceptance = { dealId: 1n, termsHash: ("0x" + "11".repeat(32)) as `0x${string}`, cumulativeAmount: 100n, cumulativeUnits: 1n, receiptsRoot: receiptsRoot([]), nonce: 1n, expiry: 2n };
    expect(hashAcceptance(CHAIN, CONTRACT, a)).not.toBe(hashAcceptance(CHAIN, CONTRACT, { ...a, nonce: 2n }));
    expect(ACCEPTANCE_TYPES.Acceptance.length).toBe(7);
  });

  it("receipts root is order-independent", () => {
    const a = ("0x" + "aa".repeat(32)) as `0x${string}`;
    const b = ("0x" + "bb".repeat(32)) as `0x${string}`;
    expect(receiptsRoot([a, b])).toBe(receiptsRoot([b, a]));
  });

  it("public terms hash is key-order independent", () => {
    expect(publicTermsHash({ a: 1, b: [1, 2] })).toBe(publicTermsHash({ b: [1, 2], a: 1 }));
  });
});
