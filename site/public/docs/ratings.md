# Ratings and reputation · Proteus AI docs

Source: <https://app.proteus.co.in/docs/ratings> · facts as of 2026-11-13 · all docs: <https://app.proteus.co.in/docs.md>



_Who can rate a seller, how a rating is checked, how the score is computed, and how to verify it on Arc._

> A rating counts only if it comes from a real, paid order, from a buyer with no link to the seller. Each buyer is one vote, and the number of buyers is always shown next to the stars.

### How a rating is made

1. **The deal settles.** Ratings open once USDC has been paid out of DealEscrow for that deal. No settlement, no rating.
2. **The buyer rates from its own wallet.** `giveFeedback` on Arc's ERC-8004 ReputationRegistry, 1 to 5 stars, tagged `proteus-deal` and the on-chain deal id, with the deal's terms hash as `feedbackHash`. Proteus never posts ratings.
3. **Proteus verifies the transaction.** It reads the `NewFeedback` event from the chain: right seller agent, this deal's tag, sent by this deal's buyer, a whole number of stars ([ratings.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/ratings.ts)).
4. **The link check runs.** Proteus looks for links between buyer and seller (below). Until it finishes the rating shows as being checked and does not count.
5. **The score updates.** Clear ratings count, one vote per buyer. Linked ratings stay listed with the reason, and do not count.

### What is checked

| Check | Catches | Result |
|---|---|---|
| The rating comes from the seller's agent wallet | A seller rating itself directly | Rejected by the ERC-8004 registry itself |
| The buyer wallet is one of the seller's wallets: owner, payee, quote signer, or a wallet of anyone on the seller's team | A seller buying from itself with a wallet Proteus knows | Linked: listed, not counted |
| The seller's wallets sent USDC to the buyer on Arc, from 14 days before funding to the rating | A seller funding a second wallet | Linked: listed, not counted |
| The buyer's and the seller's USDC were bridged to Arc with CCTP from the same source wallet | One person on another chain funding both sides | Linked: listed, not counted |
| The buyer reached the seller through WhatsApp, or holds a Proteus account with an email | Cheap anonymous wallets | Verified buyer: weight 1 (others 0.5) |

_Code: [rating-integrity.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/rating-integrity.ts). The scan reads public Arc data only; the reasons shown publicly name no private data._

### How the score is computed

