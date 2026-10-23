import { formatUsd, toMicro, type Requirements, pluralUnit, unitFor } from "@proteus/domain";
import type { AgentAdapter, AgentStep, ComposeInput, ExtractInput } from "./adapter";
import { detectInjection } from "./adapter";

const KNOWN_INTEGRATIONS: Record<string, string> = {
  zendesk: "zendesk",
  intercom: "intercom",
  shopify: "shopify",
  freshdesk: "freshdesk",
  slack: "slack",
  "rest api": "rest-api",
  api: "rest-api",
  webhook: "webhook",
  webhooks: "webhook",
};

function now() {
  return new Date().toISOString();
}

/**
 * Deterministic requirement extraction. Good enough for the demo flows and the fallback when no
 * model key is configured. Numbers are parsed, never invented.
 */
export function extractRuleBased(input: ExtractInput): Requirements {
  const buyerTurns = input.turns.filter((t) => t.role === "buyer" && !t.content.startsWith("Counteroffer:"));
  // The latest buyer message wins for numbers; earlier turns only fill gaps.
  const latest = buyerTurns.at(-1)?.content ?? "";
  const text = buyerTurns.map((t) => t.content).join("\n");
  const req: Requirements = { ...input.prior, integrations: [...(input.prior.integrations ?? [])], notes: [...(input.prior.notes ?? [])], openQuestions: [] };

  // Budget: "$1,500", "$1500/month", "budget is 1500 usd"
  const budgetRe = /\$\s?([\d,]+(?:\.\d+)?)/;
  const budgetRe2 = /budget (?:is|of)?\s*([\d,]+)\s*(?:usd|usdc|dollars)/i;
  const budget = latest.match(budgetRe) ?? latest.match(budgetRe2) ?? (req.budget ? null : text.match(budgetRe) ?? text.match(budgetRe2));
  if (budget?.[1]) req.budget = toMicro(budget[1].replace(/,/g, ""));

  // Desired units: "2,000 resolutions", "around 2000 answers", "1500 units"
  const unitWord = input.unitLabel.replace(/s$/, "");
  const unitsRe = new RegExp(`([\\d,]+)\\s*(?:eligible |ai |automated |order-status |order status )?(?:${unitWord}s?|units|answers|resolutions|calls|requests? (?:per|a) month)`, "i");
  const units = latest.match(unitsRe) ?? (req.desiredUnits ? null : text.match(unitsRe));
  if (units?.[1]) {
    const n = BigInt(units[1].replace(/,/g, ""));
    // Distinguish ticket volume from desired automated units when both appear.
    const tickets = text.match(/([\d,]+)\s*(?:support )?(?:tickets|conversations|support requests)/i);
    if (tickets?.[1] && BigInt(tickets[1].replace(/,/g, "")) === n && !/resolutions|units|answers/i.test(units[0])) {
      req.notes.push(`Incoming volume about ${n.toLocaleString()} per month; automatable share not stated.`);
    } else {
      req.desiredUnits = n;
    }
  }

  for (const [k, v] of Object.entries(KNOWN_INTEGRATIONS)) {
    if (new RegExp(`\\b${k}\\b`, "i").test(text) && !req.integrations.includes(v)) req.integrations.push(v);
  }

  if (/refund|return/i.test(text) && /human|team|agent handles/i.test(text)) req.notes.push("Refunds and returns stay with the buyer's human team.");
  if (/(six|6)[- ]month/i.test(text)) req.notes.push("Buyer mentioned a six-month commitment.");
  if (/(a|one|1)[- ]year|annual/i.test(text)) req.notes.push("Buyer mentioned an annual commitment.");
  if (/e-?commerce|stores?|shop/i.test(text)) req.industry = "e-commerce";
  if (/order (tracking|status)|delivery/i.test(text)) req.useCase = "order tracking and delivery questions";

  if (!req.desiredUnits && !req.budget) req.openQuestions.push(`Roughly how many ${pluralUnit(input.unitLabel)} per month do you expect, or what monthly budget are you working with?`);
  if (!req.desiredUnits && req.budget) req.openQuestions.push(`How many ${pluralUnit(input.unitLabel)} do you need? That sets the right option for your budget.`);
  return req;
}

/** Words too common in product names to identify one ("custom tote bags" is matched by tote, not custom). */
const GENERIC = new Set(["custom", "event", "pack", "bulk", "oversized", "branded", "service", "plan"]);

