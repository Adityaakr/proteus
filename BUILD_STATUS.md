# BUILD_STATUS

Updated 2026-10-16 (Tameion deadline: 2026-10-17 23:59 ET).

## Working now

| Area | Status | Evidence |
| --- | --- | --- |
| Marketing site (PROTEUS copy, Framer-faithful design) | done | `site/`, http://localhost:5174 |
| Deterministic pricing + policy engine (micro-USDC bigint) | done | `packages/domain`, 13 Vitest tests pass |
| EIP-712 Terms / Acceptance / Delivery shared types | done | `packages/domain/src/terms.ts` |
| `DealEscrow.sol` (fund, cumulative settle, seller close, refund, dispute, pause) | done | 24 unit/fuzz tests + 3 invariants pass (`pnpm contracts:test`) |
| API: negotiation, counter, quote, accept, fund, provision, metered service, usage ack, settle, refund, review, seller console | done | `server/`, `scripts/testnet-demo.ts` passes on local Arc anvil |
| Agent adapters: rule-based (always) and Anthropic tool-use (with key) | done | `server/src/agent` |
| Prompt-injection handling ("ignore your margin policy") | done | decision log kind `injection_blocked`, policy unchanged |
| Chain reconciler (balances from chain events, journal entries) | done | `server/src/chain/reconciler.ts` |
| Relayer: Circle developer-controlled wallet or viem fallback | done, Circle path untested without credentials | `server/src/chain/relayer.ts` |
| Web platform (buyer flow, seller console, review pages, agentic components) | done, walked against the live API at 1200 and 390 with Playwright, no page errors | `site/src/app`, `site/scripts/shot-platform.mjs` |

## End-to-end rehearsal (local Arc anvil, chain 31337, real contract calls)

`E2E OK` on 2026-10-16: negotiate → below-floor counter rejected → quote → buyer signs Terms → seller countersigns → USDC approve → relayer `createAndFundDeal` → reconciled deposit 1,440.000000 → provision → 4 service calls (2 delivered and billable, 1 refund handoff not billable, 1 unknown order not billable, 1 retry deduplicated) → buyer signs cumulative usage → relayer `settleAcceptedUsage` (1.920000 USDC) → seller `sellerCloseTerm` → relayer `refundUnused` (1,438.080000) → final `deposit = settled + refunded`, remaining 0 → public record with every tx hash.

## Arc testnet (real)

DealEscrow deployed and verified at `0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46`. Full loop executed with real transactions on 2026-10-16: see `docs/acceptance-report.md` (approve, fund, settle, close, refund; `deposit = settled + refunded`). The buyer was our own funded key, so this is proof of the loop, not customer traction.

## Circle Facilitator Service (x402)

Pay per call verified and settled by Circle's facilitator on Arc testnet (`docs/acceptance-report.md`). Pending settlements are polled on `/status/{paymentId}`.

## Account model (second pass)

Privy login with embedded wallets, `/app` dashboard with Buy and Sell, per-org seller signer, market, x402 pay-per-call endpoint. Server routes are live and tested with the dev bypass; the web rebuild is being integrated. See `docs/01-account-and-flow.md`.

## Balance reads (2026-10-16, evening)

- Wallet and Home showed "Could not read your balance: HTTP request failed" in Aditya's browser while the same RPC answered from the server. Fix: the web app's viem public client now uses a `fallback` transport (public Arc RPC, then the same-origin read-only relay `POST /api/rpc`), and `useBalances` falls back to `GET /api/me/wallet` for the linked address. Verified headless with the public RPC reachable and with it blocked (both render 13.20 USDC, relay hit 10 times); error copy now names the RPC and the HTTP status.

## Real labels, seller endpoints, deposit sheet (2026-10-16, late evening)

- "Sandbox" pill removed from every balance surface: the wallet, escrow and transactions were always real Arc testnet, so the badge now reads "Arc testnet". The seeded Northwind seller is labeled "Demo seller" (sample order store); live orgs show "Live seller" on Home, Market, product pages, review records and the seller console.
- Sellers can now publish a product backed by their own HTTPS endpoint (adapter `http`, encrypted secret, 20 s timeout, bills only 2xx JSON answers not marked `billable:false`). Start selling has a "Service endpoint" choice; the seller product page shows which one is configured. Unit-tested against a local HTTP server (4 tests). Pay per call routes through the same adapter. Published for real on org lumen-voice: product `callback-booking` ($0.20/booking Trial, $0.10 per call) pointing at a local endpoint; money has not been run through it yet (Aditya paused the browser run).
- Deposit is a sheet (centered dialog on desktop, bottom sheet on phones) with the QR, address, faucet link and a live watcher that polls for 90 s and confirms the arrival with the delta. Esc, backdrop and close dismiss it. Every app page is now centered (`.sellerMain` has `margin: 0 auto`).

## Market and negotiation redesign with seller identity (2026-10-16, night)

- Sellers have a brand (logo, tagline, category, website, accent) set at Start selling or in Sell > Settings > Brand, with client-side logo resizing to a sub-96 KB data URL. The market is seller-centric: search, category filter, live sellers first, each card with the wordmark or monogram, label, tagline, real stats from the deals table and its product rows. Product page: breadcrumb hero with the seller mark, meta chips, capability grid, billable-unit callout, tier cards with "Best unit price", a five-step "How a deal works" strip, an About card with stats, and a tighter Negotiate rail. Negotiation page: seller wordmark in the header and chat, deal summary rail, offer cards with volume/unit price/refund grid and included-feature chips. Negotiations list shows the seller mark.
- Six demo sellers seeded (Harbor Logistics, Kaidata, Meridian Legal, Vantage API, Orbit Labs, Tidewater Health) with PROTEUS's own invented marks; Northwind renamed Northwind Commerce. Real third-party logos were deliberately not used: listing a real company as a seller would claim a customer that does not exist.
- Verified headless at 1440 and 390 px: market, demo and live product pages, a fresh negotiation with three offers, the negotiations list and seller settings render with no console errors or horizontal overflow.

