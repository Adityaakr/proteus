#!/usr/bin/env tsx
/**
 * Proteus AI MCP server (stdio). Gives an AI agent (Claude, Cursor, any MCP client) tools to buy services from
 * businesses on Proteus AI: discover, negotiate within the seller's rules, verify the seller on Arc, sign and fund a
 * USDC escrow deal, call the service, and settle only for delivered units.
 *
 * Spending is bounded by a mandate the human sets: the agent cannot sign or fund a deal whose prepaid amount exceeds
 * PROTEUS_MAX_PREPAID_USDC, and it refuses to sign when the on-chain seller checks fail.
 *
 * Env:
 *   PROTEUS_API_URL            default https://ai.proteus.co.in (testnet); https://app.proteus.co.in for Arc mainnet
 *   PROTEUS_MAX_PREPAID_USDC   the mandate: largest prepaid per deal, in USDC (default 5)
 *   PROTEUS_BUYER_PRIVATE_KEY  optional. When set, the agent signs and funds itself (EOA). When absent, signing tools
 *                              return the EIP-712 typed data and the Circle CLI command for a Circle Agent Wallet.
 */
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { server } from "./server";

await server.connect(new StdioServerTransport());
