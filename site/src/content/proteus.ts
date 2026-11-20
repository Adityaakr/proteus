/**
 * All landing page copy for Proteus AI. Edit here, not in sections.
 * Voice: a small business owner's outcomes first, in plain words; chain and protocol detail lives
 * in the "Under the hood" section and the FAQ. Every capability claim matches the docs
 * (site/src/app/docs/docsContent.ts) and uses their statuses: Live, Testnet, In testing, Coming soon.
 * Chats, handles and numbers in the visuals are illustrative, never customers.
 */

export const links = {
  sell: "/app/sell",
  sellGated: "/invite?next=%2Fapp%2Fsell",
  market: "/app/market",
  howItWorks: "/#how-it-works",
  record: "/review",
  github: "https://github.com/Adityaakr/proteus",
  help: "https://github.com/Adityaakr/proteus/issues",
  docs: "/docs",
  waysToUse: "/docs/ways-to-use",
  forAgents: "/docs/for-agents",
  sellerQuickstart: "/docs/quickstart-seller",
  fees: "/docs/fees",
  security: "/docs/security",
  limits: "/docs/limits",
  verify: "/docs/verify",
  blog: "/blog",
};

export const nav = {
  items: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Payment protection", href: "/#protection" },
    { label: "For agents", href: "/#agents" },
    { label: "Pricing", href: "/#pricing" },
    { label: "FAQ", href: "/#faqs" },
    { label: "Docs", href: links.docs },
  ],
  secondary: { label: "Why Arc", href: "/#why-arc" },
  primary: { label: "Start free", href: links.sell },
};

export const hero = {
  tag: "The AI sales agent with payment protection, built on",
  /** Network name shown with its mark after the tag; empty hides it. */
  tagNetwork: "Arc",
  headline: "Win the order in minutes. Get paid when it's delivered.",
  subhead:
    "An AI sales agent that negotiates with your buyers, and their AI agents, inside your prices and limits. Every order is paid upfront into escrow on Arc and released to you in USDC when the buyer confirms delivery.",
  secondary: { label: "See how it works", href: links.howItWorks },
  /** `href` when the deployment runs the invite gate, `openHref` when it does not. */
  primary: { label: "Start free", hoverLabel: "Enter invite code", href: links.sellGated, openHref: links.sell },
  /** The three short facts under the buttons. */
  trust: ["Free during the pilot", "Live on Arc mainnet", "Set up in about 5 minutes"],
  chat: {
    user: "We're running a hackathon for 250 builders in Bengaluru on Dec 14. We need 250 black oversized tees, logo printed front and back, sizes S to XXL. Budget is $1,500 in USDC. Can you make it work?",
    status: ["Reading the request...", "Checking prices, margin and capacity", "Sizing offers to the budget"],
    done: "Two offers, both in policy.",
    reply:
      "250 tees at the bulk price is $1,625. If $1,500 is firm, 230 tees come to $1,495. Your payment is held in escrow until you confirm delivery.",
    completed: "Offer made",
    suggestionsLabel: "Suggestions",
    suggestions: ["Option 01: 250 tees, $1,625", "Option 02: 230 tees, $1,495", "Keep negotiating"],
    placeholder: "Reply to the seller's agent..",
  },
};

export const logos = {
  line: "Built for the businesses behind every custom order: merch and apparel studios, print and packaging shops, gifting companies, event suppliers, creative studios and wholesalers. The conversation above is an example; every real offer is priced from the seller's own rules.",
};

