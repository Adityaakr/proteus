/**
 * All landing page copy for Proteus AI. Edit here, not in sections.
 * Positioning: the deal network for small businesses and AI agents on Arc. Every capability claim
 * matches the docs (site/src/app/docs/docsContent.ts) and uses the same statuses: Live, Testnet,
 * In testing, Coming soon. Chats, handles and numbers in the visuals are illustrative, never customers.
 */

export const links = {
  sell: "/app/sell",
  sellGated: "/invite?next=%2Fapp%2Fsell",
  market: "/app/market",
  howItWorks: "/#how-it-works",
  record: "/review",
  github: "https://github.com/Adityaakr/proteus",
  docs: "/docs",
  waysToUse: "/docs/ways-to-use",
  forAgents: "/docs/for-agents",
  sellerQuickstart: "/docs/quickstart-seller",
  blog: "/blog",
};

export const nav = {
  items: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "For sellers", href: "/#agent" },
    { label: "Who it's for", href: "/#partners" },
    { label: "For agents", href: "/#agents" },
    { label: "FAQ", href: "/#faqs" },
    { label: "Docs", href: links.docs },
  ],
  secondary: { label: "Ways to use", href: links.waysToUse },
  primary: { label: "Start selling", href: links.sell },
};

export const hero = {
  tag: "The deal network for small businesses and AI agents, built on",
  tagNetwork: "Arc",
  headline: "Negotiated by your agent. Paid on delivery.",
  subhead:
    "Proteus AI gives a small business a deal agent. It negotiates inside the rules you set, takes the buyer's USDC into escrow on Arc, and releases it when the buyer accepts delivery.",
  secondary: { label: "See how it works", href: links.howItWorks },
  /** `href` when the deployment runs the invite gate, `openHref` when it does not. */
  primary: { label: "Start selling", hoverLabel: "Enter invite code", href: links.sellGated, openHref: links.sell },
  chat: {
    user: "We're hosting a hackathon in Bengaluru and need 250 custom tees with our logo. Our budget is $1,500 in USDC. Can you make it work?",
    status: ["Reading the request...", "Checking tiers, floor and capacity", "Sizing offers to the budget"],
    done: "Two offers, both in policy.",
    reply:
      "250 tees at the bulk price is $1,625. If $1,500 is firm, 230 tees come to $1,495. Your USDC waits in escrow until you accept delivery.",
    completed: "Offer made",
    suggestionsLabel: "Suggestions",
    suggestions: ["Option 01: 250 tees, $1,625", "Option 02: 230 tees, $1,495", "Keep negotiating"],
    placeholder: "Reply to the seller's agent..",
  },
};

export const logos = {
  line: "For small businesses whose price is a conversation: custom merch and print, gifting, event supply, creative services and wholesale. The chat above is illustrative; real offers come from each seller's own rules.",
};

/** The 4-step flow (rendered by the dark Trust section, id "how-it-works"). */
export const trust = {
  tag: "How it works",
  heading: "Four steps from a question to a paid order.",
  description:
    "The AI negotiates. The contract holds the money. A model's output is an input to the deal, never the condition that releases payment.",
  cards: [
    { title: "1. Negotiate inside your rules", body: "A buyer, or the buyer's own agent, asks. Your deal agent offers only what your price floor, discount cap and capacity allow." },
    { title: "2. USDC into escrow on Arc", body: "Both sides sign the same terms. The buyer's USDC goes into the escrow contract on Arc, never to a Proteus account, and funding is gasless." },
    { title: "3. Released on delivery", body: "You record what you delivered. The contract pays you for what the buyer signs as received; the unspent balance is refundable." },
    { title: "4. Reputation from settled deals", body: "Once a deal pays out, the buyer can rate you on Arc's ERC-8004 registry. No settled deal, no rating, and every rating is checked for links to the seller in public." },
  ],
};