## Demo sellers removed, hero facts and timeline (2026-10-16, late night)

- All six seeded demo sellers deleted (`server/scripts/remove-demo-sellers.ts`); Northwind's sample-store product and Lumen Voice's sample-store product are hidden from the market (historical deals kept). The demo adapter is gone; new products must run on the seller's own HTTPS endpoint. The market now lists only verified sellers.
- Product hero: pill chips replaced by a labeled facts strip (term, unit price, pay per call, settlement, service) with icons and no dots. Label tags no longer show a dot unless they describe a lifecycle state. "How a deal works" is a five-node timeline.

## Product page as a document (2026-10-16, night)

- Rebuilt `site/src/app/market/ProductPage.tsx` with `product.module.css`: plain header (seller wordmark, verified badge, title, summary, quiet inline meta chips), sections separated by rules instead of boxed cards, a pricing table with "Best unit price" inline, deal steps as a numbered list, About as a key/value block, and one sticky rail holding Negotiate and Pay per call. No floating badges, no dotted pills, no icon tiles.

## Seller console v2 (2026-10-16, late)

- Sell navigation: Overview, Negotiations, Deals, Customers, Products & pricing, Payments, Usage & delivery, Insights, Agent policies, Settings.
- Overview rebuilt on `GET /app/dashboard`: revenue earned, active negotiations (with how many need approval), deal margin, customer funds held; "Needs your attention" cards for pending approvals with the rule that triggered them; recent deals list. New pages: Customers (per-buyer totals, click through to their deals), Usage & delivery (every metered request with billing and receipt state), Insights (30-day bars and funnel from real rows), Agent policies (per-product floor, discount cap, approval threshold, capacity, validity, cost). All numbers are sums over the seller's own rows.

## "How PROTEUS compares" on the marketing page (2026-10-16, late)

- New light section `site/src/sections/Compare.tsx` between Differentiation and Security: headline, seven capabilities, PROTEUS in a faint accent first column, then DealHub, Pactum AI, Nue, Sequence, Metronome as plain typographic names linking to their sites (no third-party logos). Marks are Yes / Partial / Not core focus with a short qualifier where the plain word would overstate; assessed from each vendor's public product pages (searched 2026-10-16). PROTEUS marks only what is implemented; USDC is labeled Arc testnet. Phone layout is one card per product. Closing line and footnote included.

## Model-written negotiation (2026-10-16, late)

- OpenRouter key configured in `server/.env` (untracked); the agent adapter reports `openrouter:anthropic/claude-sonnet-4.5`. A real turn on Lumen Voice's product returned a plain-prose reply naming three policy-checked offers; prompts now forbid markdown so the chat renders cleanly.

## Buy or sell at sign-in, publish fix, more services (2026-10-16, night)

- Publishing from the UI failed with "invalid request": the form sent unit counts as numbers while the server validated digit strings. The server now accepts both; the form shows the server's field-level reasons on failure.
- Accounts carry a mode (buy or sell). First sign-in lands on /app/welcome with the two choices; sellers land on the console, buyers on the market. The sidebar shows one side at a time with "Switch to buying/selling" in the footer; the phone tab bar follows.
- Lumen Voice lists three endpoint-backed services: AI receptionist (revived onto the HTTP adapter), Callback booking, After-hours answering. All point at the local test endpoint until Aditya supplies a public one.

## Example sellers modeled on competitor customer segments (2026-10-16, night)

- Six example sellers restored via `server/scripts/seed-example-sellers.ts` (`pnpm --filter @proteus/server db:seed-examples`), each modeled on a segment the comparison-table tools serve: Orbit Labs (hosted inference per million tokens, the Metronome segment), Kaidata and Vantage API (API-first data and fintech, the Sequence segment), Meridian Legal (legal AI scale-up), Harbor Logistics and Tidewater Health (operations and vertical teams). Prices sit at public market rates for each category. Brands are PROTEUS's own marks; the UI says "Example seller" everywhere, the product page says the service is illustrative, and the market carries a one-line explanation. Real companies are not listed as sellers.

## Operations-agent categories and example sellers (2026-10-16, night)

- Five market categories added: Treasury, AP and AR, Vendor management, Operations, Compliance. One example seller each with its own invented mark (Cairn Treasury, Ledgerline, Tessera, Pilotlight, Lantern), a precise billable unit, market-rate tiers and opening prompts. Square marks and wordmarks generated by `site/scripts/make-logos2.mjs`; every example seller's brand now carries `markUrl`.
- "What counts as one unit" guidance added to the publish form and as section 07 of `/docs`, since countersigned units are the contract and sellers in these segments will otherwise sell time or standing states.

## Blocked on inputs from Aditya

1. Done: deployer and relayer funded, escrow deployed, loop executed on testnet.
2. An independent buyer (a second person logging in with Privy and funding their embedded wallet) would turn the self-run proof into traction.
3. Optional: `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` (model-written replies; rule-based otherwise), `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` (relayer via Circle wallets; `pnpm --filter @proteus/server tsx scripts/circle-wallet.ts` creates the ARC-TESTNET wallet).

## Not built (deliberately, see DECISIONS.md)

Magic-link auth, teammates/roles, CSV export, Telegram, CCTP, x402, Gateway, OpenAPI generator, pg-boss worker, Playwright suite (replaced by the API-level e2e script).