/** How it works: three plain steps (HowItWorks component, id "how-it-works"). The third card shows an order paying out. */
export const howItWorks = {
  tag: "How it works",
  heading: "Set your rules once.\nProteus handles every quote.",
  description:
    "Buyers want a price now. Quoting each custom order by hand means late replies, lost orders and invoices to chase. Proteus answers for you and collects the money before you start.",
  mandates: [
    "250 tees with our logo, budget $1,500?",
    "Can you do a better price for 500?",
    "Can you deliver to Pune by the 12th?",
  ],
  promptCard: { suggestion: "Buyers ask", run: "Ask the agent" },
  steps: [
    {
      title: "1. Buyers ask, at any hour.",
      body: "Quantity, budget, design, deadline, in their own words. One conversation covers your whole catalogue, on your store page, your website or from a buyer's own AI agent.",
    },
    {
      title: "2. Your agent quotes inside your limits.",
      body: "It builds offers from your price tiers and checks each one against your margin floor, discount limit and capacity. Big orders wait for your approval.",
    },
    {
      title: "3. You're paid when they confirm delivery.",
      body: "Both sides sign the same terms and the buyer pays into escrow before you start. When the buyer confirms delivery, the contract releases the money to you, settled on Arc in under a second.",
    },
  ],
  agent: {
    title: "Order: 230 tees",
    items: [
      { label: "Terms agreed by both sides", state: "done" },
      { label: "$1,495 held in escrow", state: "done" },
      { label: "Order delivered", state: "done" },
      { label: "Buyer confirmed delivery", state: "done" },
      { label: "Releasing $1,495 to you", state: "loading" },
    ] as { label: string; state: "done" | "loading" }[],
  },
};

/** Payment protection for both sides (dark Trust section, id "protection"). */
export const trust = {
  tag: "Payment protection",
  heading: "You never start work unpaid. They never pay for what didn't arrive.",
  description:
    "Every order is paid upfront into escrow, held by a public contract rather than by Proteus, you or the buyer. The AI negotiates; the contract holds the money. What the model says is an input to the deal, never the thing that releases payment.",
  cards: [
    { title: "Paid before you start", body: "The buyer funds the full order when both sides agree the terms. You can see the money is there before you buy materials." },
    { title: "Released on delivery", body: "When the buyer confirms what was delivered, the contract pays you that amount. No invoices to chase." },
    { title: "Refunds for the rest", body: "Anything not delivered is refundable to the buyer after the agreed term, so new buyers can order with confidence." },
    { title: "Reviews from real orders only", body: "A buyer can review you only after an order has paid out, and reviews from people linked to the seller are flagged in public." },
  ],
};

export const decisions = {
  tag: "Protect your margins",
  heading: "Your AI negotiates.\nIt never gives away your margin.",
  description:
    "A buyer can ask for 30% off, push back on every offer or try to talk the agent out of your limits. None of it changes what you allow.",
  tabs: [
    { number: "01", title: "Never below your floor" },
    { number: "02", title: "Sized to the budget" },
    { number: "03", title: "Your prices, your call" },
    { number: "04", title: "Big orders wait for you" },
  ],
  cards: [
    {
      id: "qYrFueytg",
      title: "The price comes from your numbers, not the AI.",
      body: "Every quote is calculated from your price tiers, costs and limits. The AI writes the message around it; a reply that states a number your rules did not produce is replaced before the buyer sees it.",
      search: {
        wave: "Your rules for custom tees",
        results: ["Cost per tee: $3.00", "Lowest margin: 35%", "Biggest discount: 5% off list", "Ask me before orders over $500"],
      },
    },
    {
      id: "JSCqOTffG",
      title: "Sized to the budget, not just discounted.",
      body: "If the budget does not cover the full order, the agent offers what it does buy at your best tier instead of cutting into your margin. You keep the deal and the margin.",
      wave: "Fitting the order to the budget",
    },
    {
      id: "lyqPHrB7z",
      title: "Change prices whenever you like.",
      body: "Update a price, a limit or your capacity at any time. New quotes follow the new numbers, and orders already agreed keep their terms.",
      wave: "Updating your price list",
      paragraphs: [
        "Custom tees: new prices apply to new quotes.",
        "Orders already agreed keep their terms.",
      ],
    },
    {
      id: "HKd1Ndk3M",
      title: "Big orders wait for you.",
      body: "Orders above your approval limit wait for one tap in your dashboard. Requests your rules cannot meet get a clear no, not a promise you cannot keep.",
      approvals: {
        campaign: "Open negotiations",
        meta: "3 need your decision",
        heading: "Needs you",
        rows: [
          { handle: "@hackathon-team", note: "300 tees, above your approval limit", action: "Approve" },
          { handle: "@buyer-agent", note: "asked below your floor", action: "Decline" },
          { handle: "@events-studio", note: "bulk pack offered instead", action: "Review" },
          { handle: "@conf-crew", note: "accepted within your rules", action: "Closed" },
        ],
        you: "Seller",
        menu: ["Approve", "Counter", "Decline"],
      },
    },
  ],
};

