import { env, features } from "../env";
import type { AgentAdapter } from "./adapter";
import { createAnthropicAdapter } from "./anthropic";
import { createOpenRouterAdapter } from "./openrouter";
import { ruleBasedAdapter } from "./rule-based";

let adapter: AgentAdapter | undefined;

export function getAgentAdapter(): AgentAdapter {
  if (!adapter) adapter = features.openrouter ? createOpenRouterAdapter() : features.anthropic ? createAnthropicAdapter() : ruleBasedAdapter;
  return adapter;
}

export function agentAdapterName(): string {
  return features.openrouter ? `openrouter:${env.OPENROUTER_MODEL}` : features.anthropic ? `anthropic:${env.ANTHROPIC_MODEL}` : "rule-based";
}

export * from "./adapter";
