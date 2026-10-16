/** All page copy for Proteus AI. Edit here, not in sections. Source: "Proteus AI" copy doc ("Your business should be able to make a deal" draft). */

export const links = {
  explore: "/app/market",
  howItWorks: "/#how-it-works",
  earlyAccess: "/app",
  record: "/review",
  github: "https://github.com/Adityaakr/proteus",
};

export const nav = {
  items: [
    { label: "Product", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Use cases", href: "/#partners" },
    { label: "FAQ", href: "/#faqs" },
  ],
  secondary: { label: "Seller console", href: links.earlyAccess },
  primary: { label: "Negotiate a deal", href: links.explore },
};

export const hero = {
  tag: "The autonomous deal desk built on",
  tagNetwork: "Arc",
  headline: "Your business should be able to make a deal.",
  headlineAlt: "Your next deal shouldn’t wait for sales.",
  subhead:
    "Proteus AI gives your business an AI co-worker that negotiates and closes deals. It works out what you can offer, negotiates within your rules, and turns the agreement into a paid transaction.",
  secondary: { label: "See how it works", href: links.howItWorks },
  primary: { label: "Explore Proteus AI", href: links.explore },
  chat: {
    user: "We run three online stores on Zendesk, about 8,000 tickets a month. We want order tracking and delivery questions automated, roughly 2,000 resolutions a month. Budget is $1,500. Can you make it work?",
    status: ["Reading the request...", "Checking packages, costs, and margin", "Structuring two offers"],
    done: "Two offers. One decision.",
    reply:
      "Yes. 2,000 resolutions a month is $1,700. If $1,500 is firm, 1,500 resolutions for $1,440. Either way, returns and refunds stay with your team.",
    completed: "Offer made",
    suggestionsLabel: "Suggestions",
    suggestions: ["Option 01: 2,000 resolutions, $1,700/month", "Option 02: 1,500 resolutions, $1,440/month", "Keep negotiating"],
    placeholder: "Reply to Proteus AI..",
  },
};

export const logos = {
  line: "Built for AI companies, APIs and infrastructure providers with more to offer than a fixed pricing page. The conversation above is illustrative; real offers come from the seller’s own costs and policies.",
};

export const howItWorks = {
  tag: "How it works",
  heading: "From interest to income.\nOne continuous workflow.",
  description:
    "A pricing page can’t handle a discount, a commitment or a budget. Someone has to work out the deal, usually the founder. Proteus AI does it for you.",
  mandates: [
    "Can we get a volume discount?",
    "What if we commit for six months?",
    "Can you fit this into our budget?",
  ],
  promptCard: { suggestion: "Customers ask", run: "Explore Proteus AI" },
  steps: [
    {
      title: "It understands what customers want.",
      body: "Buyers describe what they need in plain language. Proteus AI extracts product, volume, service level, timeline and budget, and checks what you can deliver before it talks price.",
    },
    {
      title: "It works out a deal.",
      body: "Offers are built from your pricing rules, costs and capacity. Proteus AI can propose a package, trade terms, suggest an alternative, or explain why a request doesn’t work.",
    },
    {
      title: "It gets the agreement done.",
      body: "Both sides sign the same terms, the buyer funds escrow, and the agreement drives provisioning, usage tracking and settlement. The promise stays connected to what the customer receives.",
    },
  ],
  agent: {
    title: "What the customer doesn’t see",
    items: [
      { label: "Available service packages checked", state: "done" },
      { label: "Estimated fulfillment cost checked", state: "done" },
      { label: "Permitted discounts and minimum margin checked", state: "done" },
      { label: "Budget can’t support the full package", state: "done" },
      { label: "Structuring a smaller offer that works", state: "loading" },
    ] as { label: string; state: "done" | "loading" }[],
  },
};

export const decisions = {
  tag: "Intelligence",
  heading: "It knows the price.\nMore importantly, it knows why.",
  description:
    "A customer asks for 30% off. Is there volume behind it? Spare capacity? Margin left? Those are the calls Proteus AI makes. Not every opportunity is a good deal, and it can tell the difference.",
  tabs: [
    { number: "01", title: "Price with context" },
    { number: "02", title: "Trade intelligently" },
    { number: "03", title: "Adapt to change" },
    { number: "04", title: "Know when to say no" },
  ],
  cards: [
    {
      id: "qYrFueytg",
      title: "Price with context. Respect capacity. Protect the margin.",
      body: "Every offer is checked against the cost of delivering it and the capacity to do so. Anything outside your financial limits needs different terms or your approval.",
      search: {
        wave: "Evaluating the offer against its cost",
        results: ["Cost of fulfilling it: estimated", "Minimum contribution margin: respected", "Capacity to deliver: available", "Requested discount: within limits"],
      },
    },
    {
      id: "JSCqOTffG",
      title: "Trade intelligently.",
      body: "A longer commitment, a different service level or a smaller package often beats a lower price. The best deal is the one both sides can actually make.",
      wave: "Trading terms, not just price",
    },
    {
      id: "lyqPHrB7z",
      title: "Adapt to new information.",
      body: "When costs or availability change, Proteus AI can update future offers without unilaterally rewriting accepted agreements.",
      wave: "Proteus AI is updating offers",
      paragraphs: [
        "Costs and availability changed. Future offers reflect the new information and your margin rules.",
        "Accepted agreements are not rewritten.",
      ],
    },
    {
      id: "HKd1Ndk3M",
      title: "Know when not to close.",
      body: "Some deals don’t work. The agent says why instead of promising what you can’t keep. Exceptions go to you.",
      approvals: {
        campaign: "Open negotiations",
        meta: "3 need your decision",
        heading: "Needs you",
        rows: [
          { handle: "@northwind", note: "30% discount, needs an exception", action: "Approve" },
          { handle: "@lumen", note: "doesn’t work at this price", action: "Decline" },
          { handle: "@harbor", note: "alternative package proposed", action: "Review" },
          { handle: "@kai", note: "accepted within policy", action: "Closed" },
        ],
        you: "Seller",
        menu: ["Approve", "Counter", "Decline"],
      },
    },
  ],
};

export const verification = {
  tag: "Control",
  heading: "Give it responsibility. Not unlimited authority.",
  description:
    "You set how the business sells. Proteus AI works inside those limits. It can negotiate; it cannot make up the rules.",
  counts: {
    title: "Your products. Your economics.",
    body: "What you sell, which packages exist, what each costs, and the margin and capacity rules behind them.",
    chips: ["Products", "Packages", "Costs", "Pricing rules", "Minimum margins", "Capacity", "Discount limits"],
  },
  pay: {
    title: "Your approvals. Your visibility.",
    body: "Choose what closes automatically and what waits for your signature. Every offer, approval, agreement and payment is inspectable.",
  },
  real: {
    title: "Your flexibility.",
    body: "Discount limits, negotiable commitments, payment terms and the exceptions you allow.",
    signals: ["Discounts", "Commitments", "Terms", "Exceptions", "Approvals"],
  },
  order: {
    title: "The agent can negotiate. It cannot make up the rules.",
    body: "The model proposes. Deterministic policy checks decide. The agreement moves the money.",
    waveA: "The model proposes terms",
    waveB: "Policy checks enforce, payments execute",
    chips: ["Model", "Policy"],
  },
};

export const partners = {
  tag: "Use cases",
  heading: "Every business sells differently. Proteus AI works with that.",
  description:
    "Negotiate the work, not just the subscription. Different workloads deserve different agreements, and custom infrastructure shouldn’t need a custom sales process.",
  steps: [
    { number: "01", title: "AI customer support. Sell the right level of automation: resolutions, integrations, volume, spend limits." },
    { number: "02", title: "AI voice. Turn a messy requirement into a clear offer: call volume, minutes, concurrency, commitments." },
    { number: "03", title: "AI inference and compute. Sell capacity to real demand: workload, model, compute cost, term." },
    { number: "04", title: "APIs and developer infrastructure. Answer developers without a sales call: coverage, rate limits, volume, terms." },
    { number: "05", title: "AP and AR automation. Price the work by invoice, not by seat: volume, approval rules, exceptions, term." },
    { number: "06", title: "Compliance and screening. Sell checks per counterparty: coverage, turnaround, retention, volume." },
  ],
};

export const comparison = {
  tag: "Differentiation",
  heading: "A chatbot can answer a question. Proteus AI can make a deal.",
  description:
    "You already have a place for questions, software for quotes and tools for billing. The commercial decision between them is still manual. Proteus AI connects the decision to the transaction.",
  cards: [
    { icon: "/assets/JXfbymshMLyfsl2323zgdqBGL4.svg", threshold: 0.46, title: "Understand the request", body: "Go beyond keywords and identify what the customer is actually trying to buy." },
    { icon: "/assets/oj7jXSrLMVYLxliKOyzXN6J1ZRs.svg", threshold: 0.46, title: "Evaluate the economics", body: "Understand the price, the expected cost, and the conditions that make the deal acceptable." },
    { icon: "/assets/bD52TK3MrelH1Oc6avERVA1JXw4.svg", threshold: 0.46, title: "Negotiate the terms", body: "Make offers and counteroffers within the authority the seller has granted." },
    { icon: "/assets/GUrpYsrYM8fPXMf7BXBghK727Bs.svg", threshold: 0.71, title: "Execute the agreement", body: "Connect accepted terms to payment and service delivery." },
    { icon: "/assets/vBsEOrQoXzW0ffeVyss7E7BMXc.svg", threshold: 0.42, title: "Keep the record", body: "Make the decision, agreement, and financial activity inspectable." },
    { icon: "/assets/fBC0zzbZpTAZaOtfiJwmWF4bgO4.svg", threshold: 0.28, title: "When the customer is another agent", body: "A buyer agent knows its requirements, budget and deadline. Through the same API it can request a quote, accept terms and complete an authorized purchase, under the same seller policies a person gets." },
  ],
};


/** "How Proteus AI compares": assessed from each vendor's public product pages in October 2026. */
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
    notes: [undefined, undefined, undefined, "Both sides sign, escrow funds", "Arc testnet today", undefined, undefined],
  } as CompareVendor,
  vendors: [
    { name: "DealHub", logo: "/assets/vendors/dealhub.svg", logoHeight: 13, description: "CPQ, DealRoom and billing for midsize and enterprise sales teams.", href: "https://dealhub.io", marks: ["not-core", "partial", "yes", "partial", "not-core", "partial", "not-core"], notes: [undefined, "Discount thresholds, approvals", undefined, "E-signature in DealRoom", undefined, "Usage pricing in billing", undefined] },
    { name: "Pactum AI", logo: "/assets/vendors/pactum.svg", logoHeight: 16, description: "Autonomous supplier negotiations for enterprise procurement.", href: "https://pactum.com", marks: ["yes", "partial", "partial", "partial", "not-core", "not-core", "not-core"], notes: ["Supplier side, for buyers", "Negotiates to savings targets", "Price, payment, rebate terms", "Agreements via ERP integration", undefined, undefined, undefined] },
    { name: "Nue", logo: "/assets/vendors/nue.svg", logoHeight: 14, description: "Salesforce-native quote-to-revenue with usage billing.", href: "https://www.nue.io", marks: ["not-core", "not-core", "yes", "partial", "not-core", "yes", "partial"], notes: [undefined, undefined, undefined, "Quote to order in Salesforce", undefined, "Rating and billing", "SaaS scale-ups"] },
    { name: "Sequence", logo: "/assets/vendors/sequence.svg", logoHeight: 22, description: "Billing and CPQ for B2B SaaS with custom contracts.", href: "https://www.sequencehq.com", marks: ["not-core", "not-core", "yes", "partial", "not-core", "yes", "partial"], notes: [undefined, undefined, undefined, "Signed quotes auto-execute", undefined, undefined, "Startups and scale-ups"] },
    { name: "Metronome", logo: "/assets/vendors/metronome-wordmark.svg", logoHeight: 20, description: "Usage-based billing infrastructure, now part of Stripe.", href: "https://metronome.com", marks: ["not-core", "not-core", "yes", "not-core", "not-core", "yes", "partial"], notes: [undefined, undefined, "Contracts and overrides", undefined, undefined, "Metering and invoicing", "Self-serve starter plan"] },
  ] as CompareVendor[],
  closing: "Others help you quote, negotiate, or bill. Proteus AI is built to take a deal from the first conversation to the final transaction.",
  footnote: "Assessed from each vendor's public product pages in October 2026. Names and logos belong to their owners and are shown for identification only. Proteus AI marks reflect what is implemented today. USDC settlement runs on Arc testnet.",
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
  ownerNow: { name: "Seller", value: 0, period: "", description: "", features: [], cta: { label: "Get early access", href: links.earlyAccess } } as Plan,
  partner: { name: "Buyer", value: 0, period: "", description: "", features: [], cta: { label: "Negotiate a deal", href: links.explore }, primary: true } as Plan,
  mainnet: { name: "Mainnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  testnet: { name: "Testnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  includes: "INCLUDES",
};