/** "Your deal agent": the three visual cards (HowItWorks component, id "agent"). */
export const howItWorks = {
  tag: "For sellers",
  heading: "Answers in seconds.\nOnly inside your rules.",
  description:
    "Custom orders need a quote, and quoting by hand loses the buyers who want an answer now. Your deal agent handles the back and forth for every product in your store.",
  mandates: [
    "250 tees with our logo, budget $1,500?",
    "Can you do a better price for 500?",
    "My agent can spend up to $2,000.",
  ],
  promptCard: { suggestion: "Buyers ask", run: "Ask the agent" },
  steps: [
    {
      title: "Buyers ask in their own words.",
      body: "Quantity, budget, design, deadline. One conversation covers your whole store, whether it starts on your store page, your website or a buyer's own agent.",
    },
    {
      title: "Your agent negotiates inside your rules.",
      body: "It reads the request, builds offers from your price tiers and checks each one against your floor, discount cap and capacity. Counteroffers go through the same checks.",
    },
    {
      title: "Offers you can stand behind.",
      body: "Anything your rules do not allow is refused with a reason. Anything above your approval line waits for you. Nothing is promised that you cannot deliver.",
    },
  ],
  agent: {
    title: "What the buyer doesn't see",
    items: [
      { label: "Price tiers checked", state: "done" },
      { label: "Margin floor checked", state: "done" },
      { label: "Discount cap checked", state: "done" },
      { label: "Capacity for 250 tees checked", state: "done" },
      { label: "Sizing an offer to the $1,500 budget", state: "loading" },
    ] as { label: string; state: "done" | "loading" }[],
  },
};

export const decisions = {
  tag: "Seller control",
  heading: "The agent talks.\nYour rules decide.",
  description:
    "A buyer can ask for 30% off, push back on every offer or try to talk the agent out of your limits. None of it changes what your rules allow.",
  tabs: [
    { number: "01", title: "Prices from code" },
    { number: "02", title: "Sized to the budget" },
    { number: "03", title: "Committed on Arc" },
    { number: "04", title: "Big orders wait for you" },
  ],
  cards: [
    {
      id: "qYrFueytg",
      title: "The price comes from code, not the model.",
      body: "Offers are computed from your tiers, costs and limits. The model writes the reply, a figure check replaces any reply that states a number the engine did not produce, and attempts to override your rules are logged and have no effect.",
      search: {
        wave: "Checking the reply against your rules",
        results: ["Price computed from your tiers", "Every figure in the reply matches", "Override attempt logged, no effect", "Reply sent to the buyer"],
      },
    },
    {
      id: "JSCqOTffG",
      title: "Sized to the budget, not just discounted.",
      body: "If the budget does not cover the full order, the agent offers what it does buy at your best tier instead of cutting into your margin.",
      wave: "Fitting the order to the budget",
    },
    {
      id: "lyqPHrB7z",
      title: "Your rules, committed on Arc.",
      body: "Each product's pricing policy is committed to your Arc identity. Change it whenever you like: new offers follow the new version, and signed deals keep their terms.",
      wave: "Committing policy v2 on Arc",
      paragraphs: [
        "Custom tees: policy v2 committed to your Arc identity.",
        "Deals already signed keep their terms.",
      ],
    },
    {
      id: "HKd1Ndk3M",
      title: "Big orders wait for you.",
      body: "Offers above your approval line wait for one tap in your console. Requests your rules cannot meet get a clear no, not a promise you cannot keep.",
      approvals: {
        campaign: "Open negotiations",
        meta: "3 need your decision",
        heading: "Needs you",
        rows: [
          { handle: "@hackathon-team", note: "300 tees, above your approval line", action: "Approve" },
          { handle: "@buyer-agent", note: "asked below your floor", action: "Decline" },
          { handle: "@dao-events", note: "bulk pack offered instead", action: "Review" },
          { handle: "@conf-crew", note: "accepted within your rules", action: "Closed" },
        ],
        you: "Seller",
        menu: ["Approve", "Counter", "Decline"],
      },
    },
  ],
};

export const verification = {
  tag: "Trust",
  heading: "Buyers don't have to take your word for it.",
  description:
    "Your identity, a commitment to your pricing policy and your payout wallet are on Arc. A buyer, or the buyer's agent, can check them before paying.",
  counts: {
    title: "Your rules stay private.",
    body: "Buyers never see your cost, floor or limits. They see a commitment to them on Arc, so they know an offer came from rules set in advance.",
    chips: ["Cost", "Margin floor", "Discount cap", "Minimum order", "Capacity", "Approval line", "Quote validity"],
  },
  pay: {
    title: "Every deal on the record.",
    body: "Offers, signatures, deliveries and payouts sit in your console, and every payment links to its transaction on Arc.",
  },
  real: {
    title: "What a buyer's agent can check before it pays.",
    body: "Your ERC-8004 identity, the committed policy the offer was priced from, the wallet that gets paid and your record of settled deals.",
    signals: ["Identity", "Policy", "Payout wallet", "Settled deals", "Ratings"],
  },
  order: {
    title: "The model proposes. The contract pays.",
    body: "Only signatures move money: both sides on the terms, then the buyer on what was delivered.",
    waveA: "The model proposes terms",
    waveB: "Signatures release the money",
    chips: ["Model", "Contract"],
  },
};

