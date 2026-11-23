import { amountText, formatUnitPrice, formatUsd, isInrAmount, offerTotalText, offerUnitText, toMicro, toPaise, type Requirements, pluralUnit, unitFor } from "@proteus/domain";
import type { AgentAdapter, AgentStep, ComposeInput, ExtractInput, LatestBudget } from "./adapter";
import { choiceLine, detectInjection, unlistedLines } from "./adapter";
import { requestedItems } from "./unlisted";

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

// Budget: "$1,500", "$1500/month", "budget is 1500 usd"
const budgetRe = /\$\s?([\d,]+(?:\.\d+)?)/;
const budgetRe2 = /budget (?:is|of)?\s*([\d,]+)\s*(?:usd|usdc|dollars)/i;
// Rupees: "₹40,000", "Rs 40000", "40,000 INR", "budget of 40000 rupees". Converted to USDC by the negotiation at the seller's rate.
const rupeeRe = /(?:₹|\brs\.?|\binr)\s?([\d,]+(?:\.\d{1,2})?)/i;
const rupeeRe2 = /\b([\d,]+(?:\.\d{1,2})?)\s*(?:inr|rupees?|rs\b)/i;

const buyerTurnsOf = (turns: ExtractInput["turns"]) => turns.filter((t) => t.role === "buyer" && !t.content.startsWith("Counteroffer:"));

const BUDGET_WORDS = /budget|have|max|spend/i;

/** The figure in `text` most likely to be a budget: the first one next to a budget word, else the first one. */
function budgetFigure(text: string, res: RegExp[], valid: (v: string) => boolean = () => true): { value: string; near: boolean } | undefined {
  const all = res.flatMap((re) => [...text.matchAll(new RegExp(re.source, `${re.flags}g`))]).filter((m) => m[1] && valid(m[1])).sort((a, b) => a.index! - b.index!);
  const near = (m: RegExpMatchArray) => BUDGET_WORDS.test(text.slice(Math.max(0, m.index! - 20), m.index!)) || BUDGET_WORDS.test(text.slice(m.index! + m[0].length, m.index! + m[0].length + 12));
  const best = all.find(near) ?? all[0];
  return best ? { value: best[1]!, near: near(best) } : undefined;
}

/**
 * The amounts the buyer's latest message mentions in dollars and in rupees, and which one the deterministic parse takes
 * as the budget: the only currency mentioned, else the one next to a budget word, else rupees. Undefined without either.
 */
export function latestBudget(turns: ExtractInput["turns"]): LatestBudget | undefined {
  const latest = buyerTurnsOf(turns).at(-1)?.content ?? "";
  const usd = budgetFigure(latest, [budgetRe, budgetRe2]);
  const inr = budgetFigure(latest, [rupeeRe, rupeeRe2], isInrAmount);
  if (!usd && !inr) return undefined;
  const currency = !inr || (usd?.near && !inr.near) ? "USD" : "INR";
  return { currency, ...(usd ? { usd: toMicro(usd.value.replace(/,/g, "")) } : {}), ...(inr ? { inr: toPaise(inr.value) } : {}) };
}

/**
 * Deterministic requirement extraction. Good enough for the demo flows and the fallback when no
 * model key is configured. Numbers are parsed, never invented.
 */
export function extractRuleBased(input: ExtractInput): Requirements {
  const buyerTurns = buyerTurnsOf(input.turns);
  // The latest buyer message wins for numbers; earlier turns only fill gaps.
  const latest = buyerTurns.at(-1)?.content ?? "";
  const text = buyerTurns.map((t) => t.content).join("\n");
  const req: Requirements = { ...input.prior, integrations: [...(input.prior.integrations ?? [])], notes: [...(input.prior.notes ?? [])], openQuestions: [] };

  const stated = latestBudget(input.turns);
  const earlier = stated || req.budget ? null : text.match(budgetRe) ?? text.match(budgetRe2);
  if (stated?.currency === "USD" || earlier?.[1]) {
    req.budget = stated?.currency === "USD" ? stated.usd! : toMicro(earlier![1]!.replace(/,/g, ""));
    delete req.budgetInr;
  } else if (stated?.currency === "INR") {
    req.budgetInr = stated.inr!;
    // The USDC budget is set from it once the seller's rate is known; a dollar budget from earlier no longer applies.
    req.budget = undefined;
  }

  // Desired units: "2,000 resolutions", "around 2000 answers", "1500 units"
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const unitWord = esc(input.unitLabel.replace(/s$/, ""));
  const unitPlural = esc(pluralUnit(input.unitLabel));
  // Goods are also counted in generic words: "60 bars of soap", "200 pcs", "50 pairs".
  const unitsRe = new RegExp(`([\\d,]+)\\s*(?:eligible |ai |automated |order-status |order status )?(?:${unitWord}s?|${unitPlural}|units|answers|resolutions|calls|requests? (?:per|a) month|pieces|pcs|items|bars|pairs|packs|sets)\\b`, "i");
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

  if (!req.desiredUnits && !req.budget) req.openQuestions.push(`How many ${pluralUnit(input.unitLabel)} do you need, and by when? Or tell me your budget and I will fit an option to it.`);
  if (!req.desiredUnits && req.budget) req.openQuestions.push(`How many ${pluralUnit(input.unitLabel)} do you need? That sets the right option for your budget.`);
  return req;
}