export const partners = {
  tag: "Who it's for",
  heading: "For businesses that answer \"it depends\" when asked the price.",
  description:
    "If your customers, or their agents, ask for a quote before they buy, your deal agent can answer them. Live on Arc mainnet today: one merch and print studio, with every order public on chain.",
  steps: [
    { number: "01", title: "Custom merch and apparel. Quantity, sizes, print method and per-unit price." },
    { number: "02", title: "Corporate and event gifting. Box contents, branding and volume pricing." },
    { number: "03", title: "Event supply. Swag, signage and kits for organisers with a budget and a deadline." },
    { number: "04", title: "Creative and freelance services. Design, video and content, priced per deliverable." },
    { number: "05", title: "Wholesale and small-batch makers. Minimum orders, price tiers and repeat buyers." },
    { number: "06", title: "Print and packaging. Stickers, stationery and packaging, priced by run size." },
  ],
};

/** ERC-8183: how a Proteus order maps onto the draft agent job standard (Partners layout, id "erc-8183"). The interface is planned, not built. */
export const erc8183 = {
  tag: "ERC-8183",
  heading: "Real orders, in the shape agents expect.",
  description:
    "ERC-8183 is a draft standard for paid jobs between agents: a client funds escrow, a provider delivers, and an evaluator approves before payment. A Proteus order follows the same lifecycle, with the buyer as evaluator, and adds what a real business needs around it. Today orders run on DealEscrow; an ERC-8183-compatible interface is planned.",
  steps: [
    { number: "01", title: "Budget: negotiated. The standard leaves how a price is agreed open; your deal agent negotiates it inside your rules." },
    { number: "02", title: "Fund: paid upfront. The buyer funds the agreed amount into escrow before you start work." },
    { number: "03", title: "Submit: delivered. You record each delivery against the order, with proof if you have it." },
    { number: "04", title: "Complete: paid per unit. The buyer's signed acceptance is the evaluator, so 180 good tees out of 200 still pay out." },
    { number: "05", title: "Reject or expire: refunded. Whatever the buyer doesn't accept is refundable to them after the term." },
    { number: "06", title: "Beyond the standard: disputes (In testing) and ERC-8004 reviews only from settled orders." },
  ],
};

/** Agent to agent: what the AI decides, buyers' agents, what they verify (Verification component, id "agents"). */
export const verification = {
  tag: "Agent to agent",
  heading: "Your agent can sell to theirs.",
  description:
    "More orders will start with a buyer's AI agent that prices, pays and confirms outcomes on its own. Your deal agent negotiates with it under the same rules a person gets, and everything a careful agent should check is public on Arc.",
  counts: {
    title: "What the AI decides, and what it can't.",
    body: "It reads the request, chooses which offers to make and explains them. Code computes every price from your rules, and only signatures release money.",
    chips: ["Reads the request", "Chooses the offer", "Explains the terms", "Price: your rules", "Floor: your rules", "Release: signatures", "Refund: the contract"],
  },
  pay: {
    title: "A buyer's agent with a budget it can't exceed.",
    body: "Claude or any MCP client can negotiate, verify you on Arc, fund and settle within a per-deal mandate its owner sets. Proven on Arc testnet; a hosted buyer agent is Coming soon.",
  },
  real: {
    title: "What a buyer's agent checks before it pays.",
    body: "Your ERC-8004 identity, the policy commitment your quote came from, the wallet that gets paid and your record of settled orders.",
    signals: ["Identity", "Price policy", "Payout wallet", "Settled orders", "Reviews"],
  },
  order: {
    title: "The model proposes. The contract pays.",
    body: "Only signatures move money: both sides on the terms, then the buyer on what was delivered.",
    waveA: "The model proposes terms",
    waveB: "Signatures release the money",
    chips: ["Model", "Contract"],
  },
};

