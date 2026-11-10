# 03 · WhatsApp channel with privacy by default

Status (2026-11-11): Phases 0, 1a and 2 built on branch feat/whatsapp-channel and tested locally against a fake Graph API (server/scripts/whatsapp-e2e.ts, 30 checks). Not deployed; no real Meta app yet. Seller cost/policy encryption (1b) deferred. Planned 2026-11-10. Prism PLAN run (6 lenses: data-flow, WhatsApp platform, security, regulatory, adversary, practitioner).

## 1. Recommendation

Let a seller connect **its own WhatsApp number** (Meta Cloud API, seller-owned WhatsApp Business Account, onboarded through Embedded Signup with Proteus as Tech Provider, no BSP in between). Buyers chat with the seller's agent in WhatsApp. Pricing stays in deterministic code, as today. Chat carries only what the buyer is entitled to see anyway (offers, totals, public reasons). Every step that touches money or identity (sign terms, fund, countersign, upload artwork) happens on the Proteus web page behind a short-lived, buyer-bound link.

Privacy comes from three rules, applied in order:
1. **Never collect it.** No phone numbers, names or addresses go to the LLM, the chain, alerts or logs. Buyers are keyed by a hash of Meta's business-scoped user id.
2. **Never send it.** Costs, floors and policy never leave the pricing engine. Chat text never carries wallet addresses, deal ids or quote ids.
3. **Encrypt what we must keep.** Each seller gets its own data key. Transcripts, order details, buyer contact data, cost models, policies and pricing basis are encrypted at rest. Short retention. Deleting a seller destroys its key.

**Fix the leaks that exist today before shipping WhatsApp** (Phase 0). Several of them get worse once one webhook IP and many phone numbers sit in front of the engine.

## 2. What leaks today (all `verified` by re-opening the line)

| # | Leak | Where | Who can exploit |
|---|---|---|---|
| L1 | Anyone holding a negotiation id reads the full transcript and requirements, budget included. No auth. | `server/src/routes/public.ts:96` | Anyone a link is forwarded to |
| L2 | Counteroffers have no rate limit. The engine is deterministic, and reasons differ per rule (margin floor vs max discount), so the floor can be binary-searched in about 20 tries. | `public.ts:105-109`, `packages/domain/src/pricing.ts:314-355` | Buyer, competitor |
| L3 | Rate limits trust `x-forwarded-for`, which anyone can spoof, and live in memory on one instance. | `server/src/lib/ratelimit.ts:3,16-17` | Anyone |
| L4 | `/api/review` publishes every deal's `publicTerms` (unit price, total) plus `dealIdOnchain`. One log lookup on `DealFunded` then links it to the buyer's wallet. | `server/src/services/review.ts:50-51`, `contracts/src/DealEscrow.sol:111` | Competitor, chain observer |
| L5 | A rejected quote returns raw internal rule ids. | `server/src/services/quotes.ts:62` | Buyer |
| L6 | Unhandled errors return up to 400 characters of the raw message. | `server/src/index.ts:105-111` | Anyone |
| L7 | The full transcript goes to the LLM provider unredacted. Costs do not. | `server/src/agent/anthropic.ts:49`, `openrouter.ts:34`, `adapter.ts:22-23` | LLM provider |
| L8 | All commercial and personal data is plaintext in Postgres: costs, policies, candidates with economics, `privateBasis`, transcripts, order details, emails. Only secrets are encrypted, under one global key that falls back to `SESSION_SECRET`. | `server/src/db/schema.ts:161-251,361`, `server/src/lib/crypto.ts:5-31`, `env.ts:93-96` | DB insider, backup leak |
| L9 | Unauthenticated `GET /deals/:id` returns `buyerAddress` and signatures. | `server/src/routes/deals.ts:16-20` | Anyone with the id |

What already holds: the LLM never sees costs, floors or policy (`negotiation.ts:175`, `pricing.ts:358-362`). Numbers in replies are checked against an allow-list (`anthropic.ts:115-119`). Alerts never carry buyer contact details (`notify.ts:5`). Only a salted policy commitment goes on chain, never policy values (`agent-registry.ts:147`).

## 3. Privacy model: who sees what after this plan

| Party | Sees | Never sees | Honest limit |
|---|---|---|---|
| **Buyer** | Their offers, totals, public reasons, own order | Cost, floor, policy, other buyers | Can still learn a price by buying |
| **Meta (WhatsApp)** | Message text, phone number, profile name, timing | Cost, floor, policy, wallet, deal id | Cloud API decrypts at Meta and keeps messages up to 30 days. Not end-to-end to us ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security)). |
| **LLM provider** | Scrubbed text of the chat, public offers | Phone, name, email, address, cost, floor | The scrubber uses patterns, so free-text PII can slip through. Use zero-retention, no-training terms. Seller can switch the model off (rule-based replies). |
| **Proteus (operator)** | Ciphertext at rest. Plaintext only in memory while the agent runs | Raw data in logs, backups or SQL | The server must decrypt to run the agent. An operator with production access plus the key service could read data. Phase 4 narrows this. |
| **Arc chain / public** | Wallets, amounts, terms hash | Phone, name, order details, prices on `/review` (after fix) | Wallet↔wallet payments are public by design |
| **Other sellers** | Nothing | Everything | Requires the L2/L4 fixes |