export const trust = {
  tag: "Payments",
  heading: "When the deal is made, the money should follow.",
  description:
    "Built with Circle and Arc so an accepted agreement and its USDC payment are one thing. Money moves because both sides signed, never because a model decided.",
  cards: [
    { title: "Signed and funded", body: "Price, package, volume and payment conditions are signed by both sides, then funded by the buyer." },
    { title: "Usage-based delivery", body: "Delivered units are metered against the prepaid commitment." },
    { title: "Settled and refunded", body: "The seller is paid for countersigned usage. Unused balance goes back to the buyer." },
    { title: "Verifiable records", body: "Every deal links to its onchain settlement evidence." },
  ],
};

export const record = {
  tag: "Business insights",
  heading: "Every negotiation tells you something about your business.",
  description:
    "A discount request, five asks for the same integration, deals that keep failing at one price: each one is a signal. Proteus AI turns conversations into a commercial record you can learn from.",
  entries: [
    { quote: "Four of the last five buyers asked for Shopify before price. Demand tells you what to build next.", name: "Northwind Commerce", role: "Demand", company: "illustrative example", initials: "NC", portrait: { src: "/assets/logos/mark-northwind.png", alt: "Northwind Commerce" } },
    { quote: "Offers above $1.20 a call get countered. Offers at $1.10 close. Pricing shows where the market actually is.", name: "Lumen Voice", role: "Pricing", company: "illustrative example", initials: "LV", portrait: { src: "/assets/logos/mark-lumen.png", alt: "Lumen Voice" } },
    { quote: "A 250-contract deal at $14 clears a 35% margin after review cost. Deal quality compares price to what delivery costs.", name: "Meridian Legal", role: "Deal quality", company: "illustrative example", initials: "ML", portrait: { src: "/assets/logos/mark-meridian.png", alt: "Meridian Legal" } },
    { quote: "Of six accepted offers, five were funded and four fully used. Performance follows a deal from signed to settled.", name: "Harbor Logistics", role: "Performance", company: "illustrative example", initials: "HL", portrait: { src: "/assets/logos/mark-harbor.png", alt: "Harbor Logistics" } },
    { quote: "Two quotes waited for the owner this week, both above the $4,000 threshold. Exceptions show what needed a signature and why.", name: "Vantage API", role: "Exceptions", company: "illustrative example", initials: "VA", portrait: { src: "/assets/logos/mark-vantage.png", alt: "Vantage API" } },
    { quote: "Every offer, counteroffer, approval and settlement sits in one record with the transaction hash beside it.", name: "Kaidata", role: "Visibility", company: "illustrative example", initials: "KD", portrait: { src: "/assets/logos/mark-kaidata.png", alt: "Kaidata" } },
    { quote: "Deals kept failing at 200 images. Buyers wanted 400 with approval built in. The pattern became a new tier.", name: "Orbit Labs", role: "Signal", company: "illustrative example", initials: "OL", portrait: { src: "/assets/logos/mark-orbit.png", alt: "Orbit Labs" } },
  ],
};