export function composeRuleBased(input: ComposeInput): string {
  const { offers, rejected, requirements, unitLabel, injectionDetected } = input;
  const lines: string[] = [];

  if (injectionDetected) {
    lines.push("I can only offer packages that clear the seller's commercial policy. That policy is set by the seller and I cannot change it from this conversation, and I do not share the seller's costs.");
  }

  const understood: string[] = [];
  if (requirements.useCase) understood.push(requirements.useCase);
  if (requirements.desiredUnits) understood.push(`about ${requirements.desiredUnits.toLocaleString()} ${unitFor(requirements.desiredUnits, unitLabel)} a month`);
  if (requirements.budget) understood.push(`a budget around ${formatUsd(requirements.budget, 0)} a month`);
  if (requirements.integrations.length) understood.push(`integration with ${requirements.integrations.join(", ")}`);
  if (understood.length) lines.push(`Here is what I understood: ${understood.join("; ")}.`);

  const unsupported = Array.from(new Set(offers.flatMap((o) => o.unsupportedIntegrations)));
  if (unsupported.length) lines.push(`${unsupported.map(cap).join(", ")} is not available from this seller yet, so it is excluded from any agreement. The service exposes a REST API and webhooks instead.`);

  const eligible = offers.filter((o) => o.status === "eligible");
  const needsApproval = offers.filter((o) => o.status === "approval_required");
  if (eligible.length) {
    lines.push(eligible.length > 1 ? "There are a couple of ways we could structure this:" : "Here is a package we could structure:");
    for (const o of eligible.slice(0, 2)) {
      lines.push(`${o.tierName}: ${o.units.toLocaleString()} ${unitFor(o.units, unitLabel)} for ${formatUsd(o.prepaidTotal)} prepaid for the term (${unitPrice(o.unitPrice.num, o.unitPrice.den)} per ${unitLabel}). Includes ${o.includes.join(", ").toLowerCase()}.`);
    }
  }
  if (needsApproval.length) {
    const o = needsApproval[0]!;
    lines.push(`${o.units.toLocaleString()} ${unitFor(o.units, unitLabel)} for ${formatUsd(o.prepaidTotal)} is above what I can offer on my own authority. I have sent it to the seller for approval and will update this thread when they decide.`);
  }
  if (rejected.length && !eligible.length) {
    const r = rejected[0]!;
    lines.push(`I cannot offer ${r.units.toLocaleString()} ${unitFor(r.units, unitLabel)} at ${formatUsd(r.prepaidTotal)}: ${r.publicReasons[0] ?? "it falls outside the seller's policy."}`);
  } else if (rejected.length) {
    const r = rejected[0]!;
    lines.push(`${r.units.toLocaleString()} ${unitFor(r.units, unitLabel)} for ${formatUsd(r.prepaidTotal)} does not work: ${(r.publicReasons[0] ?? "it falls outside the seller's policy.").toLowerCase()} The options above are what I can commit to.`);
  }
  // Nothing here fits the stated budget (or nothing is offered): point to the seller's other products, smallest pack first.
  const fits = eligible.filter((o) => !requirements.budget || o.prepaidTotal <= requirements.budget);
  const lastBuyer = (input.turns.filter((t) => t.role === "buyer").at(-1)?.content ?? "").toLowerCase();
  const asked = (input.catalog?.products ?? []).filter((p) => [p.unitLabel, pluralUnit(p.unitLabel), ...p.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !GENERIC.has(w))].some((w) => w && new RegExp(`\\b${w.toLowerCase()}`).test(lastBuyer)));
  if (asked.length) lines.unshift(`${asked.map((p) => `${p.name} ${p.smallestPack ? `(from ${p.smallestPack}) ` : ""}`).join("and ")}${asked.length > 1 ? "are" : "is"} a separate product from ${input.catalog!.sellerName}. Open it on the seller's page and its agent will make you an offer there.`);
  else if (!fits.length && input.catalog?.products.length) lines.push(`${input.catalog.sellerName} also offers ${input.catalog.products.map((p) => (p.smallestPack ? `${p.name} (from ${p.smallestPack})` : p.name)).join(", ")}. Open any of them on the seller's page to get an offer there.`);
  if (requirements.openQuestions.length) lines.push(requirements.openQuestions[0]!);
  if (!lines.length) lines.push(`Tell me what you need: expected ${pluralUnit(unitLabel)} per month, your budget, and any integrations, and I will put together options.`);
  return lines.join("\n\n");
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function unitPrice(num: bigint, den: bigint): string {
  const scaled = (num * 10_000n) / den;
  const whole = scaled / 10_000_000_000n;
  const frac = (scaled % 10_000_000_000n).toString().padStart(10, "0").slice(0, 4).replace(/0+$/, "");
  return `$${whole}${frac ? "." + frac : ""}`;
}

export const ruleBasedAdapter: AgentAdapter = {
  name: "rule-based",
  async extractRequirements(input) {
    const steps: AgentStep[] = [{ at: now(), label: "Reading the request", state: "done" }];
    const requirements = extractRuleBased(input);
    steps.push({ at: now(), label: "Extracted requirements", state: "done", detail: summarize(requirements) });
    return { requirements, steps };
  },
  async composeReply(input) {
    const steps: AgentStep[] = [];
    if (input.injectionDetected) steps.push({ at: now(), label: "Policy override attempt ignored", state: "blocked", detail: "Buyer text asked to bypass policy; policy is server-side and unchanged." });
    steps.push({ at: now(), label: "Drafting the reply from approved options", state: "done" });
    return { reply: composeRuleBased(input), steps };
  },
};

function summarize(r: Requirements): string {
  const parts: string[] = [];
  if (r.desiredUnits) parts.push(`units ${r.desiredUnits}`);
  if (r.budget) parts.push(`budget ${formatUsd(r.budget, 0)}`);
  if (r.integrations.length) parts.push(`integrations ${r.integrations.join(",")}`);
  return parts.join(", ") || "nothing concrete yet";
}

export { detectInjection };