Do not market this as "fully private" or "end-to-end encrypted". The accurate claim is: *your costs and margins never leave the pricing engine; buyer details are never sent to the model, the chain or alerts; everything stored is encrypted per seller and deleted on schedule.*

## 4. Architecture

```
Buyer WhatsApp ──► Meta Cloud API ──webhook (X-Hub-Signature-256)──► /api/channels/whatsapp/webhook
                                                                        │ verify sig, dedupe wamid, drop groups
                                                                        ▼
                                              channel_sessions (org, HMAC(user_id) → negotiationId, optedIn, paused)
                                                                        │
                                       PII scrubber ──► startNegotiation / addBuyerMessage / counter   (unchanged)
                                                                        │ offers (public only)
                                                                        ▼
                                outbound sender (notify deliver() gets a "whatsapp" channel)
                                  - interactive buttons for offers
                                  - cta_url link: /w/<opaque token> → /app/offers/:quoteId (30 min, buyer-bound)
                                                                        │
                       Web (existing): sign Terms, gasless permit fund, order details, countersign
```

New pieces:
- **Tech Provider app.** Meta business verification and app review for `whatsapp_business_messaging` / `whatsapp_business_management`, Embedded Signup v4+ (v2/v3 are deprecated Oct 15, 2026). Each seller owns its WABA and payment method.
- **`channel_sessions` table.** Key: `(orgId, HMAC(pepper, business-scoped user id))`. The raw phone number is stored only encrypted, and only if needed to send. Key on the business-scoped id, since the phone number can be absent ([webhook payloads](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)).
- **Webhook.** Constant-time check of `X-Hub-Signature-256` on the raw body before parsing. `hub.verify_token` handshake. Deduplicate on `wamid`. Reject group messages. Never log the body.
- **Link tokens.** An HMAC over (quoteId, sender hash, expiry) gives buyer binding and an expired-link page. Chat text never contains wallet, deal or quote ids.
- **Seller WA token.** Encrypted under the seller's data key, never returned by the API.
- **Coexistence.** Allowed, so Shoonya keeps using the WhatsApp Business app for human replies. **Decline the 180-day history sync.** We do not want past chats.
- **First message** (required): "I'm Shoonya Store's AI sales agent. Reply HUMAN to reach the team, STOP to opt out. Privacy: <link>." This covers EU AI Act Art. 50, Meta's human-escalation rule and the DPDP notice.

## 5. Roadmap (testnet first; each phase ships alone)

**Phase 0: close today's leaks (no WhatsApp yet; helps the web and embed too).**
- Buyer token required on `GET /negotiations/:id` and `GET /deals/:id` (L1, L9).
- Counter limit per negotiation and per seller. Merge the floor and discount reasons into one public reason. Return `toPublicCandidate(c).publicReasons` at `quotes.ts:62` (L2, L5).
- Trust the forwarded header only from Railway's proxy. Move buckets to Postgres (L3).
- Make `/review` per-deal opt-in, drop `dealIdOnchain`, and show amount ranges (L4).
- Stop echoing raw errors (L6).
- `KEY_ENCRYPTION_SECRET` mandatory in every production, with no `SESSION_SECRET` fallback (L8).
- Accept: existing tests pass, plus a new test per leak showing the old request now fails.

**Phase 1: encryption and retention.**
- Per-org data key, wrapped by a KMS key. Blob format `v2.<kid>.` for rotation.
- Encrypt `turns.content`, `negotiations.requirements/candidates`, `decisions.privateBasis`, `agentRuns.steps`, `service_requests.input/output`, `cost_models`, `policies` values and emails.
- Retention job: transcripts deleted N days after the deal closes or 30 days idle. Offboarding destroys the seller key.
- Accept: a `SELECT` on those columns returns ciphertext. The app works unchanged. A deleted seller's rows can't be decrypted.

**Phase 2: WhatsApp slice for Shoonya (the smallest real proof).**
- Embedded Signup → webhook → engine → offer buttons → link to the existing offer and fund page. Seller is alerted on `deal_funded` and replies by hand in the WhatsApp Business app (coexistence).
- Includes the PII scrubber before the LLM, AI disclosure, HUMAN and STOP, an opt-in log, and per-sender rate limits.
- Accept, on Arc testnet with a test number: chat → offer → link → funded. No phone number in the DB, logs, LLM requests or alerts (assert by grep in an e2e test).

**Phase 3: complete the loop in chat.**
- Order details collected by walking `RequestSpec.fields` in chat (artwork as WhatsApp media, ≤512 KB or raise the cap), written through a server-side `recordOrderDetails` without the API key.
- Console takeover: `paused` flag, `seller` turn role, reply box relayed to WhatsApp.
- Delivery → countersign link sent in chat.

**Phase 4 (optional): operator-blind.**
- Run the pricing engine and decryption in a confidential VM with attested key release, so Proteus staff cannot read data even with production access. Only worth it if a seller asks for it.

