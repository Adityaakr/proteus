# 01. Account model and first-run flow (Prism PLAN, 2026-10-16)

Panel: UX/flow (opus), practitioner (opus), security/custody (opus), simplicity (sonnet). Correction that triggered this: the first build shipped a judge demo path (storefront → chat → injected wallet) with no login and no account.

## Recommendation

One Privy login (email, Google, or an external wallet) creates one embedded EVM wallet per user. That wallet is the **Proteus AI account**: the user deposits Arc testnet USDC into it once and uses it to fund deals, pay per call, and, for businesses, receive payouts. Everything happens inside one dashboard at `/app` with two nav groups, **Buy** and **Sell**. Sell is a single "Start selling" row until the user publishes a product. There is no workspace switcher and no second balance. Existing screens (negotiation chat, offer cards, deal portal, the seller console) are re-mounted under `/app`, not rewritten. Offer and Checkout merge into one screen with a single "Fund deal from balance" action. Pay-per-call (x402 through Circle's facilitator on Arc) is a second purchase mode on a product page, built as one endpoint and time-boxed.

## Why

1. Nothing tied a person to their negotiations or deals (`site/src/main.tsx:43`, `server/src/routes/session.ts:11`), so no dashboard was possible. A verified identity keyed by Privy DID fixes that at the root.
2. The embedded wallet removes most of checkout: approve and fund run back to back from one confirm, no chain-switch prompts, and the same balance pays x402 calls.
3. Two payment modes need one rule: trying or low volume → pay per call; committing to volume or price → negotiated prepaid deal, escrowed and refundable. Both appear as cards on the product page; the agent suggests prepaid once per-call spend exceeds the Starter tier.

## Steelman of the rejected option (keep buyer and seller as separate funnels, no login)

Fastest path to a judge demo, zero auth risk, and the spec's reviewer path works without credentials. Passed because the founder's goal is a product people and businesses operate from, judges score traction on real users moving USDC, and a demo seller listing keeps the credential-free path alive inside the new flow.

## Decisions

| Topic | Decision | Grounding |
| --- | --- | --- |
| Auth | `@privy-io/react-auth` 3.49.1 `PrivyProvider` with `embeddedWallets.ethereum.createOnLogin: "users-without-wallets"`, `defaultChain`/`supportedChains` set to the Arc testnet viem chain | docs.privy.io setup, automatic-wallet-creation, configuring-evm-networks (read 2026-10-16) |
| Server identity | `@privy-io/node` 0.35.0 `verifyAccessToken` on every `/api/me`, `/api/app/*` and buyer-scoped route; users keyed by Privy DID; wallet addresses loaded from the Privy user object server-side, never from the request body | installed types `index.d.ts:14` |
| Custody wording | "Embedded wallet, key split between a hardware enclave and your login; exportable; Proteus AI never holds your key." Never claim "only you can move funds" where a server signer exists | docs.privy.io security architecture |
| Seller signer | Per-org server-held signer key is `t.seller`; payee pinned to the org owner's wallet at signing; signer shown and revocable in settings with the honest note that revocation stops future signing only | `contracts/src/DealEscrow.sol` SignatureChecker on `t.seller`; security lens option B |
| Relayer | Unchanged (Circle wallet when configured, viem otherwise). Adds per-user daily caps and skips zero-payout settles | `server/src/chain/relayer.ts` |
| Model | OpenRouter adapter through the OpenAI SDK (`baseURL https://openrouter.ai/api/v1`); Anthropic and rule-based adapters remain | openrouter.ai quickstart |
| x402 | `exact` scheme on `eip155:5042002`, USDC `0x3600…0000` EIP-712 domain `USDC`/`2`, Circle facilitator `https://api.circle.com/v1/facilitator/x402` (`/verify`, `/settle`, seller proof header). Nonce = `keccak(payer, requestId, resource, amount)` so retries cannot settle twice; `validBefore` ≤ 120 s; amount must equal the quoted price | developers.circle.com facilitator quickstart |

## Assumptions and falsifiers

- Privy embedded wallets sign EIP-712 and send transactions on a custom chain id 5042002 (docs say any `defineChain` with RPC and explorer works). If signing fails on Arc, fallback: Privy login plus the existing injected-wallet path.
- Arc USDC at `0x3600…0000` implements EIP-3009 (Circle's quickstart signs `TransferWithAuthorization` against it). If not, x402 is a stub.
- The Circle faucet funds native USDC, which on Arc is the same balance as the ERC-20, so one deposit covers gas and payments.

## Open questions for Aditya

- Testnet funding for the deployer and relayer is still the gate for real hashes.
- OpenRouter key and preferred model id.
- Whether x402 per-call should also pay for the agent's own model calls (the founder's note "paid through x402 with every paid call"); the panel read it as buyers paying per service call. Both are possible; the second is built first.

> Cross-tier verification reduces instance- and tier-level error correlation but not shared-lineage blind spots. Treat cross-tier survival as weaker evidence than grounding.

## Telemetry
- divergence: 0.41 (evidence 0.62, conclusion 0.10) | threshold 0.30 UNCALIBRATED
- grounding: n/a
- models: draft=opus · panel=3x-opus+1x-sonnet · skeptics not run (UI flow is reversible; custody claims grounded in docs)
- claims: privy-api grounded (installed types) · x402-flow supported (Circle docs) · arc-usdc-eip3009 unverified · delegation-not-onchain grounded (DealEscrow.sol)
- fleet: 4 lenses
