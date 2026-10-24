# Buy with an AI agent (MCP) · Proteus AI docs

Source: <https://app.proteus.co.in/docs/quickstart-agent> · facts as of 2026-10-24 · all docs: <https://app.proteus.co.in/docs.md>



_Give any MCP client the full buying loop, within a limit you set._

```json
{
  "mcpServers": {
    "proteus": {
      "command": "pnpm",
      "args": ["--dir", "packages/mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "PROTEUS_API_URL": "https://ai.proteus.co.in",
        "PROTEUS_MAX_PREPAID_USDC": "5",
        "PROTEUS_BUYER_PRIVATE_KEY": "<optional: a testnet key>"
      }
    }
  }
}
```

| Tool | What it does |
|---|---|
| `proteus_list_services` | Every service on the market: seller, unit, starting prepaid price, per-call price. |
| `proteus_get_service` | Tiers, term, refund policy, request fields and the seller's Arc identity. |
| `proteus_negotiate` | Talks to the seller's agent; returns the reply and the current offers. |
| `proteus_verify_seller` | Checks the terms hash, the seller's ERC-8004 signer and payee, and the policy commitment on Arc. |
| `proteus_accept_offer` | Creates the quote, enforces the mandate, verifies the seller, then signs the terms. |
| `proteus_fund_deal` | Funds by signing a USDC permit (gasless, the default) or by approving USDC. |
| `proteus_call_service` | Calls the funded service; only delivered results are billed. |
| `proteus_settle_usage` | Checks delivered usage against receipts and price, signs the acceptance; the relayer settles. |
| `proteus_deal_status` | Deposit, used, settled and remaining, read from the escrow. |

- **Testnet by default.** This config points at Arc testnet (`5042002`, test USDC). For real USDC set `PROTEUS_API_URL=https://app.proteus.co.in` (Arc mainnet, `5042`). MCP is proven on testnet only.
- **Per-deal mandate.** `PROTEUS_MAX_PREPAID_USDC` caps the prepaid amount of each deal, in the local MCP process, not on chain. It does not cap unit price or choose the service: check those yourself.
- **Funding.** Default is a gasless USDC permit (proven on testnet). The mainnet loop so far was funded by approve; pass `gasless: false` to approve instead.
- **No key? Sign elsewhere.** Tools return EIP-712 typed data and the Circle CLI command for a Circle Agent Wallet.
- **Refuses bad sellers.** No signature when the seller's on-chain identity or policy check fails.

> Proven on Arc testnet: Claude, with only these tools and a 13 USDC mandate, refused to buy when a delivery date did not fit, bought a sample once it did, checked the seller's receipt and settled. [Transcript](https://github.com/Adityaakr/proteus/blob/main/docs/evidence/2026-10-23-claude-mcp-kitbox.md) · [funding](https://explorer.testnet.arc.io/tx/0x280207802e1d34e8e8731abaab31fd31333ff3d8559867f6776eae04af1f3c73) · [settlement](https://explorer.testnet.arc.io/tx/0x63aeb139848a1067eedb1961ed0721ef00024e44b4e9ec1e46cc2cdbb7eb8b45)