## 6. Why
- **The engine is already split the right way.** Costs never reach the model (`negotiation.ts:175`). WhatsApp only adds a transport in front of transport-independent functions (`negotiation.ts:136,157,215`). Little core code changes.
- **Meta sees every message no matter what.** So the only defence there is to keep secrets out of chat text. That is a design rule, not a feature.
- **Today's leaks (L1–L4) are the real exposure.** WhatsApp makes them worse: every request comes from Meta's IPs, and a forwarded link exposes a transcript. Fixing them first is cheap and benefits the live web product.

## 7. Steelman of the rejected options
- **A BSP (Twilio, Gupshup, 360dialog).** Strongest case: onboarding in days, no Meta app review, billing handled, India support. Passed because it adds one more processor that holds plaintext and our token, with no privacy gain. **Keep it as the fallback if Meta app review stalls.** It is the one realistic risk to the timeline.
- **The seller runs the agent itself (full operator blindness).** Strongest case: Proteus never holds plaintext, which is the true answer to "nothing goes to us". Passed for v1 because a tee shop can't run always-on infrastructure, and WhatsApp replies are asynchronous, so a key must be available when the seller is offline. Phase 4 gets most of the benefit without moving the work to the seller.
- **No API: seller shares the store link in its WhatsApp Business app.** Strongest case: zero Meta integration, zero new data, ships today. It is a fine stopgap for Shoonya right now. Passed as the plan because the agent isn't in the chat, so it doesn't remove "a call per order".

## 8. Assumptions and falsifiers
- **A seller-scoped sales agent is allowed under Meta's Jan 15, 2026 AI rule (§4.7).** `supported` by Meta's statement to TechCrunch, not word-for-word policy text. If Meta classifies Proteus as an "AI Provider", the plan needs the AI Provider pricing track or a BSP.
- **USDC payment through an external link is not "selling currency".** `unverified`, the biggest platform risk. Policy bans selling crypto ([policy](https://whatsappbusiness.com/policy/)). Keep crypto wording out of chat, keep payment on the web, and expect review if reported. If a number gets restricted, fall back to link-sharing.
- **Buyers can pay in USDC on Arc.** For Indian tee buyers this is the real conversion blocker, not WhatsApp. If Phase 2 shows chats but no funding, the next project is a fiat on-ramp, not more chat.
- **Service messages cost little.** Since Oct 1, 2026, 1,000 free service messages per number per month, then paid. Meta's page also says service messages *stop being delivered* once charged; `unverified` whether that means without a payment method. The seller's WABA needs a card on file.

## 9. Open questions for you
1. **Which legal entity applies to Meta as Tech Provider?** Business verification needs a registered business. This is the longest lead time, so start it now.
2. **Retention window for chats:** 30 days after close (recommended), or longer for seller disputes?
3. **Phase 0 `/review` change:** make it opt-in (recommended), or keep it public with ranges? It is currently cited in traction updates.
4. **Model off-switch:** should sellers be able to run with rule-based replies only, so no chat text ever reaches an LLM?
5. **Shoonya:** coexistence on its current number, or a new number?

## 10. Regulatory must-dos (not legal advice; get Indian counsel)
- **Roles.** Seller = Data Fiduciary / controller. Proteus = processor (DPDP §8(2) needs a contract): a seller DPA template and a public sub-processor list (Meta, LLM provider, Railway, Circle).
- **DPDP Rules 2025.** Substantive duties apply from about May 2027. Build to them now: notice, withdrawal, erasure, breach report within 72 hours, access logs kept 1 year.
- **Chain.** No personal data on chain, ever. Phone↔wallet links are personal data: keep them off-chain and deletable.
- **Data use.** Never reuse buyer data across sellers, or Proteus becomes a controller.
- **Unverified risk.** PMLA / FIU-IND rules on virtual-asset intermediaries may reach a USDC escrow.

## Grounding
Code lines above were re-opened on 2026-11-10 (`verified`). The Meta, DPDP and EU facts come from the cited pages, read by a research agent (`supported`); the policy wording was not quoted directly.

> Cross-tier verification reduces instance- and tier-level error correlation but not
> shared-lineage blind spots. Treat cross-tier survival as weaker evidence than grounding.

Evidence: 12 verified, 8 supported, 3 unverified, 0 contradicted.

## Telemetry
- divergence: ~0.45 (evidence ~0.6, conclusion ~0.2), estimated by inspection, not computed | threshold 0.30 UNCALIBRATED
- grounding: n/a (no eval fixtures)
- models: draft=opus · skeptic panel not run; load-bearing code claims grounded directly instead
- claims: L1–L6 grounded · LLM-never-sees-costs grounded · Meta AI-rule supported · crypto-policy unverified
- fleet: 6 lenses · token-multiple n/a

CHANGELOG: one round, no critique loop (the lenses agreed on direction). The UX lens supplied the "no-API link sharing" stopgap; the adversary lens supplied L2 and L4, which became Phase 0. Open risks: Meta app review timing and the crypto-payment policy reading.
