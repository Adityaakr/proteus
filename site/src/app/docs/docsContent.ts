/**
 * The product docs at /docs, as data: the page renders it, and "Copy Markdown" turns the same data into Markdown, so
 * a person and an agent read exactly the same thing. Every figure about the market cites its source; every claim about
 * Proteus links to something checkable (a transaction, a contract, a page or the code). Facts dated as of 2026-10-24.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "stats"; items: { value: string; label: string; source?: { name: string; url: string } }[] }
  | { kind: "table"; head: string[]; rows: string[][]; note?: string }
  | { kind: "links"; items: { label: string; href: string; note?: string }[] }
  | { kind: "h3"; id: string; text: string };

export interface DocSection {
  id: string;
  group: string;
  title: string;
  blocks: Block[];
}

export const DOC_TITLE = "The deal desk for internet businesses.";
export const DOC_LEDE =
  "Proteus AI gives every business a deal agent that negotiates inside the seller's own rules, agrees terms with people or their AI agents, holds payment in USDC escrow on Arc, and pays the seller for what is delivered.";

const ESCROW = "0x5085A8400C95B9Cf0c9a3552cCFf31eA45D06a46";

export const SECTIONS: DocSection[] = [
  {
    id: "introduction",
    group: "Getting started",
    title: "What Proteus AI is",
    blocks: [
      { kind: "p", text: "Proteus AI is a deal desk that runs on its own. A seller publishes what it sells, what each unit costs it and the lowest margin it will accept. A buyer, or a buyer's AI agent, says what it needs. Proteus negotiates within the seller's rules, has both sides sign identical terms, holds the prepaid amount in an escrow contract on Arc, and pays the seller only for what is delivered. Anything unused goes back to the buyer." },
      { kind: "callout", text: "The model proposes. The seller's policy decides. The signed agreement controls the money." },
      { kind: "p", text: "It is live on Arc mainnet at app.proteus.co.in, with a real business selling on it, and on Arc testnet at ai.proteus.co.in." },
    ],
  },
  {
    id: "problem",
    group: "Getting started",
    title: "The problem",
    blocks: [
      { kind: "p", text: "Most business sales are not a checkout button. Custom merch, data and API plans, services by the hour, anything with volume pricing: each needs a quote, agreed terms, a prepayment and proof of delivery. Today that runs on email, chat, PDFs and invoices." },
      { kind: "list", items: [
        "Slow replies lose orders. A buyer asking for \"20 merch boxes with our logo, Mumbai by Oct 31, final price per box?\" sends the same message to several vendors, and the first credible answer usually wins.",
        "Every quote is done by hand, so the seller either underprices to win or spends hours per request.",
        "Trust runs one way. Either the buyer prepays and hopes, or the seller delivers and chases payment.",
        "AI agents are starting to buy, but they cannot negotiate over email, sign a PDF or wire money.",
      ] },
    ],
  },
  {
    id: "how-it-works",
    group: "Getting started",
    title: "How it works",
    blocks: [
      { kind: "steps", items: [
        { title: "Negotiate", text: "The buyer tells the seller's agent what it needs. Offers are computed in code from the seller's rules; the model only writes the words, and a check rejects any figure that is not an approved offer." },
        { title: "Sign", text: "Buyer and seller sign identical EIP-712 terms. The signatures are the contract." },
        { title: "Fund", text: "The buyer signs a USDC permit and the relayer pays the gas. USDC goes into the DealEscrow contract on Arc, not to the seller." },
        { title: "Deliver", text: "API products meter each call with a seller-signed receipt. Physical goods are confirmed by the seller per delivered batch, with proof." },
        { title: "Settle", text: "The buyer countersigns delivered usage, and the escrow pays the seller's own wallet exactly that amount." },
        { title: "Refund", text: "Anything not delivered within the term goes back to the buyer. Disputes freeze the deal for an arbiter." },
      ] },
      { kind: "h3", id: "three-ways-in", text: "Three ways in" },
      { kind: "list", items: [
        "The seller's store page on Proteus, with one deal agent for everything the seller makes.",
        "The seller's own website: one script tag adds a \"Get a quote\" button or an inline agent.",
        "Any AI agent through the Proteus MCP server, within a spending limit its owner sets.",
      ] },
    ],
  },
  {
    id: "features",
    group: "Product",
    title: "Features",
    blocks: [
      { kind: "h3", id: "for-sellers", text: "For sellers" },
      { kind: "table", head: ["Feature", "What it does"], rows: [
        ["Agent policies", "Per product: cost, margin floor, maximum discount, minimum order, capacity, approval threshold. The agent can never quote outside them."],
        ["Catalog sync", "Point Proteus at your own catalog endpoint and stock, cost and order rules stay current, checked every 15 minutes."],
        ["Store and one deal desk", "A store page for everything you sell, with one conversation that follows the buyer from product to product."],
        ["Agent on your website", "One script tag. Signing and payment always open Proteus in a new tab, never inside your page."],
        ["Seller-confirmed delivery", "Record each delivered batch with proof; the escrow pays only what the buyer countersigns."],
        ["Approvals, alerts, exports", "Large offers wait for you; email, Telegram or webhook alerts; CSV exports for QuickBooks and Xero with every Arc transaction linked."],
        ["Onboarding from your wallet", "Your wallet owns the account and receives payouts. Products stay unlisted until you are registered on Arc."],
      ] },
      { kind: "h3", id: "for-buyers", text: "For buyers and their agents" },
      { kind: "table", head: ["Feature", "What it does"], rows: [
        ["Negotiation", "Counteroffers, budgets and quantities, answered within the seller's rules, across the seller's whole catalog."],
        ["Gasless funding", "Sign a USDC permit for exactly the prepaid amount; no gas and no separate approval transaction."],
        ["Pay per call", "x402 with two options: one USDC transfer per call, or Circle Gateway batching (deposit once, then every call is a signature)."],
        ["MCP server", "Nine tools for any MCP client: discover, negotiate, verify the seller on Arc, accept, fund, call, settle, status."],
        ["Protection", "Pay only for delivered units; unused balance refunds; disputes from your own wallet."],
      ] },
      { kind: "h3", id: "on-arc", text: "On Arc and Circle" },
      { kind: "list", items: [
        `DealEscrow (${ESCROW}), the same address on Arc mainnet and testnet, source-verified.`,
        "ERC-8004 identity: each seller's agent is registered from the seller's own wallet, publishing its payee and quote-signing key.",
        "ProteusPolicyRegistry: each product's pricing policy is committed on chain, and every quote embeds that commitment.",
        "Circle Wallets for people and agents, Circle Gateway for batched pay per call, and CCTP to fund from other chains.",
      ] },
    ],
  },
  {
    id: "trust",
    group: "Product",
    title: "Trust and safety",
    blocks: [
      { kind: "list", items: [
        "The model never sets a price. Offers come from a deterministic pricing engine; replies with any unlisted figure are discarded.",
        "Proteus never holds funds. USDC sits in the escrow contract and is released only with the buyer's signature, as a refund, or by the arbiter's split in a dispute.",
        "Sellers are paid into their own wallet, the payee published in their on-chain identity. A quote is refused if the identity or policy stops matching.",
        "Prepared and synced data cannot list a seller that is not registered on Arc.",
        "Contracts are source-verified on Sourcify (exact match) and Blockscout. DealEscrow is not independently audited yet.",
      ] },
    ],
  },
  {
    id: "why-now",
    group: "Market",
    title: "Why now",
    blocks: [
      { kind: "list", items: [
        "Agents are starting to buy. Stripe and OpenAI released the Agentic Commerce Protocol for checkout inside ChatGPT, and x402 lets agents pay per HTTP request. Both handle payment at a known price. Neither negotiates custom terms or holds funds until delivery, which is what most business deals need.",
        "Businesses already pay in stablecoins. Per McKinsey and Artemis, stablecoin payments reached about $390 billion in 2025, with B2B the largest share at about $226 billion, up more than 700% year over year.",
        "The rails are ready. Arc pays gas in USDC, and Circle provides wallets for people and agents, batched payments and cross-chain transfers, so a deal can be signed, funded and settled without a bank in the middle.",
      ] },
    ],
  },
  {
    id: "market",
    group: "Market",
    title: "Market opportunity",
    blocks: [
      { kind: "stats", items: [
        { value: "$21–33T", label: "Global B2B e-commerce in 2025 (estimates vary by firm and scope)", source: { name: "Mordor Intelligence, Grand View Research, Emergen Research via market summaries", url: "https://www.blueboltsolutions.com/b2b-ecommerce-vs-dtc-2026-data/" } },
        { value: "$3–5T", label: "Global agentic commerce by 2030 (McKinsey range; $1T in US B2C retail alone)", source: { name: "McKinsey", url: "https://www.mckinsey.com/industries/retail/our-insights/the-agentic-commerce-opportunity-how-ai-agents-are-ushering-in-a-new-era-for-consumers-and-merchants" } },
        { value: "$226B", label: "B2B stablecoin payments in 2025, of about $390B in total stablecoin payments", source: { name: "McKinsey and Artemis", url: "https://www.mckinsey.com/featured-insights/week-in-charts/stablecoins-find-their-niche" } },
        { value: "$26.8B", label: "US promotional products sales in 2024, the segment of our first live seller", source: { name: "PPAI 2024 Sales Volume Report", url: "https://www.ppai.org/news/ppai-sales-volume-estimate-modest-growth-in-2024-but-reasons-for-optimism-remain" } },
      ] },
      { kind: "p", text: "Our wedge is quote-based B2B: businesses that sell custom or volume orders and already accept stablecoins. That starts with custom merch and gifting, data APIs and developer infrastructure, the three segments of our first design partners. The same deal desk works for any seller with a price list, a floor and something to deliver." },
      { kind: "p", text: "Market figures are third-party estimates with different definitions; we show ranges where sources disagree." },
    ],
  },
  {
    id: "competitors",
    group: "Market",
    title: "Compared",
    blocks: [
      { kind: "table", head: ["", "Who it serves", "Negotiates custom terms", "Buyer agents", "Holds funds until delivery", "Settlement"], rows: [
        ["Proteus AI", "Sellers and their buyers, people or agents", "Yes, within the seller's rules, enforced in code", "Yes: MCP, x402, embed", "Yes, USDC escrow on Arc", "USDC per delivered unit"],
        ["Pactum", "Enterprise procurement teams", "Yes, on the buyer's side with suppliers", "Its own agents", "Not its focus", "Through the buyer's systems"],
        ["Stripe Agentic Commerce Protocol", "Merchants selling inside AI assistants", "No, catalog price at checkout", "Yes", "No, a standard payment", "Cards through Stripe or another processor"],
        ["x402", "APIs and content paid per request", "No", "Yes", "No, paid per request", "Stablecoins per request (Proteus supports it)"],
        ["CPQ and proposal tools", "Sales teams quoting by hand", "Rules for people writing quotes", "Not designed for agents", "No", "Invoice and bank transfer"],
        ["Escrow services", "One-off, high-value transactions", "No", "No", "Yes, managed by hand", "Bank transfer"],
      ], note: "Based on each product's public description as of October 2026." },
    ],
  },
  {
    id: "traction",
    group: "Traction",
    title: "Traction",
    blocks: [
      { kind: "stats", items: [
        { value: "1", label: "Real business live on Arc mainnet: Shoonya Store" },
        { value: "#2695", label: "Shoonya's ERC-8004 agent, registered from its own wallet" },
        { value: "4", label: "Products with pricing policies committed on chain" },
        { value: "0", label: "Paid orders with Shoonya so far; the first is next" },
      ] },
      { kind: "h3", id: "shoonya", text: "Shoonya Store" },
      { kind: "p", text: "Shoonya Store (shoonyastore.com) is a custom merch and corporate gifting studio whose clients already pay in USDC. It answered quote requests by hand; now its deal agent answers within its own rules, including its real quote of $15 per event merch box with delivery and taxes. It is adding the rest of its catalog and can keep stock and costs current through catalog sync." },
      { kind: "links", items: [
        { label: "Shoonya Store on Proteus", href: "https://app.proteus.co.in/app/market/shoonya-store-t4e" },
        { label: "Agent registration transaction", href: "https://explorer.arc.io/tx/0x45921b0f981908b7d704b79119863781c21e71498c812965d90db1787bd24e55", note: "owner and payee 0x995385cB1D15fcC4521442D488d2CB757cb641Da" },
        { label: "ProteusPolicyRegistry on Arc mainnet", href: "https://explorer.arc.io/address/0x376dFc4f1D356E78cc46983478A0F2e12CA7C84B" },
      ] },
      { kind: "h3", id: "proof", text: "Proof the loop works" },
      { kind: "list", items: [
        "Arc mainnet: a full real-USDC deal loop through DealEscrow (fund, settle for delivered work, refund the unused balance).",
        "Arc testnet: Claude, through the MCP server with a 13 USDC limit, negotiated a merch order with a demo seller, refused when the delivery date did not fit, bought a sample once it did, checked the seller's receipt and settled.",
        "Design partners in three segments: custom merch (Shoonya Store), prediction-market data (PolyBaskets) and privacy infrastructure for agents (Peal).",
      ] },
    ],
  },
  {
    id: "roadmap",
    group: "Traction",
    title: "What is next",
    blocks: [
      { kind: "list", items: [
        "The first paid order to Shoonya on Arc mainnet, posted with its transactions.",
        "Shoonya's catalog endpoint connected, so its agent quotes live stock.",
        "Delivery dates as part of the signed terms, not only in the conversation.",
        "More design partners onboarded from their own wallets.",
        "An independent audit of DealEscrow.",
      ] },
    ],
  },
  {
    id: "reference",
    group: "Reference",
    title: "Links",
    blocks: [
      { kind: "links", items: [
        { label: "API reference", href: "/docs/api", note: "calling a funded service, billing, settlement, the seller endpoint" },
        { label: "Agent skill", href: "/api/public/agents/skill.md", note: "for an AI agent to discover, negotiate, fund and settle" },
        { label: "DealEscrow on Arc mainnet", href: `https://explorer.arc.io/address/${ESCROW}`, note: "Sourcify exact match" },
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
      else if (b.kind === "table") {
        out.push(`| ${b.head.join(" | ")} |`, `|${b.head.map(() => "---").join("|")}|`, ...b.rows.map((r) => `| ${r.join(" | ")} |`));
        if (b.note) out.push("", `_${b.note}_`);
        out.push("");
      }
    }
  }
  return out.join("\n").trim() + "\n";
}