/** Why Arc: the Arc and Circle pieces behind the product, each with its docs status (Comparison component, id "why-arc"). */
export const comparison = {
  tag: "Built on Arc and Circle",
  heading: "Why this runs on Arc.",
  description:
    "Small negotiated orders are only worth escrowing when fees are in dollars and settlement is instant: on Arc, gas is paid in USDC and payments settle in under a second. Live: used on Arc mainnet. Testnet: proven on Arc testnet. In testing: built, not yet used by a real customer.",
  cards: [
    { icon: "/assets/JXfbymshMLyfsl2323zgdqBGL4.svg", threshold: 0.46, title: "DealEscrow · Live", body: "Holds each order's USDC and pays out only against both sides' EIP-712 signatures. Source-verified, not upgradeable, no fee logic and fuzz-tested; not yet audited. An ERC-8183-compatible interface is planned." },
    { icon: "/assets/bD52TK3MrelH1Oc6avERVA1JXw4.svg", threshold: 0.46, title: "ERC-8004 identity and reviews · Live", body: "Each seller registers its agent from its own wallet, commits every price policy on chain, and earns reviews only from settled orders." },
    { icon: "/assets/oj7jXSrLMVYLxliKOyzXN6J1ZRs.svg", threshold: 0.46, title: "Circle Wallets, gasless funding · Live", body: "Signing in creates a Circle user-controlled wallet on Arc. Buyers fund with a USDC permit and Proteus pays the gas." },
    { icon: "/assets/GUrpYsrYM8fPXMf7BXBghK727Bs.svg", threshold: 0.71, title: "CCTP with Bridge Kit · Live", body: "Teams that already hold USDC, such as DAOs, hackathons and conferences, pay directly; others bring it from other chains inside the app." },
    { icon: "/assets/vBsEOrQoXzW0ffeVyss7E7BMXc.svg", threshold: 0.42, title: "MCP, HTTP and x402 · Testnet", body: "Buyers' agents negotiate and pay through MCP or plain HTTP within a mandate; one-off calls pay with x402 through Circle's facilitator or Gateway batching. Works with a Circle Agent Wallet." },
    { icon: "/assets/fBC0zzbZpTAZaOtfiJwmWF4bgO4.svg", threshold: 0.28, title: "Your own channels", body: "Website embed: Testnet. WhatsApp on your own number: In testing. Seller API and webhooks: In testing. The code is open on GitHub." },
  ],
};

