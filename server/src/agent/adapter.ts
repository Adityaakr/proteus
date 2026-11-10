import type { Candidate, PublicCandidate, Requirements } from "@proteus/domain";

export interface ConversationTurn {
  role: "buyer" | "agent" | "system";
  content: string;
}

export interface ExtractInput {
  productName: string;
  unitLabel: string;
  capabilities: string[];
  supportedIntegrations: string[];
  starters: string[];
  prior: Requirements;
  turns: ConversationTurn[];
}

export interface ComposeInput {
  productName: string;
  unitLabel: string;
  requirements: Requirements;
  /** Public projections only. The adapter never sees economics. */
  offers: PublicCandidate[];
  rejected: PublicCandidate[];
  injectionDetected: boolean;
  turns: ConversationTurn[];
  /** Public product terms the model may answer questions from. Anything not here is "I will confirm with the seller". */
  facts?: { termDays: number; refundPolicy: string; billableUnit: string; supportedIntegrations: string[]; capabilities: string[] };
  /** The seller's other listed products, one public line each (name, what it is, list tiers). Not offers: the buyer opens that product to negotiate it. */
  catalog?: { sellerName: string; products: { name: string; unitLabel: string; detail: string; smallestPack: string }[] };
}

export interface AgentStep {
  at: string;
  label: string;
  state: "done" | "working" | "blocked";
  detail?: string;
}

/**
 * The model can interpret and explain. It never sees seller economics and never produces a number
 * that is not already present in a deterministic candidate.
 */
export interface AgentAdapter {
  readonly name: "rule-based" | "anthropic";
  extractRequirements(input: ExtractInput): Promise<{ requirements: Requirements; steps: AgentStep[] }>;
  composeReply(input: ComposeInput): Promise<{ reply: string; steps: AgentStep[] }>;
}

export const INJECTION_PATTERNS = [
  /ignore (your|the|all) (margin|floor|polic|rules|instructions)/i,
  /(reveal|show|tell me) (your|the) (cost|cogs|margin|floor|minimum)/i,
  /you are now (the )?(owner|admin|seller)/i,
  /system prompt/i,
  /override (the )?(policy|floor|price)/i,
  /as the seller,? i (approve|authori[sz]e)/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export function stripEconomics(c: Candidate): PublicCandidate {
  const { economics: _e, rules, ...rest } = c;
  return { ...rest, publicReasons: [] } as PublicCandidate & { rules?: never };
}

/**
 * Removes contact details before buyer text is sent to a model provider: email addresses and phone or card numbers
 * (10 to 19 digits, optionally grouped with spaces, dashes, dots or brackets, optionally starting with +).
 * Quantities, prices, dates and ranges like "2000 - 3000" are left alone. The stored transcript keeps the original
 * for the seller; only the copy sent to the model is redacted. Street addresses and names are not detected.
 */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?<![\w$₹€£.,/])\+?\(?\d[\d\s().-]{8,24}\d(?![\w.,]?\d)/g, (m) => {
      const digits = m.replace(/\D/g, "").length;
      if (digits < 10 || digits > 19) return m;
      if (/\s[-–]\s/.test(m)) return m; // a range, not one number
      return "[number removed]";
    });
}