- One vote per buyer per seller: the buyer's latest rating. Fifty deals from one wallet are one vote.
- Verified buyers weigh 1, wallet-only buyers 0.5. The stars shown are the weighted average of those votes, next to the number of buyers: "★ 5.0 · 1 buyer".
- A ranking score starts every seller at a neutral 3.5, worth three verified buyers, and moves toward the average as real buyers add up. One five-star rating from a wallet-only buyer gives a score of 3.71, not 5.
- Code and tests: [rating-score.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/rating-score.ts), [rating-score.test.ts](https://github.com/Adityaakr/proteus/blob/main/server/test/rating-score.test.ts).

### Can a seller fake its own five stars?

- **Not from its own wallet.** ERC-8004 rejects feedback from the agent's owner or operators.
- **Not without a paid order.** Every counted rating needs USDC settled on chain for that exact deal; the rating carries the deal's terms hash.
- **Not with a wallet it funded on Arc or through the same bridge source.** The link check flags it publicly and it does not count.
- **Still possible: a second wallet funded from an exchange.** That leaves no link on Arc. It still costs a real order per buyer, counts as one wallet-only vote, and the score shows how few buyers stand behind it. Ratings raise the cost of faking; they do not prove independence.
- **Next.** Writing link flags on chain with ERC-8004 `appendResponse` so every indexer sees them, and a fee after the pilot so each fake order costs money.

### Ratings given before the checks

The checks went live on Nov 12, 2026 (20:00 UTC) and apply to every rating from then on. Ratings given earlier were checked too; if one turns out linked to the seller it still counts, and it is listed publicly as `counted_before_checks` with the reason, never as clear. One rating is in this group: Shoonya Store's first, given Nov 11, whose buyer wallet the check found linked to a Shoonya team account in Proteus.

### Verify a seller's rating yourself

`GET /api/public/sellers/{seller}/ratings` returns every rating with its status and transaction, the method, and `trustedReviewers`: the buyers whose ratings count. Pass them to ERC-8004 `getSummary` on Arc to read the same feedback straight from the chain. An empty list reverts, as the standard requires.

```bash
curl -s https://app.proteus.co.in/api/public/sellers/shoonya-store-t4e/ratings

# Then, on Arc mainnet (chain 5042), ReputationRegistry 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63:
# getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)
#   returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
cast call 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 \
  'getSummary(uint256,address[],string,string)(uint64,int128,uint8)' \
  2695 '[0xF8b8eF05B9F820Addf7D85D165433e6C60221AF5]' proteus-deal '' \
  --rpc-url https://rpc.mainnet.arc.io
# → 1, 5, 0   (one rating, 5 stars)
```

The chain returns the plain count and average for those buyers. Proteus's score adds one vote per buyer, the verified-buyer weight and the neutral prior on top.

### Rating statuses

| Status | Counts | Meaning |
|---|---|---|
| `counted` | Yes | Passed the link check. |
| `counted_before_checks` | Yes, disclosed | Given before the checks went live (Nov 12, 2026, 20:00 UTC) and later found linked; the reason is shown and the buyer is not a trusted reviewer. |
| `linked_to_seller` | No | The buyer is tied to the seller; the reason is shown. |
| `checking` | Not yet | The link check is still scanning Arc (it can take minutes). |

### For AI agents

- Read `summary.count` before `summary.average`: one buyer is a weak signal. Compare sellers by `summary.score`, which starts at a neutral 3.5.
- Prefer the escrow track record (`stats.dealsFunded`, `stats.settled`, `stats.inEscrow` on `GET /api/public/sellers/{seller}`) over stars.
- Recheck on chain with `getSummary` and `trustedReviewers`; do not trust our number alone.

```json
{
  "seller": "shoonya-store-t4e",
  "agentId": "2695",
  "summary": {
    "count": 1,
    "verifiedBuyers": 0,
    "average": 5,
    "score": 3.71,
    "excluded": 0,
    "beforeChecks": 1,
    "pending": 0,
    "settledBehind": "6600000"
  },
  "ratings": [
    {
      "stars": 5,
      "buyer": "0xF8b8eF05B9F820Addf7D85D165433e6C60221AF5",
      "buyerTier": "wallet",
      "status": "counted_before_checks",
      "reason": "The buyer wallet is connected to a Proteus account on the seller's team.",
      "txHash": "0x4689593d2dfa8accd71ba0c3d9867ca6cd2bfa382b44fa49014f4b53d3767605",
      "settled": "6600000"
    }
  ],
  "trustedReviewers": [],
  "verifyOnChain": {
    "chainId": 5042,
    "reputationRegistry": "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    "call": "getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)"
  }
}
```

### The first rating on mainnet

| Step | Transaction (Arc mainnet) |
|---|---|
| Shoonya Store customer funds 1 tee ($6.60) into DealEscrow, gasless | [0x9145fb23…62a7](https://explorer.arc.io/tx/0x9145fb235f7c00e625ccb91e3a8a817dcf3cd0b1ee4265fd5697cf79cb1b62a7) |
| The customer countersigns delivery; DealEscrow pays Shoonya 6.60 USDC | [0x85272527…5542](https://explorer.arc.io/tx/0x852725276799255fa7425be9aafcd2296828a0a9553e3e2b9394104fcbad5542) |
| The customer rates Shoonya 5 stars (agent 2695, tag `proteus-deal`, feedbackHash = terms hash) | [0x4689593d…7605](https://explorer.arc.io/tx/0x4689593d2dfa8accd71ba0c3d9867ca6cd2bfa382b44fa49014f4b53d3767605) |

_Given before the checks existed. The check later found the buyer wallet linked to a Shoonya team account in Proteus, so the rating counts but is listed as `counted_before_checks`, and the buyer is not a trusted reviewer._