/** "How it's different": the landing page comparison, from the strategy report's sourced capability matrix and the competitor research (Nov 2026). */
export const landingCompare = {
  tag: "How it's different",
  heading: "Negotiation, escrow and settlement in one flow.",
  description:
    "Escrow services hold the money but leave the quoting to you. Offer apps negotiate but don't hold the money. Agent payment protocols pay a fixed price. Proteus negotiates inside your rules, holds the payment and settles on the buyer's signature.",
  capabilities: [
    "Negotiates price inside the seller's rules",
    "Holds payment until delivery is confirmed",
    "Release decided by the buyer's signature, not a model",
    "Refunds and a dispute path",
    "Reputation only from completed orders",
    "Works with buyers' AI agents",
    "Follows the ERC-8183 job lifecycle",
  ],
  proteus: {
    name: "Proteus AI",
    description: "The AI sales agent with payment protection, built on Arc.",
    href: "/app",
    logo: "/assets/proteus-ai-wordmark.png",
    logoHeight: 18,
    marks: ["yes", "yes", "yes", "partial", "yes", "yes", "planned"],
    notes: [undefined, "Live on Arc mainnet", undefined, "Refunds Live; disputes In testing", "ERC-8004, with link checks", "MCP and HTTP, Testnet", "Same lifecycle; interface planned"],
  } as CompareVendor,
  vendors: [
    { name: "Escrow services", description: "Escrow.com and similar: a third party holds the payment for a fee.", href: "https://www.escrow.com", marks: ["not-core", "yes", "yes", "yes", "not-core", "not-core", "not-core"], notes: [undefined, undefined, "Buyer approves", undefined, undefined, undefined, undefined] },
    { name: "Offer apps", description: "Shopify negotiation apps such as Flux and Bargain Buddy.", href: "https://apps.shopify.com/flux-ai-negotiation", marks: ["yes", "not-core", "not-core", "partial", "not-core", "not-core", "not-core"], notes: ["Floor price, discount codes", undefined, undefined, "Store returns", undefined, undefined, undefined] },
    { name: "Agent payment protocols", description: "x402, ACP and AP2: an agent pays a known price.", href: "https://docs.x402.org/schemes/overview", marks: ["not-core", "partial", "not-core", "partial", "not-core", "yes", "not-core"], notes: ["Fixed price", "x402 auth-capture, Base only", undefined, "Void and refund, no arbiter", undefined, undefined, undefined] },
    { name: "Agent job escrow", description: "ERC-8183 and Virtuals ACP: escrowed jobs between agents.", href: "https://eips.ethereum.org/EIPS/eip-8183", marks: ["partial", "yes", "partial", "partial", "partial", "yes", "yes"], notes: ["Budget proposals", undefined, "An evaluator decides", "ERC-8183 has no disputes", "Own registry", undefined, "ERC-8183 itself"] },
  ] as CompareVendor[],
  closing: "Others hold the money, haggle over the price, or pay a fixed amount. Proteus does all three, and leaves the release to the buyer.",
  footnote: "Assessed from each product's public pages and specifications in November 2026. Names belong to their owners. Proteus marks reflect what runs today, with statuses as in our docs.",
};

/** "How Proteus AI compares": assessed from each vendor's public product pages in October 2026. Not on the landing page; the docs render it. */
export type CompareMark = "yes" | "partial" | "not-core" | "planned";
export interface CompareVendor {
  name: string;
  description: string;
  href: string;
  /** Wordmark image, shown instead of the name text. The name stays as alt text. */
  logo?: string;
  /** Rendered height in px so wordmarks with different internal padding read at one visual size. */
  logoHeight?: number;
  marks: CompareMark[];
  /** Short qualifier shown under a mark when the plain word would overstate it. */
  notes?: (string | undefined)[];
}
export const compare = {
  tag: "How Proteus AI compares",
  heading: "Built to close deals, not just manage them.",
  description:
    "Good tools exist for quoting, billing and negotiation. Proteus AI brings the whole workflow together, from the first requirement to the executed deal.",
  capabilities: [
    "Autonomous customer-facing negotiations",
    "Cost-aware pricing and margin protection",
    "Custom packages and commercial terms",
    "Automated deal closing",
    "USDC payments and programmable settlement",
    "Usage-based fulfillment and reconciliation",
    "Designed for small AI and internet businesses",
  ],
  proteus: {
    name: "Proteus AI",
    description: "The autonomous deal desk for internet businesses, in one flow.",
    href: "/app",
    logo: "/assets/proteus-ai-wordmark.png",
    logoHeight: 18,
    marks: ["yes", "yes", "yes", "yes", "yes", "yes", "yes"],
    notes: [undefined, undefined, undefined, "Both sides sign, escrow funds", "Live on Arc mainnet", undefined, undefined],
  } as CompareVendor,
  vendors: [
    { name: "DealHub", logo: "/assets/vendors/dealhub.svg", logoHeight: 13, description: "CPQ, DealRoom and billing for midsize and enterprise sales teams.", href: "https://dealhub.io", marks: ["not-core", "partial", "yes", "partial", "not-core", "partial", "not-core"], notes: [undefined, "Discount thresholds, approvals", undefined, "E-signature in DealRoom", undefined, "Usage pricing in billing", undefined] },
    { name: "Pactum AI", logo: "/assets/vendors/pactum.svg", logoHeight: 16, description: "Autonomous supplier negotiations for enterprise procurement.", href: "https://pactum.com", marks: ["yes", "partial", "partial", "partial", "not-core", "not-core", "not-core"], notes: ["Supplier side, for buyers", "Negotiates to savings targets", "Price, payment, rebate terms", "Agreements via ERP integration", undefined, undefined, undefined] },
    { name: "Nue", logo: "/assets/vendors/nue.svg", logoHeight: 14, description: "Salesforce-native quote-to-revenue with usage billing.", href: "https://www.nue.io", marks: ["not-core", "not-core", "yes", "partial", "not-core", "yes", "partial"], notes: [undefined, undefined, undefined, "Quote to order in Salesforce", undefined, "Rating and billing", "SaaS scale-ups"] },
    { name: "Sequence", logo: "/assets/vendors/sequence.svg", logoHeight: 22, description: "Billing and CPQ for B2B SaaS with custom contracts.", href: "https://www.sequencehq.com", marks: ["not-core", "not-core", "yes", "partial", "not-core", "yes", "partial"], notes: [undefined, undefined, undefined, "Signed quotes auto-execute", undefined, undefined, "Startups and scale-ups"] },
    { name: "Metronome", logo: "/assets/vendors/metronome-wordmark.svg", logoHeight: 20, description: "Usage-based billing infrastructure, now part of Stripe.", href: "https://metronome.com", marks: ["not-core", "not-core", "yes", "not-core", "not-core", "yes", "partial"], notes: [undefined, undefined, "Contracts and overrides", undefined, undefined, "Metering and invoicing", "Self-serve starter plan"] },
  ] as CompareVendor[],
  closing: "Others help you quote, negotiate, or bill. Proteus AI is built to take a deal from the first conversation to the final transaction.",
  footnote: "Assessed from each vendor's public product pages in October 2026. Names and logos belong to their owners and are shown for identification only. Proteus AI marks reflect what is implemented today. USDC settlement runs on Arc mainnet and testnet.",
};

