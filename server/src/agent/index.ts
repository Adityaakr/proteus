import { env, features } from "../env";
import type { AgentAdapter } from "./adapter";
import { createAnthropicAdapter } from "./anthropic";
import { createOpenRouterAdapter } from "./openrouter";
import { ruleBasedAdapter } from "./rule-based";
import { CLAUDE_FOR } from "../lib/claude";

let adapter: AgentAdapter | undefined;

export function getAgentAdapter(): AgentAdapter {
  // The Anthropic key is preferred: it is the account Proteus pays for directly.
  if (!adapter) adapter = features.anthropic ? createAnthropicAdapter() : features.openrouter ? createOpenRouterAdapter() : ruleBasedAdapter;
  return adapter;
}

export function agentAdapterName(): string {
  return features.anthropic ? `anthropic:${CLAUDE_FOR["chat:extract"]!.model}+${CLAUDE_FOR["chat:reply"]!.model}` : features.openrouter ? `openrouter:${env.OPENROUTER_MODEL}` : "rule-based";
}

export * from "./adapter";
