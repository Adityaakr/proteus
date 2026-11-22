# The AI behind it · Proteus AI docs

Source: <https://app.proteus.co.in/docs/ai-models> · facts as of 2026-11-22 · all docs: <https://app.proteus.co.in/docs.md>

_Which Claude model does which job, and the rules that keep it inside the seller's terms._

For anyone who wants to know where AI is used and where it is not. You will learn which model does each job, what the models see, what they are never allowed to decide, and when their work is billed.

_Diagram: Two places Claude works: the deal desk, where code sets every price, and the services Proteus runs._

Deal desk: buyer text from any channel has emails, phone and card numbers removed, Claude Haiku reads it into fields, the pricing engine (code) computes the offers, Claude Sonnet writes the words, and a figure check falls back to a fixed reply if the words carry an unlisted figure. Services Proteus runs: a request goes to a service agent on the Claude model chosen for that job (Haiku, Sonnet or Opus); a delivered result is one billed unit with a signed receipt; a refusal, failure, cut-off or handoff to a person is never billed.

<a id="ai-models-jobs"></a>

### Model per job

| Job | Model | Effort | Why |
|---|---|---|---|
| Reading a buyer's requirements in chat | Claude Haiku 5.5 | low | structured output: units, budget, integrations |
| Writing the deal desk's replies | Claude Sonnet 5.5 | low | a dollar amount or a number of four or more digits that is not among the offers, the buyer's budget or the seller's other products falls back to the fixed reply |
| Callback booking, after-hours answering | Claude Haiku 5.5 | low | fast, well-specified records |
| AI receptionist service | Claude Sonnet 5.5 | low | talks to customers; asks one question at a time |
| Invoice processing, screening checks | Claude Sonnet 5.5 | medium | reads PDFs and images directly |
| Inference service | Claude Sonnet 5.5 | low | answers within the buyer's request |
| Vendor evaluations, operator tasks | Claude Opus 5.5 | medium | multi-step judgement |
| Embeddings service | OpenRouter (text-embedding-3-small) | n/a | Anthropic has no embeddings endpoint |

Both live deployments run on Claude (`agentAdapter` in [/api/health](https://app.proteus.co.in/api/health)). Without an Anthropic key, a deployment falls back to OpenRouter (`anthropic/claude-sonnet-4.5` by default), which then receives the same redacted conversation, or to fixed rule-based replies with no model. On the OpenRouter fallback a cut-off reply is not detected as cut off. A service not listed in the table runs on Claude Sonnet 5.5 at medium effort.

<a id="ai-models-rules"></a>

### Rules the models work under

- **Prices never come from the model.** Offers are computed in code from the seller's rules; the model only writes the words, and a reply with an unlisted dollar amount or number of four or more digits is replaced by the fixed one ([How offers are priced](https://app.proteus.co.in/docs/pricing#pricing-model)).
- **Only delivered work is billed.** A request the model declines, cannot finish, or that gets cut off is never charged. A follow-up question in a live chat is never charged.
- **Refusal fallback.** Opus and Sonnet calls use Anthropic's server-side fallback, so a declined request is retried on a fallback model in the same call.
- **What the model sees.** Deal desk: the conversation with emails, phone and card numbers removed, and the public offers. Front desk: the customer's messages as written. Never costs, margins or policy ([Privacy](https://app.proteus.co.in/docs/privacy)).
- **Each result names its model.** A service result's source shows which model did the work, for example `agent:claude-haiku-5-5`.

Code: [claude.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/lib/claude.ts), [workers.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/services/workers.ts), [anthropic.ts](https://github.com/Adityaakr/proteus/blob/main/server/src/agent/anthropic.ts).