export const partners = {
  tag: "Who it's for",
  heading: "For businesses whose price is a conversation.",
  description:
    "If your customers ask for a quote before they buy, your deal agent can answer them. The first seller live on Arc mainnet is a merch and print studio.",
  steps: [
    { number: "01", title: "Custom merch and apparel. Quantity, sizes, print method and per-unit price." },
    { number: "02", title: "Corporate and event gifting. Box contents, branding and volume pricing." },
    { number: "03", title: "Event supply. Swag, signage and kits for organisers with a budget and a deadline." },
    { number: "04", title: "Creative and freelance services. Design, video and content, priced per deliverable." },
    { number: "05", title: "Wholesale and small-batch makers. Minimum orders, price tiers and repeat buyers." },
    { number: "06", title: "Print and packaging. Stickers, stationery and packaging, priced by run size." },
  ],
};

/** Buyers and their agents: every way in, with the docs' status for each (Comparison component, id "agents"). */
export const comparison = {
  tag: "Buyers and agents",
  heading: "Buyers can be people or their own agents.",
  description:
    "First up: buyers who already hold USDC, such as DAOs, hackathons, conferences and Web3 teams. Every way in reaches the same deal agent, prices from the same rules and ends in the same escrow. Live means used on Arc mainnet with real USDC; Testnet means proven on Arc testnet.",
  cards: [
    { icon: "/assets/JXfbymshMLyfsl2323zgdqBGL4.svg", threshold: 0.46, title: "Web app · Live", body: "Store pages, offer review with the terms checked in your browser, gasless funding and refunds." },
    { icon: "/assets/oj7jXSrLMVYLxliKOyzXN6J1ZRs.svg", threshold: 0.46, title: "Website embed · Testnet", body: "One script tag puts your deal agent on your own site. Signing and payment open in Proteus, never in the frame." },
    { icon: "/assets/bD52TK3MrelH1Oc6avERVA1JXw4.svg", threshold: 0.46, title: "WhatsApp · In testing", body: "The same agent on your own WhatsApp Business number. Offers arrive in the chat; paying always happens on the web." },
    { icon: "/assets/GUrpYsrYM8fPXMf7BXBghK727Bs.svg", threshold: 0.71, title: "MCP server · Testnet", body: "Claude or another MCP client negotiates, verifies the seller on Arc, funds and settles within a per-deal mandate." },
    { icon: "/assets/vBsEOrQoXzW0ffeVyss7E7BMXc.svg", threshold: 0.42, title: "Your own agent · Testnet", body: "Plain HTTP with a skill.md and OpenAPI for every service, any EIP-712 signer, and x402 for one-off paid calls." },
    { icon: "/assets/fBC0zzbZpTAZaOtfiJwmWF4bgO4.svg", threshold: 0.28, title: "Seller API · In testing", body: "Run your store from your own systems: deals, prices and deliveries through scoped keys, with signed webhooks." },
  ],
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

/** Not rendered: this copy doc has no pricing section, so `<Pricing />` is left out of App.tsx. Kept so the section compiles. */
export const pricing = {
  tag: "Pricing",
  heading: "Pricing",
  description: "",
  toggle: { left: "Testnet", right: "Mainnet", badge: "" },
  ownerNow: { name: "Seller", value: 0, period: "", description: "", features: [], cta: { label: "Get early access", href: links.sell } } as Plan,
  partner: { name: "Buyer", value: 0, period: "", description: "", features: [], cta: { label: "Negotiate a deal", href: links.market }, primary: true } as Plan,
  mainnet: { name: "Mainnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  testnet: { name: "Testnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  includes: "INCLUDES",
};

export const faq = {
  tag: "FAQ",
  heading: "Frequently asked questions",
  description: "What it is, who it is for, what the AI decides, where the money waits, and what is live.",
  items: [
    { q: "What is Proteus AI?", a: "The deal network for small businesses and AI agents on Arc. Each seller gets a deal agent that negotiates inside the seller's rules, takes the buyer's USDC into escrow on Arc and releases it when the buyer accepts delivery." },
    { q: "Who is it for?", a: "Small suppliers whose price is negotiable: custom merch and print, gifting, event supply, creative and freelance services, and wholesale. Buyers can be people on the web or their own AI agents." },
    { q: "What does the AI decide, and what doesn't it?", a: "It reads the request, chooses which offers to make and explains them. It cannot price below your floor or outside your limits, because prices are computed in code from your rules. It never releases money: only the buyer's signed acceptance of delivery does." },
    { q: "Where does the buyer's money wait?", a: "In the DealEscrow contract on Arc, never in a Proteus account. You are paid for what the buyer signs as delivered. Unspent USDC is refundable to the buyer after the term and a grace period, 3 days by default." },
    { q: "What if a delivery goes wrong?", a: "The buyer does not sign for what did not arrive, and can open a dispute from their wallet, which freezes the deal. Disputes are In testing. Today the arbiter key is held by Proteus and there is no dispute timeout; an independent arbiter and a timeout are Coming soon." },
    { q: "How do ratings work?", a: "A buyer can rate a seller on Arc's ERC-8004 registry only after the deal has paid out. Each rating is checked for links between buyer and seller; linked ratings are listed with the reason and do not count. One rating given before the checks existed is listed as linked but still counted, with the reason shown." },
    { q: "Can a buyer's AI agent negotiate and pay?", a: "Yes, through the MCP server or plain HTTP, within a mandate its owner sets. Both are proven on Arc testnet, not yet on mainnet. A hosted buyer agent you can use in the browser is Coming soon." },
    { q: "What do buyers need?", a: "USDC on Arc. They can bridge it from other chains with CCTP inside the app, and funding is gasless: they sign a permit and Proteus pays the gas." },
    { q: "Who holds the keys?", a: "Your wallet owns the account and receives every payout. Proteus holds an encrypted signer key that countersigns offers on your behalf; it cannot redirect your payouts." },
    { q: "What does it cost?", a: "Nothing during the pilot. You keep 100% of every deal, and the escrow contract has no fee logic." },
    { q: "Is Proteus AI live?", a: "Yes, on Arc mainnet. One real business is listed so far, Shoonya Store, a merch studio. Its first customer order, 6.60 USDC, settled on 11 Nov 2026; the buyer wallet was later found linked to a Shoonya team account, and its public rating says so. The contracts are source-verified and not yet audited." },
    { q: "How do I start selling?", a: "Sign in with your wallet, publish a product with its price tiers and private rules, and register your deal agent on Arc in one transaction. It takes about 5 minutes, and you can try it on Arc testnet first." },
  ],
};

export const footer = {
  heading: "Quote faster. Get paid on delivery.",
  line: "Give your business a deal agent that negotiates inside your rules, takes USDC into escrow on Arc and releases it when the buyer accepts delivery.",
  cta: { label: "Start selling", href: links.sell },
  brand: "Proteus AI",
  tagline: "The deal network for small businesses and AI agents on Arc.",
  columnTitle: "Product",
  columns: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "For sellers", href: "/#agent" },
    { label: "For agents", href: "/#agents" },
    { label: "FAQ", href: "/#faqs" },
    { label: "Ways to use", href: links.waysToUse },
    { label: "Seller quickstart", href: links.sellerQuickstart },
    { label: "Docs", href: links.docs },
    { label: "Blog", href: links.blog },
    { label: "GitHub", href: links.github },
  ],
  copyright: "© 2026 Proteus AI. Built with Circle and Arc.",
  right: { label: "Public records", href: links.record },
};

/** Mirrors the <title> and meta tags in site/index.html; keep the two in step. */
export const meta = {
  title: "Proteus AI | The deal network for small businesses and AI agents on Arc",
  description: "Proteus AI gives small businesses a deal agent that negotiates inside the seller's rules, takes USDC into escrow on Arc and releases it on delivery. Buyers can be people or their own AI agents.",
  ogTitle: "Where business agents make deals they can trust.",
  ogDescription: "Negotiated inside the seller's rules, paid into USDC escrow on Arc, released on delivery.",
};
