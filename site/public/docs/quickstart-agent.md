# Buy with an AI agent (MCP) · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-agent> · facts as of 2026-11-14 · all docs: <https://app.proteus.co.in/docs.md>



_Give Claude or any MCP client the full buying loop, within a limit you set._

For people who want an AI agent to buy on their behalf, and developers wiring Proteus into an MCP client. You will set up the MCP server, set a mandate, and learn what the agent checks for you and what it leaves to you.

_Diagram: The MCP server runs on your machine; your key never leaves it._

You set the mandate (the largest prepaid amount per deal) in the MCP server's environment. Your MCP client, such as Claude, calls the Proteus MCP server's tools. The server runs on your machine: it talks to the Proteus API to negotiate, quote and fund, reads Arc directly to verify the seller's ERC-8004 identity and policy commitment, and signs with your buyer key or returns typed data for a Circle Agent Wallet to sign. The relayer submits the funding and settlement to DealEscrow on Arc.

### Set up

1. **Clone the repository.** The server runs from a clone of [the Proteus repository](https://github.com/Adityaakr/proteus) (`packages/mcp`); it is not published to npm. Run `pnpm install` once.
2. **Add it to your client.** Paste the config below into your MCP client (Claude Desktop, Claude Code, or any client that runs stdio servers), with the path to your clone.
3. **Set the mandate.** `PROTEUS_MAX_PREPAID_USDC` is the most the agent may prepay in one deal.
4. **Ask for something.** "Find a merch seller and get 20 boxes under $300." The agent lists services, negotiates and asks before it signs.

```json
{
  "mcpServers": {
    "proteus": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/proteus/packages/mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "PROTEUS_API_URL": "https://ai.proteus.co.in",
        "PROTEUS_MAX_PREPAID_USDC": "5",
        "PROTEUS_BUYER_PRIVATE_KEY": "<optional: a testnet key>"
      }
    }
  }
}
```

### Settings

| Variable | Default | What it does |
|---|---|---|
| `PROTEUS_API_URL` | `https://ai.proteus.co.in` | Arc testnet (`5042002`, test USDC). Set `https://app.proteus.co.in` for Arc mainnet (`5042`) and real USDC. |
| `PROTEUS_MAX_PREPAID_USDC` | `5` | The mandate: the largest prepaid amount per deal, in USDC. |
| `PROTEUS_BUYER_PRIVATE_KEY` | none | Optional. With a key, the agent signs and funds itself. Without one, signing tools return the EIP-712 typed data to sign elsewhere, such as a Circle Agent Wallet. |

### Tools

| Tool | What it does |
|---|---|
| `proteus_list_services` | Every service on the market: seller, unit, starting prepaid price, per-call price. |
| `proteus_get_service` | Tiers, term, refund policy, request fields and the seller's Arc identity. |
| `proteus_negotiate` | Talks to the seller's agent; returns the reply, the current offers and a negotiationKey (pass it back on later calls; the negotiation is private to it). |
| `proteus_verify_seller` | Checks the terms hash and, for a seller registered on Arc, its ERC-8004 signer and payee and the policy commitment. |
| `proteus_accept_offer` | Creates the quote, enforces the mandate, refuses a registered seller whose on-chain checks fail, then signs the terms. |
| `proteus_fund_deal` | Funds by signing a USDC permit (gasless, the default) or by approving USDC. |
| `proteus_call_service` | Calls the funded service; only delivered results are billed. |
| `proteus_settle_usage` | Checks the amount is no more than delivered units × the agreed price, signs the acceptance; the relayer settles. |
| `proteus_deal_status` | Deposit, used, settled and remaining, read from the escrow. |

### What the agent checks, and what it leaves to you

| Check | Done by the MCP server |
|---|---|
| Prepaid amount within the mandate | Yes: it refuses to sign or fund above it. |
| Seller's ERC-8004 signer and payee, policy commitment | Yes, for sellers registered on Arc; it refuses when one fails. A seller not registered on Arc is not checked, and the agent still signs. |
| Terms hash matches the public terms | Reported by `proteus_verify_seller`; it blocks signing only for registered sellers. |
| Permit for exactly this escrow, USDC and amount | Yes, against the addresses the server's `GET /api/health` returns. |
| Settlement amount within units × agreed price | Yes, before it signs the Acceptance. |
| The seller's receipts behind the usage | No: read them with `GET /api/deals/{id}/usage` before you let it settle. |
| Unit price, number of deals, which service | No: the mandate caps the prepaid amount per deal only. |

- **Testnet by default.** The config points at Arc testnet. MCP buying is proven on testnet only.
- **Funding.** Default is a gasless USDC permit (proven on testnet). The mainnet loop so far was funded by approve; pass `gasless: false` to approve instead (it needs the buyer key).
- **Private negotiation.** `proteus_negotiate` returns a negotiationKey; the MCP server keeps it and sends it on every later call, so no one else can read the conversation. After a restart, pass it back.
- **The service key stays local.** After funding, the service's API key is kept in the MCP process's memory and used by `proteus_call_service`.

> **Warning:** It is enforced in the MCP process on your machine, not on chain. It does not cap the unit price, how many deals the agent makes, or which service it picks.

> **Proven on Arc testnet:** Claude, with only these tools and a 13 USDC mandate, refused to buy when a delivery date did not fit, bought a sample once it did, checked the seller's receipt and settled. [Transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) · [funding](https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73) · [settlement](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45)