export interface Plan {
  name: string;
  value: number;
  period: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  primary?: boolean;
  tag?: string;
}

/**
 * Pricing: the plans proposed for after the pilot (amounts await the captain's approval, see
 * copy-v3.md). Every feature is free during the pilot and there is no billing yet, so every CTA
 * starts free. The toggle switches all three cards between monthly and yearly.
 */
export const pricing = {
  tag: "Pricing",
  heading: "Start free. Upgrade when the orders do.",
  description:
    "Every feature is free for pilot sellers. After the pilot, these are the plans, and you'll be told before anything is billed. Plans are a flat subscription billed separately: nothing is ever taken from an order, and buyers never pay a fee.",
  toggle: { left: "Monthly", right: "Yearly", badge: "2 months free" },
  monthly: [
    {
      name: "Starter",
      value: 0,
      period: "forever",
      description: "For trying Proteus on your first orders. Up to 3 products and 10 paid orders a month.",
      features: ["AI deal agent on your store page", "Price tiers, margin floor and discount limit", "Payment held in escrow on every order", "The full agreed amount paid out to you", "Practice with free test money first"],
      cta: { label: "Start free", href: links.sell },
    },
    {
      name: "Growth",
      tag: "Recommended",
      value: 29,
      period: "/month",
      description: "For a studio quoting every week. ₹1,999 a month in India. Up to 100 paid orders a month.",
      features: ["Everything in Starter, unlimited products", "Agent on your own website", "Approval for big orders", "Alerts and accounting export", "WhatsApp agent (in testing)"],
      cta: { label: "Try Growth free in the pilot", href: links.sell },
      primary: true,
    },
    {
      name: "Business",
      value: 99,
      period: "/month",
      description: "For a business running its sales through Proteus. ₹6,999 a month in India. Unlimited orders.",
      features: ["Everything in Growth", "Seller API and signed webhooks (in testing)", "Catalogue sync from your system (in testing)", "Team access for your staff (coming soon)", "Priority help with setup"],
      cta: { label: "Try Business free in the pilot", href: links.sell },
    },
  ] as Plan[],
  yearly: [
    {
      name: "Starter",
      value: 0,
      period: "forever",
      description: "For trying Proteus on your first orders. Up to 3 products and 10 paid orders a month.",
      features: ["AI deal agent on your store page", "Price tiers, margin floor and discount limit", "Payment held in escrow on every order", "The full agreed amount paid out to you", "Practice with free test money first"],
      cta: { label: "Start free", href: links.sell },
    },
    {
      name: "Growth",
      tag: "Recommended",
      value: 24,
      period: "/month, billed yearly",
      description: "$290 a year, or ₹19,990 in India. Up to 100 paid orders a month.",
      features: ["Everything in Starter, unlimited products", "Agent on your own website", "Approval for big orders", "Alerts and accounting export", "WhatsApp agent (in testing)"],
      cta: { label: "Try Growth free in the pilot", href: links.sell },
      primary: true,
    },
    {
      name: "Business",
      value: 83,
      period: "/month, billed yearly",
      description: "$990 a year, or ₹69,990 in India. Unlimited orders.",
      features: ["Everything in Growth", "Seller API and signed webhooks (in testing)", "Catalogue sync from your system (in testing)", "Team access for your staff (coming soon)", "Priority help with setup"],
      cta: { label: "Try Business free in the pilot", href: links.sell },
    },
  ] as Plan[],
  includes: "INCLUDES",
};

