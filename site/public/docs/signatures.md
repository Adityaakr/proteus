# What is signed, and by whom · Proteus AI docs

Source: <https://app.proteus.co.in/docs/signatures> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Every message that moves money or identity, who signs it, and who checks it._

For buyers, agent builders and auditors. You will learn which keys exist, what each one signs, and where each signature is checked: by a contract on Arc, by Circle, by Proteus, or by the buyer before countersigning.

_Diagram: Three keys sign; the contracts on Arc check what moves money._

Buyer wallet: permit (checked by Arc USDC), terms and acceptance (DealEscrow). Seller signer, held encrypted by Proteus: terms and delivery (DealEscrow), policy commitments (ProteusPolicyRegistry). Seller wallet: ERC-8004 registration (IdentityRegistry), which publishes the payee and the signer.

<a id="signatures-table"></a>

### Every signature

| Message | Signed by | Checked by |
|---|---|---|
| Terms (EIP-712, domain `ProteusDealEscrow` v1): deal id, buyer, seller, payee, USDC, product, unit price, max units, prepaid, start, end, grace, public terms hash, nonce, expiry | Buyer wallet + seller signer | DealEscrow `createAndFundDeal` |
| USDC permit (EIP-2612): exactly the prepaid amount, spender DealEscrow | Buyer wallet | Arc USDC |
| Receipt per result or delivery batch (EIP-191 personal message) | Seller signer | The buyer or its agent can check it off chain before countersigning; the web app and the MCP server check totals, not receipt signatures |
| Acceptance (EIP-712): deal id, terms hash, cumulative units and amount, receipts root, nonce, expiry (1 hour after Proteus prepares it) | Buyer wallet | `settleAcceptedUsage` |
| Delivery (EIP-712): cumulative units and receipts root, no amount | Seller signer | `settleAcceptedUsage`, which requires both to match the Acceptance |
| Policy commitment (`commitBySig`) | Seller signer | ProteusPolicyRegistry |
| ERC-8004 registration (a transaction) | Seller's own wallet | Arc IdentityRegistry |
| Rating (`giveFeedback`, a transaction) | Buyer wallet | Arc ReputationRegistry, then Proteus's link check |
| x402 payment authorization (EIP-3009) | Buyer wallet | Circle's facilitator or Gateway |
| x402 seller proof | Seller signer | Circle's facilitator |
| Service key rotation (address and time) | Buyer wallet | Proteus server |

<a id="signatures-example"></a>

### Example: the terms to sign

`GET /api/quotes/{id}?buyer=0x…` returns this shape as `typedData`; sign it with `eth_signTypedData_v4`. Values are illustrative; amounts are micro-USDC.

**Terms typed data:**

```json
{
  "domain": {
    "name": "ProteusDealEscrow",
    "version": "1",
    "chainId": 5042,
    "verifyingContract": "0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46"
  },
  "primaryType": "Terms",
  "types": {
    "Terms": [
      {
        "name": "dealId",
        "type": "uint256"
      },
      {
        "name": "buyer",
        "type": "address"
      },
      {
        "name": "seller",
        "type": "address"
      },
      {
        "name": "payee",
        "type": "address"
      },
      {
        "name": "usdc",
        "type": "address"
      },
      {
        "name": "productId",
        "type": "bytes32"
      },
      {
        "name": "unitNum",
        "type": "uint256"
      },
      {
        "name": "unitDen",
        "type": "uint256"
      },
      {
        "name": "maxUnits",
        "type": "uint256"
      },
      {
        "name": "prepaid",
        "type": "uint256"
      },
      {
        "name": "start",
        "type": "uint64"
      },
      {
        "name": "end",
        "type": "uint64"
      },
      {
        "name": "grace",
        "type": "uint64"
      },
      {
        "name": "publicTermsHash",
        "type": "bytes32"
      },
      {
        "name": "nonce",
        "type": "uint256"
      },
      {
        "name": "expiry",
        "type": "uint64"
      }
    ]
  },
  "message": {
    "dealId": "<on-chain deal id>",
    "buyer": "<your wallet>",
    "seller": "<seller signer>",
    "payee": "<seller payee>",
    "usdc": "0x3600000000000000000000000000000000000000",
    "productId": "<keccak256 of the product slug>",
    "unitNum": "6600000",
    "unitDen": "1",
    "maxUnits": "1",
    "prepaid": "6600000",
    "start": "<unix seconds>",
    "end": "<start + term>",
    "grace": "259200",
    "publicTermsHash": "<hash of publicTerms>",
    "nonce": "<nonce>",
    "expiry": "<quote expiry>"
  }
}
```

> **The seller signer:** A per-seller key Proteus holds, AES-256-GCM encrypted ([signer.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/chain/signer.ts)). It countersigns offers so sellers need not approve each one, and on chain it is the deal's seller address. It cannot move escrowed funds on its own: every payout also needs the buyer's Acceptance, and goes to the payee in the terms, which Proteus takes from the seller's account (the owner's wallet, fixed at the first publish). It can end a term early (`sellerCloseTerm`), could open a dispute on its deals on chain (no Proteus route does), and it collects x402 payments until the seller sweeps them. Revoking it stops Proteus using it for anything; deals it already signed name it as their seller on chain, so they can no longer settle through Proteus afterwards.
