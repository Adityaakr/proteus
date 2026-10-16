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
