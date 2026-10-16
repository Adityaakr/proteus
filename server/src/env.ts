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
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-4.5"),

  /** Privy: tokens are verified against the app's public JWKS; no app secret is needed for that. */
  PRIVY_APP_ID: z.string().default("cmvb0p1b901l50fl20lp1eths"),
  PRIVY_JWKS_URL: z.string().optional(),
  /** Dev only: `x-dev-user: <id>` header impersonates a user when set to "1". Never enable in production. */
  PRIVY_DEV_BYPASS: z.string().optional(),
  /** Encrypts per-org seller signer keys at rest. */
  KEY_ENCRYPTION_SECRET: z.string().min(16).optional(),

  /** Invite gate: "1" requires a redeemed invite code for every signed-in account (default on in production). "0" opens the product. */
  INVITE_GATE: z.string().optional(),
  /** Keys the HMAC of invite codes at rest; falls back to SESSION_SECRET. Changing it invalidates every code. */
  INVITE_PEPPER: z.string().min(16).optional(),
  /** Bearer token for the admin routes that mint, list and revoke invites. Unset disables them. */
  ADMIN_TOKEN: z.string().min(32).optional(),

  /** Circle x402 facilitator (keyless trial for the exact scheme; API key once registered). */
  X402_FACILITATOR_URL: z.string().default("https://api.circle.com/v1/facilitator/x402"),
  X402_NETWORK: z.string().default("eip155:5042002"),

  /** Grace window after term end before unused funds are refundable (seconds). */
  DEAL_GRACE_SECONDS: z.coerce.number().default(3 * 86400),
  RECONCILE_INTERVAL_MS: z.coerce.number().default(10_000),
});

export const env = Env.parse(process.env);

export const features = {
  openrouter: Boolean(env.OPENROUTER_API_KEY),
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  privyDevBypass: env.PRIVY_DEV_BYPASS === "1" && env.NODE_ENV !== "production",
  circle: Boolean(env.CIRCLE_API_KEY && env.CIRCLE_ENTITY_SECRET && env.CIRCLE_WALLET_ID),
  viemRelayer: Boolean(env.RELAYER_PRIVATE_KEY),
  escrow: Boolean(env.ESCROW_ADDRESS),
  sellerSigner: Boolean(env.SELLER_SIGNER_PRIVATE_KEY),
  inviteGate: env.INVITE_GATE ? env.INVITE_GATE === "1" : env.NODE_ENV === "production",
  admin: Boolean(env.ADMIN_TOKEN),
};
