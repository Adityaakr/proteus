# The AI behind it · Proteus AI docs

Source: <https://app.proteus.co.in/docs/ai-models> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Which Claude model does which job, and the rules that keep it inside the seller's terms._

| Job | Model | Effort | Why |
|---|---|---|---|
| Reading a buyer's requirements in chat | Claude Haiku 5.5 | low | structured output: units, budget, integrations |
| Writing the deal desk's replies | Claude Sonnet 5.5 | low | only figures from the engine's offers; any other figure falls back to the fixed reply |
| Callback booking, after-hours answering | Claude Haiku 5.5 | low | fast, well-specified records |
| Receptionist (front desk) | Claude Sonnet 5.5 | low | talks to customers; asks one question at a time |
| Invoice processing, screening checks, inference | Claude Sonnet 5.5 | medium or low | reads PDFs and images directly |
| Vendor evaluations, operator tasks | Claude Opus 5.5 | medium | multi-step judgement |

- **Prices never come from the model.** Offers are computed in code from the seller's rules; the model only writes the words, and a reply with any other figure is replaced by the fixed one.
- **Only delivered work is billed.** A request the model declines, cannot finish, or that gets cut off is never charged. A follow-up question in a live chat is never charged.
- **Refusal fallback.** Opus and Sonnet calls use Anthropic's server-side fallback, so a declined request is retried on a fallback model in the same call.
- **What the model sees.** The conversation with emails, phone and card numbers removed, and the public offers. Never costs, margins or policy. See [Privacy](https://app.proteus.co.in/docs/privacy).
- **Each result names its model.** A service result's source shows which model did the work, for example `agent:claude-haiku-5-5`.

Code: [claude.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/lib/claude.ts), [workers.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/workers.ts), [anthropic.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/agent/anthropic.ts).
