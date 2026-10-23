/**
 * The product docs at /docs, as data: the page renders it, and "Copy Markdown" turns the same data into Markdown, so
 * a person and an agent read exactly the same thing.
 *
 * Rules for this file: every claim about Proteus links to something checkable (an Arc transaction, a contract, a
 * line of code, a live page); every market figure links its publisher; every proof says which network it is on;
 * caveats sit next to the claim they qualify. Transactions here were each checked with eth_getTransactionReceipt
 * (status 1) and the contracts on Sourcify (exact match). Facts are as of 2026-10-24.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "stats"; items: { value: string; label: string; source?: { name: string; url: string } }[] }
  | { kind: "table"; head: string[]; rows: string[][]; note?: string }
  | { kind: "links"; items: { label: string; href: string; note?: string }[] }
  | { kind: "h3"; id: string; text: string }
  /** A real screenshot of the product; network says where it was taken. */
  | { kind: "figure"; src: string; alt: string; caption: string; network: "Arc mainnet" | "Arc testnet" | "Diagram" }
  | { kind: "code"; lang: string; text: string };

/* Text in p, list, steps, tables and callouts may use [label](url) links and `code`; both render on the page and
   pass through unchanged to Markdown. */

export interface DocSection {
  id: string;
  group: string;
  title: string;
  blocks: Block[];
}

export const DOC_TITLE = "The deal desk for internet businesses.";
export const DOC_LEDE =
  "Proteus AI gives a business a deal agent that negotiates inside the seller's own rules, agrees terms with people or their AI agents, holds payment in USDC escrow on Arc, pays the seller for what is delivered and makes the rest refundable to the buyer.";

/* Links used throughout. */
const GH = "https://github.com/Adityaakr/proteus/blob/main";
const code = (path: string, line?: number) => `${GH}/${path}${line ? `#L${line}` : ""}`;
const txm = (h: string) => `https://explorer.arc.io/tx/${h}`;
const txt = (h: string) => `https://explorer.testnet.arc.io/tx/${h}`;
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-4)}`;
const tm = (h: string) => `[${short(h)}](${txm(h)})`;
const tt = (h: string) => `[${short(h)}](${txt(h)})`;
const ESCROW = "0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46";
const REG_MAIN = "0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B";
const REG_TEST = "0xa3f759525b5657182A8D7deCB0B40d4C66aC4A5A";
const SOURCIFY = (chain: number, a: string) => `https://sourcify.dev/server/v2/contract/${chain}/${a}`;
const SHOONYA = "https://app.proteus.co.in/app/market/shoonya-store-t4e";
const EVIDENCE = `${GH}/docs/evidence/2026-10-23-claude-mcp-kitbox.md`;

const TX = {
  shoonyaRegister: "0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55",
  shoonyaPolicies: [
    "0x59065079ffdc03ddc1e7ab3d257210ff743076e6522d1013e67b0bf901cdd165",
    "0x525f8578c6f8c039aaf5ad32cd16b91f5d176d966e54e29050ff0c735ee0c977",
    "0xe88e372b98cd6a8532b5c8294d9e6a03953821c4a543054cf1102960fe591947",
    "0xece7b7615eabe2605eba03127341da4749c06f2bc775bec22278aa2f26c4ff8f",
  ],
  mainDeploy: "0xf31053ff9ebdf450e739e2a5c5b93316febe7f0af1e0419cfb4f4a7415f37280",
  mainApprove: "0x9bbc33367d4c712dd599950309ea23ecfa769368c6619fdd2782e00b1d1bfa07",
  mainFund: "0xe527f3c4d6d5d2bebeb25dbd67dcc429b99827deac6349a81f7a88c3f75efe9d",
  mainSettle: "0xce2caa88fa3a2b136a85771573f2b5ce269be2ea2182da91f78cd9a2243153b0",
  mainClose: "0x4c51245b0bb2daeae5e5509e599e77e0302f9efb190a2d0d852a5d70c69e61b0",
  mainRefund: "0x70d68aa16db7588b90f172ccb68d20bb4f95ca099650a2755ee1a3436481c94d",
  gaslessFund: "0xcfc87ca9ab00adcafbd9468a17eb203d2e89e870b874f47d1e4e7610a7065d7d",
  gaslessSettle: "0x0601dc6e0ccf3bfbabe1dabbb2a57fef109c5b16ddf782f44a66fcbe126afac3",
  kitboxRegister: "0x4b618940e20338a0937edef6c6a46608edd92a6d5b5a9ea589291d273c5ace7f",
  kitboxPolicy: "0x8af4a932e0d40626c8452da35b795912919cf8ed475012858b34ae4ae38e4f59",
  kitboxFund: "0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73",
  kitboxSettle: "0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45",
  gatewayDeposit: "0x2e048bf4ca99132f730503acc952d90b66b1843e008fdc6e373192939c1a8eb7",
  x402Exact: "0x3d5c48a9a3fb765d5821479d0f46d4c94b8a17fc6763048fedb6f323f28de9f8",
  testRefund: "0x3af8467b98722fbdff856c3f08e3e010336937a66df097a5d428c955acd813f9",
  policyV2: "0x1d3df6183f57b16f39999988866fc93a0ac40623ab51604f0821284dfcf2c8ba",
};

