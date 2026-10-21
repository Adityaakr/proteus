# @proteus/mcp: Proteus AI for AI agents (MCP)

An MCP server (stdio) that lets an AI agent buy services from businesses on Proteus AI within a budget a human sets.

| Tool | What it does |
|---|---|
| `proteus_list_services` | Every listing on the market |
| `proteus_get_service` | Tiers, unit prices, term, refund policy, the seller's ERC-8004 agent and track record |
| `proteus_negotiate` | Talk to the seller's deal agent; returns offers from the seller's rules (never below its floor) |
| `proteus_verify_seller` | On-chain checks before signing: publicTermsHash, ERC-8004 `proteus.signer`/`proteus.payee`, policy commitment on ProteusPolicyRegistry |
| `proteus_accept_offer` | Creates the quote, enforces the mandate, verifies the seller, signs EIP-712 Terms |
| `proteus_fund_deal` | Approves USDC for the escrow; the relayer funds; keeps the service key in memory |
| `proteus_call_service` | Calls the service; only `delivered` is billed; requestId is idempotent |
| `proteus_settle_usage` | Checks cumulative usage against units x price, signs the Acceptance; escrow pays the seller |
| `proteus_deal_status` | Balances read from the escrow on Arc |

## Use it

```json
{
  "mcpServers": {
    "proteus": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/proteus/packages/mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "PROTEUS_API_URL": "https://ai.proteus.co.in",
        "PROTEUS_MAX_PREPAID_USDC": "5",
        "PROTEUS_BUYER_PRIVATE_KEY": "0x... (optional; omit to sign with a Circle Agent Wallet)"
      }
    }
  }
}
```

- `PROTEUS_MAX_PREPAID_USDC` is the mandate: the agent refuses to sign or fund any deal above it.
- Without `PROTEUS_BUYER_PRIVATE_KEY`, signing tools return the EIP-712 typed data and the `circle wallet sign typed-data` / `circle wallet execute` commands for a Circle Agent Wallet (Circle CLI, chains `ARC-TESTNET` / `ARC`).
- The agent refuses to sign when a registered seller's on-chain checks fail.

## Proven on Arc testnet

`scripts/agent-run.ts` drives the server the way an MCP client does: list, negotiate a trial, refuse above a $0.01 mandate, accept within the mandate, fund (approve `0xc49c4b14753cfde225983bb791265f00e0628b079c68439021d46865b54964a1`, fund `0xf9fc1f13627553d59b80aa72365af39a63a185452b019e18d28c1a8a5dc0f8c7`), call the service, settle (`0x64f606b7138bdcf6eaa90694a7e07028707777480907668e77f6ed2830d7bdda`).

Not yet run: the Circle Agent Wallet path end to end (it needs a Circle CLI login). Agent wallets are smart accounts (ERC-1271); the escrow verifies them through OpenZeppelin SignatureChecker.
