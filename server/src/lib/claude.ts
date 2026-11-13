/**
 * One Claude client for every model call Proteus makes with the Anthropic API key: the deal-desk chat and the
 * services Proteus runs itself. Each job names the model and effort that fit it (CLAUDE_FOR); Opus and Sonnet
 * calls opt into Anthropic's server-side refusal fallback so a declined request is retried on a fallback model
 * inside the same call instead of failing the buyer.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessage, BetaMessageParam, BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { env } from "../env";

export type ClaudeModel = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";
export type Effort = "low" | "medium" | "high";
export interface ClaudeJob { model: ClaudeModel; effort: Effort }

/**
 * Model per job. Cheap, fast, well-specified work goes to Haiku; work where tone or document reading matters to
 * Sonnet; multi-step judgment to Opus. Every service's model cost per call stays well under its unit price.
 */
export const CLAUDE_FOR: Record<string, ClaudeJob> = {
  // Deal-desk chat
  "chat:extract": { model: "claude-haiku-5-5", effort: "low" },
  "chat:reply": { model: "claude-sonnet-5-5", effort: "low" },
  // Services Proteus runs (adapter "demo"), by product slug
  "callback-booking": { model: "claude-haiku-5-5", effort: "low" },
  "after-hours-answering": { model: "claude-haiku-5-5", effort: "low" },
  "ai-receptionist": { model: "claude-sonnet-5-5", effort: "low" },
  "invoice-processing": { model: "claude-sonnet-5-5", effort: "medium" },
  "screening-checks": { model: "claude-sonnet-5-5", effort: "medium" },
  "inference-capacity": { model: "claude-sonnet-5-5", effort: "low" },
  "vendor-evaluations": { model: "claude-opus-5-5", effort: "medium" },
  "operator-tasks": { model: "claude-opus-5-5", effort: "medium" },
};
export const DEFAULT_SERVICE_JOB: ClaudeJob = { model: "claude-sonnet-5-5", effort: "medium" };

let client: Anthropic | undefined;
export const claudeConfigured = () => Boolean(env.ANTHROPIC_API_KEY);
function claude() {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 180_000, maxRetries: 2 });
  return client;
}

export interface ClaudeResult {
  text: string;
  /** The model that answered (differs from the requested one when a refusal fallback ran). */
  model: string;
  stopReason: BetaMessage["stop_reason"];
  json?: unknown;
}

/** One request. Thinking is left at each model's adaptive default; effort sets the depth. */
export async function askClaude(job: ClaudeJob, args: { system: string; content: string | BetaContentBlockParam[]; maxTokens?: number; jsonSchema?: Record<string, unknown> }): Promise<ClaudeResult> {
  const withFallback = job.model !== "claude-haiku-5-5";
  const res = await claude().beta.messages.create({
    model: job.model,
    max_tokens: args.maxTokens ?? 16_000,
    system: args.system,
    messages: [{ role: "user", content: args.content }],
    output_config: { effort: job.effort, ...(args.jsonSchema ? { format: { type: "json_schema", schema: args.jsonSchema } } : {}) },
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  let json: unknown;
  if (args.jsonSchema && text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return { text, model: res.model, stopReason: res.stop_reason, json };
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Runs the call; a thrown error is returned to Claude as an error result so it can recover. */
  run(input: Record<string, unknown>): Promise<unknown>;
}

/**
 * A short tool loop (calendar look-ups and bookings): Claude calls the tools, we run them and send every result back
 * in one user turn, until it answers in text or the turn cap is reached. The full assistant content is appended each
 * turn so the conversation stays valid for the API.
 */
export async function askClaudeWithTools(
  job: ClaudeJob,
  args: { system: string; content: string | BetaContentBlockParam[]; tools: ClaudeTool[]; maxTurns?: number; maxTokens?: number },
): Promise<ClaudeResult & { calls: { name: string; input: unknown; ok: boolean; result: unknown }[] }> {
  const withFallback = job.model !== "claude-haiku-5-5";
  const messages: BetaMessageParam[] = [{ role: "user", content: args.content }];
  const calls: { name: string; input: unknown; ok: boolean; result: unknown }[] = [];
  const byName = new Map(args.tools.map((t) => [t.name, t]));
  for (let turn = 0; turn < (args.maxTurns ?? 6); turn++) {
    const res = await claude().beta.messages.create({
      model: job.model,
      max_tokens: args.maxTokens ?? 16_000,
      system: args.system,
      messages,
      tools: args.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as BetaTool["input_schema"], strict: true })),
      tool_choice: { type: "auto" },
      output_config: { effort: job.effort },
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      const text = res.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
      return { text, model: res.model, stopReason: res.stop_reason, calls };
    }
    messages.push({ role: "assistant", content: res.content as BetaContentBlockParam[] });
    const results: BetaContentBlockParam[] = [];
    for (const u of uses) {
      if (u.type !== "tool_use") continue;
      const tool = byName.get(u.name);
      try {
        if (!tool) throw new Error(`unknown tool ${u.name}`);
        const out = await tool.run(u.input as Record<string, unknown>);
        calls.push({ name: u.name, input: u.input, ok: true, result: out });
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) });
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 300);
        calls.push({ name: u.name, input: u.input, ok: false, result: msg });
        results.push({ type: "tool_result", tool_use_id: u.id, content: msg, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "", model: job.model, stopReason: "max_tokens", calls };
}
