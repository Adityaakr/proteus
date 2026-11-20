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
    { label: "Who it's for", href: "/#partners" },
    { label: "Pricing", href: "/#pricing" },
    { label: "FAQ", href: "/#faqs" },
    { label: "Docs", href: links.docs },
  ],
  secondary: { label: "Under the hood", href: "/#under-the-hood" },
  primary: { label: "Start free", href: links.sell },
};

export const hero = {
  tag: "The AI sales agent with payment protection, for businesses that sell by quote",
  /** Network name shown with its mark after the tag; empty keeps chain names below the fold. */
  tagNetwork: "",
  headline: "Quote in seconds. Get paid on delivery.",
  subhead:
    "Proteus answers your buyers in seconds and negotiates inside the prices and limits you set. Buyers pay upfront into escrow, and the money is released to you as soon as they confirm delivery.",
  secondary: { label: "See how it works", href: links.howItWorks },
  /** `href` when the deployment runs the invite gate, `openHref` when it does not. */
  primary: { label: "Start free", hoverLabel: "Enter invite code", href: links.sellGated, openHref: links.sell },
  /** The three short facts under the buttons. */
  trust: ["Free during the pilot", "No card needed", "Set up in about 5 minutes"],
  chat: {
    user: "We're hosting a hackathon in Bengaluru and need 250 custom tees with our logo. Our budget is $1,500. Can you make it work?",
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
  line: "For studios and suppliers who quote every order: custom merch and apparel, print and packaging, gifting, event supply, creative services and wholesale. The chat above is illustrative; real offers come from each seller's own prices and rules.",
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
      body: "Both sides agree the same terms and the buyer pays into escrow before you start. When the buyer confirms delivery, the money is released to you.",
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
    "Every order is paid upfront into escrow, held by a public contract rather than by Proteus, you or the buyer. It's the protection of an escrow service, built into every order, with no escrow fee.",
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
    "If your customers ask for a quote before they buy, your deal agent can answer them. The first business live on Proteus is a merch and print studio.",
  steps: [
    { number: "01", title: "Custom merch and apparel. Quantity, sizes, print method and per-unit price." },
    { number: "02", title: "Corporate and event gifting. Box contents, branding and volume pricing." },
    { number: "03", title: "Event supply. Swag, signage and kits for organisers with a budget and a deadline." },
    { number: "04", title: "Creative and freelance services. Design, video and content, priced per deliverable." },
    { number: "05", title: "Wholesale and small-batch makers. Minimum orders, price tiers and repeat buyers." },
    { number: "06", title: "Print and packaging. Stickers, stationery and packaging, priced by run size." },
  ],
};

export const verification = {
  tag: "Transparency",
  heading: "Your buyers can check everything except your costs.",
  description:
    "Who you are, the rules behind your prices and where the money goes are public records a buyer can check before paying. Your costs, floor and limits stay private.",
  counts: {
    title: "Your costs stay private.",
    body: "Buyers never see your costs, floor or limits. They see a public fingerprint of your rules, so they know a quote came from rules you set in advance.",
    chips: ["Costs", "Margin floor", "Discount limit", "Minimum order", "Capacity", "Approval limit", "Quote validity"],
  },
  pay: {
    title: "Every order on the record.",
    body: "Quotes, agreements, deliveries and payouts sit in your dashboard, and every payment is a public transaction you can show your accountant.",
  },
  real: {
    title: "What a buyer can check before paying.",
    body: "Your registered business identity, the rules your quote came from, the account that gets paid and your record of completed orders.",
    signals: ["Identity", "Price rules", "Payout account", "Completed orders", "Reviews"],
  },
  order: {
    title: "The AI proposes. The contract pays.",
    body: "Only signatures move money: both sides on the terms, then the buyer on what was delivered.",
    waveA: "The AI proposes terms",
    waveB: "Signatures release the money",
    chips: ["AI", "Contract"],
  },
};

/** Under the hood: chain, protocol and channel detail with the docs' status for each (Comparison component, id "under-the-hood"). */
export const comparison = {
  tag: "Under the hood",
  heading: "For your developer, your accountant and your buyer's AI agent.",
  description:
    "The parts behind the promise, each with its status today. Live means used on Arc mainnet with real USDC; Testnet means proven on Arc testnet; In testing means built but not yet used by a real customer.",
  cards: [
    { icon: "/assets/JXfbymshMLyfsl2323zgdqBGL4.svg", threshold: 0.46, title: "Escrow contract · Live", body: "DealEscrow on Arc mainnet, source-verified, not upgradeable and with no fee logic. Covered by unit and invariant tests; not yet independently audited." },
    { icon: "/assets/oj7jXSrLMVYLxliKOyzXN6J1ZRs.svg", threshold: 0.46, title: "USDC on Arc · Live", body: "Orders settle in USDC, Circle's digital dollar. Teams that already hold it, such as DAOs, hackathons and conferences, pay directly; others bridge it in the app." },
    { icon: "/assets/bD52TK3MrelH1Oc6avERVA1JXw4.svg", threshold: 0.46, title: "Business identity · Live", body: "Each seller is an ERC-8004 agent on Arc with its payout wallet, and each price policy is committed on chain. Reviews go to Arc's ERC-8004 reputation registry." },
    { icon: "/assets/GUrpYsrYM8fPXMf7BXBghK727Bs.svg", threshold: 0.71, title: "Where buyers reach you", body: "Web app: Live. Website embed: Testnet. WhatsApp on your own number: In testing. Paying always happens on a Proteus page." },
    { icon: "/assets/vBsEOrQoXzW0ffeVyss7E7BMXc.svg", threshold: 0.42, title: "AI agents as buyers · Testnet", body: "An MCP server and a plain HTTP API, with x402 for one-off calls, let a buyer's agent negotiate and pay within a limit its owner sets. A hosted buyer agent is Coming soon." },
    { icon: "/assets/fBC0zzbZpTAZaOtfiJwmWF4bgO4.svg", threshold: 0.28, title: "Seller API · In testing", body: "Scoped keys for deals, prices and deliveries, signed webhooks and a public sandbox. The code is open on GitHub." },
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
    { q: "Can the AI agree to a bad deal?", a: "No. Prices are calculated from your tiers, costs and limits, not by the AI. It cannot go below your margin floor or past your discount limit, and orders above your approval limit wait for you." },
    { q: "What does it cost?", a: "Every feature is free during the pilot. After it, Starter stays free and paid plans start at $29 a month (₹1,999 in India); you'll be told before anything is billed. Proteus never takes a cut of an order, and buyers never pay a fee." },
    { q: "How do I get paid?", a: "In USDC, a digital dollar issued by Circle, sent to the wallet you sign up with. You are paid for what the buyer confirms as delivered. Rules for receiving stablecoins differ by country, so check yours, including tax, before you start." },
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
  tagline: "The AI sales agent with payment protection, for businesses that sell by quote.",
  columnTitle: "Product",
  columns: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Payment protection", href: "/#protection" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Under the hood", href: "/#under-the-hood" },
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
  title: "Proteus AI | Quote in seconds, get paid on delivery",
  description: "Proteus AI answers your buyers in seconds, negotiates inside the prices and limits you set, and collects payment upfront in escrow. You are paid when the buyer confirms delivery. Free during the pilot.",
  ogTitle: "Quote in seconds. Get paid on delivery.",
  ogDescription: "An AI sales agent for businesses that sell by quote, with every order paid upfront into escrow and released when the buyer confirms delivery.",
};
