/** All page copy for PROTEUS. Edit here, not in sections. Source: "PROTEUS" copy doc ("Your business should be able to make a deal" draft). */

export const links = {
  explore: "/#how-it-works", // TODO: real app URL
  howItWorks: "/#how-it-works",
  earlyAccess: "/#faqs", // TODO: real early-access form
  record: "/#record",
  github: "/#record", // TODO: real repo URL
};

export const nav = {
  items: [
    { label: "Product", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Use cases", href: "/#partners" },
    { label: "FAQ", href: "/#faqs" },
  ],
  secondary: { label: "Get early access", href: links.earlyAccess },
  primary: { label: "Explore PROTEUS", href: links.explore },
};

export const hero = {
  tag: "The autonomous deal desk.",
  headline: "Your business should be able to make a deal.",
  headlineAlt: "Your next deal shouldn’t wait for sales.",
  subhead:
    "Meet PROTEUS. The AI agent that negotiates, closes, and manages deals on behalf of your business. Customers want different prices, packages, and terms. PROTEUS works out what you can offer, negotiates within your boundaries, and turns an agreement into a transaction. From the first question to the final payment, without someone manually handling every step.",
  secondary: { label: "See how it works", href: links.howItWorks },
  primary: { label: "Explore PROTEUS", href: links.explore },
  chat: {
    user: "We run three e-commerce stores and handle around 8,000 support tickets a month. We want an AI support solution that works with Zendesk, automating order tracking and delivery questions, ideally around 2,000 resolutions a month. Our budget is $1,500. Can you make something work?",
    status: ["Reading the request...", "Checking packages, costs, and margin", "Structuring two offers"],
    done: "Two offers. One decision.",
    reply:
      "Yes, there are a couple of ways we could structure this. For 2,000 eligible AI resolutions, the package would be $1,700 per month. If $1,500 is a firm budget, I can offer a smaller starting package with 1,500 resolutions for $1,440. Both options keep complex returns and refunds with your human support team.",
    completed: "Offer made",
    suggestionsLabel: "Suggestions",
    suggestions: ["Option 01: 2,000 resolutions, $1,700/month", "Option 02: 1,500 resolutions, $1,440/month", "Keep negotiating"],
    placeholder: "Reply to PROTEUS..",
  },
};

export const logos = {
  line: "Built for AI companies, APIs, infrastructure providers, and businesses with more to offer than a fixed pricing page. The conversation above is illustrative: pricing and service terms are hypothetical and would be calculated using the seller’s actual costs, capabilities, and policies.",
};

export const howItWorks = {
  tag: "How it works",
  heading: "From interest to income. One continuous workflow.",
  description:
    "You build a product. You put a price on it. Customers start showing up. Then comes the part your pricing page can’t handle: a volume discount, a six-month commitment, a fixed budget, another integration, more capacity. Now someone needs to review the request, estimate costs, calculate margins, propose terms, approve exceptions, and send an agreement. On a small team, that person is often the founder. PROTEUS gives your business another way to sell, one that doesn’t require a human to be available for every negotiation.",
  mandates: [
    "Can we get a volume discount?",
    "What if we commit for six months?",
    "Can you fit this into our budget?",
  ],
  promptCard: { suggestion: "Customers ask", run: "Explore PROTEUS" },
  steps: [
    {
      title: "It understands what customers want.",
      body: "Buyers describe their requirements in plain language. PROTEUS works out the product, volume, service level, timeline, and budget they’re asking for, and checks what your business can actually deliver before talking about price. No guessing what the customer means. No quoting something you don’t sell.",
    },
    {
      title: "It works out a deal.",
      body: "PROTEUS evaluates possible offers using your actual pricing policies, costs, capacity, and commercial constraints. It can propose a package, negotiate different terms, offer an alternative, or explain why a request doesn’t work. It negotiates for the business, not against it.",
    },
    {
      title: "It gets the agreement done.",
      body: "When both sides accept the terms, PROTEUS connects the offer to a structured commercial agreement and an authorized payment process. Pricing, commitments, delivery conditions, and refund rules are recorded. For supported services, the agreement then connects to provisioning, usage tracking, and payment reconciliation, so the original promise stays connected to what the customer receives.",
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
  heading: "It knows the price. More importantly, it knows why.",
  description:
    "A customer asks for a 30% discount. Should you say yes? That depends. Are they committing to higher volume? Does the business have spare capacity? Is the deal still profitable? Does it require an exception? Those are the decisions PROTEUS is designed to make. Not every opportunity is a good deal. PROTEUS helps you tell the difference.",
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
      body: "An offer is evaluated against the cost of fulfilling it, not simply the discount the customer requested. PROTEUS considers whether the business can deliver what’s being promised, and offers outside the financial boundaries you set require different terms or human approval.",
      search: {
        wave: "Evaluating the offer against its cost",
        results: ["Cost of fulfilling it: estimated", "Minimum contribution margin: respected", "Capacity to deliver: available", "Requested discount: within limits"],
      },
    },
    {
      id: "JSCqOTffG",
      title: "Trade intelligently.",
      body: "A longer commitment, different service level, or smaller package can create a better agreement than simply reducing the price. A better deal isn’t always a cheaper deal. It’s one both sides can actually make.",
      wave: "Trading terms, not just price",
    },
    {
      id: "lyqPHrB7z",
      title: "Adapt to new information.",
      body: "When costs or availability change, PROTEUS can update future offers without unilaterally rewriting accepted agreements.",
      wave: "PROTEUS is updating offers",
      paragraphs: [
        "Costs and availability changed. Future offers reflect the new information and your margin rules.",
        "Accepted agreements are not rewritten.",
      ],
    },
    {
      id: "HKd1Ndk3M",
      title: "Know when not to close.",
      body: "Sometimes a deal doesn’t work. The agent should be able to explain why rather than making a promise the business cannot keep. Exceptions go to you.",
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
    "An autonomous agent shouldn’t mean handing over every business decision. You define how your business operates. PROTEUS works inside those boundaries. The agent can negotiate. It cannot make up the rules.",
  counts: {
    title: "Your products. Your economics.",
    body: "Define what can be sold, which packages are available, and what each one includes. Connect costs, pricing rules, minimum margins, and capacity.",
    chips: ["Products", "Packages", "Costs", "Pricing rules", "Minimum margins", "Capacity", "Discount limits"],
  },
  pay: {
    title: "Your approvals. Your visibility.",
    body: "Decide which transactions can proceed automatically and which ones need your signature. Inspect every offer, counteroffer, approval, agreement, and payment record.",
  },
  real: {
    title: "Your flexibility.",
    body: "Set discount limits, negotiable commitments, accepted payment terms, and commercial exceptions.",
    signals: ["Discounts", "Commitments", "Terms", "Exceptions", "Approvals"],
  },
  order: {
    title: "The agent can negotiate. It cannot make up the rules.",
    body: "The model proposes commercial terms. Deterministic policy checks enforce financial limits. Authorized payment infrastructure handles the money.",
    waveA: "The model proposes terms",
    waveB: "Policy checks enforce, payments execute",
    chips: ["Model", "Policy"],
  },
};

export const partners = {
  tag: "Use cases",
  heading: "Every business sells differently. PROTEUS works with that.",
  description:
    "Negotiate the work being automated, not just the subscription price. Different workloads deserve different agreements. Sell what you can deliver, at terms that make financial sense. Custom infrastructure doesn’t have to mean a custom sales process.",
  steps: [
    { number: "01", title: "AI customer support. Sell the right level of automation: eligible resolutions, integrations, usage volumes, and spending limits." },
    { number: "02", title: "AI voice. Turn a complex requirement into a clear offer: call volume, usage minutes, integrations, concurrency, and service commitments." },
    { number: "03", title: "AI inference and compute. Sell capacity according to real demand: workload, model requirements, capacity, compute costs, and commitment duration." },
    { number: "04", title: "APIs and developer infrastructure. Give developers an answer without talking to sales: data coverage, rate limits, refresh frequency, volume, and terms." },
  ],
};

export const comparison = {
  tag: "Differentiation",
  heading: "A chatbot can answer a question. PROTEUS can make a deal.",
  description:
    "Most businesses already have a place where customers can ask questions, software for preparing quotes, and tools for billing and collecting payments. But the commercial decision between those steps is often still manual. PROTEUS is designed to connect the decision with the transaction. It’s not about making a chatbot sound like a salesperson. It’s about giving a business the ability to handle real commercial work.",
  cards: [
    { icon: "/assets/JXfbymshMLyfsl2323zgdqBGL4.svg", threshold: 0.46, title: "Understand the request", body: "Go beyond keywords and identify what the customer is actually trying to buy." },
    { icon: "/assets/oj7jXSrLMVYLxliKOyzXN6J1ZRs.svg", threshold: 0.46, title: "Evaluate the economics", body: "Understand the price, the expected cost, and the conditions that make the deal acceptable." },
    { icon: "/assets/bD52TK3MrelH1Oc6avERVA1JXw4.svg", threshold: 0.46, title: "Negotiate the terms", body: "Make offers and counteroffers within the authority the seller has granted." },
    { icon: "/assets/GUrpYsrYM8fPXMf7BXBghK727Bs.svg", threshold: 0.71, title: "Execute the agreement", body: "Connect accepted terms to payment and service delivery." },
    { icon: "/assets/vBsEOrQoXzW0ffeVyss7E7BMXc.svg", threshold: 0.42, title: "Keep the record", body: "Make the decision, agreement, and financial activity inspectable." },
    { icon: "/assets/fBC0zzbZpTAZaOtfiJwmWF4bgO4.svg", threshold: 0.28, title: "What happens when the customer is another agent?", body: "An AI agent that needs inference capacity knows its requirements, its budget, and its deadline. It shouldn’t need a pricing page, a form, and a wait. PROTEUS is designed to expose commercial interactions programmatically: a buyer agent can request a quote, evaluate permitted offers, accept terms, and complete an authorized purchase, while the seller’s agent applies the same policies it uses for a human customer. Part of PROTEUS’s product direction." },
  ],
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
  partner: { name: "Buyer", value: 0, period: "", description: "", features: [], cta: { label: "Explore PROTEUS", href: links.explore }, primary: true } as Plan,
  mainnet: { name: "Mainnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  testnet: { name: "Testnet", value: 0, period: "", description: "", features: [], cta: { label: "See how it works", href: links.howItWorks } } as Plan,
  includes: "INCLUDES",
};

export const trust = {
  tag: "Payments",
  heading: "When the deal is made, the money should follow.",
  description:
    "PROTEUS is being developed with Circle and Arc to connect commercial agreements to programmable USDC payments. The goal is straightforward: fewer disconnected systems between a customer accepting a deal and the business receiving payment. Money moving should be the result of an authorized agreement, not a model’s unchecked decision.",
  cards: [
    { title: "Accepted terms, funded agreements", body: "Record the agreed price, package, volume, and payment conditions, and support prepaid purchases where the customer funds an accepted service agreement." },
    { title: "Usage-based delivery", body: "Measure eligible consumption against prepaid commitments." },
    { title: "Reconciliation and refund rules", body: "Connect payments and remaining balances to the services actually delivered, and handle eligible unused funds according to the accepted agreement." },
    { title: "Verifiable records", body: "Link the commercial transaction to its corresponding onchain settlement evidence." },
  ],
};

export const record = {
  tag: "Business insights",
  heading: "Every negotiation tells you something about your business.",
  description:
    "When a buyer asks for a discount, that tells you something. When five customers ask for the same integration, that tells you something. When deals repeatedly fail at a particular price, that tells you something too. PROTEUS can turn those conversations into a useful commercial record. Your business learns more from a deal than whether it closed.",
  entries: [
    { quote: "Understand demand. See which products, packages, and capabilities customers keep asking for.", name: "Demand", role: "What customers keep asking for", company: "PROTEUS", initials: "DE" },
    { quote: "Understand pricing. Discover where offers get accepted, countered, or declined.", name: "Pricing", role: "Where offers land", company: "PROTEUS", initials: "PR" },
    { quote: "Understand deal quality. Compare agreed prices with expected delivery costs and commercial objectives.", name: "Deal quality", role: "Agreed price against expected cost", company: "PROTEUS", initials: "DQ" },
    { quote: "Understand performance. Track which accepted offers turn into funded and fulfilled transactions.", name: "Performance", role: "From accepted to funded to fulfilled", company: "Circle and Arc", initials: "PE" },
    { quote: "Understand exceptions. See when the agent needed human authorization and what caused it.", name: "Exceptions", role: "What needed your signature, and why", company: "Seller", initials: "EX" },
    { quote: "Every offer, counteroffer, approval, agreement, and payment record is inspectable.", name: "Visibility", role: "The decision, the agreement, and the money", company: "PROTEUS", initials: "VI" },
    { quote: "When deals repeatedly fail at a particular price, that tells you something too.", name: "Signal", role: "Your business learns more from a deal than whether it closed", company: "PROTEUS", initials: "SI" },
  ],
};

export const faq = {
  tag: "FAQ",
  heading: "Frequently asked questions",
  description: "What PROTEUS is, who it is for, what the seller controls, how payments work, and what is live.",
  items: [
    { q: "What is PROTEUS?", a: "PROTEUS is an autonomous deal desk that helps businesses negotiate custom commercial terms, evaluate offers against their economics, and connect accepted agreements to payment and fulfillment." },
    { q: "Who is it for?", a: "Initially, AI and API companies, developer infrastructure providers, and internet businesses whose customers frequently need custom packages, usage commitments, or negotiated pricing." },
    { q: "Does PROTEUS replace a salesperson?", a: "It can automate eligible negotiations and commercial workflows. Large, strategic, or exceptional deals can still involve people." },
    { q: "Can it offer discounts?", a: "Yes, within the business’s configured pricing and financial rules. It can also propose alternative packages instead of simply lowering prices." },
    { q: "How does it know whether a deal is profitable?", a: "PROTEUS uses the costs and commercial policies supplied by the seller. It checks projected contribution margin before proposing an offer. Actual profitability still depends on accurate inputs and delivery costs." },
    { q: "Can it change a deal after the customer pays?", a: "PROTEUS is designed to preserve accepted terms for the agreed period. Any changes must follow the agreement and the required authorization process." },
    { q: "What does the seller control?", a: "Products, costs, pricing rules, minimum margins, capacity limits, payment requirements, and approval thresholds." },
    { q: "Can customers pay using USDC?", a: "USDC settlement through Circle and Arc is part of the implementation. Availability should be confirmed for each deployed environment." },
    { q: "Can another AI agent negotiate with PROTEUS?", a: "Programmatic negotiation and purchasing are planned capabilities, with APIs intended for authorized buyer agents." },
    { q: "How do I get started?", a: "Start with what you already sell. You need a product, an understanding of what it costs, and rules for how it can be sold. Connect the product: define your services, capabilities, and available packages. Set the boundaries: configure pricing, costs, minimum margins, capacity, and approval rules. Choose how deals are executed: connect the supported payment and fulfillment workflows. Let customers negotiate: give them a direct way to request terms, discuss offers, and complete eligible purchases. Start with one product. Close one good deal. Build from there." },
    { q: "Is PROTEUS live?", a: "PROTEUS is in development. Supported features and live settlement networks will be identified as they become available." },
  ],
};

export const footer = {
  heading: "Let your business do more of the selling.",
  line: "Customers are already telling you what they need. They have budgets, deadlines, and requirements. What they don’t always have is someone ready to work out a deal. PROTEUS gives your business an agent that understands your economics, negotiates within your rules, and moves qualified opportunities toward payment. Less waiting. Fewer handoffs. More deals that make sense.",
  cta: { label: "Explore PROTEUS", href: links.explore },
  brand: "PROTEUS",
  tagline: "Your business, ready to make a deal.",
  columnTitle: "Product",
  columns: [
    { label: "Product", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Use cases", href: "/#partners" },
    { label: "FAQ", href: "/#faqs" },
    { label: "GitHub", href: links.github },
  ],
  copyright: "© 2026 PROTEUS. Built with Circle and Arc.",
  right: { label: "Get early access", href: links.earlyAccess },
};

export const meta = {
  title: "PROTEUS | The autonomous deal desk",
  description: "PROTEUS helps internet businesses negotiate custom deals, protect margins, and turn customer agreements into paid transactions. Built for AI, APIs, and digital services.",
  ogTitle: "Your business should be able to make a deal.",
  ogDescription: "Meet PROTEUS, the autonomous deal desk that understands what you sell, what it costs, and which deals are worth closing.",
};
