# Threat model

| Attacker / failure | Mitigation | Where tested |
| --- | --- | --- |
| Buyer prompt injection ("ignore your margin policy", "reveal your costs") | Policy and prices are computed server-side from `candidateId`s; the model only chooses among returned candidates and its reply is validated against the candidate figures. Injection patterns are logged as `injection_blocked`. Buyer responses never carry economics or rule ids. | domain tests (public projection), API run on 2026-10-16 |
| Compromised model | Same as above: a model cannot mint a number, change policy, sign, or call a money function. | adapter design |
| Compromised relayer | Relayer calls carry both parties' signatures or are anyone-callable; it cannot change payee or amounts. | `test_settle_rejectsSellerOnlyForgedAcceptance`, `test_fund_rejectsForgedSellerSignature` |
| Fraudulent seller usage | Settlement requires the buyer's signed cumulative acceptance; seller-only receipts never move funds. | contract tests |
| Seller redirects payee | Payee is in the signed terms; changing it invalidates the signature; settlement always pays the stored payee. | `test_fund_rejectsTamperedPayee`, `test_settle_alwaysPaysOriginalPayee` |
| Replay across chain / contract / deal / nonce | EIP-712 domain binds chain and contract; terms digest is single-use; acceptance nonce strictly increases. | `test_fund_signatureDoesNotReplayAcrossContracts`, `test_settle_rejectsNonceReplayAndDecrease` |
| Refund vs settlement race | Settlement only before `end + grace`, refund only at or after; both guarded by status and arithmetic; closes the deal. | `test_refundSettleRace_neverDoublePays` |
| Duplicate request ids | Unique `(dealId, requestId)`; retries return the stored receipt. | e2e step 4 |
| Chain RPC outage / app restart mid-transaction | Pending `chain_txs` are re-checked; events are unique by `(txHash, logIndex)`; balances re-read from chain. | reconciler design |
| Dishonest or stale cost feed | Cost models are versioned with `freshUntil`; stale cost rejects quotes (`COST_MODEL_STALE`). | domain |
| Cross-org data leak | Every seller route filters by the session's `orgId`; buyer routes expose only public projections. | code review; add IDOR tests |
| Wallet phishing / fake tx | The UI never shows a hash it did not receive from the chain or the relayer; no simulated confirmations. | UI rule |
| Owner drain | No sweep function; owner can only pause new deals and set the arbiter. | `test_owner_cannotMoveFunds`, invariant `invariant_ownerHoldsNothing` |
| Arc specifics: transfers to blocklisted addresses revert, min base fee 20 gwei | Fees computed from the block base fee with the 20 gwei floor; blocklisted payee is an accepted DoS risk documented in OPEN_ISSUES. | `feeParams()` |

Not covered: a hostile arbiter (trusted role by design), legal enforceability of the signed terms, service quality disputes beyond refusal to sign.