export const faq = {
  tag: "FAQ",
  heading: "Frequently asked questions",
  description: "What it is, who it is for, what you control, and what is live.",
  items: [
    { q: "What is Proteus AI?", a: "An autonomous deal desk. It negotiates custom terms within your rules, has both sides sign, and connects the agreement to payment and delivery." },
    { q: "Who is it for?", a: "AI and API companies, developer infrastructure, and internet businesses whose customers need custom packages, usage commitments or negotiated pricing." },
    { q: "Does it replace a salesperson?", a: "It handles eligible negotiations end to end. Large or unusual deals can still involve people." },
    { q: "Can it offer discounts?", a: "Yes, within the limits you set. It prefers trading terms, such as a smaller package or a longer commitment, over cutting price." },
    { q: "How does it know a deal is profitable?", a: "It checks projected contribution margin against the costs and policies you supply before any offer goes out. Accuracy depends on your inputs." },
    { q: "Can it change a deal after payment?", a: "No. Accepted terms are signed by both sides and hold for the term. Changes follow the agreement." },
    { q: "What does the seller control?", a: "Products, costs, pricing rules, minimum margin, capacity, approval thresholds and payout wallet." },
    { q: "Can customers pay in USDC?", a: "Yes. Deals are funded into escrow and settled in USDC on Arc through Circle’s tooling. Today this runs on Arc testnet." },
    { q: "Can another AI agent negotiate with Proteus AI?", a: "Yes, through the same API a person uses: request a quote, accept terms, fund and call the service." },
    { q: "How do I get started?", a: "Sign in, publish one product with its tiers, costs and margin floor, point it at your endpoint, and let customers negotiate. Close one good deal, then add more." },
    { q: "Is Proteus AI live?", a: "The full loop runs on Arc testnet today: negotiation, signed terms, escrow, metered delivery, settlement and refund. Mainnet is not enabled." },
  ],
};

export const footer = {
  heading: "Let your business do more of the selling.",
  line: "Customers already tell you what they need, with budgets and deadlines. Proteus AI gives them someone ready to make the deal: an agent that knows your economics, negotiates within your rules and moves the opportunity to payment.",
  cta: { label: "Negotiate a deal", href: links.explore },
  brand: "Proteus AI",
  tagline: "Your business, ready to make a deal.",
  columnTitle: "Product",
  columns: [
    { label: "Product", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Use cases", href: "/#partners" },
    { label: "FAQ", href: "/#faqs" },
    { label: "GitHub", href: links.github },
  ],
  copyright: "© 2026 Proteus AI. Built with Circle and Arc.",
  right: { label: "Public records", href: links.record },
};

export const meta = {
  title: "Proteus AI | The autonomous deal desk",
  description: "Proteus AI negotiates custom deals for internet businesses, protects the margin, and turns the agreement into a paid transaction.",
  ogTitle: "Your business should be able to make a deal.",
  ogDescription: "Meet Proteus AI, the autonomous deal desk that understands what you sell, what it costs, and which deals are worth closing.",
};