export const SECTIONS: DocSection[] = [
  /* ------------------------------------------------------------------ Start */
  {
    id: "overview",
    group: "Start",
    title: "What Proteus AI is",
    blocks: [
      { kind: "p", text: "Proteus AI is a deal desk for businesses that sell custom, volume or usage-based work. The seller publishes what it sells and the rules its agent must respect: cost, margin floor, maximum discount, minimum order, capacity and the order size it approves personally. A buyer, or a buyer's AI agent, says what it needs. The pricing engine computes offers within those rules, both sides sign identical terms, the prepaid amount goes into an escrow contract on Arc, and the seller is paid for each unit the buyer countersigns. What is not delivered becomes refundable to the buyer when the term ends." },
      { kind: "callout", text: "The model proposes. The seller's policy decides. The signed agreement controls the money." },
      { kind: "p", text: "The model writes the conversation; it never sets a price. Offers come from a deterministic engine on Proteus's server ([pricing.ts](" + code("packages/domain/src/pricing.ts", 198) + ")), and the escrow releases USDC only against the signatures in the agreement ([DealEscrow.sol](" + code("contracts/src/DealEscrow.sol", 233) + "))." },
      { kind: "table", head: ["Network", "App", "Chain id", "What is real"], rows: [
        ["Arc mainnet", "[app.proteus.co.in](https://app.proteus.co.in)", "`5042`", "Real USDC. One real business listed: [Shoonya Store](" + SHOONYA + "). Wallet sign-in."],
        ["Arc testnet", "[ai.proteus.co.in](https://ai.proteus.co.in)", "`5042002`", "Testnet USDC with no value. Example sellers and a demo merch seller. Circle email sign-in and wallets."],
      ], note: "DealEscrow is deployed at the same address on both networks: `" + ESCROW + "`." },
      { kind: "figure", src: "/docs/market.jpg", alt: "The Proteus AI market on Arc mainnet, with Shoonya Store listed first", caption: "The market. Each seller shows its Arc identity, website and services priced from their cheapest pack.", network: "Arc mainnet" },
    ],
  },
  {
    id: "status",
    group: "Start",
    title: "What is live today",
    blocks: [
      { kind: "p", text: "Each capability and where it has been proven, with the transaction or code that shows it. Testnet proofs use testnet USDC; the mainnet deal loop was run by the Proteus team with its own funds." },
      { kind: "table", head: ["Capability", "Proven on", "Evidence"], rows: [
        ["Full escrow loop: approve, fund, settle, close, refund", "Arc mainnet (team funds, 0.60 USDC)", tm(TX.mainFund) + " fund · " + tm(TX.mainSettle) + " settle · " + tm(TX.mainRefund) + " refund"],
        ["A real business registers its agent from its own wallet", "Arc mainnet", tm(TX.shoonyaRegister) + " (Shoonya Store, Agent #2695)"],
        ["Pricing policies committed on chain", "Arc mainnet", "4 commits: " + TX.shoonyaPolicies.map(tm).join(", ")],
        ["Paid order from an outside buyer", "Not yet", "The first Shoonya order is next."],
        ["Gasless funding with a USDC permit", "Arc testnet", tt(TX.gaslessFund) + " fund · " + tt(TX.gaslessSettle) + " settle"],
        ["Seller-confirmed delivery, then settlement", "Arc testnet", tt(TX.kitboxFund) + " fund · " + tt(TX.kitboxSettle) + " settle"],
        ["An AI agent negotiates, funds and settles through MCP", "Arc testnet", "[Transcript and transactions](" + EVIDENCE + ")"],
        ["x402 pay per call (exact)", "Arc testnet", tt(TX.x402Exact)],
        ["x402 through Circle Gateway batching", "Arc testnet", tt(TX.gatewayDeposit) + " deposit; Gateway transfer `18395b90-7bfa-4cc2-b655-a2f4c7219be1`"],
        ["Disputes", "Code and scripted test; no dispute on chain yet", "[disputes.ts](" + code("server/src/services/disputes.ts") + "), `DISPUTE=1 delivery-e2e.ts`"],
        ["Catalog sync from the seller's endpoint", "Local test against a sample feed", "[catalog-sync.ts](" + code("server/src/services/catalog-sync.ts") + ")"],
      ] },
    ],
  },
  {
    id: "problem",
    group: "Start",
    title: "The problem",
    blocks: [
      { kind: "p", text: "Most business sales are not a checkout button. Whenever the price depends on volume, the work is custom or the service is used over time, a sale needs a quote, agreed terms, a prepayment, proof of delivery and, at the end, a refund of whatever was not used. Today each of those steps runs on email, chat, PDFs, spreadsheets and bank transfers, and each one is done by a person." },
      { kind: "table", head: ["Business", "What the buyer asks", "What happens today"], rows: [
        ["Custom merch and gifting", "\"20 merch boxes with our logo, Mumbai by Oct 31, final price per box including delivery?\"", "The seller prices boxes, printing and shipping by hand and replies hours later, while the buyer has asked several other vendors. The order is paid in advance on trust, and delivery is confirmed over chat."],
        ["Invoice processing", "\"About 600 invoices a month, two-way matching, budget $150.\"", "A sales call, a PDF quote, a contract, then a monthly invoice. The buyer pays for a plan, not for invoices processed, and unused volume is lost."],
        ["Inference compute and GPU hours", "\"10 million tokens this month and 40 H100 hours next week.\"", "Capacity is sold as prepaid credits or reserved blocks. Credits that are not used expire, and getting the unused part back is a support ticket, if it is possible at all."],
        ["Data and API plans", "\"50,000 calls of your market data API, priced per call, from tomorrow.\"", "An annual plan sized by guesswork and an API key by email. Overages are billed later; disputes over what was delivered are settled with screenshots."],
        ["AI voice and support agents", "\"After-hours answering for our clinic, about 300 calls a month.\"", "A per-seat or monthly subscription. Failed calls and calls handed to a person are paid for anyway."],
        ["Compliance and vendor checks", "\"Screen 200 counterparties and score 30 suppliers this quarter.\"", "A statement of work, a deposit and a report weeks later. Partial delivery turns into an argument about what is owed."],
        ["Infrastructure for AI agents", "An agent needs three paid API calls now to finish a task.", "There is no one to negotiate with and no way to sign. A person sets up an account and a card, or the task stops."],
      ] },
      { kind: "list", items: [
        "Slow replies lose orders: the first credible answer usually wins.",
        "Quotes are done by hand, so sellers underprice to win or spend hours per request, and discounts depend on who answers.",
        "Trust runs one way: the buyer prepays and hopes, or the seller delivers and chases the invoice.",
        "Buyers pay for capacity, not delivery: seats, plans and credits are bought upfront, and failed work is billed anyway.",
        "Refunds are manual and often impossible: unused credits expire and cancellations become support threads.",
        "Nothing is shared: the price lives in a chat, delivery in a screenshot, payment in a bank statement.",
        "AI agents cannot negotiate by email, sign a PDF, wire money or ask for a refund.",
      ] },
    ],
  },

  /* ------------------------------------------------------------- Quickstarts */
  {
    id: "quickstart-seller",
    group: "Quickstarts",
    title: "Sell: from wallet to a listed product",
    blocks: [
      { kind: "steps", items: [
        { title: "Sign in with your wallet", text: "At [app.proteus.co.in](https://app.proteus.co.in), sign in with the wallet you want to be paid in. It owns the seller account and is the payout address." },
        { title: "Publish products and rules", text: "For each product: what is included, tiers and list prices, and private rules: cost per unit, margin floor, maximum discount, minimum order, capacity, approval threshold. A prepared listing can be reviewed and edited before publishing ([ImportListing.tsx](" + code("site/src/app/sell/pages/ImportListing.tsx") + "))." },
        { title: "Register on Arc", text: "One transaction from your wallet registers your deal agent in Arc's ERC-8004 IdentityRegistry, publishing your payee and your quote-signing key ([agent-registry.ts](" + code("server/src/services/agent-registry.ts", 90) + "))." },
        { title: "Policies are committed", text: "Proteus reads the registration back from chain, checks owner, payee and signer, and commits each product's policy to ProteusPolicyRegistry. In the import flow, products are listed after this step." },
        { title: "Take orders", text: "Buyers negotiate with your agent on your store page, on your website, or through their own AI agent. Offers above your approval threshold wait for you." },
        { title: "Deliver and get paid", text: "For APIs, each call is metered with a signed receipt. For physical goods, you record each delivered batch with an optional proof link; it is labelled confirmed by the seller, not verified by Proteus. The escrow pays your wallet for what the buyer countersigns." },
      ] },
      { kind: "figure", src: "/docs/store.jpg", alt: "Shoonya Store's store page on Proteus AI", caption: "A seller's store: every product with its tiers, and one deal agent for all of them. This is [Shoonya Store](" + SHOONYA + "), a real business.", network: "Arc mainnet" },
      { kind: "figure", src: "/docs/policies.jpg", alt: "Agent policies page with the catalog sync card", caption: "Agent policies: the rules each product's agent must obey, and catalog sync from the seller's own endpoint.", network: "Arc testnet" },
      { kind: "h3", id: "seller-embed", text: "Put the agent on your website" },
      { kind: "code", lang: "html", text: "<script src=\"https://app.proteus.co.in/embed.js\" data-seller=\"your-slug\" async></script>\n<!-- options: data-mode=\"inline\", data-product=\"<product-slug>\", data-label=\"Get a quote\", data-color=\"#1b4dff\" -->" },
      { kind: "p", text: "The agent runs in a frame from Proteus. Signing and payment always open Proteus in a new tab, never inside your page, and you can limit which sites may embed it (CSP `frame-ancestors`) ([embed.js](" + code("site/public/embed.js") + "))." },
      { kind: "figure", src: "/docs/embed.jpg", alt: "The deal agent embedded on a seller's website, showing three offers", caption: "The embedded agent answering a request on a sample shop page, with offers priced from the seller's rules.", network: "Arc testnet" },
    ],
  },
  {
    id: "quickstart-buyer",
    group: "Quickstarts",
    title: "Buy: from a question to a refund",
    blocks: [
      { kind: "steps", items: [
        { title: "Ask the seller's agent", text: "Open a store and say what you need: quantity, date, budget. The conversation covers everything the seller makes and follows you from product to product." },
        { title: "Review the offer", text: "Each offer shows units, unit price, total, term and what is included. The terms hash is recomputed in your browser from the terms you see." },
        { title: "Sign and fund", text: "You sign the EIP-712 terms and a USDC permit for exactly the prepaid amount. The Proteus relayer submits both and pays the gas, so your wallet sends no transaction. The USDC goes into the escrow contract, not to the seller." },
        { title: "Use or receive", text: "Call the service with your key, or receive the goods. Failed calls and handoffs are never billed." },
        { title: "Countersign", text: "You sign the delivered usage, and the escrow pays the seller exactly that amount." },
        { title: "Refund the rest", text: "After the term ends (plus a grace period), or once the seller closes the term early, the remainder is refundable: one click on the deal page, or anyone can call `refundUnused`. If something is wrong, open a dispute from your wallet." },
      ] },
      { kind: "figure", src: "/docs/negotiation.jpg", alt: "Negotiation with the seller's agent and the offers panel", caption: "A negotiation: the agent answers in plain language, and every offer on the right was computed from the seller's rules.", network: "Arc testnet" },
      { kind: "figure", src: "/docs/offer.jpg", alt: "Offer review page with terms, on-chain details and the gasless funding steps", caption: "Review and fund: the exact terms, the escrow and USDC contracts, the terms hash checked in the browser, and the gasless funding steps.", network: "Arc testnet" },
      { kind: "figure", src: "/docs/deal.jpg", alt: "Deal page with escrow balances, settlement link, dispute and refund", caption: "A settled deal: deposit, settled and remaining read from the contract, the funding and settlement transactions, and the refund and dispute actions.", network: "Arc testnet" },
    ],
  },
  {
    id: "quickstart-agent",
    group: "Quickstarts",
    title: "Buy with an AI agent (MCP)",
    blocks: [
      { kind: "p", text: "The Proteus MCP server gives any MCP client (Claude, Cursor and others) the whole buying loop as tools ([packages/mcp](" + code("packages/mcp/src/index.ts") + ")). Add it to your client's MCP configuration:" },
      { kind: "code", lang: "json", text: "{\n  \"mcpServers\": {\n    \"proteus\": {\n      \"command\": \"pnpm\",\n      \"args\": [\"--dir\", \"packages/mcp\", \"exec\", \"tsx\", \"src/index.ts\"],\n      \"env\": {\n        \"PROTEUS_API_URL\": \"https://ai.proteus.co.in\",\n        \"PROTEUS_MAX_PREPAID_USDC\": \"5\",\n        \"PROTEUS_BUYER_PRIVATE_KEY\": \"<optional: a testnet key>\"\n      }\n    }\n  }\n}" },
      { kind: "table", head: ["Tool", "What it does"], rows: [
        ["`proteus_list_services`", "Every service on the market: seller, unit, starting prepaid price, per-call price."],
        ["`proteus_get_service`", "Tiers, term, refund policy, request fields and the seller's Arc identity."],
        ["`proteus_negotiate`", "Talks to the seller's agent; returns the reply and the current offers."],
        ["`proteus_verify_seller`", "Checks the terms hash, the seller's ERC-8004 signer and payee, and the policy commitment on Arc."],
        ["`proteus_accept_offer`", "Creates the quote, enforces the mandate, verifies the seller, then signs the terms."],
        ["`proteus_fund_deal`", "Funds by signing a USDC permit (gasless, the default) or by approving USDC."],
        ["`proteus_call_service`", "Calls the funded service; only delivered results are billed."],
        ["`proteus_settle_usage`", "Checks delivered usage against receipts and price, signs the acceptance, and the relayer settles."],
        ["`proteus_deal_status`", "Deposit, used, settled and remaining, read from the escrow."],
      ] },
      { kind: "list", items: [
        "The mandate `PROTEUS_MAX_PREPAID_USDC` is the largest prepaid amount per deal. It is enforced by the local MCP process, not on chain.",
        "Without a buyer key, the signing tools return the EIP-712 typed data and the Circle CLI command, so a Circle Agent Wallet signs inside its own limits.",
        "The agent refuses to sign when the seller's on-chain identity or policy check fails.",
      ] },
      { kind: "callout", text: "Proven on Arc testnet: Claude, with only these tools and a 13 USDC mandate, refused to buy when a seller's delivery date did not fit, bought a paid sample once it did, checked the seller's delivery receipt and settled. [Read the transcript](" + EVIDENCE + "), [funding](" + txt(TX.kitboxFund) + "), [settlement](" + txt(TX.kitboxSettle) + ")." },
    ],
  },

  /* ---------------------------------------------------------------- Concepts */
  {
    id: "lifecycle",
    group: "Concepts",
    title: "Deal lifecycle",
    blocks: [
      { kind: "table", head: ["State", "How a deal gets there", "Who acts"], rows: [
        ["Negotiating", "A buyer opens a conversation with the seller's agent.", "Buyer, agent"],
        ["Quoted", "The buyer picks an offer the engine produced.", "Buyer"],
        ["Approval required", "The prepaid amount is above the seller's approval threshold.", "Seller approves"],
        ["Awaiting funding", "The buyer signs the terms; the seller's signer countersigns.", "Buyer, seller signer"],
        ["Funding pending → Funded", "`createAndFundDeal` moves the prepaid USDC into escrow; the reconciler sees `DealFunded`.", "Relayer submits"],
        ["Active", "The service is provisioned (an API key is shown once) or goods are delivered; usage is settled in steps.", "Buyer, seller"],
        ["Disputed", "Buyer or seller calls `openDispute`; settlement and refund are blocked.", "Buyer or seller, then the arbiter"],
        ["Closed", "`refundUnused` after the term plus grace or after `sellerCloseTerm`, or a dispute resolution that pays everything out.", "Anyone (refund), arbiter (dispute)"],
      ], note: "A fully settled deal has nothing left to refund and stays Active. State machine: [README](" + GH + "/README.md#a-deals-states)." },
    ],
  },
  {
    id: "money-path",
    group: "Concepts",
    title: "The money path",
    blocks: [
      { kind: "table", head: ["Moment", "Where the USDC is", "What releases it"], rows: [
        ["Before funding", "The buyer's wallet", "The buyer's permit (or approval) for exactly the prepaid amount"],
        ["Funded", "DealEscrow, per deal", "Nothing without signatures; the contract has no owner withdrawal"],
        ["Settlement", "Escrow → the seller's payee", "The buyer's Acceptance and the seller's Delivery, for the cumulative delivered amount"],
        ["Refund", "Escrow → the buyer", "`refundUnused`, callable by anyone after the term plus grace or after the seller closes"],
        ["Dispute", "Escrow, frozen", "The arbiter splits only the unspent balance between payee and buyer"],
        ["Pay per call (x402)", "Buyer → seller per call, outside escrow", "Each call is paid when made; there is no escrow and no refund path"],
      ] },
      { kind: "p", text: "Invariants the contract enforces include `deposit = settled + refunded + remaining` for every deal and a contract balance equal to the sum of remainders ([DealEscrow.sol](" + code("contracts/src/DealEscrow.sol") + "); invariant tests in `contracts/test`, which do not yet exercise disputes)." },
    ],
  },
  {
    id: "signatures",
    group: "Concepts",
    title: "What is signed, and by whom",
    blocks: [
      { kind: "table", head: ["Message", "Signed by", "Checked by"], rows: [
        ["Terms (EIP-712, domain `ProteusDealEscrow` v1): price, units, term, payee, product, public terms hash", "The buyer's wallet, and the seller's delegated signer", "`createAndFundDeal`"],
        ["USDC permit (EIP-2612) for exactly the prepaid amount, spender = escrow", "The buyer's wallet", "Arc's USDC contract"],
        ["Receipt per delivered unit or batch", "The seller's signer", "The buyer, before countersigning"],
        ["Acceptance: cumulative units and amount, receipts root", "The buyer's wallet", "`settleAcceptedUsage`"],
        ["Delivery: the same cumulative totals", "The seller's signer", "`settleAcceptedUsage`"],
        ["Policy commitment (`commitBySig`)", "The seller's signer", "ProteusPolicyRegistry"],
        ["ERC-8004 registration", "The seller's own wallet (a transaction)", "Arc's IdentityRegistry"],
        ["x402 authorization (EIP-3009)", "The buyer's wallet", "Circle's facilitator or Circle Gateway"],
      ] },
      { kind: "callout", text: "The seller's signer is a per-seller key that Proteus generates and holds, encrypted with AES-256-GCM ([signer.ts](" + code("server/src/chain/signer.ts", 11) + ")). It lets the agent countersign offers without the seller approving each one. It can sign terms and deliveries; it cannot move funds, and payouts go only to the payee in the seller's on-chain identity. The seller can revoke it." },
    ],
  },
  {
    id: "pricing",
    group: "Concepts",
    title: "How offers are priced",
    blocks: [
      { kind: "list", items: [
        "The engine builds candidate offers from the published tiers and the buyer's stated quantity and budget, then checks each against the seller's rules: margin floor, maximum discount, minimum prepaid, capacity and approval threshold ([pricing.ts](" + code("packages/domain/src/pricing.ts", 198) + ")).",
        "A candidate that breaks a rule is refused with a public reason; one above the approval threshold waits for the seller.",
        "The model writes the reply from the approved candidates only. A check discards any reply that contains a figure that is not an approved offer or a listed price, and the price is never taken from the reply ([openrouter.ts](" + code("server/src/agent/openrouter.ts") + ")). Spelled-out numbers are not caught by that check.",
        "The agent also sees the seller's other listed products, so it can point the buyer to the one that fits.",
        "Each policy version is committed on Arc for sellers registered there, and quotes embed the commitment. The commitment proves which policy was published, not that the off-chain engine applied it.",
      ] },
    ],
  },

  /* ----------------------------------------------------------------- Product */
  {
    id: "features",
    group: "Product",
    title: "Features",
    blocks: [
      { kind: "h3", id: "for-sellers", text: "For sellers" },
      { kind: "table", head: ["Feature", "What it does", "Proven on"], rows: [
        ["Agent policies", "Per product: cost, margin floor, maximum discount, minimum order, capacity, approval threshold.", "Mainnet and testnet"],
        ["Store and one deal desk", "A store page for everything you sell; one conversation that follows the buyer across products ([storefront.ts](" + code("server/src/services/storefront.ts", 19) + ")).", "Mainnet and testnet"],
        ["Agent on your website", "One script tag; signing and payment open Proteus in a new tab.", "Testnet"],
        ["Catalog sync", "Your endpoint keeps stock, cost and order rules current, every 15 minutes or on demand; each change is a new policy version. List prices are never synced.", "Local test"],
        ["Seller-confirmed delivery", "Record delivered batches with a proof link; the escrow pays what the buyer countersigns.", "Testnet"],
        ["Approvals and alerts", "Large offers wait for you; email, Telegram or HMAC-signed webhooks for funding, settlement, refunds and disputes ([notify.ts](" + code("server/src/services/notify.ts") + ")).", "Testnet"],
        ["Accounting export", "CSVs of deals, receipts and journal lines in the column shape QuickBooks Online and Xero import, each money row linked to its Arc transaction.", "Testnet"],
        ["Onboarding from your wallet", "Your wallet owns the account and the payouts; the import flow lists products after Arc registration.", "Mainnet (Shoonya Store)"],
      ] },
      { kind: "figure", src: "/docs/seller-usage.jpg", alt: "Seller usage and delivery page with a signed, delivered receipt", caption: "Usage and delivery: each billable unit with its outcome and the seller-signed receipt.", network: "Arc testnet" },
      { kind: "h3", id: "for-buyers", text: "For buyers and their agents" },
      { kind: "table", head: ["Feature", "What it does", "Proven on"], rows: [
        ["Negotiation", "Quantities, budgets and counteroffers answered within the seller's rules, across the seller's catalog.", "Mainnet and testnet"],
        ["Gasless funding", "Sign a permit for exactly the prepaid amount; the relayer submits and pays the gas ([gasless.ts](" + code("server/src/services/gasless.ts", 5) + ")).", "Testnet"],
        ["Pay per call", "x402 with two options: one USDC transfer per call, or Circle Gateway batching (deposit once, then each call is a signature). Paid per call, outside escrow ([x402.ts](" + code("server/src/services/x402.ts", 71) + ")).", "Testnet"],
        ["MCP server", "Nine tools for any MCP client, within a per-deal mandate.", "Testnet"],
        ["Disputes and refunds", "Open a dispute from your wallet; refund the unspent balance after the term.", "Refund: mainnet and testnet. Dispute: scripted test"],
        ["Fund from other chains", "CCTP through Circle Bridge Kit to the buyer's Arc wallet ([bridge.ts](" + code("site/src/app/lib/bridge.ts") + ")).", "Mainnet"],
      ] },
    ],
  },

  /* ------------------------------------------------------------------- Trust */
  {
    id: "security",
    group: "Trust",
    title: "Security model and trust boundaries",
    blocks: [
      { kind: "callout", text: "DealEscrow is not independently audited yet. It is source-verified (Sourcify exact match) on both networks and covered by Foundry unit and invariant tests; the invariant handler does not exercise disputes." },
      { kind: "table", head: ["Component", "Who controls it", "What to trust"], rows: [
        ["DealEscrow", "No one can withdraw buyer funds; the owner can pause new deals and set the arbiter", "Releases follow signatures only; pause stops new deals, never settlements or refunds"],
        ["Arbiter", "The Proteus deployer key, which is also the contract owner", "Resolves disputes by splitting only the unspent balance. There is no dispute timeout yet."],
        ["Relayer", "A Proteus key that submits transactions and pays gas", "Cannot move funds without the buyer's and seller's signatures"],
        ["Seller signer", "Per-seller key held by Proteus, AES-256-GCM encrypted", "Signs terms, deliveries and policy commitments; cannot redirect payouts; revocable"],
        ["Pricing engine", "Proteus's server", "Enforces the seller's rules; the on-chain commitment shows the policy, not its application"],
        ["Delivery", "The seller confirms; the buyer countersigns", "Physical delivery is not verified by Proteus. A buyer who disagrees does not sign and can dispute."],
        ["Pay per call", "Paid directly per call", "Outside escrow: no refund path"],
      ] },
      { kind: "list", items: [
        "Prompt injection: buyer text is data to every model call; the pricing engine never reads prose.",
        "Webhooks and catalog endpoints: https only, private and metadata addresses refused, no redirects, short timeouts.",
        "Keys: seller signer keys and endpoint secrets are encrypted at rest; deal API keys are stored as hashes and shown once.",
        "Embedding: only `/embed/*` may be framed; every other page refuses framing.",
      ] },
    ],
  },
  {
    id: "limits",
    group: "Trust",
    title: "Limits and known gaps",
    blocks: [
      { kind: "list", items: [
        "No independent audit of DealEscrow yet.",
        "The arbiter is a single Proteus-operated key, and disputes have no timeout.",
        "Refunds are not automatic: they need a call to `refundUnused`, from the buyer's deal page or anyone.",
        "Delivery dates are agreed in the conversation, not in the signed terms.",
        "Physical delivery is confirmed by the seller; Proteus does not verify it.",
        "Pay per call has no escrow and no refund.",
        "The import flow lists products after registration by order of steps; the listing endpoint itself does not check registration (catalog sync does).",
        "The figure check in replies does not catch numbers written out in words.",
        "Paid orders from outside buyers on mainnet: none yet.",
      ] },
    ],
  },
  {
    id: "verify",
    group: "Trust",
    title: "Verify it yourself",
    blocks: [
      { kind: "h3", id: "contracts", text: "Contracts" },
      { kind: "table", head: ["Contract", "Network", "Address", "Source"], rows: [
        ["DealEscrow", "Arc mainnet", "[`" + ESCROW + "`](https://explorer.arc.io/address/" + ESCROW + ")", "[Sourcify exact match](" + SOURCIFY(5042, ESCROW) + ")"],
        ["DealEscrow", "Arc testnet", "[`" + ESCROW + "`](https://explorer.testnet.arc.io/address/" + ESCROW + ")", "[Sourcify exact match](" + SOURCIFY(5042002, ESCROW) + ")"],
        ["ProteusPolicyRegistry", "Arc mainnet", "[`" + REG_MAIN + "`](https://explorer.arc.io/address/" + REG_MAIN + ")", "[Sourcify exact match](" + SOURCIFY(5042, REG_MAIN) + ")"],
        ["ProteusPolicyRegistry", "Arc testnet", "[`" + REG_TEST + "`](https://explorer.testnet.arc.io/address/" + REG_TEST + ")", "[Sourcify exact match](" + SOURCIFY(5042002, REG_TEST) + ")"],
      ] },
      { kind: "h3", id: "mainnet-loop", text: "The mainnet deal loop" },
      { kind: "p", text: "Run by the Proteus team with its own USDC against its own example seller, to prove the mechanism on mainnet (not traction): 0.60 USDC in, 0.30 settled for delivered work, 0.30 refunded." },
      { kind: "table", head: ["Step", "Transaction (Arc mainnet)"], rows: [
        ["Deploy DealEscrow", tm(TX.mainDeploy)],
        ["Buyer approves USDC", tm(TX.mainApprove)],
        ["`createAndFundDeal`, 0.60 USDC into escrow", tm(TX.mainFund)],
        ["`settleAcceptedUsage`, 0.30 USDC to the payee", tm(TX.mainSettle)],
        ["`sellerCloseTerm`", tm(TX.mainClose)],
        ["`refundUnused`, 0.30 USDC back to the buyer", tm(TX.mainRefund)],
      ] },
      { kind: "h3", id: "testnet-proofs", text: "Testnet proofs" },
      { kind: "table", head: ["What", "Transaction (Arc testnet)"], rows: [
        ["Gasless funding: permit and `createAndFundDeal` in one Multicall3 transaction", tt(TX.gaslessFund)],
        ["Seller-confirmed delivery settled", tt(TX.kitboxSettle)],
        ["Demo seller registers on ERC-8004 (Agent #897439)", tt(TX.kitboxRegister)],
        ["Policy version 2 committed at quote time", tt(TX.policyV2)],
        ["Refund of the unused balance", tt(TX.testRefund)],
      ] },
      { kind: "p", text: "To read a deal yourself, open DealEscrow's read tab on the explorer and call `deals(dealId)` with the on-chain deal id shown on the deal page." },
    ],
  },

  /* ----------------------------------------------------------------- Context */
  {
    id: "why-now",
    group: "Context",
    title: "Why now",
    blocks: [
      { kind: "list", items: [
        "Agents are starting to buy. Stripe and OpenAI released the [Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout) for checkout inside ChatGPT, and [x402](https://decrypt.co/318467/coinbase-breathes-new-lift-into-long-forgotten-web-payment-code) lets agents pay per HTTP request. Both pay a known price. Neither negotiates custom terms or holds funds until delivery.",
        "Businesses already pay each other in stablecoins. McKinsey and Artemis put 2025 stablecoin payments at about $390 billion, with B2B the largest share at about $226 billion ([McKinsey](https://www.mckinsey.com/featured-insights/week-in-charts/stablecoins-find-their-niche)), and Artemis data shows B2B stablecoin payments growing more than 730% in 2025 ([The Defiant](https://thedefiant.io/b2b-stablecoin-payments-grew-over-730-percent-yoy-in-2025)).",
        "The rails exist on Arc: USDC is the gas token, Arc's USDC supports EIP-2612 permits, and Circle provides wallets for people and agents, Gateway for batched payments and CCTP for cross-chain transfers.",
      ] },
    ],
  },
  {
    id: "market",
    group: "Context",
    title: "Market",
    blocks: [
      { kind: "stats", items: [
        { value: "$3–5T", label: "Global agentic commerce by 2030 (McKinsey range; up to $1T in US B2C retail alone)", source: { name: "McKinsey", url: "https://www.mckinsey.com/industries/retail/our-insights/the-agentic-commerce-opportunity-how-ai-agents-are-ushering-in-a-new-era-for-consumers-and-merchants" } },
        { value: "$226B", label: "B2B stablecoin payments in 2025, of about $390B in stablecoin payments overall", source: { name: "McKinsey and Artemis", url: "https://www.mckinsey.com/featured-insights/week-in-charts/stablecoins-find-their-niche" } },
        { value: "0.02%", label: "Stablecoin payments as a share of global payments in 2025: early, with room to grow", source: { name: "McKinsey and Artemis", url: "https://www.mckinsey.com/featured-insights/week-in-charts/stablecoins-find-their-niche" } },
        { value: "$26.8B", label: "US promotional products sales in 2024, the category of our first live seller (US figures; we have not yet sourced India's)", source: { name: "PPAI", url: "https://www.ppai.org/news/ppai-sales-volume-estimate-modest-growth-in-2024-but-reasons-for-optimism-remain" } },
      ] },
      { kind: "p", text: "Our first market is quote-based B2B sellers that already accept stablecoins: custom merch and gifting, data APIs and infrastructure for AI agents, the segments of our first design partners. The same deal desk fits any seller with a price list, a floor and something to deliver. Market figures are third-party estimates with different definitions." },
    ],
  },
  {
    id: "competitors",
    group: "Context",
    title: "Compared",
    blocks: [
      { kind: "table", head: ["", "Who it serves", "Negotiates custom terms", "Buyer agents", "Holds funds until delivery", "Settlement"], rows: [
        ["Proteus AI", "Sellers and their buyers, people or agents", "Yes, within the seller's rules, enforced by Proteus's server", "Yes: MCP, x402, embed", "Yes, USDC escrow on Arc", "USDC per countersigned unit"],
        ["[Pactum](https://pactum.com/)", "Enterprise procurement teams", "Yes, on the buyer's side with suppliers", "Its own agents", "Not its focus", "Through the buyer's systems"],
        ["[Stripe Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)", "Merchants selling inside AI assistants", "No, catalog price at checkout", "Yes", "No, a standard payment", "Cards through Stripe or another processor"],
        ["x402", "APIs and content paid per request", "No", "Yes", "No, paid per request", "Stablecoins per request (Proteus supports it)"],
        ["CPQ and proposal tools", "Sales teams quoting by hand", "Rules for people writing quotes", "Not designed for agents", "No", "Invoice and bank transfer"],
        ["Escrow services", "One-off, high-value transactions", "No", "No", "Yes, managed by hand", "Bank transfer"],
      ], note: "Based on each product's public description as of October 2026." },
    ],
  },
  {
    id: "traction",
    group: "Context",
    title: "Traction",
    blocks: [
      { kind: "stats", items: [
        { value: "1", label: "Real business listed on Arc mainnet: [Shoonya Store](" + SHOONYA + ")" },
        { value: "#2695", label: "Its ERC-8004 agent, [registered from its own wallet](" + txm(TX.shoonyaRegister) + ")" },
        { value: "4", label: "Products with pricing policies [committed on chain](" + txm(TX.shoonyaPolicies[0]!) + ")" },
        { value: "0", label: "Paid orders from outside buyers so far; the first Shoonya order is next" },
      ] },
      { kind: "p", text: "Shoonya Store ([shoonyastore.com](https://www.shoonyastore.com)) is a custom merch and corporate gifting studio. It reports that its clients already pay in USDC, and it answered quote requests by hand. Its deal agent now answers within its own rules, including its real quote of $15 per event merch box with delivery and taxes, owner and payee `0x995385cB1D15fcC4521442D488d2CB757cb641Da`." },
      { kind: "p", text: "Two more design partners have agreed to pilot and are onboarding: PolyBaskets (prediction-market index data) and Peal (privacy infrastructure for agents)." },
      { kind: "h3", id: "next", text: "What is next" },
      { kind: "list", items: [
        "The first paid order to Shoonya on Arc mainnet, posted with its transactions.",
        "Shoonya's catalog endpoint connected, so its agent quotes live stock.",
        "Delivery dates in the signed terms, a dispute timeout, and an independent audit of DealEscrow.",
        "More sellers onboarded from their own wallets.",
      ] },
    ],
  },

  /* --------------------------------------------------------------- Reference */
  {
    id: "faq",
    group: "Reference",
    title: "FAQ",
    blocks: [
      { kind: "table", head: ["Question", "Answer"], rows: [
        ["Does Proteus hold my money?", "Not for escrowed deals: USDC sits in DealEscrow and moves only with the signatures in the agreement. Proteus does hold the seller signer keys and the arbiter key, as described in the security model. Pay per call goes straight to the seller."],
        ["Can the AI agree to a bad price?", "No. Offers come from the pricing engine and the seller's rules; the model only writes the words, and replies with unlisted figures are discarded."],
        ["How do refunds work?", "After the term plus grace, or once the seller closes the term, the remainder can be refunded with one call, from the deal page or by anyone."],
        ["What if the goods never arrive?", "Do not countersign. Open a dispute from your wallet; settlement and refund are frozen until the arbiter splits the unspent balance."],
        ["Who pays gas?", "With gasless funding, the Proteus relayer pays it. Arc's gas is paid in USDC."],
        ["Is it on mainnet?", "Yes: the escrow, one real business and its committed policies are on Arc mainnet. Most feature proofs are on testnet; the status table says which."],
        ["Can my AI agent buy on its own?", "Yes, through the MCP server, within a per-deal limit you set."],
        ["Is the contract audited?", "Not yet. It is source-verified and tested; an audit is on the roadmap."],
      ] },
    ],
  },
  {
    id: "glossary",
    group: "Reference",
    title: "Glossary",
    blocks: [
      { kind: "table", head: ["Term", "Meaning"], rows: [
        ["Terms", "The EIP-712 agreement both sides sign: price, units, term, payee, product."],
        ["Acceptance", "The buyer's signature over cumulative delivered units and amount."],
        ["Delivery", "The seller signer's signature over the same totals."],
        ["Payee", "The address the seller is paid to, published in its ERC-8004 identity."],
        ["Seller signer", "A per-seller key held by Proteus that countersigns terms and deliveries."],
        ["Relayer", "The Proteus key that submits transactions and pays gas."],
        ["Arbiter", "The key that resolves disputes over the unspent balance."],
        ["Grace", "The period after the term during which settlement is still possible before refunds open."],
        ["Mandate", "The largest prepaid amount an AI agent may commit per deal."],
        ["Policy commitment", "A salted hash of a product's pricing policy, committed on ProteusPolicyRegistry."],
        ["ERC-8004", "The agent identity standard on Arc: owner, payee and signer for a seller's agent."],
        ["micro-USDC", "USDC in its 6-decimal base unit; 1 USDC = 1,000,000."],
      ] },
    ],
  },
  {
    id: "links",
    group: "Reference",
    title: "Links",
    blocks: [
      { kind: "links", items: [
        { label: "API reference", href: "/docs/api", note: "calling a funded service, billing, settlement, the seller endpoint" },
        { label: "Agent skill", href: "/api/public/agents/skill.md", note: "for an AI agent to discover, negotiate, fund and settle" },
        { label: "Evidence: Claude buys through MCP", href: EVIDENCE, note: "transcript and transactions, Arc testnet" },
        { label: "Threat model", href: `${GH}/docs/threat-model.md` },
        { label: "Settlement model", href: `${GH}/docs/settlement-model.md` },
        { label: "Source code", href: "https://github.com/Adityaakr/proteus" },
        { label: "Open the app", href: "https://app.proteus.co.in", note: "Arc mainnet; testnet at ai.proteus.co.in" },
      ] },
    ],
  },
];