/** Words too common in product names to identify one ("custom tote bags" is matched by tote, not custom). */
const GENERIC = new Set(["custom", "event", "pack", "bulk", "oversized", "branded", "service", "plan"]);

export function composeRuleBased(input: ComposeInput): string {
  const { offers, rejected, requirements, unitLabel, injectionDetected, view } = input;
  const lines: string[] = [];
  const total = (o: (typeof offers)[number]) => offerTotalText(o, view);
  const each = (o: (typeof offers)[number]) => offerUnitText(o, view) ?? unitPrice(o.unitPrice.num, o.unitPrice.den);

  if (injectionDetected) {
    lines.push("I can only offer packages that clear the seller's commercial policy. That policy is set by the seller and I cannot change it from this conversation, and I do not share the seller's costs.");
  }
  // Asked only for something the seller does not list: say so, never answer with this product's offers.
  if (input.unlisted && !input.unlisted.alsoListed) return [...lines, ...unlistedLines(input.unlisted)].join("\n\n");

  const understood: string[] = [];
  if (requirements.useCase) understood.push(requirements.useCase);
  if (requirements.desiredUnits) understood.push(`about ${requirements.desiredUnits.toLocaleString()} ${unitFor(requirements.desiredUnits, unitLabel)}`);
  if (requirements.budget) understood.push(`a budget around ${amountText(requirements.budget, view, requirements.budgetInr, { whole: true })}`);  if (requirements.integrations.length) understood.push(`integration with ${requirements.integrations.join(", ")}`);
  if (understood.length) lines.push(`Here is what I understood: ${understood.join("; ")}.`);

  const unsupported = Array.from(new Set(offers.flatMap((o) => o.unsupportedIntegrations)));
  if (unsupported.length) lines.push(`${unsupported.map(cap).join(", ")} is not available from this seller yet, so it is excluded from any agreement. The service exposes a REST API and webhooks instead.`);

  const eligible = offers.filter((o) => o.status === "eligible");
  const needsApproval = offers.filter((o) => o.status === "approval_required");
  if (eligible.length) {
    lines.push(eligible.length > 1 ? "There are a couple of ways we could structure this:" : "Here is a package we could structure:");
    for (const o of eligible.slice(0, 2)) {
      lines.push(`${o.tierName}: ${o.units.toLocaleString()} ${unitFor(o.units, unitLabel)} for ${total(o)} prepaid for the term (${each(o)} per ${unitLabel}). Includes ${o.includes.join(", ").toLowerCase()}.`);
    }
  }
  if (needsApproval.length) {
    const o = needsApproval[0]!;
    lines.push(`${o.units.toLocaleString()} ${unitFor(o.units, unitLabel)} for ${total(o)} is above what I can offer on my own authority. I have sent it to the seller for approval and will update this thread when they decide.`);
  }
  if (rejected.length && !eligible.length) {
    const r = rejected[0]!;
    lines.push(`I cannot offer ${r.units.toLocaleString()} ${unitFor(r.units, unitLabel)} at ${total(r)}: ${r.publicReasons[0] ?? "it falls outside the seller's policy."}`);
  } else if (rejected.length) {
    const r = rejected[0]!;
    lines.push(`${r.units.toLocaleString()} ${unitFor(r.units, unitLabel)} for ${total(r)} does not work: ${(r.publicReasons[0] ?? "it falls outside the seller's policy.").toLowerCase()} The options above are what I can commit to.`);
  }
  // Nothing here fits the stated budget (or nothing is offered): point to the seller's other products, smallest pack first.
  const fits = eligible.filter((o) => !requirements.budget || (requirements.budgetInr !== undefined && o.local?.stated ? o.local.total <= requirements.budgetInr : o.prepaidTotal <= requirements.budget));
  const lastBuyer = (input.turns.filter((t) => t.role === "buyer").at(-1)?.content ?? "").toLowerCase();
  // A word that also names this product ("tees" while negotiating a tee) is about this product, not a pointer elsewhere.
  const own = new Set([unitLabel.toLowerCase(), pluralUnit(unitLabel).toLowerCase(), ...input.productName.toLowerCase().split(/[^a-z]+/)]);
  const asked = (input.catalog?.products ?? []).filter((p) => [p.unitLabel, pluralUnit(p.unitLabel), ...p.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !GENERIC.has(w))].some((w) => w && !own.has(w.toLowerCase()) && new RegExp(`\\b${w.toLowerCase()}`).test(lastBuyer)));
  if (input.choices?.products.length) lines.unshift(choiceLine(input.choices, input.productName));
  else if (asked.length) lines.unshift(`${asked.map((p) => `${p.name} ${p.smallestPack ? `(from ${p.smallestPack}) ` : ""}`).join("and ")}${asked.length > 1 ? "are" : "is"} a separate product from ${input.catalog!.sellerName}. Open it on the seller's page and its agent will make you an offer there.`);
  else if (!fits.length && input.catalog?.products.length) lines.push(`${input.catalog.sellerName} also offers ${input.catalog.products.map((p) => (p.smallestPack ? `${p.name} (from ${p.smallestPack})` : p.name)).join(", ")}. Open any of them on the seller's page to get an offer there.`);
  // Questions the website facts answer: colours and sizes, minimum order, delivery, returns, custom work.
  const k = input.facts?.knowledge;
  if (k) {
    if (/colou?rs?|sizes?|variants?|options?/.test(lastBuyer)) for (const o of k.options.slice(0, 2)) lines.push(`${o.name}: ${o.values.slice(0, 12).join(", ")}${o.values.length > 12 ? ` and ${o.values.length - 12} more` : ""}.`);
    if (/minimum|moq|bulk|custom|logo|print|brand/.test(lastBuyer)) lines.push(...k.notes.filter((n) => /minimum|bulk|custom|sold as listed/i.test(n)).slice(0, 2));
    // Lead times and samples, as the seller's own site states them.
    if (/how long|lead time|turnaround|production|deliver|dispatch|ship|sample|\bdays?\b/.test(lastBuyer)) {
      const said = k.notes.filter((n) => /\bdays?\b|weeks?|deliver|production|dispatch|ship|sample/i.test(n) && !lines.includes(n)).slice(0, 3);
      if (said.length) lines.push(`From ${input.catalog?.sellerName ?? "the seller"}'s site: ${said.join(" ")}`);
    }
    const pol = /ship|deliver/.test(lastBuyer) ? k.policies.find((p) => p.kind === "shipping") : /return|refund|exchange/.test(lastBuyer) ? k.policies.find((p) => p.kind === "returns") : undefined;
    if (pol) lines.push(`From ${input.catalog?.sellerName ?? "the seller"}'s ${pol.kind} policy: ${pol.summary.slice(0, 220)}`);
  }
  if (input.unlisted) lines.push(...unlistedLines(input.unlisted));
  if (requirements.openQuestions.length) lines.push(requirements.openQuestions[0]!);
  if (!lines.length) lines.push(`Tell me what you need: expected ${pluralUnit(unitLabel)} per month, your budget, and any integrations, and I will put together options.`);
  return lines.join("\n\n");
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const unitPrice = formatUnitPrice;

export const ruleBasedAdapter: AgentAdapter = {
  name: "rule-based",
  async extractRequirements(input) {
    const steps: AgentStep[] = [{ at: now(), label: "Reading the request", state: "done" }];
    const requirements = extractRuleBased(input);
    steps.push({ at: now(), label: "Extracted requirements", state: "done", detail: summarize(requirements) });
    const last = input.turns.filter((t) => t.role === "buyer").at(-1)?.content ?? "";
    return { requirements, steps, askedFor: requestedItems(last).map((i) => i.phrase) };
  },
  async composeReply(input) {
    const steps: AgentStep[] = [];
    if (input.injectionDetected) steps.push({ at: now(), label: "Policy override attempt ignored", state: "blocked", detail: "Buyer text asked to bypass policy; policy is server-side and unchanged." });
    steps.push({ at: now(), label: "Drafting the reply from approved options", state: "done" });
    return { reply: composeRuleBased(input), steps };
  },
  async consult(input) {
    return { result: input.fallback, steps: [{ at: now(), label: `Recommended ${input.fallback.picks.map((p) => p.slug).join(", ")} from the catalogue`, state: "done" }] };
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