export const faq = {
  tag: "FAQ",
  heading: "Frequently asked questions",
  description: "What it does, what it costs, how you get paid, what happens when something goes wrong, and what is live today.",
  items: [
    { q: "What is Proteus AI?", a: "An AI sales agent with payment protection for small businesses that sell by quote. It answers buyers and negotiates inside your prices and limits, the buyer pays into escrow before you start, and the money is released to you when they confirm delivery." },
    { q: "How is this different from a payment link or an escrow service?", a: "A payment link gets you paid but leaves the quoting to you and gives the buyer no protection. An escrow service protects both sides but charges a fee on each deal, and you still quote by hand. Proteus quotes, negotiates and holds the payment in one flow, with no fee on your orders." },
    { q: "What does the AI actually decide?", a: "It reads each request, decides which offers to make, sizes them to the buyer's budget and explains the terms. It does not set prices, which are computed in code from your rules, and it never moves money: only the buyer's and the seller's signatures do. A reply that states a number your rules did not produce is replaced before the buyer sees it." },
    { q: "Can the AI agree to a bad deal?", a: "No. Prices are calculated from your tiers, costs and limits, not by the AI. It cannot go below your margin floor or past your discount limit, and orders above your approval limit wait for you." },
    { q: "Can my buyers' AI agents buy from me?", a: "Yes. A buyer's agent can negotiate, check your identity and price policy on Arc, and fund the order within a limit its owner sets, through MCP or plain HTTP. This is proven on Arc testnet, not yet on mainnet. A hosted buyer agent you can use in the browser is Coming soon." },
    { q: "What does it cost?", a: "Every feature is free during the pilot. After it, Starter stays free and paid plans start at $29 a month (₹1,999 in India); you'll be told before anything is billed. Proteus never takes a cut of an order, and buyers never pay a fee." },
    { q: "How do I get paid?", a: "In USDC, a digital dollar issued by Circle, sent to the wallet you sign up with. You are paid for what the buyer confirms as delivered. Rules for receiving stablecoins differ by country, so check yours, including tax, before you start." },
    { q: "Why USDC and Arc?", a: "Because escrow has to be cheap and instant to make sense for a $1,500 order. On Arc, network fees are paid in USDC rather than a volatile token, payments settle in under a second, and the ERC-8004 identity and reputation registries are already live. Circle's tools let buyers sign in, fund without gas and bring USDC from other chains." },
    { q: "How does Proteus relate to ERC-8183?", a: "ERC-8183 is a draft Ethereum standard for paid jobs between agents: the client funds escrow, the provider delivers, and an evaluator completes the job (paying the provider) or rejects it (refunding the client). A Proteus order follows that lifecycle with the buyer as evaluator, and adds the parts the standard leaves open: negotiating the price inside your rules, paying per accepted unit rather than all or nothing, a dispute path and reviews from settled orders. DealEscrow does not implement the ERC-8183 interface today; a compatible version is planned, so agents built for the standard can order from you directly." },
    { q: "What if a buyer never confirms delivery?", a: "Then the money is not released. You can open a dispute, which freezes the order for the arbiter; if nobody does, the unconfirmed amount becomes refundable to the buyer after the term and a 3-day grace period. Delivery dates agreed in chat are not part of the signed terms." },
    { q: "How are disputes settled?", a: "Either side can open a dispute, and the arbiter splits the money still in escrow between the two. Disputes are In testing: today Proteus holds the arbiter key and there is no deadline for a decision. An independent arbiter and a dispute timeout are Coming soon." },
    { q: "Do my buyers need crypto?", a: "They need USDC. Teams that already hold it pay directly; others can bring it from another network inside the app. Funding an order needs no network fee: the buyer signs and Proteus pays the gas." },
    { q: "Who holds the money and the keys?", a: "Orders wait in the escrow contract, never in a Proteus account. Your wallet owns your account and receives every payout. Proteus holds an encrypted key that countersigns offers on your behalf; it cannot send your payouts anywhere else." },
    { q: "Is it safe?", a: "The escrow contract is public, source-verified, not upgradeable and covered by unit and invariant tests. It has not been independently audited yet. Every known gap is listed in the docs under Limits and known gaps." },
    { q: "Is Proteus AI live?", a: "Yes, on Arc mainnet. One real business is listed so far, Shoonya Store, a merch studio. Its first customer order, 6.60 USDC, paid out on 11 Nov 2026; the buyer wallet was later found linked to a Shoonya team account, and the public review says so. AI agents buying is proven on Arc testnet, not yet on mainnet." },
    { q: "How do I start?", a: "Sign in with your wallet, add a product with its price tiers and private limits, and register your business in one step. It takes about 5 minutes, and you can practise with free test money first." },
    { q: "How do I get help?", a: "The docs cover setup, fees, security and limits. For questions or problems, open an issue on GitHub; the whole codebase is public there." },
  ],
};

