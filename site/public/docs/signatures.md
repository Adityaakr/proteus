# What is signed, and by whom · Proteus AI docs

Source: <https://app.proteus.co.in/docs/signatures> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Eight messages; the contract checks each one._

_Diagram: Three keys sign; four contracts check._

Buyer wallet: permit (checked by Arc USDC), terms and acceptance (DealEscrow). Seller signer, held encrypted by Proteus: terms and delivery (DealEscrow), policy commitments (ProteusPolicyRegistry). Seller wallet: ERC-8004 registration (IdentityRegistry), which publishes the payee and the signer.

| Message | Signed by | Checked by |
|---|---|---|
| Terms (EIP-712, `ProteusDealEscrow` v1) | Buyer wallet + seller signer | `createAndFundDeal` |
| USDC permit (EIP-2612), exact amount, spender = escrow | Buyer wallet | Arc's USDC |
| Receipt per delivered unit or batch | Seller signer | Buyer, before countersigning |
| Acceptance: cumulative units and amount | Buyer wallet | `settleAcceptedUsage` |
| Delivery: the same totals | Seller signer | `settleAcceptedUsage` |
| Policy commitment (`commitBySig`) | Seller signer | ProteusPolicyRegistry |
| ERC-8004 registration (a transaction) | Seller's own wallet | Arc IdentityRegistry |
| x402 authorization (EIP-3009) | Buyer wallet | Circle facilitator or Gateway |

> The seller signer is a per-seller key Proteus holds, AES-256-GCM encrypted ([signer.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/chain/signer.ts#L11)). It countersigns offers so sellers need not approve each one. It cannot move funds or change the payee, and the seller can revoke it.