export const GROUPS = Array.from(new Set(SECTIONS.map((s) => s.group)));

/** The same page as Markdown, for agents and for pasting anywhere. */
export function docsMarkdown(origin: string): string {
  const abs = (h: string) => (h.startsWith("/") ? `${origin}${h}` : h);
  const out: string[] = [`# ${DOC_TITLE}`, "", DOC_LEDE, ""];
  for (const s of SECTIONS) {
    out.push(`## ${s.title}`, "");
    for (const b of s.blocks) {
      if (b.kind === "p") out.push(b.text, "");
      else if (b.kind === "callout") out.push(`> ${b.text}`, "");
      else if (b.kind === "h3") out.push(`### ${b.text}`, "");
      else if (b.kind === "list") out.push(...b.items.map((i) => `- ${i}`), "");
      else if (b.kind === "steps") out.push(...b.items.map((i, n) => `${n + 1}. **${i.title}.** ${i.text}`), "");
      else if (b.kind === "stats") out.push(...b.items.map((i) => `- **${i.value}**: ${i.label}${i.source ? ` ([${i.source.name}](${i.source.url}))` : ""}`), "");
      else if (b.kind === "links") out.push(...b.items.map((i) => `- [${i.label}](${abs(i.href)})${i.note ? `: ${i.note}` : ""}`), "");
      else if (b.kind === "figure") out.push(`![${b.alt}](${abs(b.src)})`, `_${b.caption} (${b.network})_`, "");
      else if (b.kind === "code") out.push("```" + b.lang, b.text, "```", "");
      else if (b.kind === "table") {
        out.push(`| ${b.head.join(" | ")} |`, `|${b.head.map(() => "---").join("|")}|`, ...b.rows.map((r) => `| ${r.join(" | ")} |`));
        if (b.note) out.push("", `_${b.note}_`);
        out.push("");
      }
    }
  }
  return out.join("\n").trim() + "\n";
}
