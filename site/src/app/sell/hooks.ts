import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, v1 } from "./v1";
import type { Me, ProductCreateBody } from "./types";

/** The account's /api/me, and whether it has settled (loaded, or known to be unavailable). */
export function useMe(): { me: Me | undefined; ready: boolean } {
  const a = useAuth();
  const settled = a.meStatus === "ready" || a.meStatus === "unauthorized" || a.meStatus === "error" || (a.meStatus === "idle" && a.ready && !a.authenticated);
  return { me: a.me, ready: a.ready && (settled || Boolean(a.me)) };
}

export const useSigner = (enabled = true) => useQuery({ queryKey: ["sell", "signer"], queryFn: () => v1.app.signer(), retry: false, enabled });

export function useRevokeSigner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => v1.app.revokeSigner(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sell", "signer"] }),
  });
}

/** POST /api/orgs when the user has no org yet, then POST /api/app/products. */
export function usePublishProduct() {
  const qc = useQueryClient();
  const { refetchMe } = useAuth();
  return useMutation({
    mutationFn: async (v: { hasOrg: boolean; businessName: string; body: ProductCreateBody }) => {
      if (!v.hasOrg) await v1.createOrg({ name: v.businessName.trim() });
      return v1.app.createProduct(v.body);
    },
    onSettled: () => {
      refetchMe();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["sell"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
    },
  });
}
