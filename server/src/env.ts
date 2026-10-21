import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_RPC, ARC_TESTNET_USDC, networkOf, setDefaultChainId } from "@proteus/domain";

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
  /** Circle user-controlled wallets app id (console > Wallets > User-controlled). With CIRCLE_API_KEY it enables Circle sign-in. */
  CIRCLE_APP_ID: z.string().optional(),
  /** Which sign-in the site offers: "circle" (email OTP + Circle wallet) or "privy". Defaults to circle when configured. */
  AUTH_PROVIDER: z.enum(["privy", "circle"]).optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-4.5"),

  /** Privy: tokens are verified against the app's public JWKS; no app secret is needed for that. */
  PRIVY_APP_ID: z.string().default("cmvb0p1b901l50fl20lp1eths"),
  PRIVY_JWKS_URL: z.string().optional(),
  /** Dev only: `x-dev-user: <id>` header impersonates a user when set to "1". Never enable in production. */
  PRIVY_DEV_BYPASS: z.string().optional(),
  /** Notifications. Email needs an SMTP URL (smtps://user:pass@host:465); Telegram needs a bot token from @BotFather. */
  SMTP_URL: z.string().optional(),
  NOTIFY_FROM: z.string().default("Proteus AI <notifications@proteus.co.in>"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  /** Dev only: let webhooks reach localhost/private addresses for local testing. Ignored in production. */
  NOTIFY_ALLOW_PRIVATE: z.string().optional(),
  /** Encrypts per-org seller signer keys at rest. */
  KEY_ENCRYPTION_SECRET: z.string().min(16).optional(),

  /** The other network's deployment of this product, shown as a switch in the app header (e.g. the mainnet URL on the testnet service). */
  PEER_NETWORK_URL: z.string().optional(),

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

// Seller signer keys are encrypted with KEY_ENCRYPTION_SECRET. Without it they fall back to SESSION_SECRET, which has a
// public default; on mainnet that is not acceptable, so refuse to start. Testnet keeps the fallback so existing keys stay readable.
if (!env.KEY_ENCRYPTION_SECRET) {
  if (networkOf(env.CHAIN_ID) === "mainnet") throw new Error("KEY_ENCRYPTION_SECRET is required on Arc mainnet: it encrypts every seller signer key.");
  if (env.NODE_ENV === "production") console.warn("[env] KEY_ENCRYPTION_SECRET is not set; seller signer keys are encrypted with SESSION_SECRET. Set it.");
}

setDefaultChainId(env.CHAIN_ID);

export const features = {
  /** "testnet" or "mainnet", from CHAIN_ID. Every label, explorer link and Circle chain code follows it. */
  network: networkOf(env.CHAIN_ID),
  openrouter: Boolean(env.OPENROUTER_API_KEY),
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  privyDevBypass: env.PRIVY_DEV_BYPASS === "1" && env.NODE_ENV !== "production",
  circle: Boolean(env.CIRCLE_API_KEY && env.CIRCLE_ENTITY_SECRET && env.CIRCLE_WALLET_ID),
  circleAuth: Boolean(env.CIRCLE_API_KEY && env.CIRCLE_APP_ID),
  /** Circle email sign-in creates a wallet on this chain; a TEST key cannot do that on mainnet (Circle refuses), so email is hidden there until a LIVE key is set. */
  circleEmail: Boolean(env.CIRCLE_API_KEY && env.CIRCLE_APP_ID) && !(networkOf(env.CHAIN_ID) === "mainnet" && env.CIRCLE_API_KEY!.startsWith("TEST_API_KEY")),
  authProvider: (env.AUTH_PROVIDER ?? (env.CIRCLE_API_KEY && env.CIRCLE_APP_ID ? "circle" : "privy")) as "privy" | "circle",
  viemRelayer: Boolean(env.RELAYER_PRIVATE_KEY),
  escrow: Boolean(env.ESCROW_ADDRESS),
  sellerSigner: Boolean(env.SELLER_SIGNER_PRIVATE_KEY),
  inviteGate: env.INVITE_GATE ? env.INVITE_GATE === "1" : env.NODE_ENV === "production",
  admin: Boolean(env.ADMIN_TOKEN),
};
