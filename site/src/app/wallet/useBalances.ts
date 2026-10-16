import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { api, qk } from "../lib/api";
import { readNativeBalance, readUsdcBalance } from "../lib/wallet";
import type { Address } from "../lib/types";

export interface Balances {
  /** micro-USDC (ERC-20 view, 6 decimals) */
  usdc: bigint;
  /** wei (native view, 18 decimals). Same funds as `usdc`; gas is paid from it. */
  native: bigint;
  source: "chain" | "mock";
}

/** Reads the account wallet's balance from Arc testnet (mock mode: GET /api/me/wallet). */
export function useBalances(opts: { poll?: number | false; address?: Address | null } = {}) {
  const { wallet, mock } = useAuth();
  const address = opts.address ?? wallet?.address ?? null;
  return useQuery<Balances>({
    queryKey: qk.balances(address ?? "none"),
    enabled: Boolean(address),
    retry: 1,
    staleTime: 4_000,
    refetchInterval: opts.poll ?? false,
    queryFn: async () => {
      if (mock) {
        const w = await api.meWallet();
        return { usdc: BigInt(w.usdc), native: BigInt(w.native), source: "mock" };
      }
      const [usdc, native] = await Promise.all([readUsdcBalance(address!), readNativeBalance(address!)]);
      return { usdc, native, source: "chain" };
    },
  });
}

/** "1.234567" style decimal for a wei amount, trimmed to `digits` places. */
export function formatNative(wei: bigint, digits = 4): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, digits);
  return `${neg ? "-" : ""}${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}
