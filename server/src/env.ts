import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_RPC, ARC_TESTNET_USDC } from "@proteus/domain";

// Load server/.env (untracked) when present. Secrets never live in the repo.
for (const p of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "server/.env")]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
    } catch {
      /* ignore */
    }
    break;
  }
}

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const Env = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().default("http://localhost:5174"),
  DATABASE_URL: z.string().default("postgres://localhost:5432/proteus"),
  SESSION_SECRET: z.string().min(16).default("dev-only-session-secret-change-me"),

  ARC_RPC_URL: z.string().default(ARC_TESTNET_RPC),
  CHAIN_ID: z.coerce.number().default(ARC_TESTNET_CHAIN_ID),
  USDC_ADDRESS: address.default(ARC_TESTNET_USDC),
  ESCROW_ADDRESS: address.optional(),

  /** Delegated seller signer for the sandbox seller (server-held, narrowly scoped: signs Terms and Delivery only). */
  SELLER_SIGNER_PRIVATE_KEY: hex32.optional(),
  /** viem fallback relayer; funds createAndFundDeal/settle/refund gas. */
  RELAYER_PRIVATE_KEY: hex32.optional(),
  /** Owner wallet for the real seller console session (SIWE). */
  OWNER_ADDRESS: address.optional(),

  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_ENTITY_SECRET: z.string().optional(),
  CIRCLE_WALLET_ID: z.string().optional(),
  CIRCLE_WALLET_ADDRESS: address.optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),

  /** Grace window after term end before unused funds are refundable (seconds). */
  DEAL_GRACE_SECONDS: z.coerce.number().default(3 * 86400),
  RECONCILE_INTERVAL_MS: z.coerce.number().default(10_000),
});

export const env = Env.parse(process.env);

export const features = {
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  circle: Boolean(env.CIRCLE_API_KEY && env.CIRCLE_ENTITY_SECRET && env.CIRCLE_WALLET_ID),
  viemRelayer: Boolean(env.RELAYER_PRIVATE_KEY),
  escrow: Boolean(env.ESCROW_ADDRESS),
  sellerSigner: Boolean(env.SELLER_SIGNER_PRIVATE_KEY),
};
