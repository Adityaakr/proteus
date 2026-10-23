# Evidence: Claude buys a merch sample through the Proteus MCP server (Arc testnet, 2026-10-23)

Claude (model `claude-opus-5-5`, Claude Code headless) was given only the nine Proteus MCP tools (`packages/mcp`), a testnet buyer key and a per-deal mandate of 13 USDC (`PROTEUS_MAX_PREPAID_USDC=13`), against the live testnet deployment https://ai.proteus.co.in. The seller is Kitbox, a demo merch seller labelled "Demo seller on Arc testnet" (ERC-8004 Agent #897439). Below are the tool calls and Claude's messages, unedited; tool results are trimmed to the fields that matter.

| Step | Transaction (Arc testnet) |
|---|---|
| Kitbox registers its agent (ERC-8004) | [0x4b618940…5ace7f](https://explorer.testnet.arc.io/tx/0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f) |
| Kitbox policy committed | [0x8af4a932…4f59](https://explorer.testnet.arc.io/tx/0x8af4a932e0d40626c8452da35b795912919cf8ed475012858b34ae4ae38e4f59) |
| Claude funds the sample gaslessly (12.50 USDC into escrow) | [0x28020780…3c73](https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73) |
| Claude settles after checking the seller's delivery receipt (12.50 USDC to the seller) | [0x63aeb139…8b45](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45) |

The delivery was recorded by the seller through `POST /api/app/deals/:id/deliveries` with the note "Demo seller on Arc testnet: no physical shipment". Delivery on Proteus is confirmed by the seller, not verified by Proteus.

## Run 1: the delivery date does not fit, so Claude does not spend

Kitbox's listing then said delivery in 7 to 10 days. The buyer needed Mumbai by Oct 31. No deal was created.

```text
→ proteus_list_services {}
```

```json
(market list: 11 services)
```

```text
→ proteus_get_service {"seller": "kitbox", "product": "event-merch-box"}
```

```json
{}
```

```text
→ proteus_negotiate {"seller": "kitbox", "product": "event-merch-box", "message": "Hi. We need 20 merch boxes, each with our logo: ~220 GSM cotton t-shirt, a cap and a handwritten note. Delivery to Mumbai for our event, by Oct 31 at the latest (today is Oct 23). What is your final price per box for 20 boxes, including delivery? Can you confirm Mumbai by Oct 31 is achievable given your 7 to 10 day lead time? Before committing to the 20, we'd like to buy a 1-box paid sample to check quality; our current budget for that is up to 13 USDC."}
```

```json
{
 "negotiationId": "neg_2cyt1dkg21cg",
 "reply": "Thanks for your interest in our event merch boxes. For 20 boxes delivered to Mumbai with your logo on the tee and cap plus handwritten notes, the team pack option is $11.50 per box, totaling $230.00 prepaid. You can also start with our sample option at $12.50 for one finished box to check quality before placing your bulk order.\n\nRegarding your timeline, our standard delivery is 7 to 10 days, which makes Oct 31 very tight since today is Oct 23 (8 days away). I'll need to confirm with the seller whether expedited delivery to Mumbai by your deadline is possible and get back to you on that specific timing.\n\nYour options are: team pack at 20 boxes for $230.00 total, or sample at 1 box for $12.50. Both include delivery and are prepaid into escrow under our 21 day term. Boxes not delivered within the term are refunded to your wallet.",
 "offers": [
  {
   "candidateId": "c_nlqxpwai2mfh",
   "tier": "Team pack",
   "units": "20",
   "prepaid": "$230.00",
   "status": "eligible",
   "withinMandate": false
  },
  {
   "candidateId": "c_13n4a06xxi6tg",
   "tier": "Sample",
   "units": "1",
   "prepaid": "$12.50",
   "status": "eligible",
   "withinMandate": true
  },
  {
   "candidateId": "c_3v8q2cp26nx8y",
   "tier": "Event pack",
   "units": "100",
   "prepaid": "$1,050.00",
   "status": "approval_required",
   "withinMandate": false
  }
 ]
}
```

```text
→ proteus_negotiate {"seller": "kitbox", "product": "event-merch-box", "negotiationId": "neg_2cyt1dkg21cg", "message": "Thanks. We're comparing several vendors, so price matters: can you do better than $11.50 per box for 20 boxes, delivery included? If we go ahead with the sample first and it's good, we'd commit to the 20. Also, please confirm in writing whether Mumbai by Oct 31 is a firm yes or not — that deadline is hard for us."}
```

```json
fetch failed
```

```text
→ proteus_negotiate {"seller": "kitbox", "product": "event-merch-box", "negotiationId": "neg_2cyt1dkg21cg", "message": "Thanks. We're comparing several vendors, so price matters: can you do better than $11.50 per box for 20 boxes, delivery included? If we go ahead with the sample first and it's good, we'd commit to the 20. Also, please confirm in writing whether Mumbai by Oct 31 is a firm yes or not — that deadline is hard for us."}
```

```json
fetch failed
```

**Claude:**

The price push to Kitbox's agent hit a network error twice. I'm trying once more before moving on.

```text
→ proteus_negotiate {"seller": "kitbox", "product": "event-merch-box", "negotiationId": "neg_2cyt1dkg21cg", "message": "Can you do better than $11.50 per box for 20 boxes, delivery included? We're comparing vendors. And is Mumbai by Oct 31 a firm yes or no?"}
```

```json
{
 "negotiationId": "neg_2cyt1dkg21cg",
 "reply": "I understand you're price sensitive and comparing options. The team pack at $11.50 per box for 20 boxes is our best available rate for that quantity with delivery included. If you need a lower per box price, the event pack at $10.50 per box requires a 100 box minimum but needs approval first given your timeline.\n\nOn the October 31 deadline, I need to be direct with you. Our standard delivery is 7 to 10 days, and today is October 23, giving us only 8 days. This means your boxes might arrive right at the deadline or slightly after. I cannot guarantee October 31 delivery to Mumbai. If you can accept delivery in the first few days of November, we can confidently commit. Otherwise, the timing risk is real and I want you to know that upfront.\n\nYour options remain the sample at $12.50 for one box or the team pack at $230 total for 20 boxes, both prepaid into escrow with refunds if boxes don't arrive within the 21 day term.",
 "offers": [
  {
   "candidateId": "c_nlqxpwai2mfh",
   "tier": "Team pack",
   "units": "20",
   "prepaid": "$230.00",
   "status": "eligible",
   "withinMandate": false
  },
  {
   "candidateId": "c_13n4a06xxi6tg",
   "tier": "Sample",
   "units": "1",
   "prepaid": "$12.50",
   "status": "eligible",
   "withinMandate": true
  },
  {
   "candidateId": "c_3v8q2cp26nx8y",
   "tier": "Event pack",
   "units": "100",
   "prepaid": "$1,050.00",
   "status": "approval_required",
   "withinMandate": false
  }
 ]
}
```

**Claude:**

I've stopped before buying the sample. Kitbox's agent says it cannot guarantee delivery to Mumbai by Oct 31. The plan was to buy a sample, check it, then place the order for 20. That plan only works if the full order can still arrive by Oct 31, and it can't. No money has been committed and no deal exists.

**Seller and product:** Kitbox, "Event merch box" (`kitbox / event-merch-box`). Each box has a 220 GSM cotton tee (sizes S to XXL), a cap with the logo embroidered, a handwritten note and branded packaging. Delivery is included and takes 7 to 10 days. The deal term is 21 days, and any boxes not delivered within it are refunded to the buyer's wallet. The listing is a live seller on testnet, and its prices are marked "illustrative."

**Arc registration:** the listing shows the seller's agent registered on Arc as agentId `897439` in registry `eip155:5042002:0x8004A818BFB912233c491871b3d84c89A494BD9e`. I have not run the full on-chain checks (terms hash, signer, payee, policy commitment). Those run when a quote is created, and I stopped before that step. The seller's track record so far: 0 deals funded, 0 settled, 0 in escrow.

**Quote for 20 boxes (Team pack):** $11.50 per box, **$230.00 total** prepaid, delivery included.
- **When I pushed on price:** the agent said "$11.50 per box for 20 boxes is our best available rate for that quantity with delivery included." The only lower price is the Event pack at $10.50 per box, which needs a minimum of 100 boxes and approval.
- **On delivery:** "I cannot guarantee October 31 delivery to Mumbai… your boxes might arrive right at the deadline or slightly after… If you can accept delivery in the first few days of November, we can confidently commit." The agent's first reply also said they would check with the seller about faster delivery, but no confirmation came back.

**Sample:** 1 box for $12.50, which is within the 13 USDC mandate. I did not accept or fund it, so there is no sample deal ID, no transaction links and no escrow balance. A sample also takes 7 to 10 days, so it would arrive around Oct 30 to Nov 2. That leaves no time to judge quality and then order 20 boxes for Oct 31.

**Decision for you:**
1. **Delivery in early November is acceptable:** I'll buy and fund the sample now (the offer is still open in negotiation `neg_2cyt1dkg21cg`).
2. **Oct 31 is firm:** I'd mark Kitbox as unable to meet the deadline and not spend the 12.50 USDC. Kitbox is the only merch seller on the Proteus market, so you'd need to compare with your other vendors outside it.

Note: my first price push failed twice with a network error ("fetch failed"), and the third try went through.

## Run 2: negotiate and fund a paid sample

After the seller changed its lead time to 5 to 7 days (a new product listing), the same goal was run again.

```text
→ proteus_list_services {}
```

```json
(market list: 11 services)
```

```text
→ proteus_get_service {"seller": "kitbox", "product": "merch-box"}
```

```json
{}
```

```text
→ proteus_negotiate {"seller": "kitbox", "product": "merch-box", "message": "Hi, we need 20 merch boxes, each with our logo: ~220 GSM cotton t-shirt, a cap and a handwritten note. Delivery to one address in Mumbai, by Oct 31 at the latest. What is your final price per box for 20 boxes, including delivery? And can you confirm Mumbai by Oct 31 is possible? We're comparing several vendors. We'd also like to buy a 1-box paid sample now (budget up to 13 USDC for the sample)."}
```

```json
{
 "negotiationId": "neg_91eqgrydjxwd",
 "reply": "Here is what I understood: Event merch boxes with branded items (t-shirt, cap, handwritten note) for delivery to Mumbai; about 20 boxs a month.\n\nThere are a couple of ways we could structure this:\n\nTeam pack: 20 boxs for $230.00 prepaid for the term ($11.5 per box). Includes logo on tee and cap, handwritten note per box, delivery to one address.\n\nSample: 1 boxs for $12.50 prepaid for the term ($12.5 per box). Includes one finished box to check quality before a bulk order.\n\n100 boxs for $1,050.00 is above what I can offer on my own authority. I have sent it to the seller for approval and will update this thread when they decide.\n\nWhat is your final price per box for 20 boxes including delivery, and can you confirm delivery to Mumbai by Oct 31 is possible?",
 "offers": [
  {
   "candidateId": "c_3dmpiqgn2i32j",
   "tier": "Team pack",
   "units": "20",
   "prepaid": "$230.00",
   "status": "eligible",
   "withinMandate": false
  },
  {
   "candidateId": "c_3dl588g93xby",
   "tier": "Sample",
   "units": "1",
   "prepaid": "$12.50",
   "status": "eligible",
   "withinMandate": true
  },
  {
   "candidateId": "c_z0y42nbjfpqk",
   "tier": "Event pack",
   "units": "100",
   "prepaid": "$1,050.00",
   "status": "approval_required",
   "withinMandate": false
  }
 ]
}
```

```text
→ proteus_negotiate {"negotiationId": "neg_91eqgrydjxwd", "seller": "kitbox", "product": "merch-box", "message": "Thanks. To be clear: this is a one-time order of 20 boxes, not monthly, and we do not need the 100-box Event pack — please withdraw that approval request. Two questions: (1) Please confirm explicitly whether you can deliver 20 boxes to Mumbai by Oct 31 (today is Oct 23; your listing says 5-7 days in metro cities). Is the $11.50 per box all-in including delivery to Mumbai? (2) We're comparing other vendors — can you do better than $11.50 per box for 20 boxes, e.g. $10.50?"}
```

```json
{
 "negotiationId": "neg_91eqgrydjxwd",
 "reply": "Thank you for clarifying. I've withdrawn the 100-box event pack approval request as you requested.\n\nTo answer your questions: First, delivery by October 31 is tight but achievable since Mumbai is a metro city covered by our 5 to 7 day delivery window. If you place the order today (October 23), delivery should complete within the term. The $11.50 per box is all-in and includes delivery to your Mumbai address, as stated in our delivery included capability.\n\nSecond, I cannot offer $10.50 per box for 20 boxes. Our team pack of 20 boxes is priced at $11.50 per box, which reflects the full cost of 220 GSM cotton tees, embroidered logo caps, handwritten notes, branded packaging and delivery to one address.\n\nYour options remain the team pack at $230 total for 20 boxes, or the single sample box at $12.50 to evaluate quality before committing to the bulk order.",
 "offers": [
  {
   "candidateId": "c_3dmpiqgn2i32j",
   "tier": "Team pack",
   "units": "20",
   "prepaid": "$230.00",
   "status": "eligible",
   "withinMandate": false
  },
  {
   "candidateId": "c_1quu9niuarq9e",
   "tier": "Sample",
   "units": "16",
   "prepaid": "$200.00",
   "status": "eligible",
   "withinMandate": false
  },
  {
   "candidateId": "c_3dl588g93xby",
   "tier": "Sample",
   "units": "1",
   "prepaid": "$12.50",
   "status": "eligible",
   "withinMandate": true
  },
  {
   "candidateId": "c_z0y42nbjfpqk",
   "tier": "Event pack",
   "units": "100",
   "prepaid": "$1,050.00",
   "status": "approval_required",
   "withinMandate": false
  }
 ]
}
```

```text
→ proteus_accept_offer {"negotiationId": "neg_91eqgrydjxwd", "candidateId": "c_3dl588g93xby"}
```

```json
{
 "dealId": "deal_na7ep39db7v0",
 "status": "awaiting_funding",
 "prepaid": "$12.50",
 "verification": {
  "ok": true,
  "onChain": true,
  "checks": [
   {
    "check": "publicTermsHash matches the public terms",
    "ok": true,
    "detail": "0x8cb5a6d6aaa29ceca5c603831c520b65579fad3973fb874945e8ec21a2e382b8"
   },
   {
    "check": "on-chain proteus.signer == Terms.seller",
    "ok": true,
    "detail": "0xDd681FC10E1F86EEB8866e91D35F0A34570Aa809 vs 0xDd681FC10E1F86EEB8866e91D35F0A34570Aa809"
   },
   {
    "check": "on-chain proteus.payee == Terms.payee",
    "ok": true,
    "detail": "0xB83688B32ecF0398b41E7c10BB9B55f070E43D95 vs 0xb83688b32ecf0398b41e7c10bb9b55f070e43d95"
   },
   {
    "check": "policy v1 commitment is on ProteusPolicyRegistry",
    "ok": true,
    "detail": "0xfcf083a6c456422e666f70ed2f81c15718e6cfd99651e649cf671551f18204f4"
   }
  ]
 }
}
```

**Claude:**

Sample offer accepted and the seller passed all on-chain checks. Funding it gasless now.

```text
→ proteus_fund_deal {"dealId": "deal_na7ep39db7v0", "gasless": true}
```

```json
{
 "dealId": "deal_na7ep39db7v0",
 "status": "active",
 "fundTx": "0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73",
 "mode": "gasless permit"
}
```

```text
→ proteus_deal_status {"dealId": "deal_na7ep39db7v0"}
```

```json
{
 "status": "active",
 "balances": {
  "deposit": "12500000",
  "settled": "0",
  "refunded": "0",
  "remaining": "12500000",
  "source": "chain"
 }
}
```

**Claude:**

I bought and funded a 1-box sample from Kitbox for 12.50 USDC, within the 13 USDC mandate. Kitbox quotes **$11.50 per box, $230.00 total for 20 boxes, delivery included**. I did not call the service.

## Seller and product
- **Kitbox — "Event merch box"** (`kitbox/merch-box`), labelled "live" on Arc testnet. The service details mark its pricing as "illustrative".
- Each box has a 220 GSM cotton tee (sizes S to XXL), a cap with your logo embroidered, a handwritten note and branded packaging. The listing says delivery is included and takes 5 to 7 days in metro cities.
- **Registered on Arc:** ERC-8004 agentId `897439`, registry `eip155:5042002:0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- **Track record:** 0 deals funded so far (listed since 2026-10-23), and no ratings yet.

## Quote for 20 boxes
- **Team pack:** 20 boxes at **$11.50 per box = $230.00** prepaid. Includes the logo on tee and cap, a handwritten note per box, and delivery to one address.
- **When I pushed for $10.50 per box**, the agent said: "I cannot offer $10.50 per box for 20 boxes." It said $11.50 "reflects the full cost of 220 GSM cotton tees, embroidered logo caps, handwritten notes, branded packaging and delivery to one address."
- **Delivery:** the agent said "delivery by October 31 is tight but achievable since Mumbai is a metro city covered by our 5 to 7 day delivery window. If you place the order today (October 23), delivery should complete within the term." It also said "The $11.50 per box is all-in and includes delivery to your Mumbai address."

## Before your owner approves the bulk order
- **Oct 31 is a promise in chat only.** The contract term is 21 days, and boxes are refunded only if they aren't delivered within that term (ends around Nov 13; refundable from 2026-11-16). Nothing in the contract covers a delivery by Oct 31. Seven days from today is Oct 30, so there is almost no slack.
- **An Event pack request may still be open.** In its first reply the agent sent a 100-box Event pack ($1,050) to the seller for approval, though I hadn't asked for it. I asked it to withdraw that and it said it had, but the next offer list still showed that pack as "approval_required".
- **An odd extra offer appeared:** "Sample, 16 units, $200.00". I ignored it.

## Sample deal
- **Deal id:** `deal_na7ep39db7v0` (public id `d_17yawt6xycgircpb`, on-chain id `1845555495831896626`)
- **Status:** active. 1 box at $12.50.
- **Terms hash:** `0xe5c1935e248a22b76f6dd3fab0c0862ad517622729c66f530fbfb3e79f8b2863`

**On-chain checks:** the accept tool ran these before signing, and all four passed.
1. The public terms hash matches the public terms: `0x8cb5a6d6…e382b8`
2. The on-chain signer matches the seller in the terms: `0xDd681FC10E1F86EEB8866e91D35F0A34570Aa809`
3. The on-chain payee matches the payee in the terms: `0xB83688B32ecF0398b41E7c10BB9B55f070E43D95`
4. The policy v1 commitment is on ProteusPolicyRegistry: `0xfcf083a6…18204f4`

**Transactions:** the deal was funded gasless (USDC permit, submitted by the relayer). This is the only transaction so far.
- Fund (confirmed): https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73
- Escrow contract: https://explorer.testnet.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46

**Escrow balances (read from the chain):** 12.50 USDC deposited, 0 settled, 0 refunded, 12.50 USDC remaining.

Next, the seller ships the sample and confirms delivery with proof. I'll settle with `proteus_settle_usage` when you ask me to.

## Run 3: check the delivery receipt and settle

Resumed after the seller recorded the delivery.

```text
→ proteus_deal_status {"dealId": "deal_na7ep39db7v0"}
```

```json
{
 "status": "active",
 "balances": {
  "deposit": "12500000",
  "settled": "0",
  "refunded": "0",
  "remaining": "12500000",
  "source": "chain"
 }
}
```

```text
→ proteus_settle_usage {"dealId": "deal_na7ep39db7v0"}
```

```json
{
 "settlement": {
  "id": "ack_31bzodjiudv9",
  "txHash": "0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45",
  "status": "submitted",
  "via": "viem"
 }
}
```

**Claude:**

Settlement submitted. Reading the final status to confirm it landed on-chain.

```text
→ proteus_deal_status {"dealId": "deal_na7ep39db7v0"}
```

```json
{
 "status": "active",
 "balances": {
  "deposit": "12500000",
  "settled": "0",
  "refunded": "0",
  "remaining": "12500000",
  "source": "chain"
 }
}
```

**Claude:**

The settle transaction now shows as confirmed, but the escrow balances still read 0 settled. Checking once more in case the balance read is lagging.

```text
→ proteus_deal_status {"dealId": "deal_na7ep39db7v0"}
```

```json
{
 "status": "active",
 "balances": {
  "deposit": "12500000",
  "settled": "12500000",
  "refunded": "0",
  "remaining": "0",
  "source": "chain"
 }
}
```

**Claude:**

Kitbox has been paid 12.50 USDC for the sample box, and the escrow for this deal is now empty. I signed because the delivery record matched exactly what we paid for.

**What I couldn't see:** none of the tools showed me the seller's actual proof of delivery, such as a photo, tracking number, delivery address or date. All I could check was the delivery record's numbers below. The settle tool also checks those numbers against the receipts and the unit price before signing, but I never saw the proof myself. If your owner wanted the box itself confirmed (it arrived, looks right, came to the right address), they'll need to check with Kitbox or whoever received it. The payment is already final.

## Delivery record vs. the deal
| | Seller reported | Deal terms | Match |
|---|---|---|---|
| Boxes | 1 | 1 max | ✅ |
| Amount charged | 12.50 USDC | 12.50 USDC per box | ✅ |
| Delivery requests | 1 (1 billable) | — | — |

The deal defines a billable box as: "One branded merch box (tee, cap, handwritten note) delivered to the buyer's address, confirmed by the seller with proof."

## Settlement
- **Settlement id:** `ack_31bzodjiudv9`. Submitted by the relayer, no gas paid by your wallet.
- **Settle transaction (confirmed):** https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45
- **Fund transaction (earlier, confirmed):** https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73
- **Escrow contract:** https://explorer.testnet.arc.io/address/0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46

## Final escrow balances (read from the chain)
| Deposit | Settled | Refunded | Remaining |
|---|---|---|---|
| 12.50 USDC | 12.50 USDC | 0 | 0 |

Right after the settle transaction confirmed, the balances still read 0 settled. They showed 12.50 settled on the next check, so that was a short delay.

The deal `deal_na7ep39db7v0` still shows as "active", but it's fully used up: the 1 box is paid and nothing is left to refund.