export const footer = {
  heading: "Your next custom order, quoted and paid.",
  line: "Set your prices and limits once. Proteus answers every buyer, collects payment upfront and releases it to you when they confirm delivery.",
  cta: { label: "Start free", href: links.sell },
  brand: "Proteus AI",
  tagline: "The AI sales agent with payment protection, built on Arc.",
  columnTitle: "Product",
  columns: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Payment protection", href: "/#protection" },
    { label: "Pricing", href: "/#pricing" },
    { label: "For agents", href: "/#agents" },
    { label: "Why Arc", href: "/#why-arc" },
    { label: "FAQ", href: "/#faqs" },
    { label: "Seller quickstart", href: links.sellerQuickstart },
    { label: "Security", href: links.security },
    { label: "Docs", href: links.docs },
    { label: "Get help", href: links.help },
    { label: "GitHub", href: links.github },
  ],
  copyright: "© 2026 Proteus AI. Built with Circle and Arc.",
  right: { label: "Public records", href: links.record },
};

/** Mirrors the <title> and meta tags in site/index.html; keep the two in step. */
export const meta = {
  title: "Proteus AI | Win the order in minutes, get paid when it's delivered",
  description: "Proteus is an AI sales agent for businesses that sell custom orders. It negotiates with your buyers and their AI agents inside your prices and limits, and every order is paid upfront into escrow on Arc and released to you in USDC when the buyer confirms delivery.",
  ogTitle: "Win the order in minutes. Get paid when it's delivered.",
  ogDescription: "An AI sales agent that negotiates inside your rules, with every order paid upfront into USDC escrow on Arc and released when the buyer confirms delivery.",
};
