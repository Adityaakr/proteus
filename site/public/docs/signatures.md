# What is signed, and by whom · Proteus AI docs

Source: <https://app.proteus.co.in/docs/signatures> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Every message that moves money or identity, who signs it, and who checks it._

For buyers, agent builders and auditors. You will learn which keys exist, what each one signs, and where each signature is checked: by a contract on Arc, by Circle, by Proteus, or by the buyer before countersigning.

_Diagram: Three keys sign; the contracts on Arc check what moves money._

Buyer wallet: permit (checked by Arc USDC), terms and acceptance (DealEscrow). Seller signer, held encrypted by Proteus: terms and delivery (DealEscrow), policy commitments (ProteusPolicyRegistry). Seller wallet: ERC-8004 registration (IdentityRegistry), which publishes the payee and the signer.

### Every signature

| Message | Signed by | Checked by |
|---|---|---|
| Terms (EIP-712, domain `ProteusDealEscrow` v1): deal id, buyer, seller, payee, USDC, product, unit price, max units, prepaid, start, end, grace, public terms hash, nonce, expiry | Buyer wallet + seller signer | DealEscrow `createAndFundDeal` |
| USDC permit (EIP-2612): exactly the prepaid amount, spender DealEscrow | Buyer wallet | Arc USDC |
| Receipt per delivered unit or batch (EIP-191 personal message) | Seller signer | The buyer or its agent, off chain, before countersigning |
| Acceptance (EIP-712): cumulative units and amount, receipts root, nonce, expiry | Buyer wallet | `settleAcceptedUsage` |
| Delivery (EIP-712): cumulative units and receipts root, no amount | Seller signer | `settleAcceptedUsage`, which requires both to match the Acceptance |
| Policy commitment (`commitBySig`) | Seller signer | ProteusPolicyRegistry |
| ERC-8004 registration (a transaction) | Seller's own wallet | Arc IdentityRegistry |
| Rating (`giveFeedback`, a transaction) | Buyer wallet | Arc ReputationRegistry, then Proteus's link check |
| x402 payment authorization (EIP-3009) | Buyer wallet | Circle's facilitator or Gateway |
| x402 seller proof | Seller signer | Circle's facilitator |
| Service key rotation (address and time) | Buyer wallet | Proteus server |

> **The seller signer:** A per-seller key Proteus holds, AES-256-GCM encrypted ([signer.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/chain/signer.ts)). It countersigns offers so sellers need not approve each one, and on chain it is the deal's seller address. It cannot move escrowed funds or change the payee, which is pinned to the owner's wallet. It can end a term early (`sellerCloseTerm`), and it collects x402 payments until the seller sweeps them. Revoking it stops new signatures; deals it already signed keep accepting it until they close.
